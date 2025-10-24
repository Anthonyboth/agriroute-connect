// Global locks para prevenir múltiplas execuções simultâneas de operações críticas
interface GlobalLock {
  acquiredAt: number;
  timeoutHandle?: number;
  taskPromise?: Promise<any>;
  waiters: Array<{ resolve: (value: any) => void; reject: (error: any) => void }>;
}

const locks = new Map<string, GlobalLock>();
const logThrottle = new Map<string, number>();

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
    waiters: []
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
  if (lock) {
    if (lock.timeoutHandle) {
      window.clearTimeout(lock.timeoutHandle);
    }
    // Rejeitar todos os waiters pendentes
    lock.waiters.forEach(w => w.reject(new Error('Lock cleared')));
  }
  locks.delete(key);
}

export async function withLock<T>(
  key: string,
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT
): Promise<T | null> {
  if (!setLock(key, timeoutMs)) {
    // Throttle de logs: apenas 1 log a cada 5s por chave
    const now = Date.now();
    const lastLog = logThrottle.get(key) || 0;
    if (now - lastLog > 5000) {
      if (import.meta.env.DEV) {
        console.debug(`[GlobalLocks] Operação bloqueada por lock existente: "${key}"`);
      }
      logThrottle.set(key, now);
    }
    return null;
  }

  try {
    return await fn();
  } finally {
    clearLock(key);
  }
}

export async function withLockOrJoin<T>(
  key: string,
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_TIMEOUT,
  joinTimeoutMs: number = 1500
): Promise<T | null> {
  const existingLock = locks.get(key);
  
  // Se já existe um lock, tentar "join" (aguardar a operação em andamento)
  if (existingLock) {
    // Se houver uma taskPromise em andamento, aguardar ela
    if (existingLock.taskPromise) {
      try {
        const result = await Promise.race([
          existingLock.taskPromise,
          new Promise<null>((_, reject) => 
            setTimeout(() => reject(new Error('Join timeout')), joinTimeoutMs)
          )
        ]);
        return result as T;
      } catch (error) {
        // Join timeout ou erro - retornar null
        return null;
      }
    }
    
    // Sem taskPromise, aguardar na fila de waiters
    return new Promise<T | null>((resolve) => {
      const waiter = {
        resolve: (value: any) => resolve(value),
        reject: () => resolve(null)
      };
      existingLock.waiters.push(waiter);
      
      // Timeout para o waiter
      setTimeout(() => {
        const index = existingLock.waiters.indexOf(waiter);
        if (index > -1) {
          existingLock.waiters.splice(index, 1);
        }
        resolve(null);
      }, joinTimeoutMs);
    });
  }
  
  // Criar novo lock
  if (!setLock(key, timeoutMs)) {
    return null;
  }
  
  const lock = locks.get(key)!;
  
  try {
    // Criar e guardar a taskPromise
    const taskPromise = fn();
    lock.taskPromise = taskPromise;
    
    const result = await taskPromise;
    
    // Resolver todos os waiters com o resultado
    lock.waiters.forEach(w => w.resolve(result));
    lock.waiters = [];
    
    return result;
  } catch (error) {
    // Rejeitar todos os waiters em caso de erro
    lock.waiters.forEach(w => w.reject(error));
    lock.waiters = [];
    throw error;
  } finally {
    clearLock(key);
  }
}
