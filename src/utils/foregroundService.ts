/**
 * Foreground Service — ATIVO (Background Location para segurança da carga)
 * 
 * Usa @capawesome-team/capacitor-android-foreground-service para manter
 * uma notificação persistente e silenciosa enquanto o rastreio está ativo.
 * 
 * Regras:
 * - 1 única notificação persistente (ongoing, silenciosa, prioridade baixa)
 * - Atualização do texto no máximo a cada 30s
 * - Botões: "Abrir app" e "Parar rastreio"
 * - Removida automaticamente ao parar o rastreio
 */

import { Capacitor } from '@capacitor/core';

const isAndroidPlatform = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const NOTIFICATION_ID = 9001;
const CHANNEL_ID = 'tracking_channel';
const CHANNEL_NAME = 'Rastreio de Localização';
const CHANNEL_DESCRIPTION = 'Notificação de rastreio ativo para segurança da carga';

// Button IDs
const BUTTON_OPEN_APP = 1;
const BUTTON_STOP_TRACKING = 2;

let isRunning = false;
let stopTrackingCallback: (() => void) | null = null;
let buttonListener: any = null;
let lastNotificationUpdate = 0;
const MIN_UPDATE_INTERVAL_MS = 30_000; // 30s between notification text updates

/**
 * Set the callback that will be called when user taps "Parar rastreio" on the notification.
 */
export const setStopTrackingCallback = (cb: () => void): void => {
  stopTrackingCallback = cb;
};

/**
 * Create the low-importance notification channel (silent, no vibration).
 */
const ensureNotificationChannel = async (): Promise<void> => {
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.createNotificationChannel({
      id: CHANNEL_ID,
      name: CHANNEL_NAME,
      description: CHANNEL_DESCRIPTION,
      importance: 2, // LOW importance = no sound, no vibration
    });
  } catch (err) {
    console.warn('[ForegroundService] Erro ao criar canal de notificação:', err);
  }
};

/**
 * Set up the button click listener for notification actions.
 */
const setupButtonListener = async (): Promise<void> => {
  if (buttonListener) return;
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    buttonListener = await ForegroundService.addListener('buttonClicked', (event) => {
      console.log('[ForegroundService] Button clicked:', event.buttonId);
      if (event.buttonId === BUTTON_OPEN_APP) {
        ForegroundService.moveToForeground().catch(() => {});
      } else if (event.buttonId === BUTTON_STOP_TRACKING) {
        if (stopTrackingCallback) {
          stopTrackingCallback();
        }
      }
    });
  } catch (err) {
    console.warn('[ForegroundService] Erro ao configurar listener de botões:', err);
  }
};

/**
 * Start the Android Foreground Service with a persistent, silent notification.
 */
export const startForegroundService = async (): Promise<void> => {
  if (!isAndroidPlatform()) {
    console.log('[ForegroundService] Não é Android — ignorando');
    return;
  }
  if (isRunning) {
    console.log('[FGS] FGS_ALREADY_RUNNING — idempotent, sem duplicar notificação');
    return;
  }

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');

    // 1. Create low-importance channel
    await ensureNotificationChannel();

    // 2. Set up button listener
    await setupButtonListener();

    // 3. Start foreground service
    await ForegroundService.startForegroundService({
      id: NOTIFICATION_ID,
      title: 'AgriRoute',
      body: 'Rastreio ativo – Segurança da carga',
      smallIcon: 'ic_stat_icon_config_sample',
      notificationChannelId: CHANNEL_ID,
      silent: true,
      buttons: [
        { title: 'Abrir app', id: BUTTON_OPEN_APP },
        { title: 'Parar rastreio', id: BUTTON_STOP_TRACKING },
      ],
    });

    isRunning = true;
    lastNotificationUpdate = Date.now();
    console.log('[FGS] FGS_START_OK — 1 notificação persistente ativa');
  } catch (err) {
    console.error('[ForegroundService] ❌ Erro ao iniciar:', err);
    // Don't throw — tracking can still work in foreground without FGS
  }
};

/**
 * Stop the Foreground Service and remove the notification.
 */
export const stopForegroundService = async (): Promise<void> => {
  if (!isAndroidPlatform() || !isRunning) return;

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.stopForegroundService();
    console.log('[FGS] FGS_STOP_OK — notificação removida');
  } catch (err) {
    console.warn('[ForegroundService] Erro ao parar:', err);
  } finally {
    isRunning = false;
    // Clean up listener
    if (buttonListener) {
      try { await buttonListener.remove(); } catch {}
      buttonListener = null;
    }
  }
};

/**
 * Update the notification body text (throttled to max 1 update per 30s).
 * Use for status changes like "Em rota", "Parado", "Chegando".
 */
export const updateForegroundNotification = async (body: string): Promise<void> => {
  if (!isAndroidPlatform() || !isRunning) return;

  const now = Date.now();
  if (now - lastNotificationUpdate < MIN_UPDATE_INTERVAL_MS) return;

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.updateForegroundService({
      id: NOTIFICATION_ID,
      title: 'AgriRoute',
      body,
      smallIcon: 'ic_stat_icon_config_sample',
      notificationChannelId: CHANNEL_ID,
      silent: true,
      buttons: [
        { title: 'Abrir app', id: BUTTON_OPEN_APP },
        { title: 'Parar rastreio', id: BUTTON_STOP_TRACKING },
      ],
    });
    lastNotificationUpdate = now;
  } catch (err) {
    console.warn('[ForegroundService] Erro ao atualizar notificação:', err);
  }
};

/**
 * Check if the foreground service is currently running.
 */
export const isForegroundServiceRunning = (): boolean => isRunning;
