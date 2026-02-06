/**
 * src/lib/requestDeduplicator.ts
 *
 * Camada de proteção contra requests duplicados simultâneos.
 * Wrapper sobre fetchWithDedup com:
 * - Bloqueio de requests idênticos em voo
 * - Reuso de Promise ativa
 * - Log de tentativa de duplicação (dev)
 * - Tracking de requests ativos
 * - Timeout configurável
 *
 * Todos os fetches críticos DEVEM passar por este módulo:
 * freights, service_requests, proposals, profiles, mapas (tracking)
 */

import { fetchWithDedup, hasPendingFetch } from './fetchWithDedup';

// ── Tipos ─────────────────────────────────────────────────────

export interface DedupOptions {
  /** Timeout em ms (padrão: 30s) */
  timeoutMs?: number;
  /** Signal de abort externo */
  signal?: AbortSignal;
  /** Tag para logs (ex: 'freights', 'profiles') */
  tag?: string;
}

export interface DedupStats {
  /** Total de requests executados */
  totalRequests: number;
  /** Total de duplicatas bloqueadas */
  totalDeduped: number;
  /** Requests ativos agora */
  activeRequests: number;
  /** Keys dos requests ativos */
  activeKeys: string[];
}

// ── Estado global ─────────────────────────────────────────────

let totalRequests = 0;
let totalDeduped = 0;
const activeKeys = new Set<string>();

// ── Funções principais ───────────────────────────────────────

/**
 * Executa um fetch deduplicado.
 * Se já existe request com mesma key em andamento, reutiliza a Promise.
 *
 * @example
 * const freights = await dedupFetch(
 *   'freights-driver-123',
 *   (signal) => supabase.from('freights').select('*').abortSignal(signal),
 *   { tag: 'freights' }
 * );
 */
export async function dedupFetch<T>(
  key: string,
  fetchFn: (signal: AbortSignal) => Promise<T>,
  options: DedupOptions = {}
): Promise<T> {
  const { tag = 'unknown' } = options;

  // Verificar se já existe request em voo
  if (hasPendingFetch(key)) {
    totalDeduped++;
    if (import.meta.env.DEV) {
      console.log(
        `[requestDeduplicator] 🔄 Duplicata bloqueada [${tag}] key="${key}" (total deduped: ${totalDeduped})`
      );
    }
  }

  totalRequests++;
  activeKeys.add(key);

  try {
    const result = await fetchWithDedup(key, fetchFn, {
      timeoutMs: options.timeoutMs,
      signal: options.signal,
    });
    return result;
  } finally {
    activeKeys.delete(key);
  }
}

/**
 * Verifica se um request específico está em andamento.
 */
export function isRequestActive(key: string): boolean {
  return hasPendingFetch(key) || activeKeys.has(key);
}

/**
 * Retorna estatísticas de deduplicação.
 */
export function getDedupStats(): DedupStats {
  return {
    totalRequests,
    totalDeduped,
    activeRequests: activeKeys.size,
    activeKeys: Array.from(activeKeys),
  };
}

/**
 * Reseta contadores (útil para testes).
 */
export function resetDedupStats(): void {
  totalRequests = 0;
  totalDeduped = 0;
  activeKeys.clear();
}

/**
 * Keys padrão para requests críticos.
 * Usar essas constantes para garantir consistência.
 */
export const DEDUP_KEYS = {
  freights: (userId: string) => `freights:${userId}`,
  serviceRequests: (userId: string) => `service-requests:${userId}`,
  proposals: (freightId: string) => `proposals:${freightId}`,
  profile: (profileId: string) => `profile:${profileId}`,
  profileByUid: (userId: string) => `profile-by-uid:${userId}`,
  tracking: (driverId: string) => `tracking:${driverId}`,
  vehicles: (ownerId: string) => `vehicles:${ownerId}`,
  chat: (chatKey: string) => `chat:${chatKey}`,
} as const;
