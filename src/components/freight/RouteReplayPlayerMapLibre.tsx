/**
 * src/components/freight/RouteReplayPlayerMapLibre.tsx
 * 
 * Player de replay visual da rota do frete usando MapLibre GL JS.
 * Zero dependência de Google Maps.
 */

import React, { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTileWatchdog } from '@/hooks/maplibre';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Clock, 
  Gauge,
  Route
} from 'lucide-react';
import { useRouteHistory, useRouteReplay } from '@/hooks/useRouteHistory';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  createTruckMarkerElement,
  createLocationMarkerElement,
  ROUTE_LINE_LAYER_CONFIG,
} from '@/lib/maplibre-utils';
import { RURAL_STYLE_INLINE, DEFAULT_CENTER, MAP_COLORS } from '@/config/maplibre';
import { cn } from '@/lib/utils';

interface RouteReplayPlayerMapLibreProps {
  freightId: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  className?: string;
}

export function RouteReplayPlayerMapLibre({
  freightId,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  className,
}: RouteReplayPlayerMapLibreProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  // ✅ Tile Watchdog
  useTileWatchdog(mapRef);

  // Buscar histórico de rota
  const { points, totalDistanceKm, averageSpeedKmh, duration, isLoading, error } = useRouteHistory(freightId);

  // Controles de replay
  const {
    currentPoint,
    currentIndex,
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
        // Centro inicial
        const initialCenter: [number, number] = points[0] 
          ? [points[0].lng, points[0].lat]
          : DEFAULT_CENTER;

        const map = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: RURAL_STYLE_INLINE,
          center: initialCenter,
          zoom: 12,
          attributionControl: { compact: true },
        });

        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        map.on('load', () => {
          // Coordenadas do trajeto completo
          const pathCoords = points.map((p) => [p.lng, p.lat] as [number, number]);

          // Layer do trajeto completo (cinza)
          map.addSource('full-path', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: pathCoords,
              },
            },
          });

          map.addLayer(ROUTE_LINE_LAYER_CONFIG('full-path-line', 'full-path', MAP_COLORS.route.full, 0.5));

          // Layer do progresso (verde)
          map.addSource('progress-path', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [],
              },
            },
          });

          // Layer do progresso (verde)
          map.addLayer(ROUTE_LINE_LAYER_CONFIG('progress-path-line', 'progress-path', MAP_COLORS.route.progress, 1));

          // Criar marker do caminhão - ✅ anchor: 'center' para ícones circulares
          markerRef.current = new maplibregl.Marker({
            element: createTruckMarkerElement(true),
            anchor: 'center',
          })
            .setLngLat([points[0].lng, points[0].lat])
            .addTo(map);

          // Markers de origem e destino - ✅ anchor: 'bottom' para pins
          if (typeof originLat === 'number' && typeof originLng === 'number') {
            new maplibregl.Marker({
              element: createLocationMarkerElement('origin'),
              anchor: 'bottom',
            })
              .setLngLat([originLng, originLat])
              .addTo(map);
          }

          if (typeof destinationLat === 'number' && typeof destinationLng === 'number') {
            new maplibregl.Marker({
              element: createLocationMarkerElement('destination'),
              anchor: 'bottom',
            })
              .setLngLat([destinationLng, destinationLat])
              .addTo(map);
          }

          // Ajustar bounds
          const bounds = new maplibregl.LngLatBounds();
          points.forEach((p) => bounds.extend([p.lng, p.lat]));
          map.fitBounds(bounds, { padding: 50 });

          setMapLoaded(true);
        });

        map.on('error', (e) => {
          console.error('[RouteReplayPlayerMapLibre] Map error:', e);
          setMapError('Erro ao carregar o mapa');
        });

        mapRef.current = map;

      } catch (err) {
        console.error('[RouteReplayPlayerMapLibre] Init error:', err);
        setMapError('Erro ao inicializar o mapa');
      }
    };

    initMap();

    return () => {
      markerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [points.length]);

  // Atualizar posição do marker durante replay
  useEffect(() => {
    if (!mapLoaded || !currentPoint || !markerRef.current || !mapRef.current) return;

    // Atualizar posição do marker
    markerRef.current.setLngLat([currentPoint.lng, currentPoint.lat]);

    // Atualizar polyline de progresso
    const progressCoords = points.slice(0, currentIndex + 1).map((p) => [p.lng, p.lat] as [number, number]);
    const source = mapRef.current.getSource('progress-path') as maplibregl.GeoJSONSource;
    
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: progressCoords,
        },
      });
    }

    // Centralizar no ponto atual durante reprodução
    if (isPlaying) {
      mapRef.current.panTo([currentPoint.lng, currentPoint.lat]);
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

        {/* Error overlay */}
        {mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
            <p className="text-destructive">{mapError}</p>
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
