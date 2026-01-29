/**
 * Hook para operações de banco de dados Supabase com retry e tratamento de erros
 * Centraliza lógica comum de queries e mutations
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAsyncOperation } from './useAsyncOperation';

interface SupabaseQueryOptions {
  /** Mostrar toast de erro */
  showErrorToast?: boolean;
  /** Mensagem de erro customizada */
  errorMessage?: string;
  /** Número de retries */
  maxRetries?: number;
  /** Timeout em ms */
  timeout?: number;
}

interface SupabaseQueryResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  execute: () => Promise<T | null>;
  refetch: () => Promise<T | null>;
}

/**
 * Hook para executar queries SELECT com retry automático
 */
export function useSupabaseQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>,
  options: SupabaseQueryOptions = {}
): SupabaseQueryResult<T> {
  const {
    showErrorToast = false, // Silencioso por padrão para queries
    errorMessage,
    maxRetries = 2,
    timeout = 15000,
  } = options;

  const wrappedFn = useCallback(async (): Promise<T> => {
    const { data, error } = await queryFn();
    
    if (error) {
      console.error('[useSupabaseQuery] Erro:', error);
      throw new Error(error.message || 'Erro na consulta');
    }
    
    return data as T;
  }, [queryFn]);

  const { data, error, isLoading, execute } = useAsyncOperation<T>(wrappedFn, {
    maxRetries,
    timeout,
    showErrorToast,
    errorMessage,
  });

  return {
    data,
    error,
    isLoading,
    execute,
    refetch: execute,
  };
}

/**
 * Hook para executar mutations (INSERT, UPDATE, DELETE) com segurança
 */
export function useSupabaseMutation<TInput, TOutput = any>(
  mutationFn: (input: TInput) => Promise<{ data: TOutput | null; error: any }>,
  options: SupabaseQueryOptions & {
    onSuccess?: (data: TOutput) => void;
    onError?: (error: Error) => void;
    successMessage?: string;
  } = {}
) {
  const {
    showErrorToast = true, // Mostrar erros por padrão em mutations
    errorMessage,
    maxRetries = 1, // Menos retries para mutations
    timeout = 15000,
    onSuccess,
    onError,
    successMessage,
  } = options;

  const executingRef = useRef(false);

  const wrappedFn = useCallback(async (input: TInput): Promise<TOutput> => {
    // Prevenir execução duplicada
    if (executingRef.current) {
      throw new Error('Operação já em andamento');
    }

    executingRef.current = true;

    try {
      const { data, error } = await mutationFn(input);
      
      if (error) {
        console.error('[useSupabaseMutation] Erro:', error);
        throw new Error(error.message || 'Erro na operação');
      }
      
      if (successMessage) {
        toast({
          title: 'Sucesso',
          description: successMessage,
        });
      }
      
      onSuccess?.(data as TOutput);
      return data as TOutput;
    } finally {
      executingRef.current = false;
    }
  }, [mutationFn, successMessage, onSuccess]);

  const { data, error, isLoading, execute, reset } = useAsyncOperation<TOutput>(
    wrappedFn as any,
    {
      maxRetries,
      timeout,
      showErrorToast,
      errorMessage,
      onError,
    }
  );

  const mutate = useCallback((input: TInput) => {
    return execute(input);
  }, [execute]);

  return {
    data,
    error,
    isLoading,
    mutate,
    reset,
  };
}

/**
 * Hook para executar RPCs do Supabase
 */
export function useSupabaseRpc<TParams extends Record<string, any>, TResult = any>(
  rpcName: string,
  options: SupabaseQueryOptions & {
    onSuccess?: (data: TResult) => void;
    onError?: (error: Error) => void;
  } = {}
) {
  const {
    showErrorToast = true,
    errorMessage,
    maxRetries = 2,
    timeout = 15000,
    onSuccess,
    onError,
  } = options;

  const callRpc = useCallback(async (params: TParams): Promise<TResult> => {
    const { data, error } = await supabase.rpc(rpcName as any, params as any);
    
    if (error) {
      console.error(`[useSupabaseRpc] Erro em ${rpcName}:`, error);
      throw new Error(error.message || `Erro ao executar ${rpcName}`);
    }
    
    onSuccess?.(data as TResult);
    return data as TResult;
  }, [rpcName, onSuccess]);

  const { data, error, isLoading, execute, reset } = useAsyncOperation<TResult>(
    callRpc as any,
    {
      maxRetries,
      timeout,
      showErrorToast,
      errorMessage: errorMessage || `Erro ao executar ${rpcName}`,
      onError,
    }
  );

  const call = useCallback((params: TParams) => {
    return execute(params);
  }, [execute]);

  return {
    data,
    error,
    isLoading,
    call,
    reset,
  };
}

/**
 * Hook para verificar conexão com Supabase
 */
export function useSupabaseHealth() {
  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      const start = performance.now();
      const { error } = await supabase.from('profiles').select('id').limit(1);
      const latency = performance.now() - start;
      
      if (error) {
        console.warn('[useSupabaseHealth] Erro:', error);
        return false;
      }
      
      console.log(`[useSupabaseHealth] OK - ${latency.toFixed(0)}ms`);
      return true;
    } catch (err) {
      console.error('[useSupabaseHealth] Falha:', err);
      return false;
    }
  }, []);

  const { data: isHealthy, isLoading, execute } = useAsyncOperation<boolean>(
    checkHealth,
    {
      showErrorToast: false,
      maxRetries: 1,
      timeout: 10000,
    }
  );

  return {
    isHealthy: isHealthy ?? null,
    isChecking: isLoading,
    check: execute,
  };
}
