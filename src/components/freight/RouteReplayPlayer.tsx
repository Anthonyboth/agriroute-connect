/**
 * Player de replay visual da rota do frete
 * Permite visualizar o trajeto percorrido pelo motorista
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader } from '@googlemaps/js-api-loader';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  MapPin, 
  Clock, 
  Navigation,
  Gauge,
  Route
} from 'lucide-react';
import { useRouteHistory, useRouteReplay } from '@/hooks/useRouteHistory';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RURAL_MAP_STYLE, createTruckMarkerElement } from '@/lib/map-utils';
import { cn } from '@/lib/utils';
import { GOOGLE_MAPS_API_KEY, getGoogleMapsErrorMessage } from '@/config/googleMaps';

interface RouteReplayPlayerProps {
  freightId: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  className?: string;
}

export function RouteReplayPlayer({
  freightId,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  className,
}: RouteReplayPlayerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
  const pathRef = useRef<google.maps.Polyline | null>(null);
  const progressPathRef = useRef<google.maps.Polyline | null>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // Buscar histórico de rota
  const { points, totalDistanceKm, averageSpeedKmh, duration, isLoading, error } = useRouteHistory(freightId);

  // Controles de replay
  const {
    currentPoint,
    currentIndex,
    progress,
    isPlaying,
    playbackSpeed,
    play,
    pause,
    reset,
    seekTo,
    setPlaybackSpeed,
    totalPoints,
  } = useRouteReplay(points);

  // Inicializar mapa
  useEffect(() => {
    if (!mapContainerRef.current || mapLoaded || points.length === 0) return;

    const initMap = async () => {
      try {
        if (!GOOGLE_MAPS_API_KEY) {
          setMapError('API Key não configurada');
          return;
        }

        const loader = new Loader({
          apiKey: GOOGLE_MAPS_API_KEY,
          version: 'weekly',
          libraries: ['marker'],
        });

        const { Map } = await loader.importLibrary('maps') as google.maps.MapsLibrary;
        await loader.importLibrary('marker');

        if (!mapContainerRef.current) return;

        // Centro inicial
        const initialCenter = points[0] || { lat: -14.235, lng: -51.925 };

        mapRef.current = new Map(mapContainerRef.current, {
          center: initialCenter,
          zoom: 12,
          styles: RURAL_MAP_STYLE,
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
        });

        // Criar polyline do trajeto completo
        const pathCoords = points.map((p) => ({ lat: p.lat, lng: p.lng }));
        
        pathRef.current = new google.maps.Polyline({
          path: pathCoords,
          geodesic: true,
          strokeColor: '#94a3b8',
          strokeOpacity: 0.5,
          strokeWeight: 4,
          map: mapRef.current,
        });

        // Criar polyline de progresso
        progressPathRef.current = new google.maps.Polyline({
          path: [],
          geodesic: true,
          strokeColor: '#16a34a',
          strokeOpacity: 1,
          strokeWeight: 4,
          map: mapRef.current,
        });

        // Criar marker do caminhão
        const { AdvancedMarkerElement } = await google.maps.importLibrary('marker') as google.maps.MarkerLibrary;
        
        markerRef.current = new AdvancedMarkerElement({
          map: mapRef.current,
          position: points[0],
          title: 'Motorista',
          content: createTruckMarkerElement(),
        });

        // Markers de origem e destino
        if (typeof originLat === 'number' && typeof originLng === 'number') {
          new AdvancedMarkerElement({
            map: mapRef.current,
            position: { lat: originLat, lng: originLng },
            title: 'Origem',
          });
        }

        if (typeof destinationLat === 'number' && typeof destinationLng === 'number') {
          new AdvancedMarkerElement({
            map: mapRef.current,
            position: { lat: destinationLat, lng: destinationLng },
            title: 'Destino',
          });
        }

        // Ajustar bounds
        const bounds = new google.maps.LatLngBounds();
        points.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        mapRef.current.fitBounds(bounds, 50);

        setMapLoaded(true);
      } catch (err) {
        const errorMessage = getGoogleMapsErrorMessage(err);
        console.error('[RouteReplayPlayer] Error:', errorMessage, err);
        setMapError(errorMessage);
      }
    };

    initMap();
  }, [points, mapLoaded, originLat, originLng, destinationLat, destinationLng]);

  // Atualizar posição do marker durante replay
  useEffect(() => {
    if (!mapLoaded || !currentPoint || !markerRef.current || !progressPathRef.current) return;

    // Atualizar posição do marker
    markerRef.current.position = { lat: currentPoint.lat, lng: currentPoint.lng };

    // Atualizar polyline de progresso
    const progressCoords = points.slice(0, currentIndex + 1).map((p) => ({ lat: p.lat, lng: p.lng }));
    progressPathRef.current.setPath(progressCoords);

    // Centralizar no ponto atual
    if (mapRef.current && isPlaying) {
      mapRef.current.panTo({ lat: currentPoint.lat, lng: currentPoint.lng });
    }
  }, [currentPoint, currentIndex, mapLoaded, isPlaying, points]);

  // Loading
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-64 bg-muted/30 rounded-lg", className)}>
        <div className="text-center text-muted-foreground">
          <Route className="h-8 w-8 animate-pulse mx-auto mb-2" />
          <p className="text-sm">Carregando histórico de rota...</p>
        </div>
      </div>
    );
  }

  // Sem pontos
  if (!isLoading && points.length === 0) {
    return (
      <div className={cn("flex items-center justify-center h-64 bg-muted/30 rounded-lg border-2 border-dashed", className)}>
        <div className="text-center text-muted-foreground p-4">
          <Route className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="font-medium">Nenhum histórico de rota disponível</p>
          <p className="text-xs mt-1">O histórico será gravado durante o transporte</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded">
          <Route className="h-4 w-4 text-primary" />
          <span>{totalDistanceKm.toFixed(1)} km</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded">
          <Gauge className="h-4 w-4 text-primary" />
          <span>{averageSpeedKmh.toFixed(0)} km/h</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/50 rounded">
          <Clock className="h-4 w-4 text-primary" />
          <span>{duration.totalMinutes} min</span>
        </div>
      </div>

      {/* Mapa */}
      <div className="relative h-[280px] rounded-lg overflow-hidden border">
        <div ref={mapContainerRef} className="absolute inset-0" />

        {/* Info do ponto atual */}
        {currentPoint && (
          <div className="absolute top-2 left-2 right-2 z-10">
            <Card className="p-2 bg-background/90 backdrop-blur-sm">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {currentIndex + 1} / {totalPoints}
                  </Badge>
                  <span className="text-muted-foreground">
                    {format(currentPoint.capturedAt, "HH:mm:ss", { locale: ptBR })}
                  </span>
                </div>
                {currentPoint.speed && (
                  <span className="font-medium">{currentPoint.speed.toFixed(0)} km/h</span>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Controles de reprodução */}
      <div className="space-y-2">
        {/* Slider de progresso */}
        <Slider
          value={[currentIndex]}
          max={totalPoints - 1}
          step={1}
          onValueChange={(value) => seekTo(value[0])}
          className="cursor-pointer"
        />

        {/* Botões de controle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={isPlaying ? "secondary" : "default"}
              onClick={isPlaying ? pause : play}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Velocidade de reprodução */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground mr-1">Velocidade:</span>
            {[1, 2, 4].map((speed) => (
              <Button
                key={speed}
                size="sm"
                variant={playbackSpeed === speed ? "default" : "ghost"}
                onClick={() => setPlaybackSpeed(speed)}
                className="h-7 px-2 text-xs"
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
