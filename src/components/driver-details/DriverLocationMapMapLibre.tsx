/**
 * src/components/driver-details/DriverLocationMapMapLibre.tsx
 * 
 * Mapa de localização do motorista usando MapLibre GL JS.
 * REFATORADO: Usa MapLibreBase para arquitetura padronizada.
 * ✅ CORRIGIDO: Normaliza coordenadas antes de exibir para evitar markers incorretos.
 */

import { useMemo, useRef, useCallback } from 'react';
import { MapLibreBase, type MapLibreBaseRef } from '@/components/map/MapLibreBase';
import { type GeoJSONMarkerData } from '@/hooks/maplibre';
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';

interface DriverLocationMapMapLibreProps {
  lat: number;
  lng: number;
  driverName?: string;
  className?: string;
}

export const DriverLocationMapMapLibre = ({ 
  lat, 
  lng, 
  driverName,
  className 
}: DriverLocationMapMapLibreProps) => {
  const mapRef = useRef<MapLibreBaseRef>(null);

  // ✅ Normalizar coordenadas para corrigir lat/lng invertidos ou micrograus
  const normalizedLocation = useMemo(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return null;
    }
    return normalizeLatLngPoint({ lat, lng }, 'BR');
  }, [lat, lng]);

  // ✅ Marker do motorista via GeoJSON layer (imune a transform de Dialog/Drawer)
  const markers = useMemo<GeoJSONMarkerData[]>(() => {
    if (!normalizedLocation) return [];
    
    return [{
      id: 'driver-location',
      lat: normalizedLocation.lat,
      lng: normalizedLocation.lng,
      type: 'truck',
      // GPS do motorista: pode ter lat/lng invertido ou micrograus → normalizar
      skipNormalize: false,
      label: driverName ?? 'Motorista',
    }];
  }, [normalizedLocation, driverName]);

  // Centralizar quando coordenadas mudarem (usando coordenadas normalizadas)
  const handleLoad = useCallback(() => {
    if (mapRef.current && normalizedLocation) {
      mapRef.current.flyTo(normalizedLocation.lat, normalizedLocation.lng, 15);
    }
  }, [normalizedLocation]);

  // Se não tiver coordenadas válidas após normalização, não renderizar mapa vazio
  if (!normalizedLocation) {
    return null;
  }

  return (
    <MapLibreBase
      ref={mapRef}
      center={{ lat: normalizedLocation.lat, lng: normalizedLocation.lng }}
      zoom={15}
      className={className}
      minHeight={400}
      markers={markers}
      onLoad={handleLoad}
      showNavigationControl
    />
  );
};
