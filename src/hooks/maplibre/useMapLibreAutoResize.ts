/**
 * src/hooks/maplibre/useMapLibreAutoResize.ts
 * 
 * Hook para auto-resize do mapa MapLibre.
 * Resolve o problema de "mapa branco" e markers deslocados em Tabs/Dialogs/Panels.
 * 
 * ✅ ATUALIZADO: Agora inclui "resize burst" para Drawers com transform/scale
 * 
 * Estratégia:
 * 1. ResizeObserver + requestAnimationFrame
 * 2. Resizes em cascata após load: imediato, +150ms, +350ms, +600ms
 * 3. Só faz resize se container tem dimensões > 0
 * 4. ✅ Resize duplo em RAF para garantir sincronização com animações de Dialog/Drawer
 * 5. ✅ "Resize burst" contínuo por 500ms para Drawers com transform/scale
 * 6. ✅ Listener de transitionend no container pai
 */

import { useEffect, useRef, MutableRefObject, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapLibreSafeRaf } from './useMapLibreSafeRaf';

interface UseMapLibreAutoResizeOptions {
  /** Delays adicionais para resize após load (ms) */
  resizeDelays?: number[];
  /** Se deve logar informações de debug */
  debug?: boolean;
  /** Ativar resize burst para Drawers (recomendado para containers com animação) */
  enableResizeBurst?: boolean;
  /** Duração do resize burst em ms */
  burstDuration?: number;
}

// ✅ Delays otimizados para Dialog/Drawer animations (slide-in ~200ms + settle ~300ms)
// Inclui delays pós-animação para sincronizar com transitionend
const DEFAULT_RESIZE_DELAYS = [0, 50, 150, 250, 400, 600];
const DEFAULT_BURST_DURATION = 700;
const BURST_FRAME_COUNT = 20; // ~20 frames em 700ms para cobrir animações completas

/**
 * Hook que gerencia auto-resize do mapa em containers dinâmicos
 */
export function useMapLibreAutoResize(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  containerRef: MutableRefObject<HTMLDivElement | null>,
  options: UseMapLibreAutoResizeOptions = {}
): void {
  const {
    resizeDelays = DEFAULT_RESIZE_DELAYS,
    debug = false,
    enableResizeBurst = true,
    burstDuration = DEFAULT_BURST_DURATION,
  } = options;
  
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const { raf, timeout, cancelAll } = useMapLibreSafeRaf();
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);
  const burstActiveRef = useRef(false);

  const log = useCallback(
    (msg: string, ...args: any[]) => {
      if (debug) console.log(`[MapLibre AutoResize] ${msg}`, ...args);
    },
    [debug]
  );

  /**
   * Executa resize de forma segura
   * ✅ Resize duplo em RAF para sincronizar com animações
   */
  const safeResize = useCallback((force = false) => {
    try {
      const map = mapRef.current;
      const container = containerRef.current;

      if (!map || !container) return;

      // Só faz resize se container tem dimensões válidas
      const { width, height } = container.getBoundingClientRect();
      
      if (width <= 0 || height <= 0) {
        log('Ignorando resize - container sem dimensões', { width, height });
        return;
      }

      // Evita resize desnecessário se tamanho não mudou (a menos que force=true)
      if (
        !force &&
        lastSizeRef.current &&
        lastSizeRef.current.width === width &&
        lastSizeRef.current.height === height
      ) {
        return;
      }

      lastSizeRef.current = { width, height };
      
      // ✅ Resize duplo: primeiro resize + segundo em próximo frame
      // Isso garante sincronização após animações de Dialog/Drawer
      map.resize();
      requestAnimationFrame(() => {
        try {
          mapRef.current?.resize();
        } catch {}
      });
      
      log('Resize executado (duplo)', { width, height });
    } catch (error) {
      console.error('[MapLibre] Erro ao fazer resize:', error);
    }
  }, [mapRef, containerRef, log]);

  /**
   * ✅ Resize burst: múltiplos resizes em RAF por um período
   * Resolve problema de transform/scale em Drawers
   */
  const executeResizeBurst = useCallback(() => {
    if (burstActiveRef.current) return;
    burstActiveRef.current = true;

    log('Iniciando resize burst');

    let frameCount = 0;
    const interval = burstDuration / BURST_FRAME_COUNT;

    const burstFrame = () => {
      if (frameCount >= BURST_FRAME_COUNT) {
        burstActiveRef.current = false;
        log('Resize burst finalizado');
        return;
      }

      safeResize(true); // Force resize
      frameCount++;
      
      timeout(() => {
        raf(burstFrame);
      }, interval);
    };

    raf(burstFrame);
  }, [burstDuration, safeResize, raf, timeout, log]);

  /**
   * Agenda resizes após load
   * ✅ Múltiplos resizes para cobrir diferentes durações de animação
   */
  const scheduleResizes = useCallback(() => {
    resizeDelays.forEach((delay) => {
      if (delay === 0) {
        raf(() => safeResize());
      } else {
        timeout(() => raf(() => safeResize()), delay);
      }
    });

    // ✅ Executar burst se habilitado
    if (enableResizeBurst) {
      timeout(executeResizeBurst, 50);
    }
  }, [resizeDelays, raf, timeout, safeResize, enableResizeBurst, executeResizeBurst]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;

    if (!map || !container) return;

    // Executar resizes iniciais
    scheduleResizes();

    // Configurar ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current?.disconnect();

      resizeObserverRef.current = new ResizeObserver(() => {
        // Usar raf para evitar loop infinito de resize
        raf(() => safeResize());
      });

      resizeObserverRef.current.observe(container);
      log('ResizeObserver configurado');
    }

    // ✅ Listener de transitionend no container e ancestrais
    // Captura quando animações de Drawer/Dialog terminam
    const handleTransitionEnd = (e: TransitionEvent) => {
      // Reagir a transições de transform/opacity/translate (animações de Dialog/Drawer)
      if (
        e.propertyName === 'transform' ||
        e.propertyName === 'opacity' ||
        e.propertyName === 'translate'
      ) {
        log('TransitionEnd detectado:', e.propertyName);
        // ✅ Burst pós-animação mais agressivo para Dialog (slide-in-from-*)
        // O Dialog usa translate(-50%,-50%) permanente + slide-in temporário
        // Quando a animação termina, precisamos recalcular IMEDIATAMENTE
        raf(() => safeResize(true));
        timeout(() => safeResize(true), 16);  // próximo frame
        timeout(() => safeResize(true), 50);
        timeout(() => safeResize(true), 100);
        timeout(() => safeResize(true), 200);
        timeout(() => safeResize(true), 350);
        timeout(() => safeResize(true), 600);
      }
    };

    // Adicionar listener ao container e até 7 ancestrais
    // (Dialog/Drawer podem ter muitos wrappers: Portal > Overlay > Content > Tabs > TabsContent > Card > div)
    const ancestors: HTMLElement[] = [];
    let el: HTMLElement | null = container;
    for (let i = 0; i < 8 && el; i++) {
      el.addEventListener('transitionend', handleTransitionEnd);
      ancestors.push(el);
      el = el.parentElement;
    }

    // Também ouvir evento de resize da janela
    const handleWindowResize = () => {
      raf(() => safeResize());
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      cancelAll();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener('resize', handleWindowResize);
      // Remover listeners de todos os ancestrais registrados
      for (const ancestor of ancestors) {
        ancestor.removeEventListener('transitionend', handleTransitionEnd);
      }
      log('Cleanup executado');
    };
  }, [mapRef.current, containerRef.current, scheduleResizes, raf, timeout, cancelAll, safeResize, log]);
}
