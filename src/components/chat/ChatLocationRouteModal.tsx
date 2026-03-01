/**
 * ChatLocationRouteModal.tsx
 * 
 * Modal com mapa MapLibre mostrando rota entre a posição do usuário (A)
 * e a localização compartilhada (B).
 * Usa OSRM para cálculo de rota gratuito.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Navigation, Loader2, AlertCircle, ExternalLink } from 'lucide-react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { getCurrentPositionSafe } from '@/utils/location';

interface ChatLocationRouteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  destinationLat: number;
  destinationLng: number;
  destinationAddress?: string;
}

export const ChatLocationRouteModal: React.FC<ChatLocationRouteModalProps> = ({
  open,
  onOpenChange,
  destinationLat,
  destinationLng,
  destinationAddress,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ distance: string; duration: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoute = useCallback(async (
    map: maplibregl.Map,
    origin: { lat: number; lng: number },
    dest: { lat: number; lng: number }
  ) => {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.code !== 'Ok' || !data.routes?.[0]) {
        throw new Error('Rota não encontrada');
      }

      const route = data.routes[0];
      const distKm = (route.distance / 1000).toFixed(1);
      const durMin = Math.round(route.duration / 60);
      setRouteInfo({
        distance: `${distKm} km`,
        duration: durMin < 60
          ? `${durMin} min`
          : `${Math.floor(durMin / 60)}h ${durMin % 60}min`,
      });

      // Add route line
      if (map.getSource('route')) {
        (map.getSource('route') as maplibregl.GeoJSONSource).setData(route.geometry);
      } else {
        map.addSource('route', {
          type: 'geojson',
          data: route.geometry,
        });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#3b82f6',
            'line-width': 5,
            'line-opacity': 0.8,
          },
        });
      }

      // Fit bounds
      const coords = route.geometry.coordinates as [number, number][];
      const bounds = coords.reduce(
        (b, c) => b.extend(c as [number, number]),
        new maplibregl.LngLatBounds(coords[0], coords[0])
      );
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    } catch (err) {
      console.error('[ChatLocationRouteModal] Erro ao buscar rota:', err);
      // Fallback: just show both points
      const bounds = new maplibregl.LngLatBounds()
        .extend([origin.lng, origin.lat])
        .extend([dest.lng, dest.lat]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 15 });
    }
  }, []);

  const initMap = useCallback(async () => {
    if (!mapContainerRef.current || !open) return;
    setLoading(true);
    setError(null);

    // Get user location
    let myLoc: { lat: number; lng: number } | null = null;
    try {
      const pos = await getCurrentPositionSafe();
      if (pos) {
        myLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(myLoc);
      }
    } catch (err) {
      console.warn('[ChatLocationRouteModal] Sem acesso à localização:', err);
    }

    // Init map
    const center: [number, number] = [destinationLng, destinationLat];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center,
      zoom: 13,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', async () => {
      // Destination marker (B - red)
      const destEl = document.createElement('div');
      destEl.innerHTML = `<div style="background:#ef4444;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">B</div>`;
      new maplibregl.Marker({ element: destEl })
        .setLngLat([destinationLng, destinationLat])
        .addTo(map);

      // Origin marker (A - green) if we have user location
      if (myLoc) {
        const originEl = document.createElement('div');
        originEl.innerHTML = `<div style="background:#22c55e;color:white;border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.3);border:2px solid white;">A</div>`;
        new maplibregl.Marker({ element: originEl })
          .setLngLat([myLoc.lng, myLoc.lat])
          .addTo(map);

        await fetchRoute(map, myLoc, { lat: destinationLat, lng: destinationLng });
      }

      setLoading(false);

      // Resize burst for modal animation
      setTimeout(() => map.resize(), 150);
      setTimeout(() => map.resize(), 400);
    });

    map.on('error', () => {
      setError('Erro ao carregar o mapa');
      setLoading(false);
    });
  }, [open, destinationLat, destinationLng, fetchRoute]);

  useEffect(() => {
    if (open) {
      // Small delay for dialog animation
      const timer = setTimeout(initMap, 200);
      return () => {
        clearTimeout(timer);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    } else {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setRouteInfo(null);
      setUserLocation(null);
      setLoading(true);
    }
  }, [open, initMap]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Navigation className="h-5 w-5 text-primary" />
            Localização Compartilhada
          </DialogTitle>
        </DialogHeader>

        {/* Route info bar */}
        {routeInfo && (
          <div className="px-4 pb-2 flex items-center gap-3">
            <Badge variant="outline" className="text-xs gap-1">
              <MapPin className="h-3 w-3" />
              {routeInfo.distance}
            </Badge>
            <Badge variant="outline" className="text-xs gap-1">
              🕐 {routeInfo.duration}
            </Badge>
          </div>
        )}

        {!userLocation && !loading && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 p-2 rounded">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>Sem acesso à sua localização. Mostrando apenas o destino.</span>
            </div>
          </div>
        )}

        {/* Map container */}
        <div className="relative w-full h-[350px]">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Carregando mapa...</span>
              </div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
              <div className="flex flex-col items-center gap-2 text-destructive">
                <AlertCircle className="h-6 w-6" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* Footer actions */}
        <div className="p-4 pt-2 flex gap-2">
          {destinationAddress && (
            <p className="text-xs text-muted-foreground flex-1 self-center truncate">
              {destinationAddress}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            asChild
            className="flex-shrink-0"
          >
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Google Maps
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
