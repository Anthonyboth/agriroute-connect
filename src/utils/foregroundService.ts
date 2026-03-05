/**
 * Foreground Service — Background Location for cargo security
 * 
 * Uses @capawesome-team/capacitor-android-foreground-service v8.x
 * 
 * Validated API surface (from plugin type definitions):
 * - createNotificationChannel({ id, name, description?, importance? }) — since 6.1.0
 * - startForegroundService({ id, title, body, smallIcon, buttons?, silent?, notificationChannelId? }) — since 0.0.1
 * - updateForegroundService(options) — since 6.1.0
 * - stopForegroundService() — since 0.0.1
 * - checkPermissions() → { display: PermissionState } — since 5.0.0
 * - requestPermissions() → { display: PermissionState } — since 5.0.0
 * - moveToForeground() — since 0.3.0
 * - addListener('buttonClicked', ...) — iOS ONLY per types (buttons render on Android but listener is iOS-only)
 * 
 * Rules:
 * - 1 single persistent notification while tracking is active
 * - Idempotent: won't duplicate if already running
 * - Android 13+: checks POST_NOTIFICATIONS permission before starting
 * - smallIcon must be a real drawable: ic_stat_tracking
 */

import { Capacitor } from '@capacitor/core';

const isAndroidPlatform = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

const NOTIFICATION_ID = 9001;
const CHANNEL_ID = 'tracking_channel';
const CHANNEL_NAME = 'Rastreio de Localização';
const CHANNEL_DESCRIPTION = 'Notificação de rastreio ativo para segurança da carga';
const SMALL_ICON = 'ic_stat_tracking';

let isRunning = false;
let lastNotificationUpdate = 0;
const MIN_UPDATE_INTERVAL_MS = 30_000;

/**
 * Check and request POST_NOTIFICATIONS permission (Android 13+).
 * Returns true if granted or not needed (pre-Android 13).
 */
const ensureNotificationPermission = async (): Promise<boolean> => {
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    const status = await ForegroundService.checkPermissions();
    console.log('[FGS] POST_NOTIFICATIONS check:', status.display);
    
    if (status.display === 'granted') return true;
    
    // Request permission (Android 13+ will show system dialog)
    const result = await ForegroundService.requestPermissions();
    console.log('[FGS] POST_NOTIFICATIONS request result:', result.display);
    return result.display === 'granted';
  } catch (err) {
    // Pre-Android 13 doesn't need this permission — treat as granted
    console.log('[FGS] POST_NOTIFICATIONS check not needed (pre-Android 13):', err);
    return true;
  }
};

/**
 * Create the low-importance notification channel (silent, no vibration).
 * Importance.Low = 2
 */
const ensureNotificationChannel = async (): Promise<void> => {
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.createNotificationChannel({
      id: CHANNEL_ID,
      name: CHANNEL_NAME,
      description: CHANNEL_DESCRIPTION,
      importance: 2, // Importance.Low — no sound, no vibration
    });
    console.log('[FGS] Notification channel created/ensured');
  } catch (err) {
    console.warn('[FGS] Error creating notification channel:', err);
  }
};

/**
 * Start the Android Foreground Service with a persistent, silent notification.
 * 
 * Returns false if notification permission was denied (Android 13+).
 */
export const startForegroundService = async (): Promise<boolean> => {
  if (!isAndroidPlatform()) {
    console.log('[FGS] Not Android — skipping');
    return true;
  }
  if (isRunning) {
    console.log('[FGS] FGS_ALREADY_RUNNING — idempotent, no duplicate notification');
    return true;
  }

  try {
    // 1. Check/request POST_NOTIFICATIONS (Android 13+)
    const notifGranted = await ensureNotificationPermission();
    if (!notifGranted) {
      console.warn('[FGS] POST_NOTIFICATIONS denied — cannot start FGS');
      return false;
    }

    // 2. Create low-importance channel
    await ensureNotificationChannel();

    // 3. Start foreground service
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.startForegroundService({
      id: NOTIFICATION_ID,
      title: 'AgriRoute — Rastreio ativo',
      body: 'Segurança da carga',
      smallIcon: SMALL_ICON,
      notificationChannelId: CHANNEL_ID,
      silent: true,
      // Note: buttons render on Android but buttonClicked listener is iOS-only per plugin types.
      // We still add them for visual UX — tapping the notification itself opens the app.
      buttons: [
        { title: 'Abrir app', id: 1 },
        { title: 'Parar rastreio', id: 2 },
      ],
    });

    isRunning = true;
    lastNotificationUpdate = Date.now();
    console.log('[FGS] FGS_START_OK — 1 persistent notification active');
    return true;
  } catch (err) {
    console.error('[FGS] ❌ Error starting FGS:', err);
    // Don't throw — tracking can still work in foreground without FGS
    return false;
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
    console.log('[FGS] FGS_STOP_OK — notification removed');
  } catch (err) {
    console.warn('[FGS] Error stopping FGS:', err);
  } finally {
    isRunning = false;
  }
};

/**
 * Update the notification body text (throttled to max 1 update per 30s).
 */
export const updateForegroundNotification = async (body: string): Promise<void> => {
  if (!isAndroidPlatform() || !isRunning) return;

  const now = Date.now();
  if (now - lastNotificationUpdate < MIN_UPDATE_INTERVAL_MS) return;

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.updateForegroundService({
      id: NOTIFICATION_ID,
      title: 'AgriRoute — Rastreio ativo',
      body,
      smallIcon: SMALL_ICON,
      notificationChannelId: CHANNEL_ID,
      silent: true,
      buttons: [
        { title: 'Abrir app', id: 1 },
        { title: 'Parar rastreio', id: 2 },
      ],
    });
    lastNotificationUpdate = now;
    console.log('[FGS] Notification updated:', body);
  } catch (err) {
    console.warn('[FGS] Error updating notification:', err);
  }
};

/**
 * Check if the foreground service is currently running.
 */
export const isForegroundServiceRunning = (): boolean => isRunning;
