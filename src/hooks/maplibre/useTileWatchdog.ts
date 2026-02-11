/**
 * src/hooks/maplibre/useTileWatchdog.ts
 * 
 * Tile Watchdog: garante que o mapa nunca fique branco.
 * 
 * Monitora se tiles carregaram após map 'load'. Se não carregaram
 * após intervalos progressivos, troca o style para fallback raster.
 * 
 * Cascade de fallback (sem Google):
 * 1. CARTO Voyager (padrão)
 * 2. OSM tile.openstreetmap.org
 * 3. CARTO Light
 */

import { useEffect, useRef, MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';

// Fallback styles em cascata
const FALLBACK_STYLES: maplibregl.StyleSpecification[] = [
  // Fallback 1: CARTO Voyager (subdomínios a/b/c)
  {
    version: 8,
    name: 'Fallback-CARTO-Voyager',
    sources: {
      carto: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
          'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© CARTO © OpenStreetMap',
      },
    },
    layers: [{ id: 'carto-base', type: 'raster', source: 'carto' }],
  },
  // Fallback 2: OSM padrão
  {
    version: 8,
    name: 'Fallback-OSM',
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [{ id: 'osm-base', type: 'raster', source: 'osm' }],
  },
  // Fallback 3: CARTO Light
  {
    version: 8,
    name: 'Fallback-CARTO-Light',
    sources: {
      cartoLight: {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        ],
        tileSize: 256,
        attribution: '© CARTO © OpenStreetMap',
      },
    },
    layers: [{ id: 'carto-light-base', type: 'raster', source: 'cartoLight' }],
  },
];

interface UseTileWatchdogOptions {
  /** Intervalos de verificação em ms após map load */
  checkIntervals?: number[];
  /** Máximo de erros de rede antes de acionar fallback */
  maxNetworkErrors?: number;
  /** Janela de tempo para contar erros (ms) */
  errorWindowMs?: number;
}

const DEFAULT_CHECK_INTERVALS = [1500, 3000, 5000];
const DEFAULT_MAX_NETWORK_ERRORS = 6;
const DEFAULT_ERROR_WINDOW_MS = 3000;

/**
 * Hook que monitora se tiles estão carregando e aplica fallback automaticamente.
 */
export function useTileWatchdog(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  options: UseTileWatchdogOptions = {}
): void {
  const {
    checkIntervals = DEFAULT_CHECK_INTERVALS,
    maxNetworkErrors = DEFAULT_MAX_NETWORK_ERRORS,
    errorWindowMs = DEFAULT_ERROR_WINDOW_MS,
  } = options;

  const fallbackIndexRef = useRef(0);
  const networkErrorsRef = useRef<number[]>([]);
  const watchdogActiveRef = useRef(false);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const cleanup = () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };

    /**
     * Troca o style do mapa para o próximo fallback disponível.
     */
    const switchToFallback = () => {
      const map = mapRef.current;
      if (!map) return;

      const idx = fallbackIndexRef.current;
      if (idx >= FALLBACK_STYLES.length) {
        console.error('[TileWatchdog] Todos os fallbacks falharam');
        return;
      }

      const fallbackStyle = FALLBACK_STYLES[idx];
      console.warn(`[TileWatchdog] Trocando para fallback #${idx + 1}: ${fallbackStyle.name}`);

      // Salvar center/zoom atuais
      const center = map.getCenter();
      const zoom = map.getZoom();

      try {
        map.setStyle(fallbackStyle);

        // Restaurar center/zoom após style load
        map.once('styledata', () => {
          map.setCenter(center);
          map.setZoom(zoom);
          
          // Resize burst pós style change
          for (let i = 0; i < 5; i++) {
            setTimeout(() => {
              try { map.resize(); } catch {}
            }, i * 100);
          }
        });
      } catch (err) {
        console.error('[TileWatchdog] Erro ao trocar style:', err);
      }

      fallbackIndexRef.current = idx + 1;
      // Reset error count para o novo provider
      networkErrorsRef.current = [];
    };

    /**
     * Verifica se tiles estão carregados.
     */
    const checkTiles = () => {
      const map = mapRef.current;
      if (!map) return;

      try {
        const tilesLoaded = map.areTilesLoaded();
        
        if (!tilesLoaded) {
          console.warn('[TileWatchdog] Tiles NÃO carregados - tentando resize...');
          
          // Tentar resize primeiro
          map.resize();
          
          // Verificar novamente após 1s
          const retryTimer = setTimeout(() => {
            const map2 = mapRef.current;
            if (map2 && !map2.areTilesLoaded()) {
              console.warn('[TileWatchdog] Tiles ainda não carregados após resize - acionando fallback');
              switchToFallback();
            }
          }, 1000);
          timersRef.current.push(retryTimer);
        }
      } catch (err) {
        // map pode ter sido removido
      }
    };

    /**
     * Registra erro de rede e verifica limiar para fallback.
     */
    const onNetworkError = () => {
      const now = Date.now();
      networkErrorsRef.current.push(now);
      
      // Limpar erros fora da janela
      networkErrorsRef.current = networkErrorsRef.current.filter(
        t => now - t < errorWindowMs
      );

      if (networkErrorsRef.current.length >= maxNetworkErrors) {
        console.warn(`[TileWatchdog] ${maxNetworkErrors} erros de rede em ${errorWindowMs}ms - acionando fallback`);
        networkErrorsRef.current = [];
        switchToFallback();
      }
    };

    // Monitorar erros do mapa
    const errorHandler = (e: any) => {
      const message = e?.error?.message || '';
      const url = e?.source?.url || e?.url || '';
      
      // Erros de rede/tile
      if (
        message.includes('Failed to fetch') ||
        message.includes('NetworkError') ||
        message.includes('Load failed') ||
        message.includes('ERR_NETWORK') ||
        url.includes('basemaps.cartocdn.com') ||
        url.includes('tile.openstreetmap.org') ||
        url.includes('fonts.openmaptiles.org') ||
        url.includes('demotiles.maplibre.org')
      ) {
        if (import.meta.env.DEV) {
          console.warn('[TileWatchdog] Erro de rede:', message || url);
        }
        onNetworkError();
        return;
      }
    };

    map.on('error', errorHandler);

    // Agendar verificações após map load
    const onMapLoad = () => {
      if (watchdogActiveRef.current) return;
      watchdogActiveRef.current = true;

      checkIntervals.forEach(delay => {
        const timer = setTimeout(checkTiles, delay);
        timersRef.current.push(timer);
      });
    };

    if (map.isStyleLoaded()) {
      onMapLoad();
    } else {
      map.once('load', onMapLoad);
    }

    return () => {
      cleanup();
      try {
        map.off('error', errorHandler);
        map.off('load', onMapLoad);
      } catch {}
      watchdogActiveRef.current = false;
    };
  }, [mapRef.current]);
}
