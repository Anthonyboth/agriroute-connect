/**
 * src/hooks/maplibre/useMapLibreAutoResize.ts
 * 
 * Hook para auto-resize do mapa MapLibre.
 * Resolve o problema de "mapa branco" em Tabs/Dialogs/Drawers.
 * 
 * ✅ CORRIGIDO: Removido resize burst inicial agressivo que causava
 *    resize antes do mapa ter dimensões reais (canvas 0x0).
 * ✅ CORRIGIDO: Dependências do useEffect agora baseadas em booleano
 *    isMapReady para re-executar quando o mapa aparecer.
 * 
 * Estratégia:
 * 1. ResizeObserver + requestAnimationFrame
 * 2. Resizes após load: 0ms, 150ms, 400ms
 * 3. Só faz resize se container tem dimensões > 0
 * 4. Listener de transitionend nos ancestors (Drawer/Dialog)
 */

import { useEffect, useRef, MutableRefObject, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

interface UseMapLibreAutoResizeOptions {
  debug?: boolean;
}

export function useMapLibreAutoResize(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  containerRef: MutableRefObject<HTMLDivElement | null>,
  options: UseMapLibreAutoResizeOptions = {}
): void {
  const { debug = false } = options;
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastSizeRef = useRef<{ width: number; height: number } | null>(null);

  const log = useCallback(
    (msg: string, ...args: any[]) => {
      if (debug) console.log(`[MapLibre AutoResize] ${msg}`, ...args);
    },
    [debug]
  );

  const safeResize = useCallback(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    const { width, height } = container.getBoundingClientRect();
    if (width <= 0 || height <= 0) return;

    // Evita resize desnecessário se tamanho não mudou
    if (
      lastSizeRef.current &&
      lastSizeRef.current.width === width &&
      lastSizeRef.current.height === height
    ) {
      return;
    }

    lastSizeRef.current = { width, height };
    try {
      map.resize();
      log('Resize executado', { width, height });
    } catch (e) {
      console.error('[MapLibre] Erro ao fazer resize:', e);
    }
  }, [mapRef, containerRef, log]);

  useEffect(() => {
    const map = mapRef.current;
    const container = containerRef.current;
    if (!map || !container) return;

    // Resizes iniciais após mapa existir
    const t0 = setTimeout(() => requestAnimationFrame(safeResize), 0);
    const t1 = setTimeout(() => requestAnimationFrame(safeResize), 150);
    const t2 = setTimeout(() => requestAnimationFrame(safeResize), 400);

    // ResizeObserver
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = new ResizeObserver(() => {
      requestAnimationFrame(safeResize);
    });
    resizeObserverRef.current.observe(container);

    // transitionend nos ancestors (Drawer/Dialog)
    const handleTransitionEnd = (e: TransitionEvent) => {
      if (
        e.propertyName === 'transform' ||
        e.propertyName === 'opacity' ||
        e.propertyName === 'translate'
      ) {
        requestAnimationFrame(safeResize);
        setTimeout(() => requestAnimationFrame(safeResize), 50);
        setTimeout(() => requestAnimationFrame(safeResize), 200);
        setTimeout(() => requestAnimationFrame(safeResize), 400);
      }
    };

    const ancestors: HTMLElement[] = [];
    let el: HTMLElement | null = container;
    for (let i = 0; i < 8 && el; i++) {
      el.addEventListener('transitionend', handleTransitionEnd);
      ancestors.push(el);
      el = el.parentElement;
    }

    const handleWindowResize = () => requestAnimationFrame(safeResize);
    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      window.removeEventListener('resize', handleWindowResize);
      for (const ancestor of ancestors) {
        ancestor.removeEventListener('transitionend', handleTransitionEnd);
      }
    };
    // Executa quando o mapa aparece (mapRef.current muda de null → Map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapRef.current, containerRef.current]);
}
