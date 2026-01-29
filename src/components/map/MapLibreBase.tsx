/**
 * src/components/map/MapLibreBase.tsx
 * 
 * Componente base padronizado para mapas MapLibre no AgriRoute.
 * 
 * Features:
 * - Verificação de suporte WebGL
 * - Fallback amigável quando não suportado
 * - Loader padronizado único
 * - Auto-resize em Tabs/Dialogs/Panels
 * - Markers via props
 * - Children overlay
 * - Tratamento centralizado de erros
 */

import React, { useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMapLibreSupport,
  useMapLibreMap,
  useMapLibreMarkers,
  useMapLibreControls,
  type MapLibreMarkerData,
} from '@/hooks/maplibre';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/config/maplibre';

// ==================== Types ====================

export interface MapLibreBaseProps {
  /** Centro do mapa { lat, lng } */
  center?: { lat: number; lng: number };
  /** Zoom inicial */
  zoom?: number;
  /** Classes CSS */
  className?: string;
  /** Altura mínima do mapa */
  minHeight?: number;
  /** Markers a exibir */
  markers?: MapLibreMarkerData[];
  /** Mostrar controles de navegação */
  showNavigationControl?: boolean;
  /** Callback de click no mapa */
  onClick?: (lngLat: { lat: number; lng: number }) => void;
  /** Callback quando mapa carregar */
  onLoad?: (map: maplibregl.Map) => void;
  /** Callback de erro */
  onError?: (error: Error) => void;
  /** Factory para criar elementos de marker */
  markerFactory?: (marker: MapLibreMarkerData) => HTMLElement | undefined;
  /** Children overlay (badges, botões, etc) */
  children?: React.ReactNode;
}

export interface MapLibreBaseRef {
  /** Instância do mapa MapLibre */
  map: maplibregl.Map | null;
  /** Pan suave para posição */
  panTo: (lat: number, lng: number) => void;
  /** Fly com animação */
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  /** Ajustar para incluir todos os pontos */
  fitBounds: (points: Array<{ lat: number; lng: number } | null | undefined>, padding?: number) => void;
  /** Definir zoom */
  setZoom: (zoom: number) => void;
  /** Centralizar no Brasil */
  centerOnBrazil: () => void;
  /** Forçar resize */
  resize: () => void;
}

// ==================== Component ====================

export const MapLibreBase = forwardRef<MapLibreBaseRef, MapLibreBaseProps>(({
  center,
  zoom = DEFAULT_ZOOM,
  className,
  minHeight = 280,
  markers = [],
  showNavigationControl = true,
  onClick,
  onLoad,
  onError,
  markerFactory,
  children,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Verificar suporte WebGL
  const { supported, reason, checking } = useMapLibreSupport();

  // 2. Converter center para formato [lng, lat]
  const mapCenter = useMemo<[number, number]>(() => {
    if (center && typeof center.lat === 'number' && typeof center.lng === 'number') {
      return [center.lng, center.lat];
    }
    return DEFAULT_CENTER;
  }, [center?.lat, center?.lng]);

  // 3. Inicializar mapa
  const { mapRef, isLoading, error, isReady } = useMapLibreMap({
    containerRef,
    center: mapCenter,
    zoom,
    showNavigationControl,
    onLoad,
    onError,
    onClick,
  });

  // 4. Gerenciar markers
  useMapLibreMarkers(mapRef, markers, { markerFactory });

  // 5. Controles de navegação
  const controls = useMapLibreControls(mapRef);

  // 6. Expor métodos via ref
  useImperativeHandle(ref, () => ({
    map: mapRef.current,
    panTo: controls.panTo,
    flyTo: controls.flyTo,
    fitBounds: controls.fitBounds,
    setZoom: controls.setZoom,
    centerOnBrazil: controls.centerOnBrazil,
    resize: () => {
      try {
        mapRef.current?.resize();
      } catch {}
    },
  }), [controls, mapRef]);

  // ==================== Renders ====================

  // Verificando suporte
  if (checking) {
    return (
      <Skeleton 
        className={cn("rounded-lg", className)} 
        style={{ minHeight: `${minHeight}px` }} 
      />
    );
  }

  // WebGL não suportado
  if (!supported) {
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center bg-muted/30 rounded-lg border border-destructive/20 p-4 text-center",
          className
        )}
        style={{ minHeight: `${minHeight}px` }}
      >
        <AlertTriangle className="h-10 w-10 text-destructive/60 mb-3" />
        <p className="font-medium text-destructive">Mapa indisponível</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          {reason || 'Seu navegador não suporta a exibição de mapas.'}
        </p>
      </div>
    );
  }

  // Erro de inicialização
  if (error) {
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center bg-muted/30 rounded-lg border border-destructive/20 p-4 text-center",
          className
        )}
        style={{ minHeight: `${minHeight}px` }}
      >
        <MapPin className="h-10 w-10 text-muted-foreground/60 mb-3" />
        <p className="font-medium text-destructive">Erro ao carregar mapa</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">{error}</p>
      </div>
    );
  }

  return (
    <div 
      className={cn("relative rounded-lg overflow-hidden", className)}
      style={{ minHeight: `${minHeight}px` }}
    >
      {/* Container do mapa - dimensões explícitas obrigatórias */}
      <div 
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Loading overlay - Skeleton padronizado */}
      {isLoading && (
        <div className="absolute inset-0 z-10">
          <Skeleton className="w-full h-full" />
        </div>
      )}

      {/* Children overlay (badges, botões, etc) */}
      {isReady && children}
    </div>
  );
});

MapLibreBase.displayName = 'MapLibreBase';

export default MapLibreBase;
