/**
 * gpsToastGuard — Singleton que impede spam de toasts de GPS.
 * 
 * Problema: Múltiplos componentes (UnifiedTrackingControl, useFreightTracking,
 * useLocationPermissionSync, LocationTracker, LocationPermission) disparam
 * toast.error('Permissão de localização negada') quase simultaneamente.
 * Mesmo com id: 'gps-no-permission', o sonner pode empilhar antes de deduplificar.
 * 
 * Solução: Um guard global que permite no máximo 1 toast por tipo a cada 15 segundos.
 */

import { toast } from 'sonner';

type GPSToastType = 'NO_PERMISSION' | 'GPS_OFF' | 'GPS_UNAVAILABLE' | 'GPS_TIMEOUT' | 'GPS_ERROR' | 'FGS_DENIED';

const lastShown: Record<string, number> = {};
const COOLDOWN_MS = 15_000; // 15 seconds between same toast type

/**
 * Show a GPS-related toast ONLY if the same type hasn't been shown recently.
 * Returns true if the toast was shown, false if suppressed.
 */
export function showGPSToast(type: GPSToastType): boolean {
  const now = Date.now();
  const last = lastShown[type] || 0;
  
  if (now - last < COOLDOWN_MS) {
    return false; // Suppressed
  }
  
  lastShown[type] = now;
  
  switch (type) {
    case 'NO_PERMISSION':
      toast.error('Permissão de localização negada', {
        description: 'Ative nas configurações do dispositivo.',
        id: 'gps-no-permission',
        duration: 8000,
      });
      break;
    case 'GPS_OFF':
      toast.error('GPS desligado', {
        description: 'Ative o GPS nas configurações do dispositivo.',
        id: 'gps-off',
        duration: 8000,
      });
      break;
    case 'GPS_UNAVAILABLE':
      toast.error('Localização indisponível', {
        description: 'Verifique se o GPS está ativado.',
        id: 'gps-unavailable',
        duration: 6000,
      });
      break;
    case 'GPS_TIMEOUT':
      toast.warning('GPS demorando para responder', {
        description: 'Se estiver em local fechado, mova-se para uma área aberta.',
        id: 'gps-timeout',
        duration: 6000,
      });
      break;
    case 'GPS_ERROR':
      toast.error('Erro ao rastrear localização', {
        id: 'gps-error',
        duration: 6000,
      });
      break;
    case 'FGS_DENIED':
      toast.warning('Rastreio não funcionará em segundo plano', {
        description: 'Permissão de notificações negada.',
        id: 'gps-notif-denied',
        duration: 6000,
      });
      break;
  }
  
  return true;
}

/** Reset all cooldowns (e.g., when freight ends) */
export function resetGPSToasts() {
  for (const key of Object.keys(lastShown)) {
    delete lastShown[key];
  }
}
