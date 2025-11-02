import { Capacitor } from '@capacitor/core';
import { Geolocation, PermissionStatus, Position } from '@capacitor/geolocation';

export const isNative = () => Capacitor.isNativePlatform();

export type SafePosition = {
  coords: GeolocationCoordinates;
};

export interface GPSQuality {
  accuracy: number;
  quality: 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'POOR';
  isAcceptable: boolean;
}

export const getGPSQuality = (accuracy: number): GPSQuality => {
  if (accuracy <= 20) return { accuracy, quality: 'EXCELLENT', isAcceptable: true };
  if (accuracy <= 50) return { accuracy, quality: 'GOOD', isAcceptable: true };
  if (accuracy <= 100) return { accuracy, quality: 'ACCEPTABLE', isAcceptable: true };
  return { accuracy, quality: 'POOR', isAcceptable: false };
};

const toWebLike = (pos: Position): SafePosition => ({
  // Web GeolocationCoordinates compatible object
  coords: {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude ?? null as any,
    altitudeAccuracy: pos.coords.altitudeAccuracy ?? null as any,
    heading: pos.coords.heading ?? null as any,
    speed: pos.coords.speed ?? null as any,
  } as GeolocationCoordinates,
});

export const checkPermissionSafe = async (): Promise<boolean> => {
  if (isNative()) {
    const perm: PermissionStatus = await Geolocation.checkPermissions();
    return perm.location === 'granted' || perm.coarseLocation === 'granted';
  }
  try {
    // Browser permissions API
    // @ts-ignore
    if (navigator?.permissions?.query) {
      // @ts-ignore
      const status = await navigator.permissions.query({ name: 'geolocation' });
      return status.state === 'granted';
    }
  } catch {}
  return false;
};

export const requestPermissionSafe = async (): Promise<boolean> => {
  if (isNative()) {
    const perm = await Geolocation.requestPermissions();
    return perm.location === 'granted' || perm.coarseLocation === 'granted';
  }
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
};

export const getCurrentPositionSafe = async (maxRetries: number = 3): Promise<SafePosition> => {
  if (isNative()) {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return toWebLike(pos);
  }
  
  // Tentativas com retry para obter GPS de qualidade
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject(new Error('Geolocalização não suportada'));
        
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const quality = getGPSQuality(p.coords.accuracy);
            console.log(`[GPS] Tentativa ${attempt}: ${quality.quality} (${quality.accuracy}m)`);
            
            // Aceitar se qualidade boa ou se última tentativa
            if (quality.accuracy <= 200 || attempt === maxRetries) {
              resolve(p);
            } else {
              reject(new Error(`GPS de baixa qualidade: ${quality.accuracy}m`));
            }
          },
          (err) => reject(err),
          { 
            enableHighAccuracy: attempt > 1, // Primeira tentativa mais rápida
            timeout: 25000 + (5000 * attempt), // Timeout progressivo
            maximumAge: 120000 
          }
        );
      });
      
      return { coords: position.coords };
    } catch (err: any) {
      console.warn(`[GPS] Erro tentativa ${attempt}/${maxRetries}:`, err.message);
      
      if (attempt === maxRetries) {
        throw err;
      }
      
      // Backoff exponencial entre tentativas
      await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
    }
  }
  
  throw new Error('Não foi possível obter localização de qualidade');
};

export const watchPositionSafe = (
  onSuccess: (coords: GeolocationCoordinates) => void,
  onError: (err: any) => void
): { clear: () => void } => {
  if (isNative()) {
    let watchId: string | undefined;
    Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
      if (err) return onError(err);
      if (pos) onSuccess(toWebLike(pos).coords);
    }).then((id) => {
      watchId = id as unknown as string;
    });
    return { clear: () => { if (watchId) Geolocation.clearWatch({ id: watchId }); } } as any;
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onSuccess(p.coords),
    onError,
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
  return { clear: () => navigator.geolocation.clearWatch(id) } as any;
};
