/**
 * src/components/freight/FreightRealtimeMapMapLibre.tsx
 * 
 * Mapa em tempo real usando MapLibre GL JS + OpenStreetMap.
 * Zero dependência de Google Maps - 100% gratuito.
 * 
 * IMPORTANTE: O mapa NUNCA deve ficar vazio/preto.
 * Fallback de centro: motorista online → rota → Brasil
 * 
 * REFATORADO: Usa hooks padronizados para resize e safe-raf.
 * ✅ NOVO: Integração com OSRM para rotas reais por estradas.
 */

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, WifiOff, Navigation, Eye, Clock, Route } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFreightRealtimeLocation } from '@/hooks/useFreightRealtimeLocation';
import { useCityCoordinates } from '@/hooks/useCityCoordinates';
import { useMapLibreSafeRaf, useMapLibreAutoResize, useMapLibreSupport, useOSRMRoute, useTileWatchdog } from '@/hooks/maplibre';
import { useOngoingFreightMapInputs } from '@/hooks/maplibre/useOngoingFreightMapInputs';
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
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';

interface FreightStop {
  lat: number;
  lng: number;
  durationMinutes: number;
}

interface FreightRealtimeMapMapLibreProps {
  freightId: string;
  originLat?: number | string;
  originLng?: number | string;
  destinationLat?: number | string;
  destinationLng?: number | string;
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
  initialDriverLat?: number | string;
  initialDriverLng?: number | string;
  lastLocationUpdate?: string;
  stops?: FreightStop[];
  showHeatmap?: boolean;
  className?: string;
}

// Threshold para considerar motorista online (2 minutos = 120 segundos)
// Reduzido para exibir status mais preciso
const ONLINE_THRESHOLD_SECONDS = 120;

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
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // ✅ Tile Watchdog: fallback automático quando tiles falham
  useTileWatchdog(mapRef);

  const { 
    driverLocation, 
    isOnline, 
    secondsAgo, 
    isLoading, 
    error 
  } = useFreightRealtimeLocation(freightId);

  // ✅ Hook exclusivo: normaliza entradas numéricas (number|string) para evitar markers sumindo
  const {
    originLatNum,
    originLngNum,
    destinationLatNum,
    destinationLngNum,
    initialDriverLatNum,
    initialDriverLngNum,
  } = useOngoingFreightMapInputs({
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    initialDriverLat,
    initialDriverLng,
  });

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
    originLat: originLatNum ?? undefined,
    originLng: originLngNum ?? undefined,
    destinationLat: destinationLatNum ?? undefined,
    destinationLng: destinationLngNum ?? undefined,
  });

  // ✅ Coordenadas efetivas de origem (props ou fallback de cidade)
  const effectiveOrigin = useMemo(() => {
    // 1. Usar coordenadas das props se válidas
    if (
      typeof originLatNum === 'number' &&
      typeof originLngNum === 'number' &&
      Number.isFinite(originLatNum) &&
      Number.isFinite(originLngNum) &&
      originLatNum !== 0 &&
      originLngNum !== 0
    ) {
      console.log('[FreightRealtimeMapMapLibre] ✅ Origin from props:', { originLat: originLatNum, originLng: originLngNum });
      return { lat: originLatNum, lng: originLngNum };
    }
    
    // 2. Fallback para coordenadas da cidade
    if (cityOriginCoords && cityOriginCoords.lat && cityOriginCoords.lng) {
      console.log('[FreightRealtimeMapMapLibre] ✅ Origin from city coords:', cityOriginCoords, 'city:', originCity);
      return cityOriginCoords;
    }
    
    console.log('[FreightRealtimeMapMapLibre] ⚠️ No valid origin coordinates available. Props:', { originLat: originLatNum, originLng: originLngNum }, 'City:', cityOriginCoords);
    return null;
  }, [originLatNum, originLngNum, cityOriginCoords, originCity]);

  // ✅ Coordenadas efetivas de destino (props ou fallback de cidade)
  const effectiveDestination = useMemo(() => {
    // 1. Usar coordenadas das props se válidas
    if (
      typeof destinationLatNum === 'number' &&
      typeof destinationLngNum === 'number' &&
      Number.isFinite(destinationLatNum) &&
      Number.isFinite(destinationLngNum) &&
      destinationLatNum !== 0 &&
      destinationLngNum !== 0
    ) {
      console.log('[FreightRealtimeMapMapLibre] ✅ Destination from props:', { destinationLat: destinationLatNum, destinationLng: destinationLngNum });
      return { lat: destinationLatNum, lng: destinationLngNum };
    }
    
    // 2. Fallback para coordenadas da cidade
    if (cityDestinationCoords && cityDestinationCoords.lat && cityDestinationCoords.lng) {
      console.log('[FreightRealtimeMapMapLibre] ✅ Destination from city coords:', cityDestinationCoords, 'city:', destinationCity);
      return cityDestinationCoords;
    }
    
    console.log('[FreightRealtimeMapMapLibre] ⚠️ No valid destination coordinates available. Props:', { destinationLat: destinationLatNum, destinationLng: destinationLngNum }, 'City:', cityDestinationCoords);
    return null;
  }, [destinationLatNum, destinationLngNum, cityDestinationCoords, destinationCity]);

  // ✅ Localização efetiva do motorista (hook ou props iniciais)
  const effectiveDriverLocation = useMemo(() => {
    // 1. Usar localização em tempo real do hook
    if (
      driverLocation &&
      typeof (driverLocation as any).lat === 'number' &&
      typeof (driverLocation as any).lng === 'number' &&
      Number.isFinite((driverLocation as any).lat) &&
      Number.isFinite((driverLocation as any).lng) &&
      (driverLocation as any).lat !== 0 &&
      (driverLocation as any).lng !== 0
    ) {
      console.log('[FreightRealtimeMapMapLibre] ✅ Driver location from realtime hook:', driverLocation);
      return driverLocation;
    }
    
    // 2. Fallback para props iniciais
    if (
      typeof initialDriverLatNum === 'number' &&
      typeof initialDriverLngNum === 'number' &&
      Number.isFinite(initialDriverLatNum) &&
      Number.isFinite(initialDriverLngNum) &&
      initialDriverLatNum !== 0 &&
      initialDriverLngNum !== 0
    ) {
      console.log('[FreightRealtimeMapMapLibre] ✅ Driver location from initial props:', { initialDriverLat: initialDriverLatNum, initialDriverLng: initialDriverLngNum });
      return { lat: initialDriverLatNum, lng: initialDriverLngNum };
    }
    
    console.log('[FreightRealtimeMapMapLibre] ⚠️ No valid driver location available');
    return null;
  }, [driverLocation, initialDriverLatNum, initialDriverLngNum]);

  // ✅ Normalizar coordenadas para evitar markers em posições incorretas
  // Corrige casos comuns: lat/lng invertidos e valores persistidos em micrograus.
  // ✅ CORREÇÃO: Adiciona validação extra de sanidade para garantir que coordenadas estão no Brasil
  const isValidBrazilCoord = useCallback((lat: number, lng: number): boolean => {
    return lat >= -35 && lat <= 6 && lng >= -75 && lng <= -30;
  }, []);

  const mapOrigin = useMemo(() => {
    const normalized = normalizeLatLngPoint(effectiveOrigin, 'BR');
    if (normalized && isValidBrazilCoord(normalized.lat, normalized.lng)) {
      return normalized;
    }
    if (normalized) {
      console.warn('[FreightRealtimeMapMapLibre] ❌ Origin coords outside Brazil after normalization:', normalized);
    }
    return normalized; // Retorna mesmo assim para não quebrar o mapa
  }, [effectiveOrigin, isValidBrazilCoord]);

  const mapDestination = useMemo(() => {
    const normalized = normalizeLatLngPoint(effectiveDestination, 'BR');
    if (normalized && isValidBrazilCoord(normalized.lat, normalized.lng)) {
      return normalized;
    }
    if (normalized) {
      console.warn('[FreightRealtimeMapMapLibre] ❌ Destination coords outside Brazil after normalization:', normalized);
    }
    return normalized; // Retorna mesmo assim para não quebrar o mapa
  }, [effectiveDestination, isValidBrazilCoord]);

  const mapDriverLocation = useMemo(() => {
    const normalized = normalizeLatLngPoint(effectiveDriverLocation, 'BR');
    if (normalized && isValidBrazilCoord(normalized.lat, normalized.lng)) {
      return normalized;
    }
    if (normalized) {
      console.warn('[FreightRealtimeMapMapLibre] ❌ Driver coords outside Brazil after normalization:', normalized);
    }
    return normalized; // Retorna mesmo assim para não quebrar o mapa
  }, [effectiveDriverLocation, isValidBrazilCoord]);

  // ✅ 🔍 DEBUG: Log do fluxo completo de coordenadas para rastreamento
  useEffect(() => {
    console.log('[FreightRealtimeMapMapLibre] 🔍 Coordinate Flow Debug:', {
      props: { originLat, originLng, destinationLat, destinationLng, initialDriverLat, initialDriverLng },
      parsed: {
        originLatNum,
        originLngNum,
        destinationLatNum,
        destinationLngNum,
        initialDriverLatNum,
        initialDriverLngNum,
      },
      effective: { effectiveOrigin, effectiveDestination, effectiveDriverLocation },
      normalized: { mapOrigin, mapDestination, mapDriverLocation },
      fallback: { cityOriginCoords, cityDestinationCoords }
    });
  }, [originLat, originLng, destinationLat, destinationLng, initialDriverLat, initialDriverLng, 
      originLatNum, originLngNum, destinationLatNum, destinationLngNum, initialDriverLatNum, initialDriverLngNum,
      effectiveOrigin, effectiveDestination, effectiveDriverLocation, 
      mapOrigin, mapDestination, mapDriverLocation, 
      cityOriginCoords, cityDestinationCoords]);

  // ✅ NOVO: Verificar se motorista está realmente online (< 5 min desde última atualização)
  const isDriverReallyOnline = useMemo(() => {
    return isOnline && secondsAgo < ONLINE_THRESHOLD_SECONDS;
  }, [isOnline, secondsAgo]);

  // ✅ 🚗 OSRM: Buscar rota real por estradas (origem → destino)
  const { 
    route: osrmRoute, 
    isLoading: isLoadingRoute,
    error: routeError 
  } = useOSRMRoute({
    origin: mapOrigin,
    destination: mapDestination,
    profile: 'driving',
    enabled: !!(mapOrigin && mapDestination),
  });

  // ✅ NOVO: Centro do mapa com fallback inteligente
  // Prioridade: 1. Motorista online 2. Centro da rota 3. Origem 4. Destino 5. Brasil
  const mapCenter = useMemo<[number, number]>(() => {
    // 1. Motorista online com posição recente
    if (mapDriverLocation && isDriverReallyOnline) {
      return [mapDriverLocation.lng, mapDriverLocation.lat];
    }

    // 2. Centro da rota (média entre origem e destino)
    if (mapOrigin && mapDestination) {
      return [
        (mapOrigin.lng + mapDestination.lng) / 2,
        (mapOrigin.lat + mapDestination.lat) / 2,
      ];
    }

    // 3. Origem
    if (mapOrigin) {
      return [mapOrigin.lng, mapOrigin.lat];
    }

    // 4. Destino
    if (mapDestination) {
      return [mapDestination.lng, mapDestination.lat];
    }

    // 5. Motorista offline (ainda mostra a última posição conhecida)
    if (mapDriverLocation) {
      return [mapDriverLocation.lng, mapDriverLocation.lat];
    }

    // 6. Fallback: Centro do Brasil
    return DEFAULT_CENTER;
  }, [mapDriverLocation, mapOrigin, mapDestination, isDriverReallyOnline]);

  // ✅ REMOVIDO: Não precisamos mais de routeCoordinates separado
  // A rota OSRM (plannedRouteCoordinates) já mostra o caminho real por estradas
  // Não vamos desenhar linha reta sobreposta

  // ✅ 🚗 OSRM: Usar rota real do OSRM com fallback de linha reta para garantir visibilidade
  const plannedRouteCoordinates = useMemo(() => {
    // Se temos rota OSRM, usar ela (caminho real por estradas)
    if (osrmRoute && osrmRoute.coordinates.length >= 2) {
      console.log('[FreightRealtimeMapMapLibre] 🛣️ Using OSRM real route:', osrmRoute.distanceText, 'with', osrmRoute.coordinates.length, 'points');
      return osrmRoute.coordinates;
    }
    
    // ✅ FALLBACK: Se não temos rota OSRM mas temos origem/destino, desenhar linha reta
    // Isso garante que o usuário sempre veja a conexão entre os pontos
    if (mapOrigin && mapDestination) {
      console.log('[FreightRealtimeMapMapLibre] 📏 Using straight line fallback (OSRM not loaded yet)');
      return [
        [mapOrigin.lng, mapOrigin.lat] as [number, number],
        [mapDestination.lng, mapDestination.lat] as [number, number],
      ];
    }
    
    // Sem coordenadas - retornar vazio
    return [];
  }, [osrmRoute, mapOrigin, mapDestination]);

  // ✅ Verificar se temos pelo menos uma coordenada válida para exibir o mapa
  const hasAnyValidCoordinate = useMemo(() => {
    return !!(
      mapDriverLocation ||
      mapOrigin ||
      mapDestination
    );
  }, [mapDriverLocation, mapOrigin, mapDestination]);

  // ✅ CORREÇÃO: Flag para evitar dupla inicialização
  const initializingRef = useRef(false);
  // ✅ Ref estável para mapCenter - evita re-criar mapa quando centro muda
  const mapCenterRef = useRef(mapCenter);
  mapCenterRef.current = mapCenter;
  const hasAnyValidCoordinateRef = useRef(hasAnyValidCoordinate);
  hasAnyValidCoordinateRef.current = hasAnyValidCoordinate;
  const plannedRouteCoordinatesRef = useRef(plannedRouteCoordinates);
  plannedRouteCoordinatesRef.current = plannedRouteCoordinates;
  const osrmRouteRef = useRef(osrmRoute);
  osrmRouteRef.current = osrmRoute;
  
  // Inicializar MapLibre — SEM dependência de mapCenter para evitar re-criação
  useEffect(() => {
    const container = mapContainerRef.current;
    
    // Guards contra dupla inicialização
    if (!container) {
      console.log('[FreightRealtimeMapMapLibre] Container not ready yet');
      return;
    }
    if (mapRef.current) {
      console.log('[FreightRealtimeMapMapLibre] Map already exists');
      return;
    }
    if (initializingRef.current) {
      console.log('[FreightRealtimeMapMapLibre] Already initializing');
      return;
    }
    
    // ✅ Verificar se container tem dimensões válidas
    const rect = container.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) {
      console.log('[FreightRealtimeMapMapLibre] Container has invalid dimensions, waiting...', rect);

      // ✅ Esperar o container ganhar tamanho via ResizeObserver (Drawer/Dialog/Tab)
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            if (width >= 10 && height >= 10 && !mapRef.current && !initializingRef.current) {
              console.log('[FreightRealtimeMapMapLibre] Container now has valid dimensions:', { width, height });
              ro.disconnect();
              // Re-disparar init no próximo tick
              setTimeout(() => setRetryCount((v) => v + 1), 0);
            }
          }
        });
        ro.observe(container);

        // Se demorar demais, mostrar erro amigável
        const t = setTimeout(() => {
          if (!mapRef.current) {
            console.warn('[FreightRealtimeMapMapLibre] Container never became visible (timeout)');
            setMapError('Mapa não ficou visível (container sem dimensões)');
          }
        }, 12000);

        return () => {
          clearTimeout(t);
          ro.disconnect();
        };
      }

      // Sem ResizeObserver: fallback para retry simples
      if (retryCount < 20) {
        const retryTimeout = setTimeout(() => {
          setRetryCount((prev) => prev + 1);
        }, 250);
        return () => clearTimeout(retryTimeout);
      }

      setMapError('Container do mapa sem dimensões válidas');
      return;
    }

    initializingRef.current = true;
    console.log('[FreightRealtimeMapMapLibre] Initializing map with container:', rect.width, 'x', rect.height);

    const initMap = async () => {
      try {
        const initialCenter = mapCenterRef.current;
        const initialZoom = hasAnyValidCoordinateRef.current ? 10 : 5;
        
        console.log('[FreightRealtimeMapMapLibre] Creating map at center:', initialCenter, 'zoom:', initialZoom);
        
        const map = new maplibregl.Map({
          container: container,
          style: RURAL_STYLE_INLINE,
          center: initialCenter,
          zoom: initialZoom,
          attributionControl: { compact: true },
          pixelRatio: window.devicePixelRatio || 1,
        });

        // Controles de navegação
        map.addControl(new maplibregl.NavigationControl(), 'top-right');


        // Evento de carregamento
        map.on('load', () => {
          const currentPlannedRoute = plannedRouteCoordinatesRef.current;
          const plannedRouteData = currentPlannedRoute.length >= 2
            ? {
                type: 'Feature' as const,
                properties: {},
                geometry: {
                  type: 'LineString' as const,
                  coordinates: currentPlannedRoute,
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

          const hasRealRoute = osrmRouteRef.current && osrmRouteRef.current.coordinates.length >= 2;

          map.addLayer({
            id: 'planned-route-line',
            type: 'line',
            source: 'planned-route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': MAP_COLORS.primary,
              'line-width': 5,
              'line-opacity': 0.85,
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
          console.log('[FreightRealtimeMapMapLibre] ✅ Map initialized successfully');

          // Ajustar bounds após carregar
          setTimeout(() => {
            handleFitBounds();
          }, 300);
        });

        map.on('error', (e) => {
          const errMsg = e.error?.message || '';
          // Apenas ignorar AbortError (navegação normal)
          if (
            e.error?.name === 'AbortError' ||
            errMsg.includes('signal is aborted') ||
            errMsg.includes('The operation was aborted')
          ) {
            return;
          }
          // ✅ NÃO ignorar mais "Failed to fetch" - o TileWatchdog cuida do fallback
          if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('Load failed')) {
            if (import.meta.env.DEV) {
              console.warn('[FreightRealtimeMapMapLibre] Network error (watchdog will handle):', errMsg);
            }
            return; // Watchdog cuidará do fallback
          }
          console.error('[FreightRealtimeMapMapLibre] Map error:', e);
          setMapError('Erro ao carregar o mapa');
        });

        mapRef.current = map;
        initializingRef.current = false;

      } catch (err) {
        console.error('[FreightRealtimeMapMapLibre] Init error:', err);
        setMapError('Erro ao inicializar o mapa');
        initializingRef.current = false;
      }
    };

    initMap();

    return () => {
      console.log('[FreightRealtimeMapMapLibre] Cleanup running');
      
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;

      if (cancelAnimationRef.current) {
        cancelAnimationRef.current();
        cancelAnimationRef.current = null;
      }
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      ghostDriverMarkerRef.current?.remove();
      ghostDriverMarkerRef.current = null;
      originMarkerRef.current?.remove();
      originMarkerRef.current = null;
      destinationMarkerRef.current?.remove();
      destinationMarkerRef.current = null;
      
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch (e) {
          console.warn('[FreightRealtimeMapMapLibre] Error removing map:', e);
        }
        mapRef.current = null;
      }
      
      initializingRef.current = false;
      setMapLoaded(false);
    };
  }, [retryCount]); // ✅ APENAS retryCount — não re-cria mapa por mudança de centro/coordenadas

  // ✅ Garantir resize quando o container muda de tamanho (Tabs/Dialog podem iniciar com 0px)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !mapContainerRef.current) return;

    // Forçar um resize inicial após render (corrige mapa em branco em containers ocultos)
    const t = window.setTimeout(() => {
      try {
        mapRef.current?.resize();
      } catch {}
    }, 150);

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = new ResizeObserver(() => {
        // Evitar resize em cascata
        requestAnimationFrame(() => {
          try {
            mapRef.current?.resize();
          } catch {}
        });
      });

      resizeObserverRef.current.observe(mapContainerRef.current);
    }

    return () => {
      window.clearTimeout(t);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [mapLoaded]);

  // ✅ REATIVADO: Markers de origem e destino
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    console.log('[FreightRealtimeMapMapLibre] 📍 Creating markers - Origin:', mapOrigin, 'Destination:', mapDestination);

    // Marker de origem
    if (mapOrigin) {
      if (!originMarkerRef.current) {
        const originElement = createLocationMarkerElement('origin');
        console.log('[FreightRealtimeMapMapLibre] ✅ Creating ORIGIN marker (A) at:', mapOrigin);
        
        originMarkerRef.current = new maplibregl.Marker({
          element: originElement,
          anchor: 'bottom',
        })
          .setLngLat([mapOrigin.lng, mapOrigin.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>Origem (A)</strong>${originCity ? `<br/>${originCity}${originState ? `, ${originState}` : ''}` : ''}`
          ))
          .addTo(mapRef.current);
      } else {
        originMarkerRef.current.setLngLat([mapOrigin.lng, mapOrigin.lat]);
      }
    }

    // Marker de destino
    if (mapDestination) {
      if (!destinationMarkerRef.current) {
        const destinationElement = createLocationMarkerElement('destination');
        console.log('[FreightRealtimeMapMapLibre] ✅ Creating DESTINATION marker (B) at:', mapDestination);
        
        destinationMarkerRef.current = new maplibregl.Marker({
          element: destinationElement,
          anchor: 'bottom',
        })
          .setLngLat([mapDestination.lng, mapDestination.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>Destino (B)</strong>${destinationCity ? `<br/>${destinationCity}${destinationState ? `, ${destinationState}` : ''}` : ''}`
          ))
          .addTo(mapRef.current);
      } else {
        destinationMarkerRef.current.setLngLat([mapDestination.lng, mapDestination.lat]);
      }
    }
  }, [mapOrigin, mapDestination, originCity, originState, destinationCity, destinationState, mapLoaded]);

  // ✅ REATIVADO: Marker do motorista com animação suave
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    // Sem localização do motorista — limpar markers
    if (!mapDriverLocation) {
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      ghostDriverMarkerRef.current?.remove();
      ghostDriverMarkerRef.current = null;
      return;
    }

    // Motorista OFFLINE: marker "fantasma" semi-transparente
    if (!isDriverReallyOnline) {
      driverMarkerRef.current?.remove();
      driverMarkerRef.current = null;

      if (!ghostDriverMarkerRef.current) {
        const ghostElement = createTruckMarkerElement(false);
        ghostElement.style.opacity = '0.5';
        ghostElement.style.filter = 'grayscale(100%)';
        
        ghostDriverMarkerRef.current = new maplibregl.Marker({
          element: ghostElement,
          anchor: 'center',
        })
          .setLngLat([mapDriverLocation.lng, mapDriverLocation.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              `<strong>Última Posição Conhecida</strong><br/>🔴 Motorista Offline<br/>${formatSecondsAgo(secondsAgo)}`
            )
          )
          .addTo(mapRef.current);
      } else {
        ghostDriverMarkerRef.current.setLngLat([mapDriverLocation.lng, mapDriverLocation.lat]);
      }
      return;
    }

    // Motorista ONLINE
    ghostDriverMarkerRef.current?.remove();
    ghostDriverMarkerRef.current = null;

    if (!driverMarkerRef.current) {
      const truckElement = createTruckMarkerElement(true);
      
      driverMarkerRef.current = new maplibregl.Marker({
        element: truckElement,
        anchor: 'center',
      })
        .setLngLat([mapDriverLocation.lng, mapDriverLocation.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25 }).setHTML(
            `<strong>🚛 Motorista</strong><br/>🟢 Online`
          )
        )
        .addTo(mapRef.current);
      
      previousLocationRef.current = mapDriverLocation;
      return;
    }

    // Animação suave entre posições
    if (previousLocationRef.current) {
      if (cancelAnimationRef.current) {
        cancelAnimationRef.current();
      }

      cancelAnimationRef.current = interpolatePosition(
        previousLocationRef.current,
        mapDriverLocation,
        1000,
        (pos) => {
          driverMarkerRef.current?.setLngLat([pos.lng, pos.lat]);
        },
        () => {
          previousLocationRef.current = mapDriverLocation;
        }
      );
    } else {
      driverMarkerRef.current.setLngLat([mapDriverLocation.lng, mapDriverLocation.lat]);
      previousLocationRef.current = mapDriverLocation;
    }
  }, [mapDriverLocation, mapLoaded, isDriverReallyOnline, secondsAgo]);

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

  // ✅ REMOVIDO: Layer 'route' separado foi eliminado - usar apenas OSRM 'planned-route'

  // ✅ Centralizar no motorista
  const handleCenterOnDriver = useCallback(() => {
    if (mapRef.current && mapDriverLocation) {
      mapRef.current.flyTo({
        center: [mapDriverLocation.lng, mapDriverLocation.lat],
        zoom: 14,
        duration: 1000,
      });
    }
  }, [mapDriverLocation]);

  // ✅ Ajustar bounds para mostrar tudo (usando coordenadas efetivas com fallback)
  const handleFitBounds = useCallback(() => {
    if (!mapRef.current) return;

    const validPoints = [
      mapOrigin,
      mapDriverLocation,
      mapDestination,
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
  }, [mapOrigin, mapDestination, mapDriverLocation]);

  // ✅ P1 FIX: Container SEMPRE montado. Estados de loading/error/no-location
  //    são OVERLAYS absolutos, nunca early-returns que impedem containerRef de existir.
  return (
    <div className={cn("relative rounded-lg overflow-hidden border border-border", className)} style={{ height: '280px', minHeight: '280px' }}>
      {/* ✅ P1: Container do mapa - SEMPRE montado, nunca removido do DOM */}
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0"
        style={{ width: '100%', height: '100%', transform: 'none' }}
      />

      {/* ✅ OVERLAY: Loading state */}
      {isLoading && (
        <div className="absolute inset-0 z-20">
          <Skeleton className="w-full h-full rounded-lg" />
        </div>
      )}

      {/* ✅ OVERLAY: Error state */}
      {!isLoading && (error || mapError) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/95 rounded-lg">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <WifiOff className="h-8 w-8" />
            <span className="text-sm">{error || mapError}</span>
          </div>
        </div>
      )}

      {/* ✅ OVERLAY: No location state */}
      {!isLoading && !error && !mapError && !hasAnyValidCoordinate && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-muted/95 rounded-lg border-2 border-dashed border-muted">
          <div className="flex flex-col items-center gap-3 text-muted-foreground p-4 text-center">
            <MapPin className="h-10 w-10 opacity-50" />
            <div>
              <p className="font-medium">Aguardando sinal do motorista...</p>
              <p className="text-xs mt-1">A localização aparecerá assim que o motorista iniciar o rastreamento</p>
            </div>
          </div>
        </div>
      )}

      {/* Status overlay */}
      {mapLoaded && (
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
      )}

      {/* 🚗 Badge de rota OSRM (distância e tempo estimado) */}
      {mapLoaded && osrmRoute && osrmRoute.distance > 0 && (
        <div className="absolute bottom-2 left-2 z-10">
          <Badge variant="outline" className="text-xs flex items-center gap-1.5 bg-background/90 shadow-sm">
            <Route className="h-3 w-3 text-primary" />
            <span>{osrmRoute.distanceText}</span>
            <span className="text-muted-foreground">•</span>
            <span>{osrmRoute.durationText}</span>
          </Badge>
        </div>
      )}

      {/* Botões de controle */}
      {mapLoaded && (
        <div className="absolute bottom-2 right-2 flex flex-col gap-1 z-10">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCenterOnDriver}
            disabled={!mapDriverLocation}
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
      )}
    </div>
  );
};

export const FreightRealtimeMapMapLibre = React.memo(FreightRealtimeMapMapLibreComponent);
