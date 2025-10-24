// Global locks para prevenir múltiplas execuções simultâneas de operações críticas
interface GlobalLock {
  acquiredAt: number;
  timeoutHandle?: number;
}

const locks = new Map<string, GlobalLock>();

const DEFAULT_TIMEOUT = 30000; // 30s

export function hasLock(key: string): boolean {
  return locks.has(key);
}

export function setLock(key: string, timeoutMs: number = DEFAULT_TIMEOUT): boolean {
  if (locks.has(key)) {
    return false; // Lock já existe
  }

  const lock: GlobalLock = {
    acquiredAt: Date.now(),
  };

  // Auto-release após timeout
  const timeoutHandle = window.setTimeout(() => {
    clearLock(key);
    console.warn(`[GlobalLocks] Lock "${key}" expirou após ${timeoutMs}ms`);
  }, timeoutMs);

  lock.timeoutHandle = timeoutHandle;
  locks.set(key, lock);

  return true;
}

export function clearLock(key: string): void {
  const lock = locks.get(key);
  if (lock?.timeoutHandle) {
    window.clearTimeout(lock.timeoutHandle);
  }
  locks.delete(key);
}

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<T | null> {
  if (!setLock(key, timeoutMs)) {
    console.warn(`[GlobalLocks] Operação bloqueada por lock existente: "${key}"`);
    return null;
  }

  try {
    return await fn();
  } finally {
    clearLock(key);
  }
}
