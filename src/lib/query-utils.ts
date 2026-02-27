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
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const timeoutError = new Error(`Timeout: ${operationName} excedeu ${timeoutMs}ms`);
        (timeoutError as any).isTimeout = true;
        (timeoutError as any).operationName = operationName;
        reject(timeoutError);
      }, timeoutMs);
    });

    try {
      if (import.meta.env.DEV) {
        console.log(`[QueryUtils] ${operationName} - Tentativa ${attemptNumber + 1}/${retries + 1}`);
      }
      const result = await Promise.race([queryFn(), timeoutPromise]);
      if (import.meta.env.DEV) {
        console.log(`[QueryUtils] ${operationName} - Sucesso`);
      }
      return result;
    } catch (error: any) {
      const isTimeout = (error as any)?.isTimeout === true || error.message?.includes('Timeout');
      const isInfiniteRecursion = error.code === '42P17' || error.message?.includes('infinite recursion detected in policy');
      
      // Log detalhado do erro - usar warn para timeouts (não dispara monitor)
      const logFn = isTimeout ? console.warn : console.error;
      logFn(`[QueryUtils] ${operationName} - Erro:`, JSON.stringify({
        message: error.message,
        isTimeout,
        isInfiniteRecursion,
        attempt: attemptNumber + 1,
        retriesLeft: retries - attemptNumber
      }));

      // CRÍTICO: Não retry em casos de recursão infinita de RLS
      if (isInfiniteRecursion) {
        console.error(`[QueryUtils] ${operationName} - Recursão infinita detectada em policy RLS. Não será feito retry.`);
        throw new Error('Erro de configuração de segurança. Aguarde alguns instantes e tente novamente.');
      }

      // Se ainda temos tentativas e não é erro de autenticação
      if (attemptNumber < retries && !error.message?.includes('JWT')) {
        if (import.meta.env.DEV) console.log(`[QueryUtils] ${operationName} - Tentando novamente em ${retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        return executeQuery(attemptNumber + 1);
      }

      // Manter mensagem original do timeout
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
      if (import.meta.env.DEV) console.log(`[Subscription] Status: ${status}`);
      
      if (status === 'SUBSCRIPTION_ERROR' || status === 'CHANNEL_ERROR') {
        const error = new Error(`Erro na subscription: ${status}`);
        // Use warn instead of error to avoid triggering monitor bot as CRITICAL
        console.warn('[Subscription] Fallback to polling:', status);
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
 * Subscription with retry logic and exponential backoff
 */
export function subscriptionWithRetry(
  channelName: string,
  setupFn: (channel: any) => any,
  options: {
    maxRetries?: number;
    retryDelayMs?: number;
    onError?: (error: Error) => void;
    onStatusChange?: (status: string) => void;
    onReady?: (channel: any) => void;
  } = {}
): { getChannel: () => any; cleanup: () => void } {
  const { maxRetries = 3, retryDelayMs = 2000, onError, onStatusChange, onReady } = options;
  let retries = 0;
  let channel: any;
  let isCleanedUp = false;

  const setup = () => {
    if (isCleanedUp) return;

    const supabase = (window as any).__supabaseClient;
    if (!supabase) {
      console.error('[subscriptionWithRetry] Supabase client not available');
      return;
    }

    channel = supabase.channel(channelName);
    setupFn(channel);

    channel.on('system', { event: '*' }, (payload: any) => {
      if (isCleanedUp) return;

      // Notificar mudanças de status
      onStatusChange?.(payload.status);

      // Notificar quando conectado com sucesso
      if (payload.status === 'SUBSCRIBED') {
        if (import.meta.env.DEV) {
          console.log(`[subscriptionWithRetry] ${channelName} conectado com sucesso`);
        }
        onReady?.(channel);
      }

      if ((payload.status === 'CHANNEL_ERROR' || payload.status === 'SUBSCRIPTION_ERROR') && retries < maxRetries) {
        retries++;
        const delay = retryDelayMs * Math.pow(2, retries - 1); // Exponential backoff
        
        if (import.meta.env.DEV) {
          console.log(`[subscriptionWithRetry] ${channelName} erro, retry ${retries}/${maxRetries} em ${delay}ms`);
        }

        setTimeout(() => {
          if (!isCleanedUp) {
            supabase.removeChannel(channel);
            setup();
          }
        }, delay);
      } else if (payload.status === 'CHANNEL_ERROR' && retries >= maxRetries) {
        const error = new Error(`Subscription ${channelName} falhou após ${maxRetries} tentativas`);
        console.error('[subscriptionWithRetry]', error);
        onError?.(error);
      }
    });

    channel.subscribe();
  };

  // Delay initial connection by 1 second to allow auth to settle
  setTimeout(setup, 1000);

  return {
    getChannel: () => channel,
    cleanup: () => {
      isCleanedUp = true;
      const supabase = (window as any).__supabaseClient;
      if (supabase && channel) {
        supabase.removeChannel(channel);
      }
    }
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
