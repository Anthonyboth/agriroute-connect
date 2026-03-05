/**
 * Foreground Service — Background Location for cargo security
 * 
 * Uses @capawesome-team/capacitor-android-foreground-service v8.0.1
 * 
 * Validated API surface (from plugin type definitions — node_modules/.../definitions.d.ts):
 * - createNotificationChannel({ id, name, description?, importance? }) — since 6.1.0
 * - startForegroundService({ id, title, body, smallIcon, serviceType?, buttons?, silent?, notificationChannelId? }) — since 0.0.1
 * - updateForegroundService(options) — since 6.1.0 (same options as start)
 * - stopForegroundService() — since 0.0.1
 * - checkPermissions() → { display: PermissionState } — since 5.0.0
 * - requestPermissions() → { display: PermissionState } — since 5.0.0
 * - moveToForeground() — since 0.3.0
 * - addListener('buttonClicked', ...) — iOS ONLY (per types: "Only available on iOS")
 * 
 * Rules:
 * - 1 single persistent notification (ID 9001) while tracking is active
 * - Idempotent: won't duplicate if already running
 * - Android 13+: checks POST_NOTIFICATIONS permission before starting
 * - smallIcon must be a real drawable: ic_stat_tracking (android/app/src/main/res/drawable/)
 * - serviceType: 8 (Location) — MUST match AndroidManifest foregroundServiceType="location"
 * - No buttons on Android (buttonClicked listener is iOS-only per plugin types)
 */

import { Capacitor } from '@capacitor/core';

const isAndroidNative = (): boolean => {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
};

const NOTIFICATION_ID = 9001;
const CHANNEL_ID = 'tracking_channel';
const CHANNEL_NAME = 'Rastreio de Localização';
const CHANNEL_DESCRIPTION = 'Notificação de rastreio ativo para segurança da carga';
const SMALL_ICON = 'ic_stat_tracking';
const SERVICE_TYPE_LOCATION = 8; // ServiceType.Location from plugin enum

let isRunning = false;
let lastNotificationUpdate = 0;
const MIN_UPDATE_INTERVAL_MS = 30_000; // max 1 update per 30s

/**
 * Check and request POST_NOTIFICATIONS permission (Android 13+).
 * Returns true if granted or not needed (pre-Android 13).
 */
const ensureNotificationPermission = async (): Promise<boolean> => {
  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    
    const status = await ForegroundService.checkPermissions();
    console.log('[PERM] POST_NOTIFICATIONS check:', status.display);
    
    if (status.display === 'granted') {
      console.log('[PERM] notifications granted');
      return true;
    }
    
    // Request permission (Android 13+ will show system dialog)
    const result = await ForegroundService.requestPermissions();
    console.log('[PERM] POST_NOTIFICATIONS request result:', result.display);
    
    if (result.display === 'granted') {
      console.log('[PERM] notifications granted (after request)');
      return true;
    }
    
    console.warn('[PERM] notifications denied');
    return false;
  } catch (err) {
    // Pre-Android 13 doesn't need this permission — treat as granted
    console.log('[PERM] POST_NOTIFICATIONS not required (pre-Android 13 or error):', err);
    return true;
  }
};

/**
 * Create the low-importance notification channel (silent, no vibration).
 * Importance.Low = 2 (from plugin enum)
 * This is idempotent — Android ignores duplicate channel creation.
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
    console.log('[FGS] Notification channel created/ensured (importance=LOW)');
  } catch (err) {
    console.warn('[FGS] Error creating notification channel:', err);
  }
};

/**
 * Start the Android Foreground Service with a persistent, silent notification.
 * 
 * Returns false if:
 * - Not running on Android native
 * - POST_NOTIFICATIONS permission denied (Android 13+)
 * - Plugin error (logged but not thrown)
 */
export const startForegroundService = async (): Promise<boolean> => {
  if (!isAndroidNative()) {
    console.log('[FGS] Not Android native — skipping FGS (platform:', Capacitor.getPlatform(), ')');
    return true; // return true so tracking still works on web
  }

  if (isRunning) {
    console.log('[FGS] already running (idempotent) — no duplicate notification');
    return true;
  }

  try {
    // 1. Check/request POST_NOTIFICATIONS (Android 13+)
    const notifGranted = await ensureNotificationPermission();
    if (!notifGranted) {
      console.warn('[FGS] start FAILED — POST_NOTIFICATIONS denied');
      return false;
    }

    // 2. Create low-importance channel (idempotent)
    await ensureNotificationChannel();

    // 3. Start foreground service
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    
    console.log('[FGS] calling startForegroundService with:', {
      id: NOTIFICATION_ID,
      smallIcon: SMALL_ICON,
      serviceType: SERVICE_TYPE_LOCATION,
      channelId: CHANNEL_ID,
    });

    await ForegroundService.startForegroundService({
      id: NOTIFICATION_ID,
      title: 'AgriRoute — Rastreio ativo',
      body: 'Segurança da carga',
      smallIcon: SMALL_ICON,
      notificationChannelId: CHANNEL_ID,
      silent: true,
      serviceType: SERVICE_TYPE_LOCATION, // CRITICAL: must match AndroidManifest foregroundServiceType="location"
      // No buttons — buttonClicked listener is iOS-only per plugin types
    });

    isRunning = true;
    lastNotificationUpdate = Date.now();
    console.log('[FGS] started OK — 1 persistent notification active (id:', NOTIFICATION_ID, ')');
    return true;
  } catch (err: any) {
    const msg = typeof err === 'string' ? err : err?.message ?? '';
    // Known issue: APK not rebuilt after manifest changes — warn instead of error
    if (msg.includes('WAKE_LOCK') || msg.includes('Missing') || msg.includes('AndroidManifest')) {
      console.warn('[FGS] ⚠️ APK desatualizado (permissões não sincronizadas). Execute: npm run build && npx cap sync android && cd android && ./gradlew clean');
    } else {
      console.warn('[FGS] start failed:', msg);
    }
    // Don't throw — tracking can still work in foreground without FGS
    return false;
  }
};

/**
 * Stop the Foreground Service and remove the notification.
 */
export const stopForegroundService = async (): Promise<void> => {
  if (!isAndroidNative()) {
    console.log('[FGS] Not Android native — nothing to stop');
    return;
  }
  
  if (!isRunning) {
    console.log('[FGS] not running — nothing to stop');
    return;
  }

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.stopForegroundService();
    console.log('[FGS] stopped OK — notification removed');
  } catch (err) {
    console.warn('[FGS] stop error:', err);
  } finally {
    isRunning = false;
  }
};

/**
 * Update the notification body text (throttled to max 1 update per 30s).
 * Uses updateForegroundService (available since v6.1.0).
 */
export const updateForegroundNotification = async (body: string): Promise<void> => {
  if (!isAndroidNative() || !isRunning) return;

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
      serviceType: SERVICE_TYPE_LOCATION,
    });
    lastNotificationUpdate = now;
    console.log('[FGS] update OK:', body);
  } catch (err) {
    console.warn('[FGS] update error:', err);
  }
};

/**
 * Check if the foreground service is currently running.
 */
export const isForegroundServiceRunning = (): boolean => isRunning;
