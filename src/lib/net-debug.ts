/**
 * src/lib/net-debug.ts
 * 
 * Logger leve de observabilidade de rede.
 * Registra cache hits/misses, dedupes e tempos de request.
 * Detecta possíveis loops de requisições.
 */

interface RequestLog {
  key: string;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  cacheHit: boolean;
  dedupeHit: boolean;
  error?: string;
}

const MAX_LOG_SIZE = 200;
const requestLogs: RequestLog[] = [];

// Contadores de requests por key em janela deslizante
const requestCounters = new Map<string, number[]>();

const LOOP_DETECTION_WINDOW_MS = 60_000; // 1 minuto
const LOOP_DETECTION_THRESHOLD = 10; // 10+ requests para mesma key = possível loop

/**
 * Registra início de um request
 */
export function logRequestStart(key: string, opts: { cacheHit: boolean; dedupeHit: boolean }): RequestLog {
  const log: RequestLog = {
    key,
    startedAt: Date.now(),
    cacheHit: opts.cacheHit,
    dedupeHit: opts.dedupeHit,
  };

  requestLogs.push(log);
  if (requestLogs.length > MAX_LOG_SIZE) {
    requestLogs.shift();
  }

  // Atualizar contador para detecção de loops
  trackRequestForLoop(key);

  return log;
}

/**
 * Registra fim de um request
 */
export function logRequestEnd(log: RequestLog, error?: string): void {
  log.endedAt = Date.now();
  log.durationMs = log.endedAt - log.startedAt;
  log.error = error;

  if (import.meta.env.DEV) {
    const status = error ? '❌' : '✅';
    const cacheLabel = log.cacheHit ? 'CACHE' : log.dedupeHit ? 'DEDUPE' : 'FETCH';
    console.log(
      `[net-debug] ${status} [${cacheLabel}] ${log.key} (${log.durationMs}ms)${error ? ` err: ${error}` : ''}`
    );
  }
}

/**
 * Rastreia requests para detecção de loops
 */
function trackRequestForLoop(key: string): void {
  const now = Date.now();
  const timestamps = requestCounters.get(key) || [];

  // Limpar entradas antigas (fora da janela)
  const recent = timestamps.filter(t => now - t < LOOP_DETECTION_WINDOW_MS);
  recent.push(now);
  requestCounters.set(key, recent);

  if (recent.length >= LOOP_DETECTION_THRESHOLD) {
    console.error(
      `⚠️ Possível loop de requisições detectado (${key}): ${recent.length} requests em ${LOOP_DETECTION_WINDOW_MS / 1000}s`
    );
  }
}

/**
 * Retorna estatísticas de requests recentes (debug)
 */
export function getRequestStats(): {
  total: number;
  cacheHits: number;
  dedupeHits: number;
  fetches: number;
  avgDurationMs: number;
  topKeys: { key: string; count: number }[];
} {
  const completed = requestLogs.filter(l => l.endedAt);
  const cacheHits = completed.filter(l => l.cacheHit).length;
  const dedupeHits = completed.filter(l => l.dedupeHit).length;
  const fetches = completed.filter(l => !l.cacheHit && !l.dedupeHit).length;

  const durations = completed.filter(l => l.durationMs).map(l => l.durationMs!);
  const avgDurationMs = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0;

  // Top keys por frequência
  const keyCounts = new Map<string, number>();
  for (const log of requestLogs) {
    keyCounts.set(log.key, (keyCounts.get(log.key) || 0) + 1);
  }
  const topKeys = Array.from(keyCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, count]) => ({ key, count }));

  return {
    total: completed.length,
    cacheHits,
    dedupeHits,
    fetches,
    avgDurationMs,
    topKeys,
  };
}

/**
 * Limpa logs (para testes)
 */
export function clearRequestLogs(): void {
  requestLogs.length = 0;
  requestCounters.clear();
}
