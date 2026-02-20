/**
 * src/lib/geo/mapHelpers.ts
 *
 * Helpers para coordenadas no MapLibre.
 * MapLibre usa SEMPRE [lng, lat] — nunca [lat, lng].
 */

export type LatLngInput = { lat: number; lng: number };

/**
 * Converte { lat, lng } para o formato [lng, lat] que o MapLibre exige.
 * Use SEMPRE esta função antes de passar coordenadas ao MapLibre.
 */
export function toLngLat(p: LatLngInput): [number, number] {
  return [p.lng, p.lat];
}

/**
 * Guard de sanidade de coordenadas. Loga warning em DEV se fora de range.
 */
export function assertLatLng(lat: number, lng: number, ctx: string): void {
  if (import.meta.env.DEV) {
    if (Math.abs(lat) > 90) {
      console.warn('[LATLNG INVALID] lat fora de range [-90,90]:', ctx, { lat, lng });
    }
    if (Math.abs(lng) > 180) {
      console.warn('[LATLNG INVALID] lng fora de range [-180,180]:', ctx, { lat, lng });
    }
    if (lat === 0 && lng === 0) {
      console.warn('[LATLNG INVALID] coordenadas zeradas (provável fallback):', ctx);
    }
  }
}

/**
 * Gera link do Google Maps para cross-check visual.
 * Use no devtools para verificar se a coordenada bate com o local real.
 */
export function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
