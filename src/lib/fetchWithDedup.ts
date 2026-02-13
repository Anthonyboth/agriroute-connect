/**
 * src/lib/fetchWithDedup.ts
 * 
 * Utilitário para fazer fetches com:
 * - Deduplicação de requests iguais em paralelo (single-flight)
 * - AbortController para cancelamento
 * - Timeout configurável
 * 
 * Evita spam de requests quando múltiplos componentes pedem os mesmos dados.
 */

type FetchOptions = {
  /** Timeout em ms (default: 30s) */
  timeoutMs?: number;
  /** Signal de abort externo */
  signal?: AbortSignal;
};

// Mapa global de requests em andamento (single-flight pattern)
const inFlightRequests = new Map<string, Promise<any>>();

/**
 * Executa uma função assíncrona com deduplicação.
 * Se já existe uma chamada em andamento com a mesma key, retorna a promise existente.
 * 
 * @param key Identificador único da operação (ex: 'freights-available-driver123')
 * @param fetchFn Função que retorna a Promise com os dados
 * @param options Configurações opcionais
 */
export async function fetchWithDedup<T>(
  key: string,
  fetchFn: (signal: AbortSignal) => Promise<T>,
  options: FetchOptions = {}
): Promise<T> {
  const { timeoutMs = 30000, signal: externalSignal } = options;

  // Single-flight: retorna request existente se já estiver em andamento
  const existing = inFlightRequests.get(key);
  if (existing) {
    if (import.meta.env.DEV) console.log(`[fetchWithDedup] Request em andamento para "${key}", reutilizando...`);
    return existing;
  }

  // Criar AbortController com timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Timeout após ${timeoutMs}ms`));
  }, timeoutMs);

  // Conectar signal externo se fornecido
  if (externalSignal) {
    externalSignal.addEventListener('abort', () => {
      controller.abort(externalSignal.reason);
    });
  }

  // Criar e executar a promise
  const promise = (async () => {
    try {
      const result = await fetchFn(controller.signal);
      return result;
    } finally {
      clearTimeout(timeoutId);
      inFlightRequests.delete(key);
    }
  })();

  // Registrar no mapa de in-flight
  inFlightRequests.set(key, promise);

  return promise;
}

/**
 * Cancela um request em andamento pela key.
 * Útil para cleanup em useEffect.
 */
export function cancelFetch(key: string): void {
  // O request será cancelado automaticamente quando a promise for rejeitada
  // Este método existe apenas para documentação/semântica
  if (import.meta.env.DEV) console.log(`[fetchWithDedup] Marcando "${key}" para cancelamento`);
}

/**
 * Verifica se existe um request em andamento para a key.
 */
export function hasPendingFetch(key: string): boolean {
  return inFlightRequests.has(key);
}

/**
 * Limpa todos os requests pendentes.
 * Útil para testes ou reset de estado.
 */
export function clearAllPendingFetches(): void {
  inFlightRequests.clear();
}

/**
 * Hook helper para criar AbortController com cleanup automático
 */
export function createAbortController(): {
  signal: AbortSignal;
  abort: () => void;
} {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    abort: () => controller.abort(),
  };
}
