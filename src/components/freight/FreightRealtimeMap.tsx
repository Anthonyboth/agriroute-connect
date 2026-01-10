/**
 * src/components/freight/FreightRealtimeMap.tsx
 * 
 * Mapa em tempo real para acompanhamento do motorista.
 * Usa Google Maps JS API + Supabase Realtime.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2, WifiOff, Navigation } from 'lucide-react';
import { useFreightRealtimeLocation } from '@/hooks/useFreightRealtimeLocation';
import { 
  RURAL_MAP_STYLE, 
  createTruckMarkerElement, 
  interpolatePosition, 
  calculateBounds,
  formatSecondsAgo 
} from '@/lib/map-utils';
import { cn } from '@/lib/utils';
import { GOOGLE_MAPS_API_KEY, getGoogleMapsErrorMessage } from '@/config/googleMaps';

interface FreightRealtimeMapProps {
  freightId: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  initialDriverLat?: number;
  initialDriverLng?: number;
  lastLocationUpdate?: string;
}

const FreightRealtimeMapComponent: React.FC<FreightRealtimeMapProps> = ({
  freightId,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const cancelAnimationRef = useRef<(() => void) | null>(null);
  const previousLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const { 
    driverLocation, 
    isOnline, 
    secondsAgo, 
    isLoading, 
    error 
  } = useFreightRealtimeLocation(freightId);

  // Inicializar Google Maps
  useEffect(() => {
    if (!mapContainerRef.current || mapLoaded) return;

    const initMap = async () => {
      try {
        if (!GOOGLE_MAPS_API_KEY) {
          setMapError('API Key do Google Maps não configurada');
          return;
        }

        const loader = new Loader({
          apiKey: GOOGLE_MAPS_API_KEY,
          version: 'weekly',
          libraries: ['marker']
        });

        const { Map } = await loader.importLibrary('maps') as google.maps.MapsLibrary;
        await loader.importLibrary('marker');

        if (!mapContainerRef.current) return;

        // Centro inicial: localização do motorista ou centro do Brasil
        const initialCenter = driverLocation || 
          (typeof originLat === 'number' && typeof originLng === 'number' ? { lat: originLat, lng: originLng } : { lat: -14.235, lng: -51.925 });

        mapRef.current = new Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 10,
          // mapId removido - requer configuração no Google Cloud Console
          styles: RURAL_MAP_STYLE,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy', // Melhora UX em mobile
        });

        setMapLoaded(true);
        console.log('[FreightRealtimeMap] Map initialized successfully');

        // Ajustar bounds após carregar, se já houver dados
        setTimeout(() => {
          if (driverLocation || (typeof originLat === 'number') || (typeof destinationLat === 'number')) {
            handleFitBounds();
          }
        }, 0);

      } catch (err) {
        const errorMessage = getGoogleMapsErrorMessage(err);
        console.error('[FreightRealtimeMap] Error initializing map:', errorMessage, err);
        setMapError(errorMessage);
      }
    };

    initMap();

    return () => {
      // Cleanup
      if (cancelAnimationRef.current) {
        cancelAnimationRef.current();
      }
      if (driverMarkerRef.current) {
        driverMarkerRef.current.map = null;
      }
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
      }
    };
  }, [mapLoaded, driverLocation, originLat, originLng]);

  // Atualizar marker do motorista com animação
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !driverLocation) return;

    const updateMarker = async () => {
      try {
        // Criar marker se não existir
        if (!driverMarkerRef.current) {
          const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;
          
          driverMarkerRef.current = new AdvancedMarkerElement({
            map: mapRef.current!,
            position: driverLocation,
            title: 'Motorista',
            content: createTruckMarkerElement(),
          });
          
          previousLocationRef.current = driverLocation;
          console.log('[FreightRealtimeMap] Driver marker created');
          return;
        }

        // Animar para nova posição
        if (previousLocationRef.current) {
          // Cancelar animação anterior se existir
          if (cancelAnimationRef.current) {
            cancelAnimationRef.current();
          }

          cancelAnimationRef.current = interpolatePosition(
            previousLocationRef.current,
            driverLocation,
            1000, // 1 segundo de animação
            (pos) => {
              if (driverMarkerRef.current) {
                driverMarkerRef.current.position = pos;
              }
            },
            () => {
              previousLocationRef.current = driverLocation;
            }
          );
        } else {
          driverMarkerRef.current.position = driverLocation;
          previousLocationRef.current = driverLocation;
        }

      } catch (err) {
        console.error('[FreightRealtimeMap] Error updating marker:', err);
      }
    };

    updateMarker();
  }, [driverLocation, mapLoaded]);

  // Atualizar polyline (origem → motorista → destino)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const points: google.maps.LatLngLiteral[] = [];

    // Usar typeof para evitar falso negativo quando lat/lng = 0
    if (typeof originLat === 'number' && typeof originLng === 'number') {
      points.push({ lat: originLat, lng: originLng });
    }

    if (driverLocation) {
      points.push(driverLocation);
    }

    if (typeof destinationLat === 'number' && typeof destinationLng === 'number') {
      points.push({ lat: destinationLat, lng: destinationLng });
    }

    if (points.length < 2) {
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      return;
    }

    if (!polylineRef.current) {
      polylineRef.current = new google.maps.Polyline({
        path: points,
        geodesic: true,
        strokeColor: '#16a34a',
        strokeOpacity: 0.7,
        strokeWeight: 3,
        map: mapRef.current,
      });
    } else {
      polylineRef.current.setPath(points);
    }

  }, [driverLocation, originLat, originLng, destinationLat, destinationLng, mapLoaded]);

  // Centralizar no motorista
  const handleCenterOnDriver = useCallback(() => {
    if (mapRef.current && driverLocation) {
      mapRef.current.panTo(driverLocation);
      mapRef.current.setZoom(14);
    }
  }, [driverLocation]);

  // Ajustar bounds para mostrar tudo
  const handleFitBounds = useCallback(() => {
    if (!mapRef.current) return;

    const bounds = calculateBounds([
      typeof originLat === 'number' && typeof originLng === 'number' ? { lat: originLat, lng: originLng } : null,
      driverLocation,
      typeof destinationLat === 'number' && typeof destinationLng === 'number' ? { lat: destinationLat, lng: destinationLng } : null,
    ]);

    if (bounds) {
      mapRef.current.fitBounds(bounds, 50);
    }
  }, [originLat, originLng, destinationLat, destinationLng, driverLocation]);

  // Renderizar estado de loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[280px] bg-muted/30 rounded-lg">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Carregando mapa...</span>
        </div>
      </div>
    );
  }

  // Renderizar erro
  if (error || mapError) {
    return (
      <div className="flex items-center justify-center h-[280px] bg-muted/30 rounded-lg">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <WifiOff className="h-8 w-8" />
          <span className="text-sm">{error || mapError}</span>
        </div>
      </div>
    );
  }

  // Renderizar fallback se não houver localização
  if (!driverLocation && !isLoading) {
    return (
      <div className="flex items-center justify-center h-[280px] bg-muted/30 rounded-lg border-2 border-dashed border-muted">
        <div className="flex flex-col items-center gap-3 text-muted-foreground p-4 text-center">
          <MapPin className="h-10 w-10 opacity-50" />
          <div>
            <p className="font-medium">Aguardando sinal do motorista...</p>
            <p className="text-xs mt-1">A localização aparecerá assim que o motorista iniciar o rastreamento</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[280px] rounded-lg overflow-hidden border border-border">
      {/* Mapa */}
      <div ref={mapContainerRef} className="absolute inset-0" />

      {/* Status overlay */}
      <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-2 z-10">
        {/* Badge de status */}
        <Badge 
          variant={isOnline ? "default" : "destructive"}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1",
            isOnline ? "bg-success text-success-foreground" : ""
          )}
        >
          <span className={cn(
            "w-2 h-2 rounded-full",
            isOnline ? "bg-white animate-pulse" : "bg-white/70"
          )} />
          {isOnline ? 'Online' : 'Offline'}
        </Badge>

        {/* Tempo desde última atualização */}
        {secondsAgo !== Infinity && (
          <Badge variant="secondary" className="text-xs">
            Atualizado {formatSecondsAgo(secondsAgo)}
          </Badge>
        )}
      </div>

      {/* Botões de controle */}
      <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-10">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleCenterOnDriver}
          disabled={!driverLocation}
          className="h-8 px-2 shadow-md"
          title="Centralizar no motorista"
        >
          <Navigation className="h-4 w-4 mr-1" />
          Centralizar
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleFitBounds}
          className="h-8 px-2 shadow-md bg-background/90"
          title="Ver trajeto completo"
        >
          <MapPin className="h-4 w-4 mr-1" />
          Ver tudo
        </Button>
      </div>
    </div>
  );
};

export const FreightRealtimeMap = React.memo(FreightRealtimeMapComponent);
