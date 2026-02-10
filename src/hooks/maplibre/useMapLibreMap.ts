/**
 * src/hooks/maplibre/useMapLibreMap.ts
 * 
 * Hook principal para inicialização estável e única do mapa MapLibre.
 * 
 * Features:
 * - Criação única do mapa (guard anti-dupla inicialização)
 * - Fallback de style (URL → inline)
 * - Controles de navegação opcionais
 * - Cleanup correto no unmount
 * - Estado de loading e erro
 * - ✅ Tratamento resiliente de erros de rede (tiles/glyphs)
 */

import { useRef, useState, useEffect, useCallback, MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { RURAL_STYLE_URL, RURAL_STYLE_INLINE, DEFAULT_CENTER, DEFAULT_ZOOM } from '@/config/maplibre';
import { useMapLibreSafeRaf } from './useMapLibreSafeRaf';
import { useMapLibreAutoResize } from './useMapLibreAutoResize';

export interface UseMapLibreMapOptions {
  /** Ref do container DOM */
  containerRef: MutableRefObject<HTMLDivElement | null>;
  /** Centro inicial do mapa [lng, lat] */
  center?: [number, number];
  /** Zoom inicial */
  zoom?: number;
  /** URL do estilo (fallback para inline se falhar) */
  styleUrl?: string;
  /** Mostrar controles de navegação */
  showNavigationControl?: boolean;
  /** Posição dos controles */
  controlPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Callback quando mapa carregar */
  onLoad?: (map: maplibregl.Map) => void;
  /** Callback de erro */
  onError?: (error: Error) => void;
  /** Callback de click */
  onClick?: (lngLat: { lng: number; lat: number }) => void;
  /** Atribuição customizada */
  attributionControl?: boolean;
}

export interface UseMapLibreMapResult {
  /** Ref do mapa */
  mapRef: MutableRefObject<maplibregl.Map | null>;
  /** Se está carregando */
  isLoading: boolean;
  /** Erro se houver */
  error: string | null;
  /** Se o mapa foi carregado com sucesso */
  isReady: boolean;
}

/**
 * Verifica se erro é de rede (fetch/tile) que pode ser ignorado
 */
function isNetworkTileError(error: any): boolean {
  const message = error?.message || error?.error?.message || '';
  const url = error?.source?.url || error?.url || '';
  
  // Erros de fetch de tiles são esperados offline
  if (message.includes('Failed to fetch')) return true;
  if (message.includes('NetworkError')) return true;
  if (message.includes('Load failed')) return true;
  if (message.includes('ERR_NETWORK')) return true;
  
  // Erros de tiles específicos
  if (url.includes('tile.openstreetmap.org')) return true;
  if (url.includes('basemaps.cartocdn.com')) return true;
  if (url.includes('demotiles.maplibre.org')) return true;
  if (url.includes('fonts.openmaptiles.org')) return true;
  
  return false;
}

/**
 * Hook para inicialização estável do mapa MapLibre
 */
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

  // Auto-resize para containers dinâmicos
  useMapLibreAutoResize(mapRef, containerRef, { debug: false });

  /**
   * Tenta carregar o style via fetch, retorna inline se falhar
   */
  const loadStyle = useCallback(async (): Promise<maplibregl.StyleSpecification | string> => {
    if (!styleUrl || styleUrl === RURAL_STYLE_URL) {
      try {
        const response = await fetch(RURAL_STYLE_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        console.log('[MapLibre] Style carregado via URL');
        return json;
      } catch (err) {
        console.warn('[MapLibre] Falha ao carregar style URL, usando inline:', err);
        return RURAL_STYLE_INLINE;
      }
    }
    return styleUrl;
  }, [styleUrl]);

  // Inicialização do mapa
  useEffect(() => {
    const container = containerRef.current;

    // Guards contra dupla inicialização
    if (!container) return;
    if (mapRef.current) return;
    if (initializingRef.current) return;

    initializingRef.current = true;

    const initMap = async () => {
      try {
        const style = await loadStyle();

        // Verificar novamente após async
        if (mapRef.current) {
          initializingRef.current = false;
          return;
        }

        const map = new maplibregl.Map({
          container,
          style,
          center,
          zoom,
          attributionControl: attributionControl ? {} : false,
          pixelRatio: window.devicePixelRatio || 1,
        });

        // Controles de navegação
        if (showNavigationControl) {
          map.addControl(new maplibregl.NavigationControl(), controlPosition);
        }

        // Click handler
        if (onClick) {
          map.on('click', (e) => {
            onClick({ lng: e.lngLat.lng, lat: e.lngLat.lat });
          });
        }

        // Load handler
        map.on('load', () => {
          setIsLoading(false);
          setIsReady(true);
          networkErrorCountRef.current = 0; // Reset error count on load
          console.log('[MapLibre] Mapa inicializado com sucesso');
          onLoad?.(map);
        });

        // Error handler - com filtro para erros de rede
        map.on('error', (e) => {
          // Ignorar erros de rede de tiles (esperados quando offline)
          if (isNetworkTileError(e)) {
            networkErrorCountRef.current++;
            // Log apenas a cada 10 erros para não poluir console
            if (networkErrorCountRef.current <= 3) {
              console.warn('[MapLibre] Erro de rede (tile/glyph) - esperado se offline:', e.error?.message);
            } else if (networkErrorCountRef.current === 4) {
              console.warn('[MapLibre] Múltiplos erros de rede detectados - suprimindo logs futuros');
            }
            // NÃO propagar como erro do mapa - é normal offline
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

      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Erro ao inicializar o mapa';
        console.error('[MapLibre] Erro de inicialização:', err);
        setError(errorMsg);
        setIsLoading(false);
        initializingRef.current = false;
        onError?.(err instanceof Error ? err : new Error(errorMsg));
      }
    };

    initMap();

    return () => {
      cancelAll();
      
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

  return {
    mapRef,
    isLoading,
    error,
    isReady,
  };
}
