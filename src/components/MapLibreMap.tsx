/**
 * src/components/MapLibreMap.tsx
 * 
 * Componente de mapa genérico usando MapLibre GL JS + OpenStreetMap.
 * Substitui GoogleMap.tsx - 100% gratuito, sem API key.
 */

import React, { useRef, useEffect, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RURAL_STYLE_INLINE, DEFAULT_CENTER, MAP_COLORS } from '@/config/maplibre';
import { Loader2 } from 'lucide-react';

interface MapLibreMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  markers?: Array<{
    position: { lat: number; lng: number };
    title: string;
    info?: string;
  }>;
  onClick?: (lat: number, lng: number) => void;
}

const MapLibreMap: React.FC<MapLibreMapProps> = ({
  center = { lat: -14.235, lng: -51.925 }, // Centro do Brasil
  zoom = 5,
  className = "w-full h-[400px]",
  markers = [],
  onClick
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: RURAL_STYLE_INLINE,
        center: [center.lng, center.lat],
        zoom,
      });

      // Controles de navegação
      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      map.on('load', () => {
        setIsLoading(false);

        // Adicionar listener de click se fornecido
        if (onClick) {
          map.on('click', (e) => {
            onClick(e.lngLat.lat, e.lngLat.lng);
          });
        }

        // Adicionar marcadores
        markers.forEach((marker) => {
          const el = document.createElement('div');
          el.className = 'w-6 h-6 rounded-full bg-primary border-2 border-white shadow-lg cursor-pointer';
          el.style.backgroundColor = MAP_COLORS.primary;

          const mapMarker = new maplibregl.Marker({ element: el })
            .setLngLat([marker.position.lng, marker.position.lat])
            .addTo(map);

          if (marker.info) {
            mapMarker.setPopup(
              new maplibregl.Popup({ offset: 25 }).setHTML(
                `<div class="p-2"><strong>${marker.title}</strong><p class="text-sm">${marker.info}</p></div>`
              )
            );
          }

          markersRef.current.push(mapMarker);
        });
      });

      map.on('error', (e) => {
        console.error('[MapLibreMap] Error:', e);
        setError('Erro ao carregar o mapa');
        setIsLoading(false);
      });

      mapRef.current = map;
    } catch (err) {
      console.error('[MapLibreMap] Init error:', err);
      setError('Erro ao inicializar o mapa');
      setIsLoading(false);
    }

    return () => {
      // Cleanup markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      
      // Cleanup map
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualizar centro quando mudar
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.setCenter([center.lng, center.lat]);
    }
  }, [center.lat, center.lng]);

  // Atualizar zoom quando mudar
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setZoom(zoom);
    }
  }, [zoom]);

  // Atualizar markers quando mudarem
  useEffect(() => {
    if (!mapRef.current) return;

    // Remover markers antigos
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Adicionar novos markers
    markers.forEach((marker) => {
      const el = document.createElement('div');
      el.className = 'w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-pointer';
      el.style.backgroundColor = MAP_COLORS.primary;

      const mapMarker = new maplibregl.Marker({ element: el })
        .setLngLat([marker.position.lng, marker.position.lat])
        .addTo(mapRef.current!);

      if (marker.info) {
        mapMarker.setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(
            `<div class="p-2"><strong>${marker.title}</strong><p class="text-sm">${marker.info}</p></div>`
          )
        );
      }

      markersRef.current.push(mapMarker);
    });
  }, [markers]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded-lg ${className}`}>
        <div className="text-center p-4">
          <p className="text-muted-foreground font-medium">Mapa indisponível</p>
          <p className="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10 rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div ref={mapContainerRef} className="w-full h-full rounded-lg" />
    </div>
  );
};

export default MapLibreMap;
