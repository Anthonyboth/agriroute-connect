/**
 * src/components/freight/FreightRealtimeMapMapLibre.tsx
 * 
 * Mapa em tempo real usando MapLibre GL JS + OpenStreetMap.
 * Zero dependência de Google Maps - 100% gratuito.
 * 
 * IMPORTANTE: O mapa NUNCA deve ficar vazio/preto.
 * Fallback de centro: motorista online → rota → Brasil
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Loader2, WifiOff, Navigation, Eye, Clock } from 'lucide-react';
import { useFreightRealtimeLocation } from '@/hooks/useFreightRealtimeLocation';
import { useCityCoordinates } from '@/hooks/useCityCoordinates';
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
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
  initialDriverLat?: number;
  initialDriverLng?: number;
  lastLocationUpdate?: string;
  stops?: FreightStop[];
  showHeatmap?: boolean;
  className?: string;
}

// Threshold para considerar motorista online (5 minutos = 300 segundos)
const ONLINE_THRESHOLD_SECONDS = 300;

const FreightRealtimeMapMapLibreComponent: React.FC<FreightRealtimeMapMapLibreProps> = ({
  freightId,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  originCity,
  originState,
  destinationCity,
  destinationState,
  initialDriverLat,
  initialDriverLng,
  stops = [],
  showHeatmap = false,
  className,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const driverMarkerRef = useRef<maplibregl.Marker | null>(null);
  const ghostDriverMarkerRef = useRef<maplibregl.Marker | null>(null);
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

  // ✅ Buscar coordenadas das cidades como fallback
  const { 
    originCoords: cityOriginCoords, 
    destinationCoords: cityDestinationCoords,
    routeCenter,
    isLoading: isLoadingCoords 
  } = useCityCoordinates({
    originCity,
    originState,
    destinationCity,
    destinationState,
    originLat,
    originLng,
    destinationLat,
    destinationLng,
  });

  // ✅ Coordenadas efetivas de origem (props ou fallback de cidade)
  const effectiveOrigin = useMemo(() => {
    if (typeof originLat === 'number' && typeof originLng === 'number') {
      return { lat: originLat, lng: originLng };
    }
    return cityOriginCoords;
  }, [originLat, originLng, cityOriginCoords]);

  // ✅ Coordenadas efetivas de destino (props ou fallback de cidade)
  const effectiveDestination = useMemo(() => {
    if (typeof destinationLat === 'number' && typeof destinationLng === 'number') {
      return { lat: destinationLat, lng: destinationLng };
    }
    return cityDestinationCoords;
  }, [destinationLat, destinationLng, cityDestinationCoords]);

  // ✅ Localização efetiva do motorista (hook ou props iniciais)
  const effectiveDriverLocation = useMemo(() => {
    if (driverLocation) return driverLocation;
    if (typeof initialDriverLat === 'number' && typeof initialDriverLng === 'number') {
      return { lat: initialDriverLat, lng: initialDriverLng };
    }
    return null;
  }, [driverLocation, initialDriverLat, initialDriverLng]);

  // ✅ NOVO: Verificar se motorista está realmente online (< 5 min desde última atualização)
  const isDriverReallyOnline = useMemo(() => {
    return isOnline && secondsAgo < ONLINE_THRESHOLD_SECONDS;
  }, [isOnline, secondsAgo]);

  // ✅ NOVO: Centro do mapa com fallback inteligente
  // Prioridade: 1. Motorista online 2. Centro da rota 3. Origem 4. Destino 5. Brasil
  const mapCenter = useMemo<[number, number]>(() => {
    // 1. Motorista online com posição recente
    if (effectiveDriverLocation && isDriverReallyOnline) {
      return [effectiveDriverLocation.lng, effectiveDriverLocation.lat];
    }

    // 2. Centro da rota (média entre origem e destino)
    if (effectiveOrigin && effectiveDestination) {
      return [
        (effectiveOrigin.lng + effectiveDestination.lng) / 2,
        (effectiveOrigin.lat + effectiveDestination.lat) / 2,
      ];
    }

    // 3. Origem
    if (effectiveOrigin) {
      return [effectiveOrigin.lng, effectiveOrigin.lat];
    }

    // 4. Destino
    if (effectiveDestination) {
      return [effectiveDestination.lng, effectiveDestination.lat];
    }

    // 5. Motorista offline (ainda mostra a última posição conhecida)
    if (effectiveDriverLocation) {
      return [effectiveDriverLocation.lng, effectiveDriverLocation.lat];
    }

    // 6. Fallback: Centro do Brasil
    return DEFAULT_CENTER;
  }, [effectiveDriverLocation, effectiveOrigin, effectiveDestination, isDriverReallyOnline]);

  // ✅ Coordenadas da rota para polyline (origem → motorista → destino)
  const routeCoordinates = useMemo(() => {
    const coords: [number, number][] = [];
    
    if (effectiveOrigin) {
      coords.push([effectiveOrigin.lng, effectiveOrigin.lat]);
    }
    
    if (effectiveDriverLocation && isDriverReallyOnline) {
      coords.push([effectiveDriverLocation.lng, effectiveDriverLocation.lat]);
    }
    
    if (effectiveDestination) {
      coords.push([effectiveDestination.lng, effectiveDestination.lat]);
    }
    
    return coords;
  }, [effectiveOrigin, effectiveDestination, effectiveDriverLocation, isDriverReallyOnline]);

  // ✅ Rota planejada (origem → destino) para exibição quando offline
  const plannedRouteCoordinates = useMemo(() => {
    const coords: [number, number][] = [];
    
    if (effectiveOrigin) {
      coords.push([effectiveOrigin.lng, effectiveOrigin.lat]);
    }
    
    if (effectiveDestination) {
      coords.push([effectiveDestination.lng, effectiveDestination.lat]);
    }
    
    return coords;
  }, [effectiveOrigin, effectiveDestination]);

  // ✅ Verificar se temos pelo menos uma coordenada válida para exibir o mapa
  const hasAnyValidCoordinate = useMemo(() => {
    return !!(
      effectiveDriverLocation ||
      effectiveOrigin ||
      effectiveDestination
    );
  }, [effectiveDriverLocation, effectiveOrigin, effectiveDestination]);

  // Inicializar MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapLoaded) return;

    const initMap = async () => {
      try {
        // ✅ NOVO: Usar mapCenter calculado com fallback inteligente
        const map = new maplibregl.Map({
          container: mapContainerRef.current!,
          style: RURAL_STYLE_INLINE,
          center: mapCenter,
          zoom: hasAnyValidCoordinate ? 10 : 5, // Zoom menor para fallback Brasil
          attributionControl: {},
        });

        // Controles de navegação
        map.addControl(new maplibregl.NavigationControl(), 'top-right');

        // Evento de carregamento
        map.on('load', () => {
          // ✅ Adicionar layer para rota planejada (cinza, sempre visível)
          // IMPORTANTE: Só criar LineString se tiver 2+ pontos, senão usar FeatureCollection vazia
          const plannedRouteData = plannedRouteCoordinates.length >= 2
            ? {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: plannedRouteCoordinates,
                },
              }
            : {
                type: 'FeatureCollection' as const,
                features: [],
              };

          map.addSource('planned-route', {
            type: 'geojson',
            data: plannedRouteData,
          });

          map.addLayer({
            id: 'planned-route-line',
            type: 'line',
            source: 'planned-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': MAP_COLORS.offline, // Cinza para rota planejada
              'line-width': 3,
              'line-opacity': 0.5,
              'line-dasharray': [4, 2], // Tracejada
            },
          });

          // ✅ Adicionar source e layer para rota ativa (sobre a planejada)
          // IMPORTANTE: Só criar LineString se tiver 2+ pontos
          const routeData = routeCoordinates.length >= 2
            ? {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: routeCoordinates,
                },
              }
            : {
                type: 'FeatureCollection' as const,
                features: [],
              };

          map.addSource('route', {
            type: 'geojson',
            data: routeData,
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
          console.log('[FreightRealtimeMapMapLibre] Map initialized successfully at center:', mapCenter);

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
      ghostDriverMarkerRef.current?.remove();
      originMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // ✅ Atualizar markers de origem e destino usando coordenadas efetivas
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Marker de origem (usando effectiveOrigin que inclui fallback de cidade)
    if (effectiveOrigin) {
      if (!originMarkerRef.current) {
        originMarkerRef.current = new maplibregl.Marker({
          element: createLocationMarkerElement('origin'),
        })
          .setLngLat([effectiveOrigin.lng, effectiveOrigin.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>Origem</strong>${originCity ? `<br/>${originCity}${originState ? `, ${originState}` : ''}` : ''}`
          ))
          .addTo(mapRef.current);
      } else {
        originMarkerRef.current.setLngLat([effectiveOrigin.lng, effectiveOrigin.lat]);
      }
    }

    // Marker de destino (usando effectiveDestination que inclui fallback de cidade)
    if (effectiveDestination) {
      if (!destinationMarkerRef.current) {
        destinationMarkerRef.current = new maplibregl.Marker({
          element: createLocationMarkerElement('destination'),
        })
          .setLngLat([effectiveDestination.lng, effectiveDestination.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>Destino</strong>${destinationCity ? `<br/>${destinationCity}${destinationState ? `, ${destinationState}` : ''}` : ''}`
          ))
          .addTo(mapRef.current);
      } else {
        destinationMarkerRef.current.setLngLat([effectiveDestination.lng, effectiveDestination.lat]);
      }
    }
  }, [effectiveOrigin, effectiveDestination, originCity, originState, destinationCity, destinationState, mapLoaded]);

  // ✅ Atualizar marker do motorista com animação (usando effectiveDriverLocation)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !effectiveDriverLocation) return;

    // ✅ NOVO: Se motorista está offline, mostrar marker "fantasma" semi-transparente
    if (!isDriverReallyOnline) {
      // Remover marker ativo se existir
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;

      // Criar marker fantasma se não existir
      if (!ghostDriverMarkerRef.current) {
        const ghostElement = createTruckMarkerElement(false);
        ghostElement.style.opacity = '0.5';
        ghostElement.style.filter = 'grayscale(100%)';
        
        ghostDriverMarkerRef.current = new maplibregl.Marker({
          element: ghostElement,
        })
          .setLngLat([effectiveDriverLocation.lng, effectiveDriverLocation.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              `<strong>Última Posição Conhecida</strong><br/>🔴 Motorista Offline<br/>Há ${formatSecondsAgo(secondsAgo)}`
            )
          )
          .addTo(mapRef.current);
        
        console.log('[FreightRealtimeMapMapLibre] Ghost marker created - driver offline');
      } else {
        ghostDriverMarkerRef.current.setLngLat([effectiveDriverLocation.lng, effectiveDriverLocation.lat]);
      }
      return;
    }

    // ✅ Motorista online - remover marker fantasma e usar marker ativo
    ghostDriverMarkerRef.current?.remove();
    ghostDriverMarkerRef.current = null;

    // Criar marker se não existir
    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new maplibregl.Marker({
        element: createTruckMarkerElement(true),
      })
        .setLngLat([effectiveDriverLocation.lng, effectiveDriverLocation.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>Motorista</strong><br/>🟢 Online`
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
  }, [effectiveDriverLocation, mapLoaded, isDriverReallyOnline, secondsAgo]);

  // ✅ Atualizar rota planejada quando coordenadas mudarem
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const plannedSource = mapRef.current.getSource('planned-route') as maplibregl.GeoJSONSource;
    if (plannedSource) {
      const data = plannedRouteCoordinates.length >= 2
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'LineString' as const,
              coordinates: plannedRouteCoordinates,
            },
          }
        : {
            type: 'FeatureCollection' as const,
            features: [],
          };
      plannedSource.setData(data);
    }
  }, [plannedRouteCoordinates, mapLoaded]);

  // Atualizar polyline quando rota mudar
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const source = mapRef.current.getSource('route') as maplibregl.GeoJSONSource;
    if (source) {
      const data = routeCoordinates.length >= 2
        ? {
            type: 'Feature' as const,
            properties: {},
            geometry: {
              type: 'LineString' as const,
              coordinates: routeCoordinates,
            },
          }
        : {
            type: 'FeatureCollection' as const,
            features: [],
          };
      source.setData(data);
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

  // ✅ Ajustar bounds para mostrar tudo (usando coordenadas efetivas com fallback)
  const handleFitBounds = useCallback(() => {
    if (!mapRef.current) return;

    const validPoints = [
      effectiveOrigin,
      effectiveDriverLocation,
      effectiveDestination,
    ].filter(Boolean) as Array<{ lat: number; lng: number }>;

    // Se não tem pontos, centralizar no Brasil
    if (validPoints.length === 0) {
      mapRef.current.flyTo({
        center: DEFAULT_CENTER,
        zoom: 5,
        duration: 1000,
      });
      return;
    }

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
  }, [effectiveOrigin, effectiveDestination, effectiveDriverLocation]);

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
          variant={isDriverReallyOnline ? "default" : "secondary"}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1",
            isDriverReallyOnline ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
          )}
        >
          <span className={cn(
            "w-2 h-2 rounded-full",
            isDriverReallyOnline ? "bg-white animate-pulse" : "bg-destructive"
          )} />
          {isDriverReallyOnline ? 'Online' : 'Offline'}
        </Badge>

        {/* Tempo desde última atualização */}
        {secondsAgo !== Infinity && secondsAgo > 0 && (
          <Badge variant="secondary" className="text-xs flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {formatSecondsAgo(secondsAgo)}
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
