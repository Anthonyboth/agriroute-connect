/**
 * src/components/driver-details/DriverLocationMapMapLibre.tsx
 * 
 * Mapa de localização do motorista usando MapLibre GL JS.
 * Substitui a versão Google Maps - 100% gratuito.
 */

import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RURAL_STYLE_INLINE, MAP_COLORS } from '@/config/maplibre';
import { createTruckMarkerElement } from '@/lib/maplibre-utils';
import { Loader2 } from 'lucide-react';

interface DriverLocationMapMapLibreProps {
  lat: number;
  lng: number;
  driverName?: string;
}

export const DriverLocationMapMapLibre = ({ lat, lng, driverName }: DriverLocationMapMapLibreProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: RURAL_STYLE_INLINE,
      center: [lng, lat],
      zoom: 15,
    });

    // Controles de navegação
    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('load', () => {
      setIsLoading(false);

      // Criar marker do motorista
      const marker = new maplibregl.Marker({
        element: createTruckMarkerElement(true),
      })
        .setLngLat([lng, lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div style="padding: 8px;">
              <h3 style="margin: 0 0 8px 0; font-weight: 600;">${driverName || 'Motorista'}</h3>
              <p style="margin: 0; font-size: 14px; color: #666;">Última localização conhecida</p>
            </div>
          `)
        )
        .addTo(map);

      markerRef.current = marker;
    });

    mapRef.current = map;

    return () => {
      markerRef.current?.remove();
      map.remove();
    };
  }, []);

  // Atualizar posição quando coordenadas mudarem
  useEffect(() => {
    if (mapRef.current && markerRef.current) {
      markerRef.current.setLngLat([lng, lat]);
      mapRef.current.panTo([lng, lat]);
    }
  }, [lat, lng]);

  return (
    <div className="relative w-full h-[400px] rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 z-10">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};
