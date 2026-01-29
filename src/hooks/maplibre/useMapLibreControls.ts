/**
 * src/hooks/maplibre/useMapLibreControls.ts
 * 
 * Hook para controles de navegação do mapa (pan, zoom, bounds).
 * Inclui debounce/throttle para evitar atualizações excessivas.
 */

import { useCallback, useRef, MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { calculateBounds } from '@/lib/maplibre-utils';
import { DEFAULT_CENTER } from '@/config/maplibre';

export interface UseMapLibreControlsOptions {
  /** Threshold mínimo de distância para pan (graus) */
  panThreshold?: number;
  /** Duração da animação (ms) */
  animationDuration?: number;
  /** Debounce para atualizações (ms) */
  debounceMs?: number;
}

export interface UseMapLibreControlsResult {
  /** Pan suave para uma posição */
  panTo: (lat: number, lng: number) => void;
  /** Fly para uma posição com animação */
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  /** Define zoom */
  setZoom: (zoom: number) => void;
  /** Ajusta bounds para incluir todos os pontos */
  fitBounds: (points: Array<{ lat: number; lng: number } | null | undefined>, padding?: number) => void;
  /** Centraliza no Brasil (fallback) */
  centerOnBrazil: () => void;
  /** Define centro diretamente (sem animação) */
  setCenter: (lat: number, lng: number) => void;
}

/**
 * Hook para controles de navegação do mapa
 */
export function useMapLibreControls(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  options: UseMapLibreControlsOptions = {}
): UseMapLibreControlsResult {
  const {
    panThreshold = 0.0001,
    animationDuration = 1000,
    debounceMs = 100,
  } = options;

  const lastPanRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  const panTo = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    const now = Date.now();
    const last = lastPanRef.current;

    // Debounce e threshold
    if (last) {
      const timeDiff = now - last.time;
      const latDiff = Math.abs(lat - last.lat);
      const lngDiff = Math.abs(lng - last.lng);

      // Ignorar se muito recente ou diferença muito pequena
      if (timeDiff < debounceMs || (latDiff < panThreshold && lngDiff < panThreshold)) {
        return;
      }
    }

    lastPanRef.current = { lat, lng, time: now };

    try {
      map.panTo([lng, lat], { duration: animationDuration / 2 });
    } catch (e) {
      console.warn('[MapLibre] Erro ao fazer pan:', e);
    }
  }, [mapRef, panThreshold, animationDuration, debounceMs]);

  const flyTo = useCallback((lat: number, lng: number, zoom?: number) => {
    const map = mapRef.current;
    if (!map) return;

    try {
      map.flyTo({
        center: [lng, lat],
        zoom: zoom ?? map.getZoom(),
        duration: animationDuration,
      });
    } catch (e) {
      console.warn('[MapLibre] Erro ao fazer flyTo:', e);
    }
  }, [mapRef, animationDuration]);

  const setZoom = useCallback((zoom: number) => {
    const map = mapRef.current;
    if (!map) return;

    try {
      map.setZoom(zoom);
    } catch (e) {
      console.warn('[MapLibre] Erro ao definir zoom:', e);
    }
  }, [mapRef]);

  const fitBounds = useCallback((
    points: Array<{ lat: number; lng: number } | null | undefined>,
    padding: number = 50
  ) => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = calculateBounds(points);

    if (!bounds) {
      // Fallback: centro do Brasil
      map.flyTo({
        center: DEFAULT_CENTER,
        zoom: 5,
        duration: animationDuration,
      });
      return;
    }

    try {
      map.fitBounds(bounds, { padding, duration: animationDuration });
    } catch (e) {
      console.warn('[MapLibre] Erro ao ajustar bounds:', e);
    }
  }, [mapRef, animationDuration]);

  const centerOnBrazil = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      map.flyTo({
        center: DEFAULT_CENTER,
        zoom: 5,
        duration: animationDuration,
      });
    } catch (e) {
      console.warn('[MapLibre] Erro ao centralizar no Brasil:', e);
    }
  }, [mapRef, animationDuration]);

  const setCenter = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;

    try {
      map.setCenter([lng, lat]);
    } catch (e) {
      console.warn('[MapLibre] Erro ao definir centro:', e);
    }
  }, [mapRef]);

  return {
    panTo,
    flyTo,
    setZoom,
    fitBounds,
    centerOnBrazil,
    setCenter,
  };
}
