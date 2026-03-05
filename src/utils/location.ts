import { Capacitor } from '@capacitor/core';
import { devLog } from '@/lib/devLogger';
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
  if (accuracy <= 50) return { accuracy, quality: 'EXCELLENT', isAcceptable: true };
  if (accuracy <= 100) return { accuracy, quality: 'GOOD', isAcceptable: true };
  if (accuracy <= 500) return { accuracy, quality: 'ACCEPTABLE', isAcceptable: true };
  return { accuracy, quality: 'POOR', isAcceptable: false };
};

const toWebLike = (pos: Position): SafePosition => ({
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

/**
 * Verifica se o erro é "serviços de localização desativados" (iOS/Android)
 */
const isLocationServicesDisabledError = (err: any): boolean => {
  const msg = typeof err === 'string' ? err : err?.message ?? '';
  const lower = msg.toLowerCase();
  return (
    lower.includes('location services') ||
    lower.includes('location service') ||
    lower.includes('disabled') ||
    lower.includes('not enabled') ||
    lower.includes('kclauthorizationstatusdenied') ||
    lower.includes('denied') ||
    // iOS specific
    lower.includes('cllocationmanager')
  );
};

export const checkPermissionSafe = async (): Promise<boolean> => {
  if (isNative()) {
    try {
      const perm: PermissionStatus = await Geolocation.checkPermissions();
      console.log('[PERM] checkPermissions result:', JSON.stringify(perm));
      
      const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
      if (granted) {
        console.log('[PERM] fine/coarse granted');
        return true;
      }

      // On iOS, 'prompt' means user hasn't decided yet — not denied
      // On some Android, checkPermissions returns wrong result
      // Try a quick getCurrentPosition as real proof
      try {
        await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 });
        console.log('[PERM] checkPermissions returned non-granted, but getCurrentPosition worked — treating as granted');
        return true;
      } catch {
        return false;
      }
    } catch (err: any) {
      console.warn('[PERM] Erro ao verificar permissões nativas:', err?.message || err);
      if (isLocationServicesDisabledError(err)) {
        console.warn('[PERM] Serviços de localização do SISTEMA estão DESATIVADOS (iOS/Android)');
      }
      console.log('[PERM] fine/coarse denied (check failed)');
      return false;
    }
  }

  // Web fallback — navigator.permissions.query is NOT supported on iOS Safari
  try {
    if (typeof navigator !== 'undefined' && navigator?.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return status.state === 'granted';
    }
  } catch {
    // Silently fail — iOS Safari doesn't support permissions API
  }
  
  // Final fallback for web: try to actually get position with short timeout
  if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
    try {
      await new Promise<void>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(),
          (err) => reject(err),
          { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
        );
      });
      return true;
    } catch {
      return false;
    }
  }
  
  return false;
};

export const requestPermissionSafe = async (): Promise<boolean> => {
  if (isNative()) {
    try {
      console.log('[PERM] Requesting native fine/coarse permissions...');
      const perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      console.log('[PERM] requestPermissions result:', JSON.stringify(perm));
      
      const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
      console.log('[PERM] fine/coarse', granted ? 'granted' : 'denied');
      
      if (granted) return true;
      
      // Fallback: try getCurrentPosition — some devices report wrong permission status
      console.log('[GPS] Permission reported as not granted, trying getCurrentPosition fallback...');
      try {
        await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 });
        console.log('[GPS] Fallback getCurrentPosition worked despite permission reported as denied');
        return true;
      } catch (fallbackErr: any) {
        console.warn('[GPS] Fallback getCurrentPosition also failed:', fallbackErr?.message || fallbackErr);
        return false;
      }
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message ?? '';
      console.warn('[GPS] Error requesting native permissions:', msg);
      
      // ✅ Detect "Missing permissions in AndroidManifest.xml" — this means the APK
      // was built without running `npx cap sync` after the latest git pull.
      // The permissions ARE in our AndroidManifest.xml but weren't merged into the build.
      if (msg.includes('Missing the following permissions') || msg.includes('AndroidManifest')) {
        console.error('[GPS] ❌ APK desatualizado — permissões não foram sincronizadas.');
        console.error('[GPS] Execute: git pull && npx cap sync android && npx cap run android');
        // Still try the web fallback — some WebView environments support it
        try {
          const webPos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              enableHighAccuracy: false, timeout: 8000 
            });
          });
          if (webPos?.coords) {
            console.log('[GPS] ✅ WebView geolocation fallback worked!');
            return true;
          }
        } catch {
          console.warn('[GPS] WebView geolocation fallback also failed');
        }
        return false;
      }
      
      if (isLocationServicesDisabledError(err)) {
        console.error('[GPS] ❌ Serviços de localização do SISTEMA estão DESATIVADOS.');
        console.error('[GPS] iOS: Ajustes > Privacidade > Serviços de Localização > ATIVAR');
        console.error('[GPS] Android: Configurações > Localização > ATIVAR');
        try {
          await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 });
          console.log('[GPS] getCurrentPosition worked despite requestPermissions throwing');
          return true;
        } catch {
          return false;
        }
      }
      
      // Any other error — try the fallback too
      try {
        await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 8000 });
        console.log('[GPS] getCurrentPosition fallback worked despite error in requestPermissions');
        return true;
      } catch {
        // Last resort: try WebView geolocation API directly
        try {
          const webPos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { 
              enableHighAccuracy: false, timeout: 8000 
            });
          });
          if (webPos?.coords) {
            console.log('[GPS] ✅ WebView geolocation final fallback worked!');
            return true;
          }
        } catch {
          // truly no GPS available
        }
        return false;
      }
    }
  }

  // Web: request by actually calling getCurrentPosition (triggers browser prompt)
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(false);
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
};

// Global rate limiting
let lastGPSRequestTime = 0;
const GPS_COOLDOWN_MS = 5000;

export const getCurrentPositionSafe = async (maxRetries: number = 3): Promise<SafePosition> => {
  // Rate limiting
  const now = Date.now();
  if (now - lastGPSRequestTime < GPS_COOLDOWN_MS) {
    const waitTime = GPS_COOLDOWN_MS - (now - lastGPSRequestTime);
    devLog(`[GPS] Rate limit: aguardando ${waitTime}ms`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  lastGPSRequestTime = Date.now();

  if (isNative()) {
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      return toWebLike(pos);
    } catch (err: any) {
      console.warn('[GPS] Native getCurrentPosition failed:', err?.message || err);
      
      // If high accuracy fails, try low accuracy (iOS simulator often has issues with high accuracy)
      if (maxRetries > 0) {
        console.log('[GPS] Retrying with enableHighAccuracy: false...');
        try {
          const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 15000 });
          return toWebLike(pos);
        } catch (retryErr: any) {
          console.warn('[GPS] Low accuracy also failed:', retryErr?.message || retryErr);
        }
      }
      
      if (isLocationServicesDisabledError(err)) {
        throw new Error('Serviços de localização desativados. Ative em Ajustes > Privacidade > Serviços de Localização.');
      }
      throw err;
    }
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject(new Error('Geolocalização não suportada'));
        
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const quality = getGPSQuality(p.coords.accuracy);
            devLog(`[GPS] Tentativa ${attempt}: ${quality.quality} (${quality.accuracy}m)`);
            
            if (p.coords.accuracy > 1000 && attempt < maxRetries) {
              reject(new Error(`GPS de baixa qualidade: ${p.coords.accuracy}m`));
              return;
            }
            
            if (quality.accuracy <= 500 || attempt === maxRetries) {
              if (attempt === maxRetries && quality.quality === 'POOR') {
                console.warn(`[GPS] ⚠️ Aceitando GPS de baixa qualidade após ${maxRetries} tentativas: ${quality.accuracy}m`);
                import('sonner').then(({ toast }) => {
                  toast.warning('GPS com baixa precisão. Considere mover-se para área aberta.', {
                    duration: 5000
                  });
                });
              }
              resolve(p);
            } else {
              reject(new Error(`GPS de baixa qualidade: ${quality.accuracy}m`));
            }
          },
          (err) => reject(err),
          { 
            enableHighAccuracy: attempt > 1,
            timeout: 15000 + (5000 * attempt),
            maximumAge: 30000
          }
        );
      });
      
      return { coords: position.coords };
    } catch (err: any) {
      console.warn(`[GPS] Erro tentativa ${attempt}/${maxRetries}:`, err.message);
      
      if (attempt === maxRetries) {
        throw err;
      }
      
      const backoffTime = 3000 * attempt;
      devLog(`[GPS] Retry em ${backoffTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, backoffTime));
    }
  }
  
  throw new Error('Não foi possível obter localização');
};

export const watchPositionSafe = (
  onSuccess: (coords: GeolocationCoordinates) => void,
  onError: (err: any) => void
): { clear: () => void } => {

  // Helper: start web/WebView geolocation as fallback
  const startWebFallback = (): { clear: () => void } => {
    if (!('geolocation' in navigator)) {
      onError({ code: 1, message: 'Geolocalização não suportada neste dispositivo.' });
      return { clear: () => {} };
    }
    console.log('[GPS] Using navigator.geolocation (WebView fallback)');
    const id = navigator.geolocation.watchPosition(
      (p) => onSuccess(p.coords),
      onError,
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 }
    );
    return { clear: () => navigator.geolocation.clearWatch(id) };
  };

  if (isNative()) {
    let pendingWatchId: string | null = null;
    let wasStoppedBeforeResolve = false;
    let fallbackHandle: { clear: () => void } | null = null;

    const handle = {
      clear: () => {
        if (fallbackHandle) {
          fallbackHandle.clear();
          fallbackHandle = null;
          return;
        }
        if (pendingWatchId) {
          Geolocation.clearWatch({ id: pendingWatchId });
          pendingWatchId = null;
        } else {
          wasStoppedBeforeResolve = true;
        }
      },
    };

    Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
      if (wasStoppedBeforeResolve) return;
      if (err) {
        const msg = typeof err === 'string' ? err : (err as any)?.message ?? '';
        if (isLocationServicesDisabledError(msg)) {
          return onError({ code: 2, message: 'Serviços de localização desativados. Ative em Ajustes > Privacidade > Serviços de Localização.' });
        }
        if (msg.toLowerCase().includes('missing') && msg.toLowerCase().includes('permission')) {
          // Manifest issue — switch to WebView fallback silently
          console.warn('[GPS] Manifest permission issue in callback — switching to WebView fallback');
          fallbackHandle = startWebFallback();
          return;
        }
        return onError(err);
      }
      if (pos) onSuccess(toWebLike(pos).coords);
    }).then((id) => {
      pendingWatchId = id as unknown as string;
      if (wasStoppedBeforeResolve) {
        console.log('[GPS] watchPositionSafe: clear() called before resolve — clearing immediately');
        Geolocation.clearWatch({ id: pendingWatchId });
        pendingWatchId = null;
      }
    }).catch((err) => {
      // Capacitor plugin failed entirely — use WebView fallback instead of reporting error
      const msg = typeof err === 'string' ? err : (err as any)?.message ?? '';
      console.warn('[GPS] Native watchPosition failed, trying WebView fallback:', msg);

      if (isLocationServicesDisabledError(msg)) {
        // Location services truly off — no fallback will help
        onError({ code: 2, message: 'Serviços de localização desativados. Ative em Ajustes > Privacidade > Serviços de Localização.' });
        return;
      }

      // For manifest errors or other plugin failures, try WebView geolocation
      fallbackHandle = startWebFallback();
    });
    return handle as any;
  }

  return startWebFallback();
};
