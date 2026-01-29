/**
 * src/components/driver-details/DriverLocationMapMapLibre.tsx
 * 
 * Mapa de localização do motorista usando MapLibre GL JS.
 * REFATORADO: Usa MapLibreBase para arquitetura padronizada.
 */

import { useMemo, useRef, useCallback } from 'react';
import { MapLibreBase, type MapLibreBaseRef } from '@/components/map/MapLibreBase';
import { type MapLibreMarkerData } from '@/hooks/maplibre';
import { createTruckMarkerElement } from '@/lib/maplibre-utils';

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

  // Marker do motorista
  const markers = useMemo<MapLibreMarkerData[]>(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return [];
    
    return [{
      id: 'driver-location',
      lat,
      lng,
      popup: `
        <div style="padding: 8px;">
          <h3 style="margin: 0 0 8px 0; font-weight: 600;">${driverName || 'Motorista'}</h3>
          <p style="margin: 0; font-size: 14px; color: #666;">Última localização conhecida</p>
        </div>
      `,
    }];
  }, [lat, lng, driverName]);

  // Factory para criar elemento do marker
  const markerFactory = useCallback(() => {
    return createTruckMarkerElement(true);
  }, []);

  // Centralizar quando coordenadas mudarem
  const handleLoad = useCallback(() => {
    if (mapRef.current && lat && lng) {
      mapRef.current.flyTo(lat, lng, 15);
    }
  }, [lat, lng]);

  return (
    <MapLibreBase
      ref={mapRef}
      center={{ lat, lng }}
      zoom={15}
      className={className}
      minHeight={400}
      markers={markers}
      markerFactory={markerFactory}
      onLoad={handleLoad}
      showNavigationControl
    />
  );
};
