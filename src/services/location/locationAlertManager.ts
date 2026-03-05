/**
 * locationAlertManager
 *
 * Gerenciador centralizado de alertas de GPS.
 * Agora delegando para gpsToastGuard para deduplicação global.
 */

import { showGPSToast } from '@/utils/gpsToastGuard';
import { toast } from 'sonner';

export type LocationAlertType =
  | 'NO_PERMISSION'
  | 'GPS_OFF'
  | 'LOW_ACCURACY'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'RESTORED';

interface AlertRecord {
  type: LocationAlertType;
  shownAt: number;
}

// Cooldowns em ms
const ALERT_COOLDOWN_MS = 2 * 60 * 1000;       // 2 min entre alertas críticos
const DISMISSED_COOLDOWN_MS = 5 * 60 * 1000;   // 5 min se o usuário fechou o banner
const LOW_ACCURACY_COOLDOWN_MS = 5 * 60 * 1000; // 5 min para aviso leve

class LocationAlertManager {
  private lastAlert: AlertRecord | null = null;
  private dismissedAt: number = 0;

  /** Chamado quando o usuário fecha o banner manualmente */
  dismiss() {
    this.dismissedAt = Date.now();
  }

  private shouldSuppress(type: LocationAlertType): boolean {
    const now = Date.now();

    // TIMEOUT nunca exibe alerta intrusivo
    if (type === 'TIMEOUT') return true;

    // Se o usuário fechou o banner recentemente (exceto se virar NO_PERMISSION)
    if (
      type !== 'NO_PERMISSION' &&
      this.dismissedAt > 0 &&
      now - this.dismissedAt < DISMISSED_COOLDOWN_MS
    ) {
      return true;
    }

    if (!this.lastAlert) return false;

    // Mesmo tipo dentro do cooldown
    const cooldown =
      type === 'LOW_ACCURACY' ? LOW_ACCURACY_COOLDOWN_MS : ALERT_COOLDOWN_MS;

    if (this.lastAlert.type === type && now - this.lastAlert.shownAt < cooldown) {
      return true;
    }

    return false;
  }

  show(
    type: LocationAlertType,
    opts?: { onAction?: () => void }
  ) {
    if (this.shouldSuppress(type)) {
      return;
    }

    this.lastAlert = { type, shownAt: Date.now() };

    switch (type) {
      case 'NO_PERMISSION':
        showGPSToast('NO_PERMISSION');
        break;
      case 'GPS_OFF':
        showGPSToast('GPS_OFF');
        break;
      case 'LOW_ACCURACY':
        showGPSToast('GPS_TIMEOUT');
        break;
      case 'UNAVAILABLE':
        console.warn('[GPS-Alert] Posição indisponível — tentando novamente silenciosamente');
        break;
      case 'RESTORED':
        toast.success('GPS restaurado', {
          description: 'Localização sendo capturada normalmente.',
          duration: 4000,
          id: 'gps-restored',
        });
        break;
    }
  }

  /** Reseta o estado (ex: quando frete termina) */
  reset() {
    this.lastAlert = null;
    this.dismissedAt = 0;
  }
}

// Singleton por sessão
export const locationAlertManager = new LocationAlertManager();
