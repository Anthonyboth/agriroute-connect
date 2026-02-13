/**
 * Lazy import with automatic ChunkLoadError retry
 * 
 * Previne erros de "dynamically imported module" que acontecem
 * quando o browser tem cache antigo após deploy de nova versão.
 * 
 * Suporta opções de retry, delay e callback de erro.
 */
import { lazy, ComponentType } from 'react';

const RETRY_KEY = 'chunk_retry_count';
const CACHE_CLEARED_KEY = 'chunk_cache_cleared_at';

interface LazyWithRetryOptions {
  /** Número máximo de retries antes de falhar (default: 3) */
  retries?: number;
  /** Delay em ms entre tentativas (default: 1000) */
  delay?: number;
  /** Callback chamado em cada erro */
  onError?: (error: Error, attempt: number) => void;
}

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

function markCacheCleared(): void {
  try {
    sessionStorage.setItem(CACHE_CLEARED_KEY, Date.now().toString());
  } catch {}
}

function wasCacheRecentlyCleared(): boolean {
  try {
    const clearedAt = sessionStorage.getItem(CACHE_CLEARED_KEY);
    if (!clearedAt) return false;
    // Considera "recente" se limpou nos últimos 10 segundos
    return Date.now() - parseInt(clearedAt, 10) < 10000;
  } catch {
    return false;
  }
}

async function clearAllCaches(): Promise<void> {
  // 1. Limpa Cache Storage (PWA)
  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      if (import.meta.env.DEV) console.log('[lazyWithRetry] Cache Storage limpo:', keys.length, 'caches');
    } catch (e) {
      console.warn('[lazyWithRetry] Erro ao limpar Cache Storage:', e);
    }
  }

  // 2. Unregister Service Workers
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
      if (registrations.length > 0) {
        if (import.meta.env.DEV) console.log('[lazyWithRetry] Service Workers removidos:', registrations.length);
      }
    } catch (e) {
      console.warn('[lazyWithRetry] Erro ao remover Service Workers:', e);
    }
  }

  // 3. Limpa localStorage de cache antigo de versões
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('workbox') || key.startsWith('sw-') || key.startsWith('pwa'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    if (keysToRemove.length > 0) {
      if (import.meta.env.DEV) console.log('[lazyWithRetry] localStorage PWA limpo:', keysToRemove.length, 'keys');
    }
  } catch (e) {
    console.warn('[lazyWithRetry] Erro ao limpar localStorage:', e);
  }

  markCacheCleared();
}

async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wrapper para React.lazy com auto-retry em caso de ChunkLoadError.
 * Limpa caches e recarrega a página automaticamente após tentativas falharem.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options?: LazyWithRetryOptions
): React.LazyExoticComponent<T> {
  const maxRetries = options?.retries ?? 3;
  const delayMs = options?.delay ?? 1000;
  const onError = options?.onError;

  return lazy(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Tenta importar com cache-busting se não é primeira tentativa
        if (attempt > 0) {
          await wait(delayMs);
        }

        const module = await importFn();
        // Sucesso: limpa contador de retries
        clearRetryCount();
        return module;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        if (onError) {
          onError(lastError, attempt);
        }

        if (isChunkError(error)) {
          console.warn(`[lazyWithRetry] ChunkLoadError - tentativa ${attempt + 1}/${maxRetries}`);
          
          // Na primeira falha, limpa todos os caches
          if (attempt === 0 && !wasCacheRecentlyCleared()) {
            if (import.meta.env.DEV) console.log('[lazyWithRetry] Limpando todos os caches...');
            await clearAllCaches();
          }
        } else {
          // Não é erro de chunk, propaga imediatamente
          throw error;
        }
      }
    }

    // Todas as tentativas falharam
    console.error(`[lazyWithRetry] Todas as ${maxRetries} tentativas falharam. Recarregando página...`);
    
    // Força reload hard (ignora cache)
    incrementRetryCount();
    const currentRetries = getRetryCount();
    
    if (currentRetries <= 2) {
      // Ainda tem tentativas de página, recarrega
      window.location.reload();
      // Nunca retorna (página recarrega)
      return new Promise(() => {});
    } else {
      // Muitas tentativas de página, limpa e mostra erro
      clearRetryCount();
      throw lastError || new Error('Failed to load module after multiple retries');
    }
  });
}

export default lazyWithRetry;
