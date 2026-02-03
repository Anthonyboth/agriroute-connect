/**
 * src/components/freight/MultiDriverMapMapLibre.tsx
 * 
 * Mapa em tempo real com MÚLTIPLOS caminhões para fretes multi-carreta.
 * Cada motorista aparece como um marcador individual no mapa.
 */

import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Badge } from '@/components/ui/badge';
import { MapPin, WifiOff, Users, Loader2 } from 'lucide-react';
import { useMultiDriverLocations, DriverLocationData } from '@/hooks/useMultiDriverLocations';
import { useCityCoordinates } from '@/hooks/useCityCoordinates';
import { useOSRMRoute } from '@/hooks/maplibre';
import { useOngoingFreightMapInputs } from '@/hooks/maplibre/useOngoingFreightMapInputs';
import { 
  createLocationMarkerElement,
  calculateBounds,
} from '@/lib/maplibre-utils';
import { RURAL_STYLE_INLINE, DEFAULT_CENTER, MAP_COLORS } from '@/config/maplibre';
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';
import { cn } from '@/lib/utils';

interface MultiDriverMapMapLibreProps {
  freightId: string;
  originLat?: number | string;
  originLng?: number | string;
  destinationLat?: number | string;
  destinationLng?: number | string;
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
  className?: string;
}

// Cores para diferentes motoristas
const DRIVER_COLORS = [
  '#2563eb', // blue-600
  '#16a34a', // green-600
  '#dc2626', // red-600
  '#9333ea', // purple-600
  '#ea580c', // orange-600
];

/**
 * ✅ CORRIGIDO: Cria elemento de marker do caminhão para multi-driver.
 * IMPORTANTE: NÃO usar transform translate - o MapLibre cuida do posicionamento via anchor.
 * anchor: 'center' é usado para ícones circulares/caminhões.
 */
const createTruckMarkerElement = (index: number, driverName: string, isOnline: boolean): HTMLDivElement => {
  const el = document.createElement('div');
  // ✅ CRÍTICO: Classe 'truck-marker' define anchor: 'center' no hook de markers
  el.className = 'truck-marker';
  el.title = `${driverName} ${isOnline ? '(Online)' : '(Offline)'}`;
  
  const color = DRIVER_COLORS[index % DRIVER_COLORS.length];
  const opacity = isOnline ? '1' : '0.5';
  
  // ✅ CORRIGIDO: Remover transform translate - o MapLibre anchor posiciona corretamente
  el.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
  `;
  
  el.innerHTML = `
    <div style="
      background: ${color};
      opacity: ${opacity};
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 10px;
      font-weight: 600;
      color: white;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      margin-bottom: 2px;
    ">
      #${index + 1}
    </div>
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="opacity: ${opacity}; filter: drop-shadow(0 2px 2px rgba(0,0,0,0.3));">
      <rect x="1" y="6" width="15" height="10" rx="1" fill="${color}" stroke="white" stroke-width="1.5"/>
      <rect x="16" y="9" width="6" height="7" rx="1" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="6" cy="17" r="2" fill="#374151" stroke="white" stroke-width="1"/>
      <circle cx="19" cy="17" r="2" fill="#374151" stroke="white" stroke-width="1"/>
      ${isOnline ? '<circle cx="20" cy="6" r="3" fill="#22c55e" stroke="white" stroke-width="1"/>' : ''}
    </svg>
  `;
  
  return el;
};

export const MultiDriverMapMapLibre: React.FC<MultiDriverMapMapLibreProps> = ({
  freightId,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  originCity,
  originState,
  destinationCity,
  destinationState,
  className,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);

  const { drivers, isLoading: driversLoading } = useMultiDriverLocations(freightId);

  // ✅ Hook exclusivo: normaliza entradas numéricas (number|string)
  const {
    originLatNum,
    originLngNum,
    destinationLatNum,
    destinationLngNum,
  } = useOngoingFreightMapInputs({
    originLat,
    originLng,
    destinationLat,
    destinationLng,
  });

  // Coordenadas efetivas
  const { 
    originCoords: cityOriginCoords, 
    destinationCoords: cityDestinationCoords,
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

  const effectiveOrigin = useMemo(() => {
    if (typeof originLatNum === 'number' && typeof originLngNum === 'number') {
      return normalizeLatLngPoint({ lat: originLatNum, lng: originLngNum }, 'BR');
    }
    return cityOriginCoords ? normalizeLatLngPoint(cityOriginCoords, 'BR') : null;
  }, [originLatNum, originLngNum, cityOriginCoords]);

  const effectiveDestination = useMemo(() => {
    if (typeof destinationLatNum === 'number' && typeof destinationLngNum === 'number') {
      return normalizeLatLngPoint({ lat: destinationLatNum, lng: destinationLngNum }, 'BR');
    }
    return cityDestinationCoords ? normalizeLatLngPoint(cityDestinationCoords, 'BR') : null;
  }, [destinationLatNum, destinationLngNum, cityDestinationCoords]);

  // OSRM Route
  const { route: osrmRoute } = useOSRMRoute({
    origin: effectiveOrigin,
    destination: effectiveDestination,
    profile: 'driving',
    enabled: !!(effectiveOrigin && effectiveDestination),
  });

  // Centro do mapa
  const mapCenter = useMemo<[number, number]>(() => {
    // Prioridade: motoristas online > centro da rota > origem > destino > Brasil
    const onlineDrivers = drivers.filter(d => d.isOnline && d.lat && d.lng);
    if (onlineDrivers.length > 0) {
      const avgLat = onlineDrivers.reduce((sum, d) => sum + (d.lat || 0), 0) / onlineDrivers.length;
      const avgLng = onlineDrivers.reduce((sum, d) => sum + (d.lng || 0), 0) / onlineDrivers.length;
      return [avgLng, avgLat];
    }

    if (effectiveOrigin && effectiveDestination) {
      return [(effectiveOrigin.lng + effectiveDestination.lng) / 2, (effectiveOrigin.lat + effectiveDestination.lat) / 2];
    }

    if (effectiveOrigin) return [effectiveOrigin.lng, effectiveOrigin.lat];
    if (effectiveDestination) return [effectiveDestination.lng, effectiveDestination.lat];

    return DEFAULT_CENTER;
  }, [drivers, effectiveOrigin, effectiveDestination]);

  // Inicializar mapa
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const map = new maplibregl.Map({
      container,
      style: RURAL_STYLE_INLINE,
      center: mapCenter,
      zoom: 8,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      // Layer para rota
      const routeCoords = osrmRoute?.coordinates || [];
      map.addSource('route', {
        type: 'geojson',
        data: routeCoords.length >= 2 
          ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeCoords } }
          : { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        paint: { 'line-color': MAP_COLORS.primary, 'line-width': 4, 'line-opacity': 0.8 },
      });

      setMapLoaded(true);
    });

    mapRef.current = map;

    return () => {
      driverMarkersRef.current.forEach(m => m.remove());
      driverMarkersRef.current.clear();
      originMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualizar rota
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const source = mapRef.current.getSource('route') as maplibregl.GeoJSONSource;
    if (!source) return;

    const coords = osrmRoute?.coordinates || [];
    source.setData(coords.length >= 2
      ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
      : { type: 'FeatureCollection', features: [] }
    );
  }, [osrmRoute, mapLoaded]);

  // Atualizar marcadores de origem/destino
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Origem
    if (effectiveOrigin) {
      if (!originMarkerRef.current) {
        originMarkerRef.current = new maplibregl.Marker({ element: createLocationMarkerElement('origin'), anchor: 'bottom' })
          .setLngLat([effectiveOrigin.lng, effectiveOrigin.lat])
          .addTo(mapRef.current);
      } else {
        originMarkerRef.current.setLngLat([effectiveOrigin.lng, effectiveOrigin.lat]);
      }
    }

    // Destino
    if (effectiveDestination) {
      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = new maplibregl.Marker({ element: createLocationMarkerElement('destination'), anchor: 'bottom' })
          .setLngLat([effectiveDestination.lng, effectiveDestination.lat])
          .addTo(mapRef.current);
      } else {
        destinationMarkerRef.current.setLngLat([effectiveDestination.lng, effectiveDestination.lat]);
      }
    }
  }, [effectiveOrigin, effectiveDestination, mapLoaded]);

  // Atualizar marcadores de motoristas
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const currentDriverIds = new Set(drivers.map(d => d.driverId));

    // Remover markers de motoristas que saíram
    driverMarkersRef.current.forEach((marker, driverId) => {
      if (!currentDriverIds.has(driverId)) {
        marker.remove();
        driverMarkersRef.current.delete(driverId);
      }
    });

    // Adicionar/atualizar markers
    drivers.forEach((driver, index) => {
      if (!driver.lat || !driver.lng) return;

      // ✅ CORREÇÃO: Normalizar coordenadas antes de usar no mapa
      const normalized = normalizeLatLngPoint({ lat: driver.lat, lng: driver.lng }, 'BR');
      if (!normalized) {
        console.warn('[MultiDriverMapMapLibre] Invalid driver coordinates:', driver.driverId, driver.lat, driver.lng);
        return;
      }

      const existingMarker = driverMarkersRef.current.get(driver.driverId);
      
      if (existingMarker) {
        // Atualizar posição (coordenadas normalizadas)
        existingMarker.setLngLat([normalized.lng, normalized.lat]);
        
        // ✅ CORREÇÃO: Reconstruir marker para atualizar visual de online/offline
        // replaceWith não funciona bem com MapLibre, remover e recriar
        existingMarker.remove();
        const el = createTruckMarkerElement(index, driver.driverName, driver.isOnline);
        const newMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([normalized.lng, normalized.lat])
          .addTo(mapRef.current!);
        driverMarkersRef.current.set(driver.driverId, newMarker);
      } else {
        // Criar novo marker
        const el = createTruckMarkerElement(index, driver.driverName, driver.isOnline);
        // ✅ CORREÇÃO: anchor: 'center' para ícones de caminhão (não são pins)
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([normalized.lng, normalized.lat])
          .addTo(mapRef.current!);
        
        driverMarkersRef.current.set(driver.driverId, marker);
      }
    });

    // Ajustar bounds para mostrar todos
    if (drivers.some(d => d.lat && d.lng) || effectiveOrigin || effectiveDestination) {
      const points: { lat: number; lng: number }[] = [];
      
      drivers.forEach(d => {
        if (d.lat && d.lng) points.push({ lat: d.lat, lng: d.lng });
      });
      
      if (effectiveOrigin) points.push(effectiveOrigin);
      if (effectiveDestination) points.push(effectiveDestination);

      if (points.length >= 2) {
        const bounds = calculateBounds(points);
        mapRef.current?.fitBounds(bounds as any, { padding: 60, maxZoom: 14, duration: 500 });
      }
    }
  }, [drivers, mapLoaded, effectiveOrigin, effectiveDestination]);

  const onlineCount = drivers.filter(d => d.isOnline).length;

  return (
    <div className={cn("relative", className)}>
      {/* Header com contagem */}
      <div className="absolute top-2 left-2 z-10 flex gap-2">
        <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm">
          <Users className="h-3 w-3 mr-1" />
          {drivers.length} motorista{drivers.length !== 1 ? 's' : ''}
        </Badge>
        {onlineCount > 0 && (
          <Badge variant="default" className="bg-green-600">
            {onlineCount} online
          </Badge>
        )}
        {onlineCount === 0 && drivers.length > 0 && (
          <Badge variant="outline" className="bg-background/90 backdrop-blur-sm">
            <WifiOff className="h-3 w-3 mr-1" />
            Todos offline
          </Badge>
        )}
      </div>

      {/* Mapa */}
      <div 
        ref={mapContainerRef} 
        className="w-full rounded-lg overflow-hidden"
        style={{ height: '280px' }}
      />

      {/* Loading */}
      {driversLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
};
