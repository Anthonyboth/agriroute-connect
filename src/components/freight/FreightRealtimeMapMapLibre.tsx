/**
 * src/components/freight/FreightRealtimeMapMapLibre.tsx
 * 
 * Mapa em tempo real usando MapLibre GL JS + OpenStreetMap.
 * Zero dependência de Google Maps - 100% gratuito.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2, WifiOff, Navigation, Eye } from 'lucide-react';
import { useFreightRealtimeLocation } from '@/hooks/useFreightRealtimeLocation';
import { 
  createTruckMarkerElement,
  createLocationMarkerElement,
  interpolatePosition, 
  calculateBounds,
  formatSecondsAgo,
  createStopsHeatmapGeoJSON,
  HEATMAP_LAYER_CONFIG,
} from '@/lib/maplibre-utils';
import { RURAL_STYLE_INLINE, DEFAULT_CENTER, MAP_COLORS } from '@/config/maplibre';
import { cn } from '@/lib/utils';

interface FreightStop {
  lat: number;
  lng: number;
  durationMinutes: number;
}

interface FreightRealtimeMapMapLibreProps {
  freightId: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
  initialDriverLat?: number;
  initialDriverLng?: number;
  lastLocationUpdate?: string;
  stops?: FreightStop[];
  showHeatmap?: boolean;
  className?: string;
}

const FreightRealtimeMapMapLibreComponent: React.FC<FreightRealtimeMapMapLibreProps> = ({
  freightId,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  initialDriverLat,
  initialDriverLng,
  stops = [],
  showHeatmap = false,
  className,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const originMarkerRef = useRef<maplibregl.Marker | null>(null);
  const destinationMarkerRef = useRef<maplibregl.Marker | null>(null);
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

  // ✅ Localização efetiva do motorista (hook ou props iniciais)
  const effectiveDriverLocation = useMemo(() => {
    if (driverLocation) return driverLocation;
    if (typeof initialDriverLat === 'number' && typeof initialDriverLng === 'number') {
      return { lat: initialDriverLat, lng: initialDriverLng };
    }
    return null;
  }, [driverLocation, initialDriverLat, initialDriverLng]);

  // Coordenadas da rota para polyline
  const routeCoordinates = useMemo(() => {
    const coords: [number, number][] = [];
    
    if (typeof originLat === 'number' && typeof originLng === 'number') {
      coords.push([originLng, originLat]);
    }
    
    if (effectiveDriverLocation) {
      coords.push([effectiveDriverLocation.lng, effectiveDriverLocation.lat]);
    }
    
    if (typeof destinationLat === 'number' && typeof destinationLng === 'number') {
      coords.push([destinationLng, destinationLat]);
    }
    
    return coords;
  }, [originLat, originLng, destinationLat, destinationLng, effectiveDriverLocation]);

  // ✅ Verificar se temos pelo menos uma coordenada válida para exibir o mapa
  const hasAnyValidCoordinate = useMemo(() => {
    return (
      effectiveDriverLocation !== null ||
      (typeof originLat === 'number' && typeof originLng === 'number') ||
      (typeof destinationLat === 'number' && typeof destinationLng === 'number')
    );
  }, [effectiveDriverLocation, originLat, originLng, destinationLat, destinationLng]);

  // Inicializar MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapLoaded) return;

    const initMap = async () => {
      try {
        // ✅ Centro inicial: prioriza localização do motorista
        const initialCenter: [number, number] = effectiveDriverLocation 
          ? [effectiveDriverLocation.lng, effectiveDriverLocation.lat]
          : (typeof originLat === 'number' && typeof originLng === 'number')
            ? [originLng, originLat]
            : (typeof destinationLat === 'number' && typeof destinationLng === 'number')
              ? [destinationLng, destinationLat]
              : DEFAULT_CENTER;

        const map = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: RURAL_STYLE_INLINE,
          center: initialCenter,
          zoom: 10,
          attributionControl: {},
        });

        // Controles de navegação
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Evento de carregamento
        map.on('load', () => {
          // Adicionar source e layer para rota
          map.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: routeCoordinates,
              },
            },
          });

          map.addLayer({
            id: 'route-line',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': MAP_COLORS.primary,
              'line-width': 4,
              'line-opacity': 0.7,
            },
          });

          // Adicionar heatmap se habilitado
          if (showHeatmap && stops.length > 0) {
            map.addSource('stops', {
              type: 'geojson',
              data: createStopsHeatmapGeoJSON(stops),
            });

            map.addLayer(HEATMAP_LAYER_CONFIG);
          }

          setMapLoaded(true);
          console.log('[FreightRealtimeMapMapLibre] Map initialized successfully');

          // Ajustar bounds após carregar
          setTimeout(() => {
            handleFitBounds();
          }, 100);
        });

        map.on('error', (e) => {
          console.error('[FreightRealtimeMapMapLibre] Map error:', e);
          setMapError('Erro ao carregar o mapa');
        });

        mapRef.current = map;

      } catch (err) {
        console.error('[FreightRealtimeMapMapLibre] Init error:', err);
        setMapError('Erro ao inicializar o mapa');
      }
    };

    initMap();

    return () => {
      // Cleanup
      if (cancelAnimationRef.current) {
        cancelAnimationRef.current();
      }
      driverMarkerRef.current?.remove();
      originMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Atualizar markers de origem e destino
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Marker de origem
    if (typeof originLat === 'number' && typeof originLng === 'number') {
      if (!originMarkerRef.current) {
        originMarkerRef.current = new maplibregl.Marker({
          element: createLocationMarkerElement('origin'),
        })
          .setLngLat([originLng, originLat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<strong>Origem</strong>'))
          .addTo(mapRef.current);
      } else {
        originMarkerRef.current.setLngLat([originLng, originLat]);
      }
    }

    // Marker de destino
    if (typeof destinationLat === 'number' && typeof destinationLng === 'number') {
      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = new maplibregl.Marker({
          element: createLocationMarkerElement('destination'),
        })
          .setLngLat([destinationLng, destinationLat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML('<strong>Destino</strong>'))
          .addTo(mapRef.current);
      } else {
        destinationMarkerRef.current.setLngLat([destinationLng, destinationLat]);
      }
    }
  }, [originLat, originLng, destinationLat, destinationLng, mapLoaded]);

  // ✅ Atualizar marker do motorista com animação (usando effectiveDriverLocation)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !effectiveDriverLocation) return;

    // Criar marker se não existir
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new maplibregl.Marker({
        element: createTruckMarkerElement(isOnline),
      })
        .setLngLat([effectiveDriverLocation.lng, effectiveDriverLocation.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>Motorista</strong><br/>${isOnline ? '🟢 Online' : '🔴 Offline'}`
          )
        )
        .addTo(mapRef.current);
      
      previousLocationRef.current = effectiveDriverLocation;
      console.log('[FreightRealtimeMapMapLibre] Driver marker created at:', effectiveDriverLocation);
      return;
    }

    // Animar para nova posição
    if (previousLocationRef.current) {
      // Cancelar animação anterior
      if (cancelAnimationRef.current) {
        cancelAnimationRef.current();
      }

      cancelAnimationRef.current = interpolatePosition(
        previousLocationRef.current,
        effectiveDriverLocation,
        1000,
        (pos) => {
          driverMarkerRef.current?.setLngLat([pos.lng, pos.lat]);
        },
        () => {
          previousLocationRef.current = effectiveDriverLocation;
        }
      );
    } else {
      driverMarkerRef.current.setLngLat([effectiveDriverLocation.lng, effectiveDriverLocation.lat]);
      previousLocationRef.current = effectiveDriverLocation;
    }
  }, [effectiveDriverLocation, mapLoaded, isOnline]);

  // Atualizar cor do marker baseado no status online/offline
  useEffect(() => {
    if (!driverMarkerRef.current) return;
    
    const element = driverMarkerRef.current.getElement();
    if (element) {
      element.innerHTML = createTruckMarkerElement(isOnline).innerHTML;
    }
  }, [isOnline]);

  // Atualizar polyline quando rota mudar
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const source = mapRef.current.getSource('route') as maplibregl.GeoJSONSource;
    if (source && routeCoordinates.length >= 2) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates,
        },
      });
    }
  }, [routeCoordinates, mapLoaded]);

  // ✅ Centralizar no motorista
  const handleCenterOnDriver = useCallback(() => {
    if (mapRef.current && effectiveDriverLocation) {
      mapRef.current.flyTo({
        center: [effectiveDriverLocation.lng, effectiveDriverLocation.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [effectiveDriverLocation]);

  // ✅ Ajustar bounds para mostrar tudo (funciona mesmo com alguns pontos nulos)
  const handleFitBounds = useCallback(() => {
    if (!mapRef.current) return;

    const validPoints = [
      typeof originLat === 'number' && typeof originLng === 'number' 
        ? { lat: originLat, lng: originLng } 
        : null,
      effectiveDriverLocation,
      typeof destinationLat === 'number' && typeof destinationLng === 'number' 
        ? { lat: destinationLat, lng: destinationLng } 
        : null,
    ].filter(Boolean) as Array<{ lat: number; lng: number }>;

    // Se só tem 1 ponto válido, centralizar nele
    if (validPoints.length === 1) {
      mapRef.current.flyTo({
        center: [validPoints[0].lng, validPoints[0].lat],
        zoom: 12,
        duration: 1000,
      });
      return;
    }

    // Se tem 2+ pontos, usar fitBounds
    const bounds = calculateBounds(validPoints);
    if (bounds) {
      mapRef.current.fitBounds(bounds, { padding: 50 });
    }
  }, [originLat, originLng, destinationLat, destinationLng, effectiveDriverLocation]);

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-[280px] bg-muted/30 rounded-lg", className)}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">Carregando mapa...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error || mapError) {
    return (
      <div className={cn("flex items-center justify-center h-[280px] bg-muted/30 rounded-lg", className)}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <WifiOff className="h-8 w-8" />
          <span className="text-sm">{error || mapError}</span>
        </div>
      </div>
    );
  }

  // ✅ No location fallback - só mostra se não tiver NENHUMA coordenada válida
  if (!hasAnyValidCoordinate && !isLoading) {
    return (
      <div className={cn("flex items-center justify-center h-[280px] bg-muted/30 rounded-lg border-2 border-dashed border-muted", className)}>
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
    <div className={cn("relative h-[280px] rounded-lg overflow-hidden border border-border", className)}>
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
          disabled={!effectiveDriverLocation}
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
          <Eye className="h-4 w-4 mr-1" />
          Ver tudo
        </Button>
      </div>
    </div>
  );
};

export const FreightRealtimeMapMapLibre = React.memo(FreightRealtimeMapMapLibreComponent);
