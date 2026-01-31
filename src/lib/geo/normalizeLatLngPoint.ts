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

function tryScaleToDegrees(value: number, kind: 'lat' | 'lng'): number {
  const maxAbs = kind === 'lat' ? 90 : 180;
  if (Math.abs(value) <= maxAbs) return value;

  // Heurística: alguns sistemas persistem coordenadas como micrograus (1e6) ou 1e7
  for (const divisor of [1e6, 1e7]) {
    const scaled = value / divisor;
    if (Math.abs(scaled) <= maxAbs) return scaled;
  }

  return value;
}

/**
 * Normaliza um ponto {lat,lng} para uso no MapLibre.
 * - Corrige coordenadas em micrograus (1e6/1e7)
 * - Corrige lat/lng invertidos quando o ponto final cai no Brasil
 * 
 * IMPORTANTE: Esta função pode retornar null se as coordenadas
 * não forem válidas globalmente. Se você precisa de um fallback,
 * verifique o retorno antes de usar.
 */
export function normalizeLatLngPoint(
  point: LatLngPoint | null | undefined,
  region: Region = 'BR'
): LatLngPoint | null {
  if (!point) {
    console.log('[normalizeLatLngPoint] Null/undefined point received');
    return null;
  }
  
  if (!isFiniteNumber(point.lat) || !isFiniteNumber(point.lng)) {
    console.log('[normalizeLatLngPoint] Non-finite numbers:', { lat: point.lat, lng: point.lng });
    return null;
  }

  // 1) Corrigir escala (micrograus)
  const scaledLat = tryScaleToDegrees(point.lat, 'lat');
  const scaledLng = tryScaleToDegrees(point.lng, 'lng');
  
  // Log se houve escala
  if (scaledLat !== point.lat || scaledLng !== point.lng) {
    console.log('[normalizeLatLngPoint] Scaled from microdegs:', { 
      from: { lat: point.lat, lng: point.lng },
      to: { lat: scaledLat, lng: scaledLng }
    });
  }

  // 2) Validar range global
  if (!withinWorld(scaledLat, scaledLng)) {
    console.warn('[normalizeLatLngPoint] Coordinates outside world bounds:', { lat: scaledLat, lng: scaledLng });
    return null;
  }

  if (region === 'WORLD') {
    return { lat: scaledLat, lng: scaledLng };
  }

  // 3) Se já cai no Brasil, ok
  if (withinBrazil(scaledLat, scaledLng)) {
    return { lat: scaledLat, lng: scaledLng };
  }

  // 4) Heurística: se invertido, corrigir
  if (withinBrazil(scaledLng, scaledLat)) {
    console.warn('[normalizeLatLngPoint] Detected swapped lat/lng. Auto-fixing.', {
      from: { lat: point.lat, lng: point.lng },
      to: { lat: scaledLng, lng: scaledLat },
    });
    return { lat: scaledLng, lng: scaledLat };
  }

  // 5) Não cai no Brasil mas é válido globalmente - retorna mesmo assim
  // Isso é importante para não rejeitar coordenadas de países vizinhos ou oceano
  console.log('[normalizeLatLngPoint] Coordinates outside Brazil but valid globally:', { lat: scaledLat, lng: scaledLng });
  return { lat: scaledLat, lng: scaledLng };
}
