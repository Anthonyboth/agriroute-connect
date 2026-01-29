/**
 * src/components/map/MapLibreMap.tsx
 * 
 * Componente base de mapa usando MapLibre GL JS + OpenStreetMap.
 * Zero dependência de Google Maps ou APIs pagas.
 */

import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { RURAL_STYLE_INLINE, DEFAULT_CENTER, DEFAULT_ZOOM, MAP_COLORS } from '@/config/maplibre';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  element?: HTMLElement;
  popup?: string;
}

export interface MapLibreMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  markers?: MapMarker[];
  onClick?: (lngLat: { lat: number; lng: number }) => void;
  onLoad?: (map: maplibregl.Map) => void;
  children?: React.ReactNode;
}

export interface MapLibreMapRef {
  map: maplibregl.Map | null;
  fitBounds: (bounds: maplibregl.LngLatBounds, padding?: number) => void;
  panTo: (lngLat: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  addMarker: (marker: MapMarker) => maplibregl.Marker;
  removeMarker: (id: string) => void;
}

export const MapLibreMap = forwardRef<MapLibreMapRef, MapLibreMapProps>(({
  center,
  zoom = DEFAULT_ZOOM,
  className,
  markers = [],
  onClick,
  onLoad,
  children,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expose map methods via ref
  useImperativeHandle(ref, () => ({
    map: mapRef.current,
    fitBounds: (bounds: maplibregl.LngLatBounds, padding = 50) => {
      mapRef.current?.fitBounds(bounds, { padding });
    },
    panTo: (lngLat: { lat: number; lng: number }) => {
      mapRef.current?.panTo([lngLat.lng, lngLat.lat]);
    },
    setZoom: (z: number) => {
      mapRef.current?.setZoom(z);
    },
    addMarker: (marker: MapMarker) => {
      if (!mapRef.current) throw new Error('Map not initialized');
      
      const markerInstance = new maplibregl.Marker({
        element: marker.element,
      })
        .setLngLat([marker.lng, marker.lat])
        .addTo(mapRef.current);
      
      if (marker.popup) {
        markerInstance.setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(marker.popup)
        );
      }
      
      markersRef.current.set(marker.id, markerInstance);
      return markerInstance;
    },
    removeMarker: (id: string) => {
      const marker = markersRef.current.get(id);
      if (marker) {
        marker.remove();
        markersRef.current.delete(id);
      }
    },
  }), []);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    try {
      const initialCenter: [number, number] = center 
        ? [center.lng, center.lat] 
        : DEFAULT_CENTER;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: RURAL_STYLE_INLINE,
        center: initialCenter,
        zoom,
        attributionControl: {},
      });

      // Add navigation controls
      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Handle click events
      if (onClick) {
        map.on('click', (e) => {
          onClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
        });
      }

      // Handle load
      map.on('load', () => {
        setIsLoading(false);
        onLoad?.(map);
        console.log('[MapLibreMap] Map loaded successfully');
      });

      // Handle error
      map.on('error', (e) => {
        console.error('[MapLibreMap] Map error:', e);
        setError('Erro ao carregar o mapa');
      });

      mapRef.current = map;

    } catch (err) {
      console.error('[MapLibreMap] Initialization error:', err);
      setError('Erro ao inicializar o mapa');
      setIsLoading(false);
    }

    return () => {
      // Cleanup markers
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      
      // Cleanup map
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center when prop changes
  useEffect(() => {
    if (mapRef.current && center) {
      mapRef.current.panTo([center.lng, center.lat]);
    }
  }, [center?.lat, center?.lng]);

  // Manage markers
  useEffect(() => {
    if (!mapRef.current || isLoading) return;

    const currentIds = new Set(markers.map(m => m.id));
    
    // Remove old markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    markers.forEach((markerData) => {
      const existing = markersRef.current.get(markerData.id);
      
      if (existing) {
        // Update position
        existing.setLngLat([markerData.lng, markerData.lat]);
      } else {
        // Create new marker
        const markerInstance = new maplibregl.Marker({
          element: markerData.element,
        })
          .setLngLat([markerData.lng, markerData.lat])
          .addTo(mapRef.current!);

        if (markerData.popup) {
          markerInstance.setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(markerData.popup)
          );
        }

        markersRef.current.set(markerData.id, markerInstance);
      }
    });
  }, [markers, isLoading]);

  if (error) {
    return (
      <div className={cn(
        "flex items-center justify-center bg-muted/30 rounded-lg border border-destructive/20",
        className
      )} style={{ minHeight: '200px' }}>
        <div className="text-center text-muted-foreground p-4">
          <p className="font-medium text-destructive">{error}</p>
          <p className="text-sm mt-1">Verifique sua conexão e tente novamente</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative rounded-lg overflow-hidden", className)} style={{ minHeight: '200px' }}>
      {/* Map container - IMPORTANTE: dimensões explícitas para MapLibre */}
      <div 
        ref={containerRef} 
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50 z-10">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Carregando mapa...</span>
          </div>
        </div>
      )}

      {/* Children overlay */}
      {children}
    </div>
  );
});

MapLibreMap.displayName = 'MapLibreMap';

export default MapLibreMap;
