/**
 * src/components/freight/FreightRealtimeMapMapLibre.tsx
 * 
 * Mapa em tempo real usando MapLibre GL JS + OpenStreetMap.
 * Zero dependência de Google Maps - 100% gratuito.
 * 
 * IMPORTANTE: O mapa NUNCA deve ficar vazio/preto.
 * Fallback de centro: motorista online → rota → Brasil
 * 
 * ✅ FIX CRÍTICO: Markers agora são GeoJSON Symbol Layers no canvas WebGL,
 *    NÃO mais DOM Markers. Isso garante que ficam fixos nas coordenadas
 *    independente de CSS transforms (Drawer/Dialog/Sheet).
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, WifiOff, Navigation, Eye, Clock, Route } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFreightRealtimeLocation } from '@/hooks/useFreightRealtimeLocation';
import { useCityCoordinates } from '@/hooks/useCityCoordinates';
import { useMapLibreSafeRaf, useMapLibreAutoResize, useMapLibreSupport, useOSRMRoute, useTileWatchdog } from '@/hooks/maplibre';
import { useOngoingFreightMapInputs } from '@/hooks/maplibre/useOngoingFreightMapInputs';
import { 
  interpolatePosition, 
  calculateBounds,
  formatSecondsAgo,
  createStopsHeatmapGeoJSON,
  HEATMAP_LAYER_CONFIG,
} from '@/lib/maplibre-utils';
import { generateMarkerIcons, buildMarkersFeatureCollection } from '@/lib/maplibre-canvas-icons';
import { RURAL_STYLE_INLINE, DEFAULT_CENTER, MAP_COLORS } from '@/config/maplibre';
import { cn } from '@/lib/utils';
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';

// ==================== Types ====================

interface FreightStop {
  lat: number;
  lng: number;
  durationMinutes: number;
}

interface FreightRealtimeMapMapLibreProps {
  freightId: string;
  originLat?: number | string;
  originLng?: number | string;
  destinationLat?: number | string;
  destinationLng?: number | string;
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
  initialDriverLat?: number | string;
  initialDriverLng?: number | string;
  lastLocationUpdate?: string;
  stops?: FreightStop[];
  showHeatmap?: boolean;
  className?: string;
}

const ONLINE_THRESHOLD_SECONDS = 120;

// ✅ Source/Layer IDs para markers no canvas
const MARKERS_SOURCE_ID = 'freight-markers-source';
const MARKERS_LAYER_ID = 'freight-markers-layer';

const FreightRealtimeMapMapLibreComponent: React.FC<FreightRealtimeMapMapLibreProps> = ({
  freightId,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  originCity,
  originState,
  destinationCity,
  destinationState,
  initialDriverLat,
  initialDriverLng,
  stops = [],
  showHeatmap = false,
  className,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  // ✅ REMOVIDO: driverMarkerRef, ghostDriverMarkerRef, originMarkerRef, destinationMarkerRef
  // Markers agora são GeoJSON symbol layers no canvas — sem DOM elements
  const cancelAnimationRef = useRef<(() => void) | null>(null);
  const previousLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const iconsRegisteredRef = useRef(false);
  // Ref para o driver location animado (para interpolação suave)
  const animatedDriverLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // ✅ Tile Watchdog: fallback automático quando tiles falham
  useTileWatchdog(mapRef);

  const { 
    driverLocation, 
    isOnline, 
    secondsAgo, 
    isLoading, 
    error 
  } = useFreightRealtimeLocation(freightId);

  // ✅ Hook exclusivo: normaliza entradas numéricas (number|string)
  const {
    originLatNum,
    originLngNum,
    destinationLatNum,
    destinationLngNum,
    initialDriverLatNum,
    initialDriverLngNum,
  } = useOngoingFreightMapInputs({
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    initialDriverLat,
    initialDriverLng,
  });

  // ✅ Buscar coordenadas das cidades como fallback
  const { 
    originCoords: cityOriginCoords, 
    destinationCoords: cityDestinationCoords,
    routeCenter,
    isLoading: isLoadingCoords 
  } = useCityCoordinates({
    originCity,
    originState,
    destinationCity,
    destinationState,
    originLat: originLatNum ?? undefined,
    originLng: originLngNum ?? undefined,
    destinationLat: destinationLatNum ?? undefined,
    destinationLng: destinationLngNum ?? undefined,
  });

  // ✅ Coordenadas efetivas de origem (props ou fallback de cidade)
  const effectiveOrigin = useMemo(() => {
    if (
      typeof originLatNum === 'number' &&
      typeof originLngNum === 'number' &&
      Number.isFinite(originLatNum) &&
      Number.isFinite(originLngNum) &&
      originLatNum !== 0 &&
      originLngNum !== 0
    ) {
      return { lat: originLatNum, lng: originLngNum };
    }
    if (cityOriginCoords && cityOriginCoords.lat && cityOriginCoords.lng) {
      return cityOriginCoords;
    }
    return null;
  }, [originLatNum, originLngNum, cityOriginCoords]);

  // ✅ Coordenadas efetivas de destino
  const effectiveDestination = useMemo(() => {
    if (
      typeof destinationLatNum === 'number' &&
      typeof destinationLngNum === 'number' &&
      Number.isFinite(destinationLatNum) &&
      Number.isFinite(destinationLngNum) &&
      destinationLatNum !== 0 &&
      destinationLngNum !== 0
    ) {
      return { lat: destinationLatNum, lng: destinationLngNum };
    }
    if (cityDestinationCoords && cityDestinationCoords.lat && cityDestinationCoords.lng) {
      return cityDestinationCoords;
    }
    return null;
  }, [destinationLatNum, destinationLngNum, cityDestinationCoords]);

  // ✅ Localização efetiva do motorista
  const effectiveDriverLocation = useMemo(() => {
    if (
      driverLocation &&
      typeof (driverLocation as any).lat === 'number' &&
      typeof (driverLocation as any).lng === 'number' &&
      Number.isFinite((driverLocation as any).lat) &&
      Number.isFinite((driverLocation as any).lng) &&
      (driverLocation as any).lat !== 0 &&
      (driverLocation as any).lng !== 0
    ) {
      return driverLocation;
    }
    if (
      typeof initialDriverLatNum === 'number' &&
      typeof initialDriverLngNum === 'number' &&
      Number.isFinite(initialDriverLatNum) &&
      Number.isFinite(initialDriverLngNum) &&
      initialDriverLatNum !== 0 &&
      initialDriverLngNum !== 0
    ) {
      return { lat: initialDriverLatNum, lng: initialDriverLngNum };
    }
    return null;
  }, [driverLocation, initialDriverLatNum, initialDriverLngNum]);

  // (isValidBrazilCoord removido — normalizeLatLngPoint não é mais aplicado em origem/destino)

  // ✅ FIX: Origem e destino NÃO passam por normalizeLatLngPoint.
  // Coordenadas de cidades/endereços (banco ou Nominatim) já estão corretas.
  // A heurística de swap do normalize pode inverter lat/lng válidos.
  // Apenas GPS do motorista passa por normalize (dados brutos de sensor).
  const mapOrigin = useMemo(() => {
    if (!effectiveOrigin) return null;
    if (!Number.isFinite(effectiveOrigin.lat) || !Number.isFinite(effectiveOrigin.lng)) return null;
    if (import.meta.env.DEV) {
      console.log('[MAP PIN DEBUG]', {
        id: 'origin',
        label: originCity ? `${originCity}/${originState}` : 'Origem',
        raw: { lat: effectiveOrigin.lat, lng: effectiveOrigin.lng },
        normalized: null,
        skipNormalize: true,
        mapLibreLngLat: [effectiveOrigin.lng, effectiveOrigin.lat],
        googleMapsLink: `https://www.google.com/maps?q=${effectiveOrigin.lat},${effectiveOrigin.lng}`,
      });
    }
    return effectiveOrigin;
  }, [effectiveOrigin, originCity, originState]);

  const mapDestination = useMemo(() => {
    if (!effectiveDestination) return null;
    if (!Number.isFinite(effectiveDestination.lat) || !Number.isFinite(effectiveDestination.lng)) return null;
    if (import.meta.env.DEV) {
      console.log('[MAP PIN DEBUG]', {
        id: 'destination',
        label: destinationCity ? `${destinationCity}/${destinationState}` : 'Destino',
        raw: { lat: effectiveDestination.lat, lng: effectiveDestination.lng },
        normalized: null,
        skipNormalize: true,
        mapLibreLngLat: [effectiveDestination.lng, effectiveDestination.lat],
        googleMapsLink: `https://www.google.com/maps?q=${effectiveDestination.lat},${effectiveDestination.lng}`,
      });
    }
    return effectiveDestination;
  }, [effectiveDestination, destinationCity, destinationState]);

  // ✅ GPS do motorista SIM passa por normalize (dados brutos de sensor podem ter lat/lng invertido)
  const mapDriverLocation = useMemo(() => {
    if (!effectiveDriverLocation) return null;
    const normalized = normalizeLatLngPoint(effectiveDriverLocation, 'BR');
    if (import.meta.env.DEV) {
      console.log('[MAP PIN DEBUG]', {
        id: 'driver',
        label: 'Motorista (GPS)',
        raw: { lat: effectiveDriverLocation.lat, lng: effectiveDriverLocation.lng },
        normalized: normalized ? { lat: normalized.lat, lng: normalized.lng } : null,
        skipNormalize: false,
        mapLibreLngLat: normalized ? [normalized.lng, normalized.lat] : null,
        googleMapsLink: normalized ? `https://www.google.com/maps?q=${normalized.lat},${normalized.lng}` : null,
      });
    }
    return normalized;
  }, [effectiveDriverLocation]);

  // ✅ DEBUG log (apenas DEV)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log('[FreightRealtimeMap] 🔍 Coords:', {
      normalized: { mapOrigin, mapDestination, mapDriverLocation },
    });
  }, [mapOrigin, mapDestination, mapDriverLocation]);

  const isDriverReallyOnline = useMemo(() => {
    return isOnline && secondsAgo < ONLINE_THRESHOLD_SECONDS;
  }, [isOnline, secondsAgo]);

  // ✅ OSRM route
  const { 
    route: osrmRoute, 
    isLoading: isLoadingRoute,
    error: routeError 
  } = useOSRMRoute({
    origin: mapOrigin,
    destination: mapDestination,
    profile: 'driving',
    enabled: !!(mapOrigin && mapDestination),
  });

  // ✅ Centro do mapa com fallback inteligente
  const mapCenter = useMemo<[number, number]>(() => {
    if (mapDriverLocation && isDriverReallyOnline) {
      return [mapDriverLocation.lng, mapDriverLocation.lat];
    }
    if (mapOrigin && mapDestination) {
      return [
        (mapOrigin.lng + mapDestination.lng) / 2,
        (mapOrigin.lat + mapDestination.lat) / 2,
      ];
    }
    if (mapOrigin) return [mapOrigin.lng, mapOrigin.lat];
    if (mapDestination) return [mapDestination.lng, mapDestination.lat];
    if (mapDriverLocation) return [mapDriverLocation.lng, mapDriverLocation.lat];
    return DEFAULT_CENTER;
  }, [mapDriverLocation, mapOrigin, mapDestination, isDriverReallyOnline]);

  // ✅ Rota planejada (OSRM ou fallback linha reta)
  const plannedRouteCoordinates = useMemo(() => {
    if (osrmRoute && osrmRoute.coordinates.length >= 2) {
      return osrmRoute.coordinates;
    }
    if (mapOrigin && mapDestination) {
      return [
        [mapOrigin.lng, mapOrigin.lat] as [number, number],
        [mapDestination.lng, mapDestination.lat] as [number, number],
      ];
    }
    return [];
  }, [osrmRoute, mapOrigin, mapDestination]);

  const hasAnyValidCoordinate = useMemo(() => {
    return !!(mapDriverLocation || mapOrigin || mapDestination);
  }, [mapDriverLocation, mapOrigin, mapDestination]);

  // ✅ Refs estáveis para evitar re-criação do mapa
  const initializingRef = useRef(false);
  const mapCenterRef = useRef(mapCenter);
  mapCenterRef.current = mapCenter;
  const hasAnyValidCoordinateRef = useRef(hasAnyValidCoordinate);
  hasAnyValidCoordinateRef.current = hasAnyValidCoordinate;
  const plannedRouteCoordinatesRef = useRef(plannedRouteCoordinates);
  plannedRouteCoordinatesRef.current = plannedRouteCoordinates;
  const osrmRouteRef = useRef(osrmRoute);
  osrmRouteRef.current = osrmRoute;
  
  // ==================== Map Initialization ====================
  useEffect(() => {
    const container = mapContainerRef.current;
    
    if (!container) return;
    if (mapRef.current) return;
    if (initializingRef.current) return;
    
    const rect = container.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width >= 10 && height >= 10 && !mapRef.current && !initializingRef.current) {
              ro.disconnect();
              setTimeout(() => setRetryCount((v) => v + 1), 0);
            }
          }
        });
        ro.observe(container);
        const t = setTimeout(() => {
          if (!mapRef.current) setMapError('Mapa não ficou visível (container sem dimensões)');
        }, 12000);
        return () => { clearTimeout(t); ro.disconnect(); };
      }
      if (retryCount < 20) {
        const retryTimeout = setTimeout(() => setRetryCount((prev) => prev + 1), 250);
        return () => clearTimeout(retryTimeout);
      }
      setMapError('Container do mapa sem dimensões válidas');
      return;
    }

    initializingRef.current = true;

    const initMap = async () => {
      try {
        const initialCenter = mapCenterRef.current;
        const initialZoom = hasAnyValidCoordinateRef.current ? 10 : 5;
        
        const map = new maplibregl.Map({
          container: container,
          style: RURAL_STYLE_INLINE,
          center: initialCenter,
          zoom: initialZoom,
          attributionControl: { compact: true },
          pixelRatio: window.devicePixelRatio || 1,
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', async () => {
          // ✅ Registrar ícones SVG como imagens no canvas
          try {
            const icons = await generateMarkerIcons();
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            for (const icon of icons) {
              if (!map.hasImage(icon.id)) {
                map.addImage(icon.id, icon.imageData, { pixelRatio });
              }
            }
            iconsRegisteredRef.current = true;
            if (import.meta.env.DEV) console.log('[FreightRealtimeMap] ✅ Canvas icons registered');
          } catch (err) {
            console.error('[FreightRealtimeMap] Failed to register icons:', err);
          }

          // ✅ Rota planejada (source + layer)
          const currentPlannedRoute = plannedRouteCoordinatesRef.current;
          const plannedRouteData = currentPlannedRoute.length >= 2
            ? {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: currentPlannedRoute,
                },
              }
            : { type: 'FeatureCollection' as const, features: [] };

          map.addSource('planned-route', { type: 'geojson', data: plannedRouteData });
          map.addLayer({
            id: 'planned-route-line',
            type: 'line',
            source: 'planned-route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': MAP_COLORS.primary, 'line-width': 5, 'line-opacity': 0.85 },
          });

          // ✅ Heatmap
          if (showHeatmap && stops.length > 0) {
            map.addSource('stops', { type: 'geojson', data: createStopsHeatmapGeoJSON(stops) });
            map.addLayer(HEATMAP_LAYER_CONFIG);
          }

          // ✅ FIX CRÍTICO: Markers como GeoJSON symbol layer no CANVAS
          const emptyFC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
          map.addSource(MARKERS_SOURCE_ID, { type: 'geojson', data: emptyFC });
          map.addLayer({
            id: MARKERS_LAYER_ID,
            type: 'symbol',
            source: MARKERS_SOURCE_ID,
            layout: {
              'icon-image': ['get', 'icon'],
              'icon-size': 1,
              'icon-allow-overlap': true,
              'icon-ignore-placement': true,
              // Pins (origin/destination) ancoram embaixo; truck ancora no centro
              'icon-anchor': [
                'match', ['get', 'markerType'],
                'origin', 'bottom',
                'destination', 'bottom',
                'center', // truck-online, truck-ghost
              ] as any,
              'icon-offset': [0, 0],
            },
          });

          // ✅ Click handler para markers no canvas
          map.on('click', MARKERS_LAYER_ID, (e) => {
            if (!e.features || e.features.length === 0) return;
            const feature = e.features[0];
            const coords = (feature.geometry as GeoJSON.Point).coordinates;
            const label = (feature.properties as any)?.label || '';
            
            new maplibregl.Popup({ offset: 25 })
              .setLngLat(coords as [number, number])
              .setHTML(`<strong>${label}</strong>`)
              .addTo(map);
          });

          // Cursor pointer ao hover
          map.on('mouseenter', MARKERS_LAYER_ID, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', MARKERS_LAYER_ID, () => { map.getCanvas().style.cursor = ''; });

          setMapLoaded(true);
          if (import.meta.env.DEV) console.log('[FreightRealtimeMap] ✅ Map initialized');

          setTimeout(() => handleFitBounds(), 300);
        });

        map.on('error', (e) => {
          const errMsg = e.error?.message || '';
          if (e.error?.name === 'AbortError' || errMsg.includes('signal is aborted') || errMsg.includes('The operation was aborted')) return;
          if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('Load failed')) return;
          console.error('[FreightRealtimeMap] Map error:', e);
          setMapError('Erro ao carregar o mapa');
        });

        mapRef.current = map;
        initializingRef.current = false;
      } catch (err) {
        console.error('[FreightRealtimeMap] Init error:', err);
        setMapError('Erro ao inicializar o mapa');
        initializingRef.current = false;
      }
    };

    initMap();

    return () => {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
      if (cancelAnimationRef.current) {
        cancelAnimationRef.current();
        cancelAnimationRef.current = null;
      }
      // ✅ REMOVIDO: Não precisa mais limpar DOM markers
      if (mapRef.current) {
        try { mapRef.current.remove(); } catch (e) {}
        mapRef.current = null;
      }
      initializingRef.current = false;
      iconsRegisteredRef.current = false;
      setMapLoaded(false);
    };
  }, [retryCount]);

  // ✅ Resize observer
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !mapContainerRef.current) return;
    const t = window.setTimeout(() => { try { mapRef.current?.resize(); } catch {} }, 150);
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = new ResizeObserver(() => {
        requestAnimationFrame(() => { try { mapRef.current?.resize(); } catch {} });
      });
      resizeObserverRef.current.observe(mapContainerRef.current);
    }
    return () => {
      window.clearTimeout(t);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [mapLoaded]);

  // ==================== ✅ FIX CRÍTICO: Update markers via GeoJSON source ====================
  // Este useEffect substitui os 2 useEffects anteriores de DOM Markers.
  // Agora apenas atualiza o GeoJSON source — rendering é feito pelo canvas WebGL.

  // Helper para atualizar o source de markers
  const updateMarkersSource = useCallback((driverPos: { lat: number; lng: number } | null) => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !iconsRegisteredRef.current) return;
    const source = map.getSource(MARKERS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    
    const fc = buildMarkersFeatureCollection(
      mapOrigin,
      mapDestination,
      driverPos,
      isDriverReallyOnline,
    );
    source.setData(fc);
  }, [mapOrigin, mapDestination, isDriverReallyOnline, mapLoaded]);

  // Atualizar markers quando origem/destino/driver/status mudam
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !iconsRegisteredRef.current) return;

    // Se não há driver location, atualizar sem driver
    if (!mapDriverLocation) {
      animatedDriverLocationRef.current = null;
      previousLocationRef.current = null;
      updateMarkersSource(null);
      return;
    }

    // Se não há posição anterior ou motorista offline, snap direto
    if (!previousLocationRef.current || !isDriverReallyOnline) {
      animatedDriverLocationRef.current = mapDriverLocation;
      previousLocationRef.current = mapDriverLocation;
      updateMarkersSource(mapDriverLocation);
      return;
    }

    // ✅ Animação suave do caminhão (interpolação via requestAnimationFrame)
    if (cancelAnimationRef.current) {
      cancelAnimationRef.current();
    }

    cancelAnimationRef.current = interpolatePosition(
      previousLocationRef.current,
      mapDriverLocation,
      1000,
      (pos) => {
        animatedDriverLocationRef.current = pos;
        updateMarkersSource(pos);
      },
      () => {
        previousLocationRef.current = mapDriverLocation;
        animatedDriverLocationRef.current = mapDriverLocation;
      }
    );
  }, [mapDriverLocation, mapOrigin, mapDestination, mapLoaded, isDriverReallyOnline, updateMarkersSource]);

  // ✅ Atualizar rota planejada
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const plannedSource = mapRef.current.getSource('planned-route') as maplibregl.GeoJSONSource;
    if (plannedSource) {
      const data = plannedRouteCoordinates.length >= 2
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'LineString' as const, coordinates: plannedRouteCoordinates },
          }
        : { type: 'FeatureCollection' as const, features: [] };
      plannedSource.setData(data);
    }
  }, [plannedRouteCoordinates, mapLoaded]);

  // ✅ Centralizar no motorista
  const handleCenterOnDriver = useCallback(() => {
    if (mapRef.current && mapDriverLocation) {
      mapRef.current.flyTo({
        center: [mapDriverLocation.lng, mapDriverLocation.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [mapDriverLocation]);

  // ✅ Ajustar bounds
  const handleFitBounds = useCallback(() => {
    if (!mapRef.current) return;
    const validPoints = [mapOrigin, mapDriverLocation, mapDestination].filter(Boolean) as Array<{ lat: number; lng: number }>;
    if (validPoints.length === 0) {
      mapRef.current.flyTo({ center: DEFAULT_CENTER, zoom: 5, duration: 1000 });
      return;
    }
    if (validPoints.length === 1) {
      mapRef.current.flyTo({ center: [validPoints[0].lng, validPoints[0].lat], zoom: 12, duration: 1000 });
      return;
    }
    const bounds = calculateBounds(validPoints);
    if (bounds) mapRef.current.fitBounds(bounds, { padding: 50 });
  }, [mapOrigin, mapDestination, mapDriverLocation]);

  // ==================== Render ====================
  return (
    <div className={cn("relative rounded-lg overflow-hidden border border-border", className)} style={{ height: '280px', minHeight: '280px' }}>
      {/* ✅ P1: Container do mapa - SEMPRE montado */}
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0"
        style={{ width: '100%', height: '100%', transform: 'none' }}
      />

      {/* ✅ OVERLAY: Loading */}
      {isLoading && (
        <div className="absolute inset-0 z-20">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      )}

      {/* ✅ OVERLAY: Error */}
      {!isLoading && (error || mapError) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/95 rounded-lg">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <WifiOff className="h-8 w-8" />
            <span className="text-sm">{error || mapError}</span>
          </div>
        </div>
      )}

      {/* ✅ OVERLAY: No location */}
      {!isLoading && !error && !mapError && !hasAnyValidCoordinate && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/95 rounded-lg border-2 border-dashed border-muted">
          <div className="flex flex-col items-center gap-3 text-muted-foreground p-4 text-center">
            <MapPin className="h-10 w-10 opacity-50" />
            <div>
              <p className="font-medium">Aguardando sinal do motorista...</p>
              <p className="text-xs mt-1">A localização aparecerá assim que o motorista iniciar o rastreamento</p>
            </div>
          </div>
        </div>
      )}

      {/* Status overlay */}
      {mapLoaded && (
        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2 z-10">
          <Badge 
            variant={isDriverReallyOnline ? "default" : "secondary"}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1",
              isDriverReallyOnline ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
            )}
          >
            <span className={cn(
              "w-2 h-2 rounded-full",
              isDriverReallyOnline ? "bg-white animate-pulse" : "bg-destructive"
            )} />
            {isDriverReallyOnline ? 'Online' : 'Offline'}
          </Badge>

          {secondsAgo !== Infinity && secondsAgo > 0 && (
            <Badge variant="secondary" className="text-xs flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatSecondsAgo(secondsAgo)}
            </Badge>
          )}
        </div>
      )}

      {/* 🚗 Badge de rota OSRM */}
      {mapLoaded && osrmRoute && osrmRoute.distance > 0 && (
        <div className="absolute bottom-2 left-2 z-10">
          <Badge variant="outline" className="text-xs flex items-center gap-1.5 bg-background/90 shadow-sm">
            <Route className="h-3 w-3 text-primary" />
            <span>{osrmRoute.distanceText}</span>
            <span className="text-muted-foreground">•</span>
            <span>{osrmRoute.durationText}</span>
          </Badge>
        </div>
      )}

      {/* Botões de controle */}
      {mapLoaded && (
        <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-10">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCenterOnDriver}
            disabled={!mapDriverLocation}
            className="h-8 px-2 shadow-md"
            title="Centralizar no motorista"
          >
            <Navigation className="h-4 w-4 mr-1" />
            Centralizar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleFitBounds}
            className="h-8 px-2 shadow-md bg-background/90"
            title="Ver trajeto completo"
          >
            <Eye className="h-4 w-4 mr-1" />
            Ver tudo
          </Button>
        </div>
      )}
    </div>
  );
};

export const FreightRealtimeMapMapLibre = React.memo(FreightRealtimeMapMapLibreComponent);
