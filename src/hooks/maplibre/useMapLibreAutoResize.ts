/**
 * src/hooks/maplibre/useMapLibreAutoResize.ts
 * 
 * Hook para auto-resize do mapa MapLibre.
 * Resolve o problema de "mapa branco" e markers deslocados em Tabs/Dialogs/Panels.
 * 
 * Estratégia:
 * 1. ResizeObserver + requestAnimationFrame
 * 2. Resizes em cascata após load: imediato, +150ms, +350ms, +600ms
 * 3. Só faz resize se container tem dimensões > 0
 * 4. ✅ Resize duplo em RAF para garantir sincronização com animações de Dialog/Drawer
 */

import { useEffect, useRef, MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { useMapLibreSafeRaf } from './useMapLibreSafeRaf';

interface UseMapLibreAutoResizeOptions {
  /** Delays adicionais para resize após load (ms) */
  resizeDelays?: number[];
  /** Se deve logar informações de debug */
  debug?: boolean;
}

// ✅ Delays otimizados para Dialog/Drawer animations (duration ~200-300ms)
const DEFAULT_RESIZE_DELAYS = [0, 150, 350, 600];

/**
 * Hook que gerencia auto-resize do mapa em containers dinâmicos
 */
export function useMapLibreAutoResize(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  containerRef: MutableRefObject<HTMLDivElement | null>,
  options: UseMapLibreAutoResizeOptions = {}
): void {
  const { resizeDelays = DEFAULT_RESIZE_DELAYS, debug = false } = options;
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const { raf, timeout, cancelAll } = useMapLibreSafeRaf();
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;

    if (!map || !container) return;

    const log = debug
      ? (msg: string, ...args: any[]) => console.log(`[MapLibre AutoResize] ${msg}`, ...args)
      : () => {};

    /**
     * Executa resize de forma segura
     * ✅ Resize duplo em RAF para sincronizar com animações
     */
    const safeResize = () => {
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

        // Evita resize desnecessário se tamanho não mudou
        if (
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
    };

    /**
     * Agenda resizes após load
     * ✅ Múltiplos resizes para cobrir diferentes durações de animação
     */
    const scheduleResizes = () => {
      resizeDelays.forEach((delay) => {
        if (delay === 0) {
          raf(safeResize);
        } else {
          timeout(() => raf(safeResize), delay);
        }
      });
    };

    // Executar resizes iniciais
    scheduleResizes();

    // Configurar ResizeObserver
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current?.disconnect();

      resizeObserverRef.current = new ResizeObserver((entries) => {
        // Usar raf para evitar loop infinito de resize
        raf(safeResize);
      });

      resizeObserverRef.current.observe(container);
      log('ResizeObserver configurado');
    }

    // Também ouvir evento de resize da janela
    const handleWindowResize = () => {
      raf(safeResize);
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      cancelAll();
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener('resize', handleWindowResize);
      log('Cleanup executado');
    };
  }, [mapRef.current, containerRef.current, resizeDelays, debug, raf, timeout, cancelAll]);
}
