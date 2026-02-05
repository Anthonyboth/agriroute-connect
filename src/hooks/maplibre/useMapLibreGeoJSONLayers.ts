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
    // Normalizar coordenadas (evita lat/lng invertidos)
    const lat = Number(marker.lat);
    const lng = Number(marker.lng);
    
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      console.warn('[GeoJSONLayers] Coordenadas inválidas para marker:', marker.id);
      continue;
    }

    const normalized = normalizeLatLngPoint({ lat, lng }, 'BR', { silent: true });
    const point = normalized ?? { lat, lng };

    features.push({
      type: 'Feature',
      id: marker.id,
      geometry: {
        type: 'Point',
        coordinates: [point.lng, point.lat], // GeoJSON = [lng, lat]
      },
      properties: {
        id: marker.id,
        type: marker.type || 'default',
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
      // 🔍 DEBUG ETAPA 2: Verificar se source já existe
      const existingSource = map.getSource(sourceId);
      console.log("[MapLibreBase] source existe?", !!existingSource);
      
      if (existingSource) {
        setupDoneRef.current = true;
        isReadyRef.current = true;
        console.log("[MapLibreBase] layer existe?", !!map.getLayer(layerCircleId));
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
      console.log("[MapLibreBase] source criado:", sourceId);

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
      console.log("[MapLibreBase] layer criado:", layerCircleId);
      console.log("[MapLibreBase] source existe?", !!map.getSource(sourceId));
      console.log("[MapLibreBase] layer existe?", !!map.getLayer(layerCircleId));

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
      console.log('[GeoJSONLayers] Source e layers criados:', sourceId);

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
      
      // 🔍 DEBUG ETAPA 2: Logs de source e layer
      console.log("[MapLibreBase] source existe?", !!source);
      console.log("[MapLibreBase] layer existe?", !!map.getLayer(layerCircleId));
      
      if (source) {
        const geojson = markersToGeoJSON(points);
        
        // 🔍 DEBUG ETAPA 2: Validar cada feature antes de usar
        const validFeatures = geojson.features.filter(f => {
          const coords = (f.geometry as GeoJSON.Point).coordinates;
          const lng = coords[0];
          const lat = coords[1];
          
          const isValidType = typeof lat === 'number' && typeof lng === 'number';
          const isFiniteVal = isFinite(lat) && isFinite(lng);
          const isInRange = lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
          
          const isValid = isValidType && isFiniteVal && isInRange;
          
          if (!isValid) {
            console.warn("[MapLibreBase] Feature inválida:", f.properties?.id, { lat, lng, isValidType, isFiniteVal, isInRange });
          }
          return isValid;
        });
        
        // 🔍 DEBUG ETAPA 2: Log setData features
        console.log("[MapLibreBase] setData features:", validFeatures.length, validFeatures[0]);
        
        source.setData({
          type: 'FeatureCollection',
          features: validFeatures,
        });
        
        // 🔍 DEBUG ETAPA 3: fitBounds + resize burst
        if (validFeatures.length >= 1) {
          const bounds = new maplibregl.LngLatBounds();
          validFeatures.forEach(f => {
            const coords = (f.geometry as GeoJSON.Point).coordinates;
            bounds.extend(coords as [number, number]);
          });
          
          map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 0 });
          console.log("[MapLibreBase] fitBounds executado para", validFeatures.length, "pontos");
          
          // Resize burst por 500ms (15 frames) para Drawers com transform
          for (let i = 0; i < 15; i++) {
            setTimeout(() => {
              try {
                map.resize();
              } catch {}
            }, i * (500 / 15));
          }
          console.log("[MapLibreBase] resize burst iniciado (15 frames em 500ms)");
        }
        
        console.log('[GeoJSONLayers] Pontos atualizados:', points.length);
      }
    } catch (error) {
      console.error('[GeoJSONLayers] Erro ao atualizar pontos:', error);
    }
  }, [mapRef, sourceId, layerCircleId]);

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
