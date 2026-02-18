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
    try {
      const perm: PermissionStatus = await Geolocation.checkPermissions();
      const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
      if (granted) return true;

      // Fallback: checkPermissions pode retornar falso negativo em alguns Android.
      // Tentar getCurrentPosition rápido como prova real de que o GPS funciona.
      try {
        await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 3000 });
        if (import.meta.env.DEV) console.log('[GPS] checkPermissions retornou não-granted, mas getCurrentPosition funcionou — tratando como granted');
        return true;
      } catch {
        // GPS realmente não disponível
        return false;
      }
    } catch (err) {
      console.warn('[GPS] Erro ao verificar permissões nativas:', err);
      return false;
    }
  }
  try {
    if (navigator?.permissions?.query) {
      const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return status.state === 'granted';
    }
  } catch {}
  return false;
};

export const requestPermissionSafe = async (): Promise<boolean> => {
  if (isNative()) {
    try {
      // Primeiro, solicitar permissões de localização (foreground)
      const perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      console.log('[GPS] Resultado requestPermissions:', JSON.stringify(perm));
      
      const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
      
      if (!granted) {
        // No Android, se o usuário negou 2x, o sistema bloqueia permanentemente.
        // Nesse caso, precisamos direcionar o usuário para as Configurações.
        console.warn('[GPS] Permissão negada pelo sistema. Pode ser bloqueio permanente (Android).');
        
        // Tentar fallback: getCurrentPosition pode funcionar se o GPS está ativo
        // mesmo quando checkPermissions/requestPermissions reportam negado
        try {
          await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000 });
          console.log('[GPS] Fallback getCurrentPosition funcionou apesar de permissão reportada como negada');
          return true;
        } catch (fallbackErr) {
          console.warn('[GPS] Fallback também falhou:', fallbackErr);
          return false;
        }
      }
      
      return true;
    } catch (err: any) {
      const msg = typeof err === 'string' ? err : err?.message ?? '';
      console.warn('[GPS] Erro ao solicitar permissões nativas:', msg, err);
      
      // "location disabled" = serviços de localização desativados no Android
      if (msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('location service')) {
        console.error('[GPS] Serviços de localização do sistema estão DESATIVADOS');
      }
      
      return false;
    }
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
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
    return toWebLike(pos);
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!('geolocation' in navigator)) return reject(new Error('Geolocalização não suportada'));
        
        navigator.geolocation.getCurrentPosition(
          (p) => {
            const quality = getGPSQuality(p.coords.accuracy);
            devLog(`[GPS] Tentativa ${attempt}: ${quality.quality} (${quality.accuracy}m)`);
            
            // Rejeitar se accuracy > 1000m (exceto na última tentativa)
            if (p.coords.accuracy > 1000 && attempt < maxRetries) {
              reject(new Error(`GPS de baixa qualidade: ${p.coords.accuracy}m`));
              return;
            }
            
            // Accept accuracy <= 500m OR always accept on last attempt
            if (quality.accuracy <= 500 || attempt === maxRetries) {
              // ✅ Na última tentativa, avisar sobre GPS ruim
              if (attempt === maxRetries && quality.quality === 'POOR') {
                console.warn(`[GPS] ⚠️ Aceitando GPS de baixa qualidade após ${maxRetries} tentativas: ${quality.accuracy}m`);
                // Importar toast dinamicamente para evitar problemas de dependência circular
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
      
      // Exponential backoff: 3s, 6s, 9s
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
  if (isNative()) {
    let watchId: string | undefined;
    Geolocation.watchPosition({ enableHighAccuracy: true }, (pos, err) => {
      if (err) {
        // Traduzir erros nativos para português
        const msg = typeof err === 'string' ? err : (err as any)?.message ?? '';
        if (msg.toLowerCase().includes('missing') && msg.toLowerCase().includes('permission')) {
          return onError({ code: 1, message: 'Permissão de localização necessária. Ative nas configurações do dispositivo.' });
        }
        return onError(err);
      }
      if (pos) onSuccess(toWebLike(pos).coords);
    }).then((id) => {
      watchId = id as unknown as string;
    }).catch((err) => {
      console.warn('[GPS] Erro nativo ao iniciar watchPosition:', err);
      const msg = typeof err === 'string' ? err : (err as any)?.message ?? '';
      if (msg.toLowerCase().includes('missing') && msg.toLowerCase().includes('permission')) {
        onError({ code: 1, message: 'Permissão de localização necessária. Ative nas configurações do dispositivo.' });
      } else {
        onError({ code: 1, message: 'Não foi possível iniciar o rastreamento. Verifique as permissões de localização.' });
      }
    });
    return { clear: () => { if (watchId) Geolocation.clearWatch({ id: watchId }); } } as any;
  }
  const id = navigator.geolocation.watchPosition(
    (p) => onSuccess(p.coords),
    onError,
    // Timeout maior evita falhas frequentes em ambientes com GPS lento (indoor/PWA)
    { enableHighAccuracy: true, timeout: 30000, maximumAge: 30000 }
  );
  return { clear: () => navigator.geolocation.clearWatch(id) } as any;
};
