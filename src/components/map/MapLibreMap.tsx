/**
 * src/components/map/MapLibreMap.tsx
 * 
 * Componente de mapa genérico usando MapLibre GL JS + OpenStreetMap.
 * REFATORADO: Wrapper simples sobre MapLibreBase para compatibilidade.
 * 
 * @deprecated Use MapLibreBase diretamente para novos componentes.
 */

import React, { forwardRef, useImperativeHandle, useRef, useMemo, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import { MapLibreBase, type MapLibreBaseRef } from './MapLibreBase';
import { type GeoJSONMarkerData } from '@/hooks/maplibre';
import { MAP_COLORS } from '@/config/maplibre';

// Interface legada para compatibilidade
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
  addMarker: (marker: MapMarker) => maplibregl.Marker | null;
  removeMarker: (id: string) => void;
}

/**
 * Componente de mapa genérico (wrapper sobre MapLibreBase)
 */
export const MapLibreMap = forwardRef<MapLibreMapRef, MapLibreMapProps>(({
  center,
  zoom = 5,
  className,
  markers = [],
  onClick,
  onLoad,
  children,
}, ref) => {
  const baseRef = useRef<MapLibreBaseRef>(null);

  // Converter markers para formato GeoJSON padronizado
  const normalizedMarkers = useMemo<GeoJSONMarkerData[]>(() => {
    return markers.map((m) => ({
      id: m.id,
      lat: m.lat,
      lng: m.lng,
      type: 'default' as const,
    }));
  }, [markers]);

  // Factory padrão para markers (bolinha verde)
  const defaultMarkerFactory = useCallback(() => {
    const el = document.createElement('div');
    el.className = 'w-6 h-6 rounded-full border-2 border-white shadow-lg cursor-pointer';
    el.style.backgroundColor = MAP_COLORS.primary;
    return el;
  }, []);

  // Expor métodos via ref (interface legada)
  useImperativeHandle(ref, () => ({
    get map() {
      return baseRef.current?.map ?? null;
    },
    fitBounds: (bounds: maplibregl.LngLatBounds, padding = 50) => {
      const map = baseRef.current?.map;
      if (map) {
        map.fitBounds(bounds, { padding });
      }
    },
    panTo: (lngLat: { lat: number; lng: number }) => {
      baseRef.current?.panTo(lngLat.lat, lngLat.lng);
    },
    setZoom: (z: number) => {
      baseRef.current?.setZoom(z);
    },
    addMarker: (marker: MapMarker) => {
      // Não suportado mais - use markers prop
      console.warn('[MapLibreMap] addMarker deprecated - use markers prop');
      return null;
    },
    removeMarker: (id: string) => {
      // Não suportado mais - use markers prop
      console.warn('[MapLibreMap] removeMarker deprecated - use markers prop');
    },
  }), []);

  return (
    <MapLibreBase
      ref={baseRef}
      center={center}
      zoom={zoom}
      className={className}
      markers={normalizedMarkers}
      onClick={onClick}
      onLoad={onLoad}
      showNavigationControl
    >
      {children}
    </MapLibreBase>
  );
});

MapLibreMap.displayName = 'MapLibreMap';

export default MapLibreMap;
