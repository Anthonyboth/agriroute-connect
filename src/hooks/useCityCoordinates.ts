/**
 * Hook para buscar coordenadas de cidades
 * Prioriza dados do banco, com fallback para geocoding
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeNominatimGeocode } from '@/utils/safeGeocoding';

interface Coordinates {
  lat: number;
  lng: number;
}

interface UseCityCoordinatesResult {
  originCoords: Coordinates | null;
  destinationCoords: Coordinates | null;
  routeCenter: Coordinates | null;
  isLoading: boolean;
  hasAnyCoordinates: boolean;
}

// Cache em memória para evitar requisições repetidas
const coordsCache = new Map<string, Coordinates | null>();

/**
 * Busca coordenadas de uma cidade no banco ou via geocoding
 */
async function fetchCityCoordinates(
  cityName: string | undefined,
  state: string | undefined
): Promise<Coordinates | null> {
  if (!cityName) return null;

  const cacheKey = `${cityName},${state || ''}`;
  
  // Verificar cache
  if (coordsCache.has(cacheKey)) {
    return coordsCache.get(cacheKey) || null;
  }

  try {
    // 1. Tentar buscar no banco (tabela cities)
    let query = supabase
      .from('cities')
      .select('lat, lng')
      .ilike('name', cityName);
    
    if (state) {
      query = query.eq('state', state);
    }

    const { data: cityData } = await query.limit(1).maybeSingle();

    if (cityData?.lat && cityData?.lng) {
      const coords = { lat: cityData.lat, lng: cityData.lng };
      coordsCache.set(cacheKey, coords);
      return coords;
    }

    // 2. Fallback: geocoding via Nominatim
    console.log(`[useCityCoordinates] Cidade não encontrada no banco, tentando geocoding: ${cityName}, ${state}`);
    const geocodeResult = await safeNominatimGeocode(cityName, state);
    
    if (geocodeResult) {
      const coords = { lat: geocodeResult.latitude, lng: geocodeResult.longitude };
      coordsCache.set(cacheKey, coords);
      return coords;
    }

    // Não encontrou em lugar nenhum
    coordsCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error('[useCityCoordinates] Erro ao buscar coordenadas:', error);
    coordsCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Hook para buscar coordenadas de origem e destino de um frete
 */
export function useCityCoordinates({
  originCity,
  originState,
  destinationCity,
  destinationState,
  originLat,
  originLng,
  destinationLat,
  destinationLng,
}: {
  originCity?: string;
  originState?: string;
  destinationCity?: string;
  destinationState?: string;
  originLat?: number;
  originLng?: number;
  destinationLat?: number;
  destinationLng?: number;
}): UseCityCoordinatesResult {
  const [originCoords, setOriginCoords] = useState<Coordinates | null>(null);
  const [destinationCoords, setDestinationCoords] = useState<Coordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Usar coordenadas das props se disponíveis
  const hasOriginFromProps = typeof originLat === 'number' && typeof originLng === 'number';
  const hasDestinationFromProps = typeof destinationLat === 'number' && typeof destinationLng === 'number';

  useEffect(() => {
    // Se já temos coordenadas das props, usar elas
    if (hasOriginFromProps) {
      setOriginCoords({ lat: originLat!, lng: originLng! });
    }
    if (hasDestinationFromProps) {
      setDestinationCoords({ lat: destinationLat!, lng: destinationLng! });
    }

    // Só buscar do banco/geocoding se não temos das props
    const fetchMissingCoords = async () => {
      const needsOrigin = !hasOriginFromProps && originCity;
      const needsDestination = !hasDestinationFromProps && destinationCity;

      if (!needsOrigin && !needsDestination) return;

      setIsLoading(true);

      try {
        const [origin, destination] = await Promise.all([
          needsOrigin ? fetchCityCoordinates(originCity, originState) : null,
          needsDestination ? fetchCityCoordinates(destinationCity, destinationState) : null,
        ]);

        if (needsOrigin && origin) {
          setOriginCoords(origin);
        }
        if (needsDestination && destination) {
          setDestinationCoords(destination);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchMissingCoords();
  }, [
    originCity, 
    originState, 
    destinationCity, 
    destinationState,
    originLat,
    originLng,
    destinationLat,
    destinationLng,
    hasOriginFromProps,
    hasDestinationFromProps
  ]);

  // Calcular centro da rota (média das coordenadas)
  const routeCenter = useMemo<Coordinates | null>(() => {
    if (originCoords && destinationCoords) {
      return {
        lat: (originCoords.lat + destinationCoords.lat) / 2,
        lng: (originCoords.lng + destinationCoords.lng) / 2,
      };
    }
    return originCoords || destinationCoords;
  }, [originCoords, destinationCoords]);

  const hasAnyCoordinates = !!(originCoords || destinationCoords);

  return {
    originCoords,
    destinationCoords,
    routeCenter,
    isLoading,
    hasAnyCoordinates,
  };
}

/**
 * Limpar cache de coordenadas (útil para testes)
 */
export function clearCityCoordinatesCache() {
  coordsCache.clear();
}
