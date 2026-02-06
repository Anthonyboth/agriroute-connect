/**
 * src/hooks/useSafeMapLibre.ts
 *
 * Hook OBRIGATÓRIO para inicialização segura do mapa MapLibre.
 * Wrapper sobre useMapLibreMap com proteções adicionais:
 *
 * 1. Não inicializa se container não tem tamanho (width/height = 0)
 * 2. Retry automático com backoff curto (3 tentativas)
 * 3. ResizeObserver com debounce para containers dinâmicos
 * 4. Fallback visual PT-BR se mapa falhar
 * 5. Nunca trava render principal
 * 6. Log de segurança para diagnóstico
 *
 * PROIBIDO inicializar MapLibre direto em componente — use este hook.
 */

import { useRef, useState, useEffect, useCallback, MutableRefObject } from 'react';
import { useMapLibreMap, type UseMapLibreMapOptions, type UseMapLibreMapResult } from '@/hooks/maplibre/useMapLibreMap';

// =============================================================================
// TIPOS
// =============================================================================

export interface UseSafeMapLibreOptions extends Omit<UseMapLibreMapOptions, 'containerRef'> {
  /** Se o mapa deve ser habilitado (false = não inicializa) */
  enabled?: boolean;
  /** Número máximo de retentativas */
  maxRetries?: number;
  /** Delay base para retry (ms) */
  retryDelayMs?: number;
  /** Se está dentro de modal/drawer (força resize burst) */
  insideModal?: boolean;
}

export interface UseSafeMapLibreResult extends UseMapLibreMapResult {
  /** Ref do container DOM */
  containerRef: MutableRefObject<HTMLDivElement | null>;
  /** Se o container tem tamanho válido */
  containerReady: boolean;
  /** Número de tentativas realizadas */
  retryCount: number;
  /** Se o mapa falhou permanentemente */
  hasFailed: boolean;
  /** Mensagem de fallback PT-BR */
  fallbackMessage: string | null;
  /** Forçar retry manualmente */
  retryInit: () => void;
}

// =============================================================================
// CONSTANTES
// =============================================================================

const MIN_CONTAINER_SIZE = 50; // px mínimo para considerar container válido
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY = 500; // ms

// =============================================================================
// HOOK
// =============================================================================

export function useSafeMapLibre(
  options: UseSafeMapLibreOptions = {}
): UseSafeMapLibreResult {
  const {
    enabled = true,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY,
    insideModal = false,
    ...mapOptions
  } = options;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerReady, setContainerReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // ─── Container size validation via ResizeObserver ───
  useEffect(() => {
    if (!enabled) return;

    const checkSize = () => {
      const el = containerRef.current;
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const valid = rect.width >= MIN_CONTAINER_SIZE && rect.height >= MIN_CONTAINER_SIZE;
      return valid;
    };

    // Initial check
    if (checkSize()) {
      setContainerReady(true);
    }

    // ResizeObserver for dynamic containers
    const observer = new ResizeObserver(() => {
      if (checkSize()) {
        setContainerReady(true);
      }
    });

    observerRef.current = observer;

    // Observe after next frame to ensure container is mounted
    const raf = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) {
        observer.observe(el);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      observerRef.current = null;
    };
  }, [enabled]);

  // ─── Map initialization (only when container is ready) ───
  const shouldInit = enabled && containerReady && !hasFailed;

  const handleError = useCallback((error: Error) => {
    console.error('[SafeMapLibre] Erro de inicialização:', error.message);

    if (retryCount < maxRetries) {
      const delay = retryDelayMs * Math.pow(2, retryCount); // Exponential backoff
      console.warn(`[SafeMapLibre] Tentando novamente em ${delay}ms (tentativa ${retryCount + 1}/${maxRetries})`);

      retryTimerRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        // Container ready will re-trigger map init
        setContainerReady(false);
        requestAnimationFrame(() => {
          const el = containerRef.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            if (rect.width >= MIN_CONTAINER_SIZE && rect.height >= MIN_CONTAINER_SIZE) {
              setContainerReady(true);
            }
          }
        });
      }, delay);
    } else {
      console.error(`[SafeMapLibre] Falha permanente após ${maxRetries} tentativas`);
      setHasFailed(true);
      setFallbackMessage('Não foi possível carregar o mapa. Verifique sua conexão e tente novamente.');
    }

    mapOptions.onError?.(error);
  }, [retryCount, maxRetries, retryDelayMs, mapOptions]);

  // Use the base map hook with our container ref
  const mapResult = useMapLibreMap({
    ...mapOptions,
    containerRef,
    onError: shouldInit ? handleError : undefined,
    onLoad: (map) => {
      console.log('[SafeMapLibre] Mapa inicializado com sucesso');
      setHasFailed(false);
      setFallbackMessage(null);

      // Resize burst for modals/drawers
      if (insideModal) {
        let frame = 0;
        const burstResize = () => {
          if (frame < 15 && map) {
            try { map.resize(); } catch (_) { /* ignore */ }
            frame++;
            requestAnimationFrame(burstResize);
          }
        };
        requestAnimationFrame(burstResize);
      }

      mapOptions.onLoad?.(map);
    },
  });

  // ─── Manual retry ───
  const retryInit = useCallback(() => {
    setHasFailed(false);
    setFallbackMessage(null);
    setRetryCount(0);
    setContainerReady(false);

    requestAnimationFrame(() => {
      const el = containerRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width >= MIN_CONTAINER_SIZE && rect.height >= MIN_CONTAINER_SIZE) {
          setContainerReady(true);
        }
      }
    });
  }, []);

  // ─── Cleanup ───
  useEffect(() => {
    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  return {
    ...mapResult,
    containerRef,
    containerReady,
    retryCount,
    hasFailed,
    fallbackMessage,
    retryInit,
    // Override loading: show loading if container not ready or map loading
    isLoading: !containerReady || mapResult.isLoading,
    // Override error: include fallback message
    error: hasFailed ? fallbackMessage : mapResult.error,
  };
}
