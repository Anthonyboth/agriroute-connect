import { z } from 'zod';

// SCHEMAS DE VALIDAÇÃO
export const CoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90).finite(),
  longitude: z.number().min(-180).max(180).finite()
});

export const LocationNameSchema = z.string()
  .max(200, 'Nome de localização muito longo')
  .regex(/^[a-zA-ZÀ-ÿ0-9\s,\.\-çÇãõáéíóúâêîôûàèìòùäëïöü]+$/, 'Caracteres inválidos no nome da localização')
  .optional();

export const NominatimResponseSchema = z.object({
  lat: z.string(),
  lon: z.string(),
  display_name: z.string(),
  address: z.object({
    city: z.string().optional(),
    town: z.string().optional(),
    village: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional()
  }).optional()
});

export const BigDataCloudResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  locality: z.string().optional(),
  city: z.string().optional(),
  principalSubdivision: z.string().optional(),
  countryName: z.string().optional()
});

export interface SafeLocation {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  state?: string;
  country?: string;
}

async function fetchWithTimeout(url: string, timeoutMs: number = 5000, maxRetries: number = 3): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'AgriRoute/1.0' } });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return response;
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError || new Error('Falha ao fazer requisição de geocodificação');
}

function sanitizeText(text: string, maxLength: number = 200): string {
  if (!text) return '';
  return text.replace(/<[^>]*>/g, '').replace(/[<>'"]/g, '').trim().substring(0, maxLength);
}

export function validateCoordinates(lat: number, lng: number): boolean {
  return !isNaN(lat) && !isNaN(lng) && isFinite(lat) && isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function formatSafeAddress(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).map(part => sanitizeText(part || '')).filter(part => part.length > 0).join(', ');
}

export async function safeNominatimGeocode(cityName: string, state?: string, country: string = 'Brasil'): Promise<SafeLocation | null> {
  if (!cityName || cityName.trim().length === 0) return null;
  try {
    const queryParts = [cityName.trim()];
    if (state) queryParts.push(state);
    queryParts.push(country);
    const query = queryParts.join(', ');
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`;
    const response = await fetchWithTimeout(url);
    const data = await response.json();
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    const validationResult = NominatimResponseSchema.safeParse(data[0]);
    if (!validationResult.success) return null;
    const result = validationResult.data;
    const latitude = parseFloat(result.lat);
    const longitude = parseFloat(result.lon);
    if (!validateCoordinates(latitude, longitude)) return null;
    const coordsValidation = CoordinatesSchema.safeParse({ latitude, longitude });
    if (!coordsValidation.success) return null;
    const address = formatSafeAddress([result.address?.city || result.address?.town || result.address?.village, result.address?.state, result.address?.country]) || sanitizeText(result.display_name);
    return { latitude, longitude, address, city: sanitizeText(result.address?.city || result.address?.town || result.address?.village || ''), state: sanitizeText(result.address?.state || ''), country: sanitizeText(result.address?.country || '') };
  } catch (error) {
    console.error('Erro ao fazer geocodificação com Nominatim:', error);
    return null;
  }
}

export async function safeBigDataCloudReverseGeocode(latitude: number, longitude: number, language: string = 'pt'): Promise<SafeLocation | null> {
  if (!validateCoordinates(latitude, longitude)) return null;
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=${language}`;
    const response = await fetchWithTimeout(url);
    const data = await response.json();
    const validationResult = BigDataCloudResponseSchema.safeParse(data);
    if (!validationResult.success) {
      return { latitude, longitude, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` };
    }
    const result = validationResult.data;
    if (!validateCoordinates(result.latitude, result.longitude)) {
      return { latitude, longitude, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` };
    }
    const address = formatSafeAddress([result.locality || result.city, result.principalSubdivision, result.countryName]) || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
    return { latitude: result.latitude, longitude: result.longitude, address, city: sanitizeText(result.locality || result.city || ''), state: sanitizeText(result.principalSubdivision || ''), country: sanitizeText(result.countryName || '') };
  } catch (error) {
    console.error('Erro ao fazer reverse geocoding com BigDataCloud:', error);
    return { latitude, longitude, address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` };
  }
}