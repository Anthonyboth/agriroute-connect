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
  // Em projetos que incluem tipos Node, setTimeout pode tipar como "Timeout".
  // Usar globalThis mantém compatibilidade.
  const timersRef = useRef<Array<ReturnType<typeof globalThis.setTimeout>>>([]);

  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof globalThis.setInterval> | undefined;

    // Mantém referência do mapa em que o watchdog foi anexado
    const attachedMapRef = { current: null as maplibregl.Map | null };

    const cleanupTimers = () => {
      timersRef.current.forEach(globalThis.clearTimeout);
      timersRef.current = [];
    };

    const detach = (map: maplibregl.Map | null, errorHandler?: (e: any) => void, onMapLoad?: () => void) => {
      cleanupTimers();
      if (!map) return;
      try {
        if (errorHandler) map.off('error', errorHandler);
        if (onMapLoad) map.off('load', onMapLoad);
      } catch {
        // ignore
      }
      watchdogActiveRef.current = false;
    };

    /**
     * Tenta anexar o watchdog ao mapa assim que mapRef.current existir.
     * IMPORTANTE: alterações em ref.current não causam re-render; então precisamos de polling curto.
     */
    const tryAttach = () => {
      if (disposed) return;

      const map = mapRef.current;
      if (!map) return;

      // Já anexado neste mapa
      if (attachedMapRef.current === map) return;

      // Se tinha um mapa anterior anexado, desanexa (defensivo)
      detach(attachedMapRef.current);
      attachedMapRef.current = map;

      /**
       * Troca o style do mapa para o próximo fallback disponível.
       */
      const switchToFallback = () => {
        const liveMap = mapRef.current;
        if (!liveMap) return;

        const idx = fallbackIndexRef.current;
        if (idx >= FALLBACK_STYLES.length) {
          console.error('[TileWatchdog] Todos os fallbacks falharam');
          return;
        }

        const fallbackStyle = FALLBACK_STYLES[idx];
        console.warn(`[TileWatchdog] Trocando para fallback #${idx + 1}: ${fallbackStyle.name}`);

        // Salvar center/zoom atuais
        const center = liveMap.getCenter();
        const zoom = liveMap.getZoom();

        try {
          watchdogActiveRef.current = false;
          cleanupTimers();

          liveMap.setStyle(fallbackStyle);

          // Restaurar center/zoom após styledata
          liveMap.once('styledata', () => {
            try {
              liveMap.setCenter(center);
              liveMap.setZoom(zoom);
            } catch {
              // ignore
            }

            // Resize burst pós style change
            for (let i = 0; i < 7; i++) {
              const t = globalThis.setTimeout(() => {
                try {
                  liveMap.resize();
                } catch {
                  // ignore
                }
              }, i * 120);
              timersRef.current.push(t);
            }

            // Re-checagem após fallback
            const recheck = globalThis.setTimeout(() => {
              try {
                if (!liveMap.areTilesLoaded()) {
                  console.warn('[TileWatchdog] Tiles ainda não carregados após fallback');
                }
              } catch {
                // ignore
              }
            }, 1600);
            timersRef.current.push(recheck);
          });
        } catch (err) {
          console.error('[TileWatchdog] Erro ao trocar style:', err);
        }

        fallbackIndexRef.current = idx + 1;
        networkErrorsRef.current = [];
      };

      /**
       * Verifica se tiles estão carregados.
       */
      const checkTiles = () => {
        const liveMap = mapRef.current;
        if (!liveMap) return;

        try {
          if (!liveMap.areTilesLoaded()) {
            console.warn('[TileWatchdog] Tiles NÃO carregados - tentando resize...');
            liveMap.resize();

            const retryTimer = globalThis.setTimeout(() => {
              const liveMap2 = mapRef.current;
              if (liveMap2 && !liveMap2.areTilesLoaded()) {
                console.warn('[TileWatchdog] Tiles ainda não carregados após resize - acionando fallback');
                switchToFallback();
              }
            }, 1000);
            timersRef.current.push(retryTimer);
          }
        } catch {
          // ignore
        }
      };

      /**
       * Registra erro de rede e verifica limiar para fallback.
       */
      const onNetworkError = (reason?: string) => {
        const now = Date.now();
        networkErrorsRef.current.push(now);

        // Limpar erros fora da janela
        networkErrorsRef.current = networkErrorsRef.current.filter((t) => now - t < errorWindowMs);

        if (networkErrorsRef.current.length >= maxNetworkErrors) {
          console.warn(
            `[TileWatchdog] ${maxNetworkErrors} erros de rede em ${errorWindowMs}ms${reason ? ` (${reason})` : ''} - acionando fallback`,
          );
          networkErrorsRef.current = [];
          switchToFallback();
        }
      };

      // Monitorar erros do mapa
      const errorHandler = (e: any) => {
        const message = e?.error?.message || '';
        const url = e?.source?.url || e?.url || '';

        const isNetworkish =
          message.includes('Failed to fetch') ||
          message.includes('NetworkError') ||
          message.includes('Load failed') ||
          message.includes('ERR_NETWORK') ||
          url.includes('basemaps.cartocdn.com') ||
          url.includes('tile.openstreetmap.org') ||
          url.includes('fonts.openmaptiles.org') ||
          url.includes('demotiles.maplibre.org') ||
          url.includes('cartocdn.com') ||
          url.includes('openmaptiles.org');

        if (isNetworkish) {
          if (import.meta.env.DEV) {
            console.warn('[TileWatchdog] Erro de rede:', message || url);
          }
          onNetworkError(message || url);
          return;
        }
      };

      map.on('error', errorHandler);

      // Agendar verificações após map load
      const onMapLoad = () => {
        if (watchdogActiveRef.current) return;
        watchdogActiveRef.current = true;

        checkIntervals.forEach((delay) => {
          const timer = globalThis.setTimeout(checkTiles, delay);
          timersRef.current.push(timer);
        });
      };

      // Se o mapa nunca chegar em load (style URL bloqueado), força fallback após um tempo
      const forceFallbackTimer = globalThis.setTimeout(() => {
        const liveMap = mapRef.current;
        if (!liveMap) return;
        try {
          if (!liveMap.isStyleLoaded() || !liveMap.areTilesLoaded()) {
            console.warn('[TileWatchdog] Timeout sem tiles/style - acionando fallback');
            switchToFallback();
          }
        } catch {
          // ignore
        }
      }, 6500);
      timersRef.current.push(forceFallbackTimer);

      if (map.isStyleLoaded()) {
        onMapLoad();
      } else {
        map.once('load', onMapLoad);
      }

      // Se trocar para outro mapa no futuro, detach o anterior
      // (cleanup do effect também chama detach)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _attachedCleanup = () => detach(map, errorHandler, onMapLoad);
    };

    // Polling curto até mapRef.current existir
    pollTimer = globalThis.setInterval(tryAttach, 200);
    tryAttach();

    return () => {
      disposed = true;
      if (pollTimer) globalThis.clearInterval(pollTimer);
      detach(attachedMapRef.current);
      attachedMapRef.current = null;
    };
  }, [mapRef, checkIntervals, maxNetworkErrors, errorWindowMs]);
}
