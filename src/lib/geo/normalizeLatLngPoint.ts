export type LatLngPoint = { lat: number; lng: number };

type Region = 'BR' | 'WORLD';

const BRAZIL_BOUNDS = {
  minLat: -35,
  maxLat: 6,
  minLng: -75,
  maxLng: -30,
} as const;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function withinWorld(lat: number, lng: number) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function withinBrazil(lat: number, lng: number) {
  return (
    lat >= BRAZIL_BOUNDS.minLat &&
    lat <= BRAZIL_BOUNDS.maxLat &&
    lng >= BRAZIL_BOUNDS.minLng &&
    lng <= BRAZIL_BOUNDS.maxLng
  );
}

/**
 * Tenta escalar coordenadas em micrograus (1e5, 1e6, 1e7) para graus decimais.
 * Também detecta se os valores estão invertidos (lat no lugar de lng e vice-versa).
 */
function tryScaleToDegrees(value: number, kind: 'lat' | 'lng'): number {
  const maxAbs = kind === 'lat' ? 90 : 180;
  if (Math.abs(value) <= maxAbs) return value;

  // Heurística: alguns sistemas persistem coordenadas como micrograus (1e5, 1e6) ou 1e7
  for (const divisor of [1e5, 1e6, 1e7]) {
    const scaled = value / divisor;
    if (Math.abs(scaled) <= maxAbs) {
      console.log(`[normalizeLatLngPoint] Scaled ${kind} from ${value} to ${scaled} (divisor: ${divisor})`);
      return scaled;
    }
  }

  return value;
}

/**
 * Verifica se o valor parece ser uma coordenada válida para o Brasil.
 * Útil para detectar coordenadas zeradas ou claramente inválidas.
 */
function isPlausibleBrazilCoord(lat: number, lng: number): boolean {
  // Coordenadas zeradas ou muito pequenas são inválidas
  if (lat === 0 && lng === 0) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  
  // Latitude brasileira deve ser negativa (exceto extremo norte)
  // Longitude brasileira deve ser negativa
  if (lng > 0) return false; // Brasil está no hemisfério oeste
  
  return withinBrazil(lat, lng);
}

/**
 * Normaliza um ponto {lat,lng} para uso no MapLibre.
 * - Corrige coordenadas em micrograus (1e5/1e6/1e7)
 * - Corrige lat/lng invertidos quando o ponto final cai no Brasil
 * 
 * IMPORTANTE: Esta função pode retornar null se as coordenadas
 * não forem válidas globalmente. Se você precisa de um fallback,
 * verifique o retorno antes de usar.
 */
export function normalizeLatLngPoint(
  point: LatLngPoint | null | undefined,
  region: Region = 'BR',
  options?: { silent?: boolean }
): LatLngPoint | null {
  const silent = options?.silent ?? false;
  const log = (...args: any[]) => {
    if (!silent) console.log(...args);
  };
  const warn = (...args: any[]) => {
    if (!silent) console.warn(...args);
  };

  if (!point) {
    log('[normalizeLatLngPoint] ❌ Null/undefined point received');
    return null;
  }
  
  if (!isFiniteNumber(point.lat) || !isFiniteNumber(point.lng)) {
    log('[normalizeLatLngPoint] ❌ Non-finite numbers:', { lat: point.lat, lng: point.lng });
    return null;
  }

  // Detectar coordenadas zeradas
  if (point.lat === 0 && point.lng === 0) {
    log('[normalizeLatLngPoint] ❌ Zero coordinates - invalid');
    return null;
  }

  // 1) Corrigir escala (micrograus)
  const scaledLat = tryScaleToDegrees(point.lat, 'lat');
  const scaledLng = tryScaleToDegrees(point.lng, 'lng');

  // 2) Validar range global
  if (!withinWorld(scaledLat, scaledLng)) {
    warn('[normalizeLatLngPoint] ❌ Coordinates outside world bounds after scaling:', { 
      original: { lat: point.lat, lng: point.lng },
      scaled: { lat: scaledLat, lng: scaledLng }
    });
    return null;
  }

  if (region === 'WORLD') {
    log('[normalizeLatLngPoint] ✅ WORLD mode - using scaled:', { lat: scaledLat, lng: scaledLng });
    return { lat: scaledLat, lng: scaledLng };
  }

  // 3) Se já cai no Brasil, ok
  if (isPlausibleBrazilCoord(scaledLat, scaledLng)) {
    log('[normalizeLatLngPoint] ✅ Valid Brazil coordinates:', { lat: scaledLat, lng: scaledLng });
    return { lat: scaledLat, lng: scaledLng };
  }

  // 4) Heurística: se invertido, corrigir (lat <-> lng)
  if (isPlausibleBrazilCoord(scaledLng, scaledLat)) {
    warn('[normalizeLatLngPoint] 🔄 Detected SWAPPED lat/lng. Auto-fixing.', {
      from: { lat: point.lat, lng: point.lng },
      to: { lat: scaledLng, lng: scaledLat },
    });
    return { lat: scaledLng, lng: scaledLat };
  }

  // 5) Verificar se cai no Brasil com limites mais relaxados
  if (withinBrazil(scaledLat, scaledLng)) {
    log('[normalizeLatLngPoint] ✅ Within Brazil bounds (relaxed):', { lat: scaledLat, lng: scaledLng });
    return { lat: scaledLat, lng: scaledLng };
  }

  // 6) Não cai no Brasil mas é válido globalmente - retorna mesmo assim
  // Isso é importante para não rejeitar coordenadas de países vizinhos ou oceano
  log('[normalizeLatLngPoint] ⚠️ Coordinates outside Brazil but valid globally:', { lat: scaledLat, lng: scaledLng });
  return { lat: scaledLat, lng: scaledLng };
}
