/**
 * src/components/map/MapLibreBase.tsx
 * 
 * Componente base padronizado para mapas MapLibre no AgriRoute.
 * 
 * ✅ CORRIGIDO P1: Container SEMPRE montado (sem early-return que impeça ref)
 * ✅ CORRIGIDO P2: Markers via GeoJSON layers (sem DOM Markers)
 * ✅ Overlays absolutos para checking/unsupported/error/loading
 * ✅ Resize burst após transitionend de Drawer/Dialog
 */

import React, { useRef, forwardRef, useImperativeHandle, useMemo, useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cn } from '@/lib/utils';
import { AlertTriangle, MapPin } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useMapLibreSupport,
  useMapLibreMap,
  useMapLibreGeoJSONLayers,
  useMapLibreControls,
  type GeoJSONMarkerData,
} from '@/hooks/maplibre';
import { DEFAULT_CENTER, DEFAULT_ZOOM } from '@/config/maplibre';

// ==================== Types ====================

export interface MapLibreBaseProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  minHeight?: number;
  markers?: GeoJSONMarkerData[];
  showNavigationControl?: boolean;
  onClick?: (lngLat: { lat: number; lng: number }) => void;
  onLoad?: (map: maplibregl.Map) => void;
  onError?: (error: Error) => void;
  onMarkerClick?: (marker: GeoJSONMarkerData) => void;
  children?: React.ReactNode;
}

export interface MapLibreBaseRef {
  map: maplibregl.Map | null;
  panTo: (lat: number, lng: number) => void;
  flyTo: (lat: number, lng: number, zoom?: number) => void;
  fitBounds: (points: Array<{ lat: number; lng: number } | null | undefined>, padding?: number) => void;
  setZoom: (zoom: number) => void;
  centerOnBrazil: () => void;
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
  onMarkerClick,
  children,
}, ref) => {
  if (import.meta.env.DEV && markers?.length) console.log("[MapLibreBase] markers count:", markers.length);

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

  // 3. Inicializar mapa (inclui auto-resize com burst para Drawers)
  // ✅ P1: containerRef SEMPRE existe porque não há early-return antes do render
  const { mapRef, isLoading, error, isReady } = useMapLibreMap({
    containerRef,
    center: mapCenter,
    zoom,
    showNavigationControl,
    onLoad,
    onError,
    onClick,
  });

  // ✅ P2: Marcadores via GeoJSON layers (NÃO DOM Markers)
  useMapLibreGeoJSONLayers(mapRef, markers, {
    onPointClick: onMarkerClick,
    circleColor: '#111827',
    circleRadius: 8,
    strokeColor: '#ffffff',
    strokeWidth: 2,
  });

  // 5. Controles de navegação
  const controls = useMapLibreControls(mapRef);

  // ✅ P2: Resize burst após transitionend de Drawer/Dialog ancestors
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTransitionEnd = () => {
      const map = mapRef.current;
      if (!map) return;
      // Burst de resizes para garantir canvas correto após animação
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          try { map.resize(); } catch {}
        }, i * 80);
      }
    };

    // Ouvir transitionend em ancestors (Dialog/Drawer content)
    // Bubble up: qualquer transitionend que chegue ao container dispara resize
    const wrapper = container.closest('[role="dialog"], [data-vaul-drawer], [data-state]');
    if (wrapper) {
      wrapper.addEventListener('transitionend', handleTransitionEnd);
      return () => wrapper.removeEventListener('transitionend', handleTransitionEnd);
    }
  }, [mapRef]);

  // ✅ DEV log quando isReady muda
  useEffect(() => {
    if (import.meta.env.DEV && isReady) {
      console.log('[MapLibreBase] ✅ isReady=true');
    }
  }, [isReady]);

  // 6. Expor métodos via ref
  useImperativeHandle(ref, () => ({
    map: mapRef.current,
    panTo: controls.panTo,
    flyTo: controls.flyTo,
    fitBounds: controls.fitBounds,
    setZoom: controls.setZoom,
    centerOnBrazil: controls.centerOnBrazil,
    resize: () => {
      try { mapRef.current?.resize(); } catch {}
    },
  }), [controls, mapRef]);

  // ==================== Render ====================
  // ✅ P1: Container SEMPRE montado. Estados de checking/unsupported/error/loading
  //    são OVERLAYS absolutos por cima do container, nunca early-returns.

  return (
    <div 
      className={cn("relative rounded-lg overflow-hidden", className)}
      style={{ minHeight: `${minHeight}px` }}
    >
      {/* ✅ P1: Container do mapa - SEMPRE montado, nunca removido do DOM */}
      <div 
        ref={containerRef}
        className="absolute inset-0"
        style={{ width: '100%', height: '100%' }}
      />

      {/* ✅ OVERLAY: Verificando suporte WebGL */}
      {checking && (
        <div className="absolute inset-0 z-10">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      )}

      {/* ✅ OVERLAY: WebGL não suportado */}
      {!checking && !supported && (
        <div 
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-muted/95 rounded-lg border border-destructive/20 p-4 text-center"
        >
          <AlertTriangle className="h-10 w-10 text-destructive/60 mb-3" />
          <p className="font-medium text-destructive">Mapa indisponível</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {reason || 'Seu navegador não suporta a exibição de mapas.'}
          </p>
        </div>
      )}

      {/* ✅ OVERLAY: Erro de inicialização */}
      {!checking && supported && error && (
        <div 
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-muted/95 rounded-lg border border-destructive/20 p-4 text-center"
        >
          <MapPin className="h-10 w-10 text-muted-foreground/60 mb-3" />
          <p className="font-medium text-destructive">Erro ao carregar mapa</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">{error}</p>
        </div>
      )}

      {/* ✅ OVERLAY: Loading (mapa inicializando) */}
      {!checking && supported && !error && isLoading && (
        <div className="absolute inset-0 z-10">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      )}

      {/* Children overlay (badges, botões, etc) */}
      {isReady && children}
    </div>
  );
});

MapLibreBase.displayName = 'MapLibreBase';

export default MapLibreBase;
