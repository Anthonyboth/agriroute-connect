/**
 * locationAlertManager
 *
 * Gerenciador centralizado de alertas de GPS.
 * Garante:
 *   - Cooldown mínimo de 2 minutos entre alertas
 *   - Não repete alerta se estado não mudou
 *   - Suprime alertas de TIMEOUT (silencioso)
 *   - Não spamma banner se o usuário fechou recentemente
 */

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
        toast.error('Permissão de localização negada', {
          description: 'Ative a permissão de localização nas configurações do dispositivo.',
          duration: 12000,
          id: 'gps-no-permission',
          action: opts?.onAction
            ? { label: 'Permitir', onClick: opts.onAction }
            : undefined,
        });
        break;

      case 'GPS_OFF':
        toast.error('GPS desligado', {
          description: 'Ative o GPS (serviços de localização) nas configurações do dispositivo.',
          duration: 12000,
          id: 'gps-off',
          action: opts?.onAction
            ? { label: 'Configurações', onClick: opts.onAction }
            : undefined,
        });
        break;

      case 'LOW_ACCURACY':
        toast.warning('Sinal GPS fraco', {
          description: 'Baixa precisão detectada. Tente se mover para um local aberto.',
          duration: 6000,
          id: 'gps-low-accuracy',
        });
        break;

      case 'UNAVAILABLE':
        // Aviso sutil — sem bloquear
        console.warn('[GPS-Alert] Posição indisponível — tentando novamente silenciosamente');
        break;

      case 'RESTORED':
        toast.success('GPS restaurado', {
          description: 'Localização sendo capturada normalmente.',
          duration: 4000,
          id: 'gps-restored',
        });
        break;

      // TIMEOUT → suprimido acima, nunca chega aqui
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
