/**
 * Lazy import with automatic ChunkLoadError retry
 * 
 * Previne erros de "dynamically imported module" que acontecem
 * quando o browser tem cache antigo após deploy de nova versão.
 */
import { lazy, ComponentType } from 'react';

const RETRY_KEY = 'chunk_retry_count';
const MAX_RETRIES = 2;

function isChunkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return /dynamically imported module|ChunkLoadError|Loading chunk.*failed|Failed to fetch/i.test(msg);
}

function getRetryCount(): number {
  try {
    return parseInt(sessionStorage.getItem(RETRY_KEY) || '0', 10);
  } catch {
    return 0;
  }
}

function incrementRetryCount(): number {
  const count = getRetryCount() + 1;
  try {
    sessionStorage.setItem(RETRY_KEY, String(count));
  } catch {}
  return count;
}

function clearRetryCount(): void {
  try {
    sessionStorage.removeItem(RETRY_KEY);
  } catch {}
}

/**
 * Wrapper para React.lazy com auto-retry em caso de ChunkLoadError.
 * Limpa caches e recarrega a página automaticamente.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      const module = await importFn();
      // Sucesso: limpa contador de retries
      clearRetryCount();
      return module;
    } catch (error) {
      if (isChunkError(error)) {
        const retries = getRetryCount();
        if (retries < MAX_RETRIES) {
          incrementRetryCount();
          console.warn(`[lazyWithRetry] ChunkLoadError - retry ${retries + 1}/${MAX_RETRIES}. Limpando cache e recarregando...`);
          
          // Limpa caches do browser
          if ('caches' in window) {
            try {
              const keys = await caches.keys();
              await Promise.all(keys.map(k => caches.delete(k)));
            } catch (e) {
              console.warn('[lazyWithRetry] Erro ao limpar caches:', e);
            }
          }
          
          // Recarrega a página
          window.location.reload();
          
          // Nunca retorna (página recarrega)
          return new Promise(() => {});
        } else {
          console.error('[lazyWithRetry] Max retries exceeded. Propagando erro.');
          clearRetryCount();
        }
      }
      throw error;
    }
  });
}

export default lazyWithRetry;
