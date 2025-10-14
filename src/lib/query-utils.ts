/**
 * Query Utilities - Timeout e Error Handling para Supabase
 * 
 * Previne loading infinito e melhora UX com timeouts e retry logic
 */

export interface QueryOptions {
  timeoutMs?: number;
  operationName?: string;
  retries?: number;
  retryDelayMs?: number;
}

/**
 * Executa uma query com timeout automático
 * Previne travamentos quando a query demora muito
 */
export async function queryWithTimeout<T>(
  queryFn: () => Promise<T>,
  options: QueryOptions = {}
): Promise<T> {
  const {
    timeoutMs = 10000,
    operationName = 'query',
    retries = 0,
    retryDelayMs = 1000
  } = options;

  const executeQuery = async (attemptNumber: number = 0): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${operationName} excedeu ${timeoutMs}ms`)), timeoutMs)
    );

    try {
      console.log(`[QueryUtils] ${operationName} - Tentativa ${attemptNumber + 1}/${retries + 1}`);
      const result = await Promise.race([queryFn(), timeoutPromise]);
      console.log(`[QueryUtils] ${operationName} - Sucesso`);
      return result;
    } catch (error: any) {
      const isTimeout = error.message?.includes('Timeout');
      
      // Log detalhado do erro
      console.error(`[QueryUtils] ${operationName} - Erro:`, {
        message: error.message,
        isTimeout,
        attempt: attemptNumber + 1,
        retriesLeft: retries - attemptNumber
      });

      // Se ainda temos tentativas e não é erro de autenticação
      if (attemptNumber < retries && !error.message?.includes('JWT')) {
        console.log(`[QueryUtils] ${operationName} - Tentando novamente em ${retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        return executeQuery(attemptNumber + 1);
      }

      // Mensagens de erro amigáveis
      if (isTimeout) {
        throw new Error('A operação demorou muito tempo. Verifique sua conexão e tente novamente.');
      }
      
      throw error;
    }
  };

  return executeQuery();
}

/**
 * Wrapper para subscriptions real-time com error handling
 */
export function subscriptionWithErrorHandler(
  channel: any,
  onError?: (error: Error) => void
) {
  const originalSubscribe = channel.subscribe.bind(channel);
  
  channel.subscribe = (callback?: (status: string) => void) => {
    return originalSubscribe((status: string) => {
      console.log(`[Subscription] Status: ${status}`);
      
      if (status === 'SUBSCRIPTION_ERROR' || status === 'CHANNEL_ERROR') {
        const error = new Error(`Erro na subscription: ${status}`);
        console.error('[Subscription] Erro:', error);
        onError?.(error);
      }
      
      callback?.(status);
    });
  };
  
  return channel;
}

/**
 * Safe loading setter - garante que loading sempre será resetado
 */
export function withLoadingState<T>(
  setLoading: (loading: boolean) => void,
  asyncFn: () => Promise<T>
): Promise<T> {
  setLoading(true);
  return asyncFn().finally(() => setLoading(false));
}

/**
 * Debounce para queries frequentes
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), waitMs);
  };
}

/**
 * Cache simples com expiração
 */
export class QueryCache<T> {
  private cache = new Map<string, { data: T; timestamp: number }>();
  private ttl: number;

  constructor(ttlMinutes: number = 5) {
    this.ttl = ttlMinutes * 60 * 1000;
  }

  set(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  get(key: string): T | null {
    const cached = this.cache.get(key);
    
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > this.ttl;
    
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return cached.data;
  }

  clear(): void {
    this.cache.clear();
  }
}
