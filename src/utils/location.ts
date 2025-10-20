// src/utils/location.ts
// Runtime-safe location utilities.
// Motivation: avoid build errors when Capacitor isn't present; provide consistent 20s timeout
// and friendly error messages for geolocation attempts.
//
// This utility intentionally avoids top-level imports of Capacitor packages to keep the
// web bundler happy. It prefers native Capacitor runtime if available (window.Capacitor),
// otherwise it falls back to navigator.geolocation.

export type SafePosition = {
  coords: GeolocationCoordinates;
};

const hasNavigatorGeo = typeof navigator !== 'undefined' && 'geolocation' in navigator;

const getCapacitor = (): any => {
  if (typeof window === 'undefined') return null;
  // @ts-ignore runtime check
  const w = window as any;
  return w.Capacitor ?? null;
};

const getCapacitorGeolocationPlugin = async (): Promise<any | null> => {
  const cap = getCapacitor();
  if (!cap) return null;
  try {
    if (cap.Plugins && cap.Plugins.Geolocation) return cap.Plugins.Geolocation;
    // dynamic import fallback; may fail in web build, wrap in try/catch
    // @ts-ignore
    const mod = await import('@capacitor/geolocation');
    return mod.Geolocation ?? mod;
  } catch {
    return null;
  }
};

export const isNativePlatform = (): boolean => {
  const cap = getCapacitor();
  try {
    return !!(cap && typeof cap.isNativePlatform === 'function'
      ? cap.isNativePlatform()
      : (cap && cap.platform !== undefined && cap.platform !== 'web'));
  } catch {
    return false;
  }
};

export const requestPermissionSafe = async (opts?: { timeout?: number }): Promise<boolean> => {
  const cap = getCapacitor();
  if (cap) {
    try {
      const geoplugin = await getCapacitorGeolocationPlugin();
      if (geoplugin && typeof geoplugin.requestPermissions === 'function') {
        const perm = await geoplugin.requestPermissions();
        if (perm && (perm.location === 'granted' || perm.location === 'granted_foreground' || perm === 'granted')) return true;
      }
    } catch {
      // fallthrough to browser flow
    }
  }

  if (!hasNavigatorGeo) return false;

  return new Promise((resolve) => {
    try {
      navigator.geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { enableHighAccuracy: true, timeout: opts?.timeout ?? 20000, maximumAge: 0 }
      );
    } catch {
      resolve(false);
    }
  });
};

export const getCurrentPositionSafe = async (opts?: { timeout?: number }): Promise<SafePosition> => {
  const cap = getCapacitor();
  if (cap) {
    try {
      const geoplugin = await getCapacitorGeolocationPlugin();
      if (geoplugin && typeof geoplugin.getCurrentPosition === 'function') {
        const pos = await geoplugin.getCurrentPosition({ enableHighAccuracy: true, timeout: opts?.timeout ?? 20000 });
        return {
          coords: {
            latitude: pos.coords?.latitude ?? pos.latitude,
            longitude: pos.coords?.longitude ?? pos.longitude,
            accuracy: pos.coords?.accuracy ?? null,
            altitude: pos.coords?.altitude ?? null,
            altitudeAccuracy: (pos.coords && (pos.coords as any).altitudeAccuracy) ?? null,
            heading: (pos.coords && (pos.coords as any).heading) ?? null,
            speed: (pos.coords && (pos.coords as any).speed) ?? null,
          } as GeolocationCoordinates,
        };
      }
    } catch {
      // fallback to browser
    }
  }

  if (!hasNavigatorGeo) throw new Error('Geolocalização não suportada neste ambiente');

  return new Promise((resolve, reject) => {
    try {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ coords: p.coords }),
        (err) => {
          let msg = 'Erro ao obter localização';
          if (err && typeof err.code === 'number') {
            if (err.code === 1) msg = 'Permissão de localização negada';
            else if (err.code === 2) msg = 'Posição indisponível';
            else if (err.code === 3) msg = 'Timeout ao obter localização';
          }
          const error = new Error(msg);
          // @ts-ignore attach original
          error.raw = err;
          reject(error);
        },
        { enableHighAccuracy: true, timeout: opts?.timeout ?? 20000, maximumAge: 0 }
      );
    } catch (e) {
      reject(new Error('Erro ao acessar API de geolocalização'));
    }
  });
};

export const watchPositionSafe = (
  onSuccess: (coords: GeolocationCoordinates) => void,
  onError: (err: any) => void,
  opts?: { timeout?: number; maximumAge?: number }
): { clear: () => void } => {
  const cap = getCapacitor();
  let cleared = false;

  if (cap) {
    (async () => {
      try {
        const geoplugin = await getCapacitorGeolocationPlugin();
        if (!geoplugin || typeof geoplugin.watchPosition !== 'function') return;
        const watchId = await geoplugin.watchPosition({ enableHighAccuracy: true }, (pos: any, err: any) => {
          if (err) return onError(err);
          if (pos) onSuccess({
            latitude: pos.coords?.latitude ?? pos.latitude,
            longitude: pos.coords?.longitude ?? pos.longitude,
            accuracy: pos.coords?.accuracy ?? null,
            altitude: pos.coords?.altitude ?? null,
            altitudeAccuracy: (pos.coords && (pos.coords as any).altitudeAccuracy) ?? null,
            heading: (pos.coords && (pos.coords as any).heading) ?? null,
            speed: (pos.coords && (pos.coords as any).speed) ?? null,
          } as GeolocationCoordinates);
        });
        // store id on window for clearing later
        // @ts-ignore
        (window as any).__cap_geo_watch_id = watchId;
      } catch {
        // fallback to browser
      }
    })();
    return {
      clear: () => {
        if (cleared) return;
        cleared = true;
        try {
          // @ts-ignore
          const id = (window as any).__cap_geo_watch_id;
          if (id && cap && cap.Plugins && cap.Plugins.Geolocation && typeof cap.Plugins.Geolocation.clearWatch === 'function') {
            cap.Plugins.Geolocation.clearWatch({ id });
          }
        } catch {}
      },
    };
  }

  if (!hasNavigatorGeo) {
    return { clear: () => {} };
  }

  const id = navigator.geolocation.watchPosition(
    (p) => onSuccess(p.coords),
    (err) => {
      let msg = 'Erro ao obter localização';
      if (err && typeof err.code === 'number') {
        if (err.code === 1) msg = 'Permissão de localização negada';
        else if (err.code === 2) msg = 'Posição indisponível';
        else if (err.code === 3) msg = 'Timeout ao obter localização';
      }
      onError({ ...err, message: msg });
    },
    { enableHighAccuracy: true, timeout: opts?.timeout ?? 20000, maximumAge: opts?.maximumAge ?? 60000 }
  );

  return { clear: () => navigator.geolocation.clearWatch(id) };
};
