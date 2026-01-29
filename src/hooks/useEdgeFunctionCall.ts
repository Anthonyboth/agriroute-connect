import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EdgeFunctionCallOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  showToastOnError?: boolean;
  onRetry?: (attempt: number, error: Error) => void;
}

interface EdgeFunctionCallResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
}

interface EdgeFunctionError extends Error {
  code?: string;
  status?: number;
  details?: string;
}

const DEFAULT_OPTIONS: EdgeFunctionCallOptions = {
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 30000,
  showToastOnError: true,
};

// Erros que NÃO devem ser retentados
const NON_RETRYABLE_ERRORS = [
  'ALREADY_ACCEPTED',
  'PENDING_CONFIRMATION',
  'INSUFFICIENT_BALANCE',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
];

// Mapa de códigos de erro para mensagens amigáveis
const ERROR_MESSAGES: Record<string, string> = {
  'ALREADY_ACCEPTED': 'Você já aceitou este frete',
  'PENDING_CONFIRMATION': 'Entrega aguardando confirmação do produtor',
  'INSUFFICIENT_BALANCE': 'Saldo insuficiente para esta operação',
  'UNAUTHORIZED': 'Sessão expirada. Por favor, faça login novamente',
  'FORBIDDEN': 'Você não tem permissão para esta ação',
  'NOT_FOUND': 'Recurso não encontrado',
  'NETWORK_ERROR': 'Erro de conexão. Verifique sua internet',
  'TIMEOUT': 'A operação demorou muito. Tente novamente',
  'SERVER_ERROR': 'Erro no servidor. Nossa equipe foi notificada',
};

function parseEdgeFunctionError(error: any): EdgeFunctionError {
  const edgeError = new Error() as EdgeFunctionError;
  
  // Tentar extrair detalhes do erro
  if (error?.context) {
    try {
      const context = typeof error.context === 'string' 
        ? JSON.parse(error.context) 
        : error.context;
      edgeError.code = context.code;
      edgeError.message = context.error || context.message || error.message;
      edgeError.details = context.details;
      edgeError.status = error.status;
    } catch {
      edgeError.message = error.message || 'Erro desconhecido';
    }
  } else if (error?.message) {
    edgeError.message = error.message;
  } else {
    edgeError.message = 'Erro desconhecido na Edge Function';
  }
  
  return edgeError;
}

function shouldRetry(error: EdgeFunctionError): boolean {
  // Não retentar erros de negócio
  if (error.code && NON_RETRYABLE_ERRORS.includes(error.code)) {
    return false;
  }
  
  // Não retentar erros 4xx (exceto 408 timeout, 429 rate limit)
  if (error.status && error.status >= 400 && error.status < 500) {
    if (error.status !== 408 && error.status !== 429) {
      return false;
    }
  }
  
  return true;
}

function getErrorMessage(error: EdgeFunctionError): string {
  if (error.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  
  if (error.message?.includes('Failed to fetch')) {
    return ERROR_MESSAGES['NETWORK_ERROR'];
  }
  
  if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
    return ERROR_MESSAGES['TIMEOUT'];
  }
  
  return error.message || 'Erro inesperado. Tente novamente.';
}

export function useEdgeFunctionCall<T = any>(
  functionName: string,
  options: EdgeFunctionCallOptions = {}
) {
  const [state, setState] = useState<EdgeFunctionCallResult<T>>({
    data: null,
    error: null,
    isLoading: false,
  });
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const invoke = useCallback(
    async (body?: Record<string, any>): Promise<T | null> => {
      // Cancelar chamada anterior se existir
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      setState({ data: null, error: null, isLoading: true });
      
      let lastError: EdgeFunctionError | null = null;
      let attempt = 0;
      
      while (attempt < (mergedOptions.maxRetries || 3)) {
        attempt++;
        
        try {
          console.log(`[EdgeFunction] ${functionName} - Tentativa ${attempt}/${mergedOptions.maxRetries}`);
          
          // Criar timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Timeout após ${mergedOptions.timeout}ms`));
            }, mergedOptions.timeout);
          });
          
          // Chamar edge function
          const invokePromise = supabase.functions.invoke(functionName, {
            body,
          });
          
          // Race entre chamada e timeout
          const { data, error } = await Promise.race([
            invokePromise,
            timeoutPromise.then(() => ({ data: null, error: { message: 'Timeout' } })),
          ]);
          
          if (error) {
            lastError = parseEdgeFunctionError(error);
            
            // Verificar se deve retentar
            if (!shouldRetry(lastError) || attempt >= (mergedOptions.maxRetries || 3)) {
              throw lastError;
            }
            
            // Callback de retry
            if (mergedOptions.onRetry) {
              mergedOptions.onRetry(attempt, lastError);
            }
            
            // Aguardar antes de retentar (backoff exponencial)
            const delay = (mergedOptions.retryDelay || 1000) * Math.pow(2, attempt - 1);
            console.log(`[EdgeFunction] ${functionName} - Aguardando ${delay}ms antes de retentar`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          
          // Sucesso!
          console.log(`[EdgeFunction] ${functionName} - Sucesso na tentativa ${attempt}`);
          setState({ data: data as T, error: null, isLoading: false });
          return data as T;
          
        } catch (error) {
          lastError = error instanceof Error 
            ? parseEdgeFunctionError(error)
            : parseEdgeFunctionError({ message: 'Erro desconhecido' });
          
          // Verificar se deve retentar
          if (!shouldRetry(lastError) || attempt >= (mergedOptions.maxRetries || 3)) {
            break;
          }
          
          // Callback de retry
          if (mergedOptions.onRetry) {
            mergedOptions.onRetry(attempt, lastError);
          }
          
          // Aguardar antes de retentar
          const delay = (mergedOptions.retryDelay || 1000) * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
      
      // Todas as tentativas falharam
      const errorMessage = getErrorMessage(lastError!);
      console.error(`[EdgeFunction] ${functionName} - Falhou após ${attempt} tentativas:`, lastError);
      
      if (mergedOptions.showToastOnError) {
        toast.error(errorMessage, {
          description: lastError?.details,
          duration: 5000,
        });
      }
      
      setState({ data: null, error: lastError, isLoading: false });
      return null;
    },
    [functionName, mergedOptions]
  );

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const reset = useCallback(() => {
    cancel();
    setState({ data: null, error: null, isLoading: false });
  }, [cancel]);

  return {
    ...state,
    invoke,
    cancel,
    reset,
  };
}

// Hook específico para aceitar fretes com tratamento especial
export function useAcceptFreight() {
  const { invoke, ...rest } = useEdgeFunctionCall<{
    success: boolean;
    assignments?: any[];
    message?: string;
  }>('accept-freight-multiple', {
    maxRetries: 2,
    timeout: 45000,
    showToastOnError: false, // Tratamos manualmente
    onRetry: (attempt) => {
      toast.info(`Tentando novamente... (${attempt}/2)`, { duration: 2000 });
    },
  });

  const acceptFreight = useCallback(
    async (freightId: string, numTrucks: number = 1) => {
      const result = await invoke({
        freight_id: freightId,
        num_trucks: numTrucks,
      });
      
      if (result?.success) {
        toast.success('Frete aceito com sucesso! 🚚', {
          description: 'Confira os detalhes na sua dashboard',
        });
      }
      
      return result;
    },
    [invoke]
  );

  return {
    acceptFreight,
    ...rest,
  };
}

// Hook genérico para monitorar saúde das edge functions
export function useEdgeFunctionsHealth() {
  const { invoke, ...rest } = useEdgeFunctionCall<{
    success: boolean;
    summary: {
      total: number;
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
    results: any[];
  }>('edge-functions-health-monitor', {
    maxRetries: 1,
    timeout: 60000,
    showToastOnError: false,
  });

  const checkHealth = useCallback(() => invoke(), [invoke]);

  return {
    checkHealth,
    ...rest,
  };
}
