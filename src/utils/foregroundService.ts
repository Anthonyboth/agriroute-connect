/**
 * Foreground Service Manager (v2 — Production-Ready)
 * 
 * Uses @capawesome-team/capacitor-android-foreground-service to provide:
 * - Real Android Foreground Service (startForeground() + NotificationChannel)
 * - Persistent notification that survives app backgrounding/screen lock
 * - "Parar Rastreamento" button on notification
 * - Auto-cleanup when freight ends
 * 
 * REQUIRED by Google Play for ACCESS_BACKGROUND_LOCATION.
 * On iOS and Web, all functions are no-ops.
 * 
 * Architecture:
 *   startForegroundService() → creates NotificationChannel + starts service
 *   updateForegroundNotification() → updates notification text
 *   stopForegroundService() → stops service + removes notification
 */

import { Capacitor } from '@capacitor/core';

// ── State ──────────────────────────────────────────────────────────────────
let isServiceRunning = false;
let buttonListenerRegistered = false;
let stopCallback: (() => void) | null = null;

const NOTIFICATION_ID = 1001;
const CHANNEL_ID = 'agriroute_tracking';
const CHANNEL_NAME = 'Rastreamento de Localização';
const CHANNEL_DESC = 'Notificação exibida enquanto o rastreamento de localização está ativo durante um frete.';

const BUTTON_STOP_ID = 1;

// ── Guards ─────────────────────────────────────────────────────────────────
const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/**
 * Register a callback to be invoked when user taps "Parar Rastreamento" on the notification.
 * Should be set before calling startForegroundService.
 */
export const setStopTrackingCallback = (cb: () => void) => {
  stopCallback = cb;
};

/**
 * Create the notification channel (Android 8+ requirement).
 * Safe to call multiple times — Android ignores duplicates.
 */
const ensureNotificationChannel = async () => {
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.createNotificationChannel({
      id: CHANNEL_ID,
      name: CHANNEL_NAME,
      description: CHANNEL_DESC,
      importance: 3, // Importance.Default = 3
    });
    console.log('[ForegroundService] ✅ NotificationChannel criado:', CHANNEL_ID);
  } catch (err: any) {
    console.warn('[ForegroundService] ⚠️ Falha ao criar canal:', err?.message || err);
  }
};

/**
 * Register listener for notification button clicks (once).
 */
const ensureButtonListener = async () => {
  if (buttonListenerRegistered) return;
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.addListener('buttonClicked', (event) => {
      console.log('[ForegroundService] 🔔 Botão clicado na notificação:', event.buttonId);
      if (event.buttonId === BUTTON_STOP_ID && stopCallback) {
        stopCallback();
      }
    });
    buttonListenerRegistered = true;
  } catch {
    // Silent — listener registration is best-effort
  }
};

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Start the Android Foreground Service with a persistent notification.
 * Must be called BEFORE starting geolocation watch.
 * 
 * Creates:
 * - NotificationChannel (Android 8+)
 * - Foreground Service with startForeground()
 * - Persistent notification with "Parar Rastreamento" action button
 */
export const startForegroundService = async (): Promise<void> => {
  if (!isAndroid() || isServiceRunning) return;

  try {
    // 1. Create notification channel first (required on Android 8+)
    await ensureNotificationChannel();

    // 2. Register button click listener
    await ensureButtonListener();

    // 3. Check notification permission (Android 13+ requires POST_NOTIFICATIONS)
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    
    const permResult = await ForegroundService.checkPermissions();
    if (permResult.display !== 'granted') {
      console.log('[ForegroundService] Solicitando permissão de notificação...');
      const reqResult = await ForegroundService.requestPermissions();
      if (reqResult.display !== 'granted') {
        console.warn('[ForegroundService] ⚠️ Permissão de notificação negada — serviço pode não funcionar');
        // Continue anyway — on Android < 13, this permission doesn't exist
      }
    }

    // 4. Start the foreground service
    await ForegroundService.startForegroundService({
      id: NOTIFICATION_ID,
      title: 'AgriRoute — Rastreamento Ativo',
      body: 'Sua localização está sendo monitorada durante o frete. Toque para abrir o app.',
      smallIcon: 'ic_launcher_foreground', // Uses the app's adaptive icon foreground
      buttons: [
        {
          title: 'Parar Rastreamento',
          id: BUTTON_STOP_ID,
        },
      ],
      silent: true, // Don't play sound on every location update
      notificationChannelId: CHANNEL_ID,
    });

    isServiceRunning = true;
    console.log('[ForegroundService] ✅ Serviço iniciado com notificação persistente');
  } catch (err: any) {
    console.error('[ForegroundService] ❌ Falha ao iniciar:', err?.message || err);
    // Don't throw — tracking can still work in foreground without the service
  }
};

/**
 * Stop the Android Foreground Service and dismiss the persistent notification.
 * Calls stopForeground(true) + stopSelf() internally.
 * Must be called when freight ends (DELIVERED, COMPLETED, CANCELLED).
 */
export const stopForegroundService = async (): Promise<void> => {
  if (!isAndroid() || !isServiceRunning) return;

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.stopForegroundService();
    isServiceRunning = false;
    console.log('[ForegroundService] ✅ Serviço encerrado — notificação removida');
  } catch (err: any) {
    console.error('[ForegroundService] ❌ Falha ao parar:', err?.message || err);
    isServiceRunning = false;
  }
};

/**
 * Update the notification body text (e.g., to show last update time or freight status).
 * Uses updateForegroundService for efficient updates without restarting the service.
 */
export const updateForegroundNotification = async (body: string): Promise<void> => {
  if (!isAndroid() || !isServiceRunning) return;

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.updateForegroundService({
      id: NOTIFICATION_ID,
      title: 'AgriRoute — Rastreamento Ativo',
      body,
      smallIcon: 'ic_launcher_foreground',
      notificationChannelId: CHANNEL_ID,
    });
  } catch {
    // Silent fail — notification update is cosmetic
  }
};

/**
 * Check if the foreground service is currently running.
 */
export const isForegroundServiceRunning = (): boolean => isServiceRunning;
