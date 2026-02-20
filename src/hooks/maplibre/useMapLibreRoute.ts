/**
 * src/hooks/maplibre/useMapLibreRoute.ts
 * 
 * Hook para desenhar rotas reais no mapa MapLibre.
 * Integra com OSRM para obter rotas por estradas.
 */

import { useEffect, useRef, MutableRefObject, useCallback, useState } from 'react';
import { devLog } from '@/lib/devLogger';
import maplibregl from 'maplibre-gl';
import { useOSRMRoute, RoutePoint, OSRMRouteResult } from './useOSRMRoute';

export interface UseMapLibreRouteOptions {
  /** Origem da rota */
  origin: RoutePoint | null;
  /** Destino da rota */
  destination: RoutePoint | null;
  /** Cor da linha da rota */
  lineColor?: string;
  /** Largura da linha */
  lineWidth?: number;
  /** ID do layer (para múltiplas rotas) */
  layerId?: string;
  /** Perfil de roteamento */
  profile?: 'driving' | 'walking' | 'cycling';
  /** Habilitar/desabilitar */
  enabled?: boolean;
  /** Mostrar linha reta enquanto carrega */
  showLoadingLine?: boolean;
}

export interface UseMapLibreRouteResult {
  /** Dados da rota */
  route: OSRMRouteResult | null;
  /** Carregando */
  isLoading: boolean;
  /** Erro */
  error: string | null;
  /** Remover rota do mapa */
  removeRoute: () => void;
  /** Atualizar rota */
  refetch: () => void;
}

/**
 * Hook para desenhar rotas no MapLibre usando OSRM
 */
export function useMapLibreRoute(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  options: UseMapLibreRouteOptions
): UseMapLibreRouteResult {
  const {
    origin,
    destination,
    lineColor = '#16a34a', // Verde agrícola
    lineWidth = 4,
    layerId = 'route-line',
    profile = 'driving',
    enabled = true,
    showLoadingLine = true,
  } = options;

  const sourceId = `${layerId}-source`;
  // Contador reativo para forçar re-render quando o mapa estiver pronto
  const [mapReadyTick, setMapReadyTick] = useState(0);

  // Buscar rota via OSRM
  const { route, isLoading, error, refetch } = useOSRMRoute({
    origin,
    destination,
    profile,
    enabled,
  });

  // Registrar listener 'styledata' para reagir quando o mapa/estilo ficar pronto
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onStyleReady = () => setMapReadyTick(t => t + 1);

    map.on('styledata', onStyleReady);
    // Disparar imediatamente se já estiver pronto
    if (map.isStyleLoaded()) {
      setMapReadyTick(t => t + 1);
    }

    return () => {
      map.off('styledata', onStyleReady);
    };
  }, [mapRef.current]); // eslint-disable-line react-hooks/exhaustive-deps

  // Desenhar rota no mapa
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Limpar layer/source existente
    const cleanup = () => {
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (e) {
        // Ignorar erros de cleanup
      }
    };

    // Sem rota: mostrar linha reta enquanto carrega
    if (!route || route.coordinates.length === 0) {
      if (showLoadingLine && isLoading && origin && destination) {
        const straightLine: [number, number][] = [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ];

        cleanup();

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: straightLine },
          },
        });

        map.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': '#94a3b8',
            'line-width': lineWidth,
            'line-dasharray': [2, 2],
            'line-opacity': 0.5,
          },
        });
      } else {
        cleanup();
      }
      return;
    }

    // Desenhar rota real
    cleanup();

    map.addSource(sourceId, {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {
          distance: route.distanceText,
          duration: route.durationText,
        },
        geometry: { type: 'LineString', coordinates: route.coordinates },
      },
    });

    map.addLayer({
      id: layerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': lineColor,
        'line-width': lineWidth,
        'line-opacity': 0.8,
      },
    });

    devLog('[useMapLibreRoute] Route drawn:', {
      layerId,
      points: route.coordinates.length,
      distance: route.distanceText,
    });
  }, [mapReadyTick, route, isLoading, origin, destination, lineColor, lineWidth, layerId, sourceId, showLoadingLine]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (!map) return;
      try {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
      } catch (e) {
        // Ignorar erros no unmount
      }
    };
  }, [layerId, sourceId]); // eslint-disable-line react-hooks/exhaustive-deps

  const removeRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    try {
      if (map.getLayer(layerId)) map.removeLayer(layerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    } catch (e) {
      console.error('[useMapLibreRoute] Error removing route:', e);
    }
  }, [layerId, sourceId]);

  return {
    route,
    isLoading,
    error,
    removeRoute,
    refetch,
  };
}
