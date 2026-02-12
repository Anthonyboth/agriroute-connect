/**
 * src/hooks/maplibre/useMapLibreMap.ts
 * 
 * Hook principal para inicialização estável e única do mapa MapLibre.
 * 
 * ✅ P1: Aguarda container com dimensões > 0 via ResizeObserver
 * ✅ P3: Fallback de style URL → inline raster (sem glyphs)
 * ✅ DEV logs: container size, style source, isReady
 */

import { useRef, useState, useEffect, useCallback, MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { RURAL_STYLE_URL, RURAL_STYLE_INLINE, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/config/maplibre';
import { useMapLibreSafeRaf } from './useMapLibreSafeRaf';
import { useMapLibreAutoResize } from './useMapLibreAutoResize';
import { useTileWatchdog } from './useTileWatchdog';

export interface UseMapLibreMapOptions {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  center?: [number, number];
  zoom?: number;
  styleUrl?: string;
  showNavigationControl?: boolean;
  controlPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  onLoad?: (map: maplibregl.Map) => void;
  onError?: (error: Error) => void;
  onClick?: (lngLat: { lng: number; lat: number }) => void;
  attributionControl?: boolean;
}

export interface UseMapLibreMapResult {
  mapRef: MutableRefObject<maplibregl.Map | null>;
  isLoading: boolean;
  error: string | null;
  isReady: boolean;
}

function isNetworkTileError(error: any): boolean {
  const message = error?.message || error?.error?.message || '';
  const url = error?.source?.url || error?.url || '';
  if (message.includes('Failed to fetch')) return true;
  if (message.includes('NetworkError')) return true;
  if (message.includes('Load failed')) return true;
  if (message.includes('ERR_NETWORK')) return true;
  if (url.includes('tile.openstreetmap.org')) return true;
  if (url.includes('basemaps.cartocdn.com')) return true;
  if (url.includes('demotiles.maplibre.org')) return true;
  if (url.includes('fonts.openmaptiles.org')) return true;
  return false;
}

export function useMapLibreMap(options: UseMapLibreMapOptions): UseMapLibreMapResult {
  const {
    containerRef,
    center = DEFAULT_CENTER,
    zoom = DEFAULT_ZOOM,
    styleUrl = RURAL_STYLE_URL,
    showNavigationControl = true,
    controlPosition = 'top-right',
    onLoad,
    onError,
    onClick,
    attributionControl = true,
  } = options;

  const mapRef = useRef<maplibregl.Map | null>(null);
  const initializingRef = useRef(false);
  const networkErrorCountRef = useRef(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const { raf, timeout, cancelAll } = useMapLibreSafeRaf();

  useMapLibreAutoResize(mapRef, containerRef, { debug: false });
  useTileWatchdog(mapRef);

  /**
   * ✅ P3: Tenta carregar style via fetch, fallback para inline raster (sem glyphs)
   */
  const loadStyle = useCallback(async (): Promise<maplibregl.StyleSpecification | string> => {
    if (!styleUrl || styleUrl === RURAL_STYLE_URL) {
      try {
        const response = await fetch(RURAL_STYLE_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (import.meta.env.DEV) {
          console.log('[MapLibre] ✅ Style carregado via URL:', RURAL_STYLE_URL);
        }
        return json;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[MapLibre] ⚠️ Falha ao carregar style URL, usando INLINE raster (sem glyphs):', err);
        }
        return RURAL_STYLE_INLINE;
      }
    }
    return styleUrl;
  }, [styleUrl]);

  // Inicialização do mapa
  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;
    if (mapRef.current) return;
    if (initializingRef.current) return;

    const tryInit = async () => {
      const rect = container.getBoundingClientRect();
      
      if (rect.width <= 0 || rect.height <= 0) {
        if (import.meta.env.DEV) {
          console.log('[MapLibre] Container com dimensões 0 - aguardando resize...', { w: rect.width, h: rect.height });
        }
        return false;
      }

      initializingRef.current = true;

      try {
        const style = await loadStyle();

        if (mapRef.current) {
          initializingRef.current = false;
          return true;
        }

        if (import.meta.env.DEV) {
          console.log('[MapLibre] 🗺️ Criando mapa — container:', { w: rect.width, h: rect.height });
        }

        const map = new maplibregl.Map({
          container,
          style,
          center,
          zoom,
          attributionControl: attributionControl ? { compact: true } : false,
          pixelRatio: window.devicePixelRatio || 1,
        });

        if (showNavigationControl) {
          map.addControl(new maplibregl.NavigationControl(), controlPosition);
        }

        if (onClick) {
          map.on('click', (e) => {
            onClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          });
        }

        map.on('load', () => {
          setIsLoading(false);
          setIsReady(true);
          networkErrorCountRef.current = 0;
          if (import.meta.env.DEV) {
            console.log('[MapLibre] ✅ Mapa inicializado com sucesso — isReady=true');
          }
          onLoad?.(map);
        });

        map.on('error', (e) => {
          if (isNetworkTileError(e)) {
            networkErrorCountRef.current++;
            if (networkErrorCountRef.current <= 3) {
              console.warn('[MapLibre] Erro de rede (tile/glyph):', e.error?.message);
            }
            return;
          }
          
          const errorMsg = e.error?.message || 'Erro ao carregar o mapa';
          console.error('[MapLibre] Erro crítico:', e);
          setError(errorMsg);
          setIsLoading(false);
          onError?.(new Error(errorMsg));
        });

        mapRef.current = map;
        initializingRef.current = false;
        return true;

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro ao inicializar o mapa';
        console.error('[MapLibre] Erro de inicialização:', err);
        setError(errorMsg);
        setIsLoading(false);
        initializingRef.current = false;
        onError?.(err instanceof Error ? err : new Error(errorMsg));
        return true;
      }
    };

    tryInit().then((initialized) => {
      if (initialized) return;
      
      const waitObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          if (width > 0 && height > 0 && !mapRef.current && !initializingRef.current) {
            if (import.meta.env.DEV) {
              console.log('[MapLibre] Container agora tem dimensões válidas:', { width, height });
            }
            waitObserver.disconnect();
            tryInit();
          }
        }
      });
      waitObserver.observe(container);
      
      const cleanup = () => waitObserver.disconnect();
      container.addEventListener('__maplibre_cleanup', cleanup, { once: true });
    });

    return () => {
      cancelAll();
      containerRef.current?.dispatchEvent(new Event('__maplibre_cleanup'));
      
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn('[MapLibre] Erro ao remover mapa:', e);
        }
        mapRef.current = null;
      }
      
      initializingRef.current = false;
    };
  }, []); // Dependências vazias - inicializa apenas uma vez

  return { mapRef, isLoading, error, isReady };
}
