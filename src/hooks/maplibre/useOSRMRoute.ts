/**
 * src/hooks/maplibre/useOSRMRoute.ts
 * 
 * Hook para obter rotas reais via OSRM (Open Source Routing Machine).
 * Usa o servidor público demo.project-osrm.org para roteamento gratuito.
 * 
 * Retorna a rota mais curta por estradas reais entre dois pontos.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface RoutePoint {
  lat: number;
  lng: number;
}

export interface OSRMRouteResult {
  /** Coordenadas da rota [lng, lat][] */
  coordinates: [number, number][];
  /** Distância total em metros */
  distance: number;
  /** Duração estimada em segundos */
  duration: number;
  /** Distância formatada (ex: "450 km") */
  distanceText: string;
  /** Duração formatada (ex: "5h 30min") */
  durationText: string;
}

export interface UseOSRMRouteOptions {
  /** Origem (lat, lng) */
  origin: RoutePoint | null;
  /** Destino (lat, lng) */
  destination: RoutePoint | null;
  /** Perfil de roteamento: 'driving' | 'walking' | 'cycling' */
  profile?: 'driving' | 'walking' | 'cycling';
  /** Habilitar busca automática */
  enabled?: boolean;
}

export interface UseOSRMRouteResult {
  route: OSRMRouteResult | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Formata distância em metros para string legível
 */
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(0)} km`;
  }
  return `${meters.toFixed(0)} m`;
}

/**
 * Formata duração em segundos para string legível
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}min`;
  }
  return `${minutes} min`;
}

/**
 * Decodifica polyline encoded do OSRM (formato polyline6)
 */
function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const coordinates: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const factor = Math.pow(10, precision);

  while (index < encoded.length) {
    // Decode latitude
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    // Decode longitude
    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;

    // OSRM retorna [lng, lat], mantemos esse formato
    coordinates.push([lng / factor, lat / factor]);
  }

  return coordinates;
}

/**
 * Hook para obter rotas reais via OSRM
 */
export function useOSRMRoute({
  origin,
  destination,
  profile = 'driving',
  enabled = true,
}: UseOSRMRouteOptions): UseOSRMRouteResult {
  const [route, setRoute] = useState<OSRMRouteResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cacheKeyRef = useRef<string>('');

  const fetchRoute = useCallback(async () => {
    if (!origin || !destination || !enabled) {
      setRoute(null);
      return;
    }

    // Evitar requisições duplicadas para mesma rota
    const cacheKey = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}-${profile}`;
    if (cacheKey === cacheKeyRef.current && route) {
      return;
    }

    // Cancelar requisição anterior
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setIsLoading(true);
    setError(null);

    try {
      // OSRM espera coordenadas no formato lng,lat
      const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
      
      // Usar servidor público OSRM (gratuito, limite de uso razoável)
      const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=polyline`;

      console.log('[useOSRMRoute] Fetching route:', url);

      // Capturar AbortError inline para evitar que escape como unhandled rejection
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal,
        headers: {
          'Accept': 'application/json',
        },
      }).catch((fetchErr: Error) => {
        if (fetchErr.name === 'AbortError') {
          return null; // Silenciar AbortError antes que vire unhandled rejection
        }
        throw fetchErr;
      });

      // Se foi abortado, sair silenciosamente
      if (!response) return;

      if (!response.ok) {
        throw new Error(`OSRM error: ${response.status}`);
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error(data.message || 'Rota não encontrada');
      }

      const osrmRoute = data.routes[0];
      const coordinates = decodePolyline(osrmRoute.geometry, 5);

      const result: OSRMRouteResult = {
        coordinates,
        distance: osrmRoute.distance,
        duration: osrmRoute.duration,
        distanceText: formatDistance(osrmRoute.distance),
        durationText: formatDuration(osrmRoute.duration),
      };

      console.log('[useOSRMRoute] Route found:', {
        points: coordinates.length,
        distance: result.distanceText,
        duration: result.durationText,
      });

      cacheKeyRef.current = cacheKey;
      setRoute(result);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('[useOSRMRoute] Request aborted');
        return;
      }

      console.error('[useOSRMRoute] Error fetching route:', err);
      setError(err.message || 'Erro ao obter rota');
      
      // Em caso de erro, criar linha reta como fallback
      setRoute({
        coordinates: [
          [origin.lng, origin.lat],
          [destination.lng, destination.lat],
        ],
        distance: 0,
        duration: 0,
        distanceText: 'N/A',
        durationText: 'N/A',
      });
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, profile, enabled, route]);

  // Buscar rota quando origem/destino mudarem
  useEffect(() => {
    fetchRoute();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchRoute]);

  return {
    route,
    isLoading,
    error,
    refetch: fetchRoute,
  };
}

/**
 * Função utilitária para buscar rota sem hook (para uso em componentes de classe ou funções)
 */
export async function fetchOSRMRoute(
  origin: RoutePoint,
  destination: RoutePoint,
  profile: 'driving' | 'walking' | 'cycling' = 'driving'
): Promise<OSRMRouteResult> {
  const coords = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
  const url = `https://router.project-osrm.org/route/v1/${profile}/${coords}?overview=full&geometries=polyline`;

  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`OSRM error: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(data.message || 'Rota não encontrada');
  }

  const osrmRoute = data.routes[0];
  const coordinates = decodePolyline(osrmRoute.geometry, 5);

  return {
    coordinates,
    distance: osrmRoute.distance,
    duration: osrmRoute.duration,
    distanceText: formatDistance(osrmRoute.distance),
    durationText: formatDuration(osrmRoute.duration),
  };
}
