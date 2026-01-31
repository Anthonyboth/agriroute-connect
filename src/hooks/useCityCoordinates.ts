/**
 * Hook para buscar coordenadas de cidades
 * Prioriza dados do banco, com fallback para geocoding
 * ✅ CORRIGIDO: Aplica normalização para corrigir coordenadas invertidas ou em micrograus
 */

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeNominatimGeocode } from '@/utils/safeGeocoding';
import { normalizeLatLngPoint } from '@/lib/geo/normalizeLatLngPoint';

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
    console.log('[useCityCoordinates] Fetching coordinates for:', { cityName, state });
    
    // 1. Tentar buscar no banco (tabela cities)
    let query = supabase
      .from('cities')
      .select('lat, lng, name')
      .ilike('name', cityName);
    
    if (state) {
      query = query.eq('state', state);
    }

    const { data: cityData, error: dbError } = await query.limit(1).maybeSingle();

    if (dbError) {
      console.warn('[useCityCoordinates] Database error:', dbError);
    }

    // ✅ IMPORTANTE: Verificar se as coordenadas existem E são válidas (não nulas)
    if (cityData?.lat != null && cityData?.lng != null && 
        typeof cityData.lat === 'number' && typeof cityData.lng === 'number' &&
        !isNaN(cityData.lat) && !isNaN(cityData.lng)) {
      // ✅ Normalizar coordenadas para corrigir inversões ou micrograus
      const normalized = normalizeLatLngPoint({ lat: cityData.lat, lng: cityData.lng }, 'BR');
      if (normalized) {
        console.log('[useCityCoordinates] ✅ Found in database:', normalized, 'for:', cityName);
        coordsCache.set(cacheKey, normalized);
        return normalized;
      }
    } else {
      console.log('[useCityCoordinates] City found in database but has no coordinates:', cityData);
    }

    // 2. Fallback: geocoding via Nominatim
    console.log(`[useCityCoordinates] 🌍 Trying geocoding via Nominatim: ${cityName}, ${state}`);
    const geocodeResult = await safeNominatimGeocode(cityName, state);
    
    if (geocodeResult && geocodeResult.latitude && geocodeResult.longitude) {
      // ✅ Normalizar coordenadas do geocoding também
      const normalized = normalizeLatLngPoint({ lat: geocodeResult.latitude, lng: geocodeResult.longitude }, 'BR');
      if (normalized) {
        console.log('[useCityCoordinates] ✅ Geocoding successful:', normalized);
        coordsCache.set(cacheKey, normalized);
        return normalized;
      }
    } else {
      console.warn('[useCityCoordinates] ⚠️ Geocoding returned no valid results');
    }

    // Não encontrou em lugar nenhum
    console.warn('[useCityCoordinates] ❌ No coordinates found for:', { cityName, state });
    coordsCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.error('[useCityCoordinates] Error fetching coordinates:', error);
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
    // Se já temos coordenadas das props, normalizar e usar elas
    if (hasOriginFromProps) {
      const normalized = normalizeLatLngPoint({ lat: originLat!, lng: originLng! }, 'BR');
      if (normalized) {
        setOriginCoords(normalized);
      }
    }
    if (hasDestinationFromProps) {
      const normalized = normalizeLatLngPoint({ lat: destinationLat!, lng: destinationLng! }, 'BR');
      if (normalized) {
        setDestinationCoords(normalized);
      }
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
