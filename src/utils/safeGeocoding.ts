import { z } from 'zod';
import { devLog } from '@/lib/devLogger';

// Schema para validar coordenadas
export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90).finite(),
  longitude: z.number().min(-180).max(180).finite(),
});

// Schema para validar nomes de localização
export const LocationNameSchema = z
  .string()
  .max(200, 'Nome de localização muito longo')
  .regex(/^[a-zA-Z0-9\s,.-áàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ]+$/, 'Caracteres inválidos no nome da localização');

// Schema para resposta da API Nominatim
export const NominatimResponseSchema = z.object({
  lat: z.string().transform(val => parseFloat(val)),
  lon: z.string().transform(val => parseFloat(val)),
  display_name: z.string().max(500),
  address: z.object({
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

// Schema para resposta da API BigDataCloud
export const BigDataCloudResponseSchema = z.object({
  latitude: z.number().finite(),
  longitude: z.number().finite(),
  locality: z.string().max(200).optional(),
  city: z.string().max(200).optional(),
  principalSubdivision: z.string().max(200).optional(),
  countryName: z.string().max(100).optional(),
});

// Tipos derivados dos schemas
export type Coordinates = z.infer<typeof CoordinatesSchema>;
export type NominatimResponse = z.infer<typeof NominatimResponseSchema>;
export type BigDataCloudResponse = z.infer<typeof BigDataCloudResponseSchema>;

// Função para fazer requisições com timeout e retry
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = 5000,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AgriRoute/1.0',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      lastError = error as Error;
      
      // Se foi um abort por timeout ou erro de rede, tentar novamente
      if (attempt < maxRetries - 1) {
        // Backoff exponencial: 1s, 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
    }
  }

  throw lastError || new Error('Falha ao fazer requisição');
}

// Função para sanitizar texto removendo HTML e caracteres perigosos
export function sanitizeText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/<[^>]*>/g, '') // Remove tags HTML
    .replace(/[<>'"]/g, '') // Remove caracteres perigosos
    .trim()
    .substring(0, 200); // Limita comprimento
}

// Função para validar coordenadas manualmente
export function validateCoordinates(lat: number, lng: number): boolean {
  return (
    !isNaN(lat) &&
    !isNaN(lng) &&
    isFinite(lat) &&
    isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Função para formatar endereço de forma segura
export function formatSafeAddress(parts: string[]): string {
  return parts
    .filter(Boolean)
    .map(part => sanitizeText(part))
    .filter(part => part.length > 0)
    .join(', ')
    .substring(0, 500);
}

/**
 * Geocodificação segura usando Nominatim
 * Converte endereço em coordenadas com validação completa
 */
export async function safeNominatimGeocode(
  cityName: string,
  state?: string
): Promise<{ latitude: number; longitude: number; displayName: string } | null> {
  try {
    if (!cityName || cityName.trim().length < 2) {
      console.warn('Nome de cidade inválido ou muito curto');
      return null;
    }

    const sanitizedCity = sanitizeText(cityName);
    const sanitizedState = state ? sanitizeText(state) : '';
    
    const query = sanitizedState
      ? `${sanitizedCity}, ${sanitizedState}, Brasil`
      : `${sanitizedCity}, Brasil`;

    const url = `https://nominatim.openstreetmap.org/search?` +
      `format=json&` +
      `q=${encodeURIComponent(query)}&` +
      `limit=1&` +
      `countrycodes=br`;

    devLog('[SafeGeocoding] Nominatim request:', { city: sanitizedCity, state: sanitizedState });

    const response = await fetchWithTimeout(url);
    const data = await response.json();

    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn('[SafeGeocoding] Nenhum resultado encontrado');
      return null;
    }

    // Validar resposta com Zod
    const validationResult = NominatimResponseSchema.safeParse(data[0]);

    if (!validationResult.success) {
      console.error('[SafeGeocoding] Validação falhou:', validationResult.error);
      return null;
    }

    const validated = validationResult.data;

    // Validação adicional de coordenadas
    if (!validateCoordinates(validated.lat, validated.lon)) {
      console.error('[SafeGeocoding] Coordenadas inválidas:', { lat: validated.lat, lon: validated.lon });
      return null;
    }

    // Formatar endereço seguro
    const displayName = sanitizeText(validated.display_name);

    devLog('[SafeGeocoding] Geocodificação bem-sucedida:', {
      latitude: validated.lat,
      longitude: validated.lon,
    });

    return {
      latitude: validated.lat,
      longitude: validated.lon,
      displayName,
    };
  } catch (error) {
    console.error('[SafeGeocoding] Erro ao geocodificar:', error);
    return null;
  }
}

/**
 * Geocodificação reversa segura usando BigDataCloud
 * Converte coordenadas em endereço com validação completa
 */
export async function safeBigDataCloudReverseGeocode(
  latitude: number,
  longitude: number
): Promise<{ address: string; city?: string; state?: string } | null> {
  try {
    // Validar coordenadas de entrada
    if (!validateCoordinates(latitude, longitude)) {
      console.error('[SafeGeocoding] Coordenadas de entrada inválidas:', { latitude, longitude });
      return null;
    }

    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?` +
      `latitude=${latitude}&` +
      `longitude=${longitude}&` +
      `localityLanguage=pt`;

    devLog('[SafeGeocoding] BigDataCloud request:', { latitude, longitude });

    const response = await fetchWithTimeout(url);
    const data = await response.json();

    // Validar resposta com Zod
    const validationResult = BigDataCloudResponseSchema.safeParse(data);

    if (!validationResult.success) {
      console.error('[SafeGeocoding] Validação BigDataCloud falhou:', validationResult.error);
      // Fallback para coordenadas
      return {
        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      };
    }

    const validated = validationResult.data;

    // Validar coordenadas retornadas
    if (!validateCoordinates(validated.latitude, validated.longitude)) {
      console.error('[SafeGeocoding] Coordenadas retornadas inválidas');
      return {
        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
      };
    }

    // Construir endereço seguro
    const city = validated.locality || validated.city;
    const state = validated.principalSubdivision;

    const addressParts = [city, state].filter(Boolean);
    const address = addressParts.length > 0
      ? formatSafeAddress(addressParts)
      : `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;

    devLog('[SafeGeocoding] Geocodificação reversa bem-sucedida');

    return {
      address: sanitizeText(address),
      city: city ? sanitizeText(city) : undefined,
      state: state ? sanitizeText(state) : undefined,
    };
  } catch (error) {
    console.error('[SafeGeocoding] Erro na geocodificação reversa:', error);
    // Fallback seguro para coordenadas
    return {
      address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    };
  }
}