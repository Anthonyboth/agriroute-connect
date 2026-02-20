/**
 * src/hooks/maplibre/useMapLibreGeoJSONLayers.ts
 * 
 * Hook para renderizar marcadores via GeoJSON + circle layers do MapLibre.
 * 
 * ✅ DEFINITIVO: Não usa DOM Markers (proibido por causa de transform/scale em Drawers)
 * ✅ Marcadores ficam fixos no mapa, não flutuam com animações
 * ✅ Performance melhor para muitos pontos
 * 
 * Uso:
 * - Passar array de pontos com {id, lat, lng, properties}
 * - Hook cria/atualiza Source GeoJSON e Layer circle automaticamente
 */

import { useRef, useEffect, useCallback, MutableRefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';
import { assertLatLng, googleMapsLink } from '@/lib/geo/mapHelpers';

// ==================== Types ====================

export interface GeoJSONMarkerData {
  /** ID único do ponto */
  id: string;
  /** Latitude */
  lat: number;
  /** Longitude */
  lng: number;
  /** Tipo do marcador (para estilização diferenciada) */
  type?: 'driver' | 'origin' | 'destination' | 'truck' | 'default';
  /**
   * Se true, DESABILITA normalizeLatLngPoint para este marker.
   * Use para coordenadas de cidade/endereço (Nominatim, cities table) que já estão corretas.
   * Deixe false apenas para GPS de motorista (pode ter lat/lng invertido ou micrograus).
   * DEFAULT: true (skip normalize) — normalization é opt-in via skipNormalize=false.
   */
  skipNormalize?: boolean;
  /** Label associado (cidade/endereço) — usado no log de debug */
  label?: string;
  /** Propriedades extras para o GeoJSON */
  properties?: Record<string, any>;
}

export interface UseMapLibreGeoJSONLayersOptions {
  /** ID base para source e layers */
  sourceId?: string;
  /** Cor do círculo */
  circleColor?: string;
  /** Raio do círculo */
  circleRadius?: number;
  /** Cor do stroke */
  strokeColor?: string;
  /** Largura do stroke */
  strokeWidth?: number;
  /** Callback de click em ponto */
  onPointClick?: (point: GeoJSONMarkerData) => void;
}

export interface UseMapLibreGeoJSONLayersResult {
  /** Se as layers estão prontas */
  isReady: boolean;
  /** Atualiza os pontos */
  updatePoints: (points: GeoJSONMarkerData[]) => void;
  /** Remove todos os pontos */
  clearAll: () => void;
}

// ==================== Constants ====================

const SOURCE_ID = 'agri_markers';
const LAYER_CIRCLE_ID = 'agri_markers_circle';
const LAYER_STROKE_ID = 'agri_markers_stroke';

// Cores padrão (tema escuro do AgriRoute)
const DEFAULT_CIRCLE_COLOR = '#111827'; // gray-900
const DEFAULT_STROKE_COLOR = '#ffffff';
const DEFAULT_CIRCLE_RADIUS = 8;
const DEFAULT_STROKE_WIDTH = 2;

// ==================== Helper ====================

/**
 * Converte array de markers para GeoJSON FeatureCollection
 */
function markersToGeoJSON(markers: GeoJSONMarkerData[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const marker of markers) {
    const rawLat = Number(marker.lat);
    const rawLng = Number(marker.lng);

    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng)) {
      console.warn('[GeoJSONLayers] Coordenadas inválidas para marker:', marker.id);
      continue;
    }

    // ✅ normalizeLatLngPoint é opt-in: apenas quando skipNormalize === false
    // Por padrão (skipNormalize === undefined ou true), usa coordenadas brutas.
    // Isso evita que a heurística de swap inverta coordenadas corretas de cidades/endereços.
    const shouldNormalize = marker.skipNormalize === false;
    let finalLat = rawLat;
    let finalLng = rawLng;

    if (shouldNormalize) {
      const normalized = normalizeLatLngPoint({ lat: rawLat, lng: rawLng }, 'BR', { silent: false });
      if (normalized) {
        finalLat = normalized.lat;
        finalLng = normalized.lng;
      }
    }

    // ✅ Guard de sanidade
    assertLatLng(finalLat, finalLng, `marker[${marker.id}]`);

    // ✅ [MAP PIN DEBUG] — visível em DEV para diagnóstico de pin no lugar errado
    if (import.meta.env.DEV) {
      console.log('[MAP PIN DEBUG]', {
        id: marker.id,
        type: marker.type,
        label: marker.label ?? '(sem label)',
        raw: { lat: rawLat, lng: rawLng },
        normalized: shouldNormalize ? { lat: finalLat, lng: finalLng } : null,
        skipNormalize: marker.skipNormalize ?? true,
        mapLibreLngLat: [finalLng, finalLat],
        googleMapsLink: googleMapsLink(finalLat, finalLng),
      });
    }

    features.push({
      type: 'Feature',
      id: marker.id,
      geometry: {
        type: 'Point',
        coordinates: [finalLng, finalLat], // GeoJSON = [lng, lat]
      },
      properties: {
        id: marker.id,
        type: marker.type || 'default',
        label: marker.label,
        ...marker.properties,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

// ==================== Hook ====================

/**
 * Hook para gerenciar marcadores via GeoJSON layers (sem DOM Markers)
 */
export function useMapLibreGeoJSONLayers(
  mapRef: MutableRefObject<maplibregl.Map | null>,
  markers: GeoJSONMarkerData[],
  options: UseMapLibreGeoJSONLayersOptions = {}
): UseMapLibreGeoJSONLayersResult {
  const {
    sourceId = SOURCE_ID,
    circleColor = DEFAULT_CIRCLE_COLOR,
    circleRadius = DEFAULT_CIRCLE_RADIUS,
    strokeColor = DEFAULT_STROKE_COLOR,
    strokeWidth = DEFAULT_STROKE_WIDTH,
    onPointClick,
  } = options;

  const layerCircleId = `${sourceId}_circle`;
  const isReadyRef = useRef(false);
  const setupDoneRef = useRef(false);

  /**
   * Configura source e layers (apenas uma vez)
   */
  const setupSourceAndLayers = useCallback((map: maplibregl.Map) => {
    if (setupDoneRef.current) return;

    try {
      const existingSource = map.getSource(sourceId);
      
      if (existingSource) {
        setupDoneRef.current = true;
        isReadyRef.current = true;
        return;
      }

      // Criar source GeoJSON vazia
      map.addSource(sourceId, {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [],
        },
      });

      // Adicionar layer de círculo
      map.addLayer({
        id: layerCircleId,
        type: 'circle',
        source: sourceId,
        paint: {
          'circle-radius': circleRadius,
          'circle-color': circleColor,
          'circle-stroke-width': strokeWidth,
          'circle-stroke-color': strokeColor,
        },
      });

      // Click handler
      if (onPointClick) {
        map.on('click', layerCircleId, (e) => {
          if (e.features && e.features.length > 0) {
            const feature = e.features[0];
            const props = feature.properties;
            const coords = (feature.geometry as GeoJSON.Point).coordinates;
            
            onPointClick({
              id: props?.id || String(feature.id),
              lat: coords[1],
              lng: coords[0],
              type: props?.type,
              properties: props,
            });
          }
        });

        // Cursor pointer ao passar sobre pontos
        map.on('mouseenter', layerCircleId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerCircleId, () => {
          map.getCanvas().style.cursor = '';
        });
      }

      setupDoneRef.current = true;
      isReadyRef.current = true;
      if (import.meta.env.DEV) {
        console.log('[GeoJSONLayers] Source e layers criados:', sourceId);
      }

    } catch (error) {
      console.error('[GeoJSONLayers] Erro ao criar source/layers:', error);
    }
  }, [sourceId, layerCircleId, circleColor, circleRadius, strokeColor, strokeWidth, onPointClick]);

  /**
   * Atualiza os dados da source com validação e fitBounds
   */
  const updatePoints = useCallback((points: GeoJSONMarkerData[]) => {
    const map = mapRef.current;
    if (!map) return;

    try {
      const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
      
      if (source) {
        const geojson = markersToGeoJSON(points);
        
        // Filtrar features com coordenadas inválidas
        const validFeatures = geojson.features.filter(f => {
          const coords = (f.geometry as GeoJSON.Point).coordinates;
          const lng = coords[0];
          const lat = coords[1];
          return typeof lat === 'number' && typeof lng === 'number' 
            && isFinite(lat) && isFinite(lng)
            && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
        });
        
        source.setData({
          type: 'FeatureCollection',
          features: validFeatures,
        });
        
        // fitBounds se tiver pontos
        if (validFeatures.length >= 1) {
          const bounds = new maplibregl.LngLatBounds();
          validFeatures.forEach(f => {
            const coords = (f.geometry as GeoJSON.Point).coordinates;
            bounds.extend(coords as [number, number]);
          });
          
          map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 0 });
          
          // Resize burst por 500ms para Drawers com transform
          for (let i = 0; i < 10; i++) {
            setTimeout(() => {
              try { map.resize(); } catch {}
            }, i * 50);
          }
        }
      }
    } catch (error) {
      console.error('[GeoJSONLayers] Erro ao atualizar pontos:', error);
    }
  }, [mapRef, sourceId]);

  /**
   * Limpa todos os pontos
   */
  const clearAll = useCallback(() => {
    updatePoints([]);
  }, [updatePoints]);

  // Setup inicial quando mapa estiver pronto
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Se mapa já está loaded, configurar imediatamente
    if (map.isStyleLoaded()) {
      setupSourceAndLayers(map);
      updatePoints(markers);
    } else {
      // Aguardar load do mapa
      const onLoad = () => {
        setupSourceAndLayers(map);
        updatePoints(markers);
      };
      map.on('load', onLoad);
      
      return () => {
        map.off('load', onLoad);
      };
    }
  }, [mapRef.current, setupSourceAndLayers]);

  // Atualizar pontos quando markers mudarem
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !setupDoneRef.current) return;

    updatePoints(markers);
  }, [markers, updatePoints, mapRef.current]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      const map = mapRef.current;
      if (!map || !setupDoneRef.current) return;

      try {
        if (map.getLayer(layerCircleId)) {
          map.removeLayer(layerCircleId);
        }
        if (map.getSource(sourceId)) {
          map.removeSource(sourceId);
        }
        console.log('[GeoJSONLayers] Cleanup executado');
      } catch (error) {
        // Ignorar erros de cleanup (mapa pode já ter sido removido)
      }

      setupDoneRef.current = false;
      isReadyRef.current = false;
    };
  }, [sourceId, layerCircleId]);

  return {
    isReady: isReadyRef.current,
    updatePoints,
    clearAll,
  };
}
