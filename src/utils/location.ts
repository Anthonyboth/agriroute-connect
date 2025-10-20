import { Capacitor } from '@capacitor/core';
import { Geolocation, PermissionStatus, Position } from '@capacitor/geolocation';

export const isNative = () => Capacitor.isNativePlatform();

export type SafePosition = {
  coords: GeolocationCoordinates;
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

export const getCurrentPositionSafe = async (): Promise<SafePosition> => {
  if (isNative()) {
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return toWebLike(pos);
  }
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('Geolocalização não suportada'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ coords: p.coords }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
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
