/**
 * src/hooks/maplibre/useTileWatchdog.ts
 * 
 * Tile Watchdog: troca style APENAS quando erros reais de rede acumulam.
 * 
 * ✅ CORRIGIDO: Removido forceFallbackTimer que trocava style mesmo quando
 *    mapa estava funcionando (areTilesLoaded() é false transitório).
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
  /** Máximo de erros de rede antes de acionar fallback */
  maxNetworkErrors?: number;
  /** Janela de tempo para contar erros (ms) */
  errorWindowMs?: number;
}

const DEFAULT_MAX_NETWORK_ERRORS = 8;
const DEFAULT_ERROR_WINDOW_MS = 4000;

export function useTileWatchdog(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  options: UseTileWatchdogOptions = {}
): void {
  const {
    maxNetworkErrors = DEFAULT_MAX_NETWORK_ERRORS,
    errorWindowMs = DEFAULT_ERROR_WINDOW_MS,
  } = options;

  const fallbackIndexRef = useRef(0);
  const networkErrorsRef = useRef<number[]>([]);
  const timersRef = useRef<Array<ReturnType<typeof globalThis.setTimeout>>>([]);
  const attachedMapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof globalThis.setInterval> | undefined;

    const cleanupTimers = () => {
      timersRef.current.forEach(globalThis.clearTimeout);
      timersRef.current = [];
    };

    const switchToFallback = (liveMap: maplibregl.Map) => {
      const idx = fallbackIndexRef.current;
      if (idx >= FALLBACK_STYLES.length) {
        console.error('[TileWatchdog] Todos os fallbacks falharam');
        return;
      }

      const fallbackStyle = FALLBACK_STYLES[idx];
      console.warn(`[TileWatchdog] Trocando para fallback #${idx + 1}: ${fallbackStyle.name}`);
      fallbackIndexRef.current = idx + 1;
      networkErrorsRef.current = [];

      const center = liveMap.getCenter();
      const zoom = liveMap.getZoom();

      try {
        liveMap.setStyle(fallbackStyle);
        liveMap.once('styledata', () => {
          try {
            liveMap.setCenter(center);
            liveMap.setZoom(zoom);
          } catch { /* ignore */ }
          // Resize após troca de style
          for (let i = 0; i < 5; i++) {
            const t = globalThis.setTimeout(() => {
              try { liveMap.resize(); } catch { /* ignore */ }
            }, i * 100);
            timersRef.current.push(t);
          }
        });
      } catch (err) {
        console.error('[TileWatchdog] Erro ao trocar style:', err);
      }
    };

    const tryAttach = () => {
      if (disposed) return;

      const map = mapRef.current;
      if (!map) return;
      if (attachedMapRef.current === map) return;

      attachedMapRef.current = map;

      const onNetworkError = (reason?: string) => {
        const liveMap = mapRef.current;
        if (!liveMap) return;

        const now = Date.now();
        networkErrorsRef.current.push(now);
        // Limpar erros fora da janela
        networkErrorsRef.current = networkErrorsRef.current.filter((t) => now - t < errorWindowMs);

        if (networkErrorsRef.current.length >= maxNetworkErrors) {
          if (import.meta.env.DEV) {
            console.warn(`[TileWatchdog] ${maxNetworkErrors} erros de rede em ${errorWindowMs}ms${reason ? ` (${reason})` : ''} - acionando fallback`);
          }
          networkErrorsRef.current = [];
          switchToFallback(liveMap);
        }
      };

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
        }
      };

      map.on('error', errorHandler);
    };

    pollTimer = globalThis.setInterval(tryAttach, 200);
    tryAttach();

    return () => {
      disposed = true;
      if (pollTimer) globalThis.clearInterval(pollTimer);
      cleanupTimers();
      if (attachedMapRef.current) {
        try { attachedMapRef.current.off('error', () => {}); } catch { /* ignore */ }
        attachedMapRef.current = null;
      }
    };
  }, [mapRef, maxNetworkErrors, errorWindowMs]);
}
