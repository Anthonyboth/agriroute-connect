/**
 * Foreground Service Manager
 * 
 * Wraps @capawesome-team/capacitor-android-foreground-service to provide
 * a persistent notification + foreground service on Android.
 * 
 * This is REQUIRED by Google Play for apps using ACCESS_BACKGROUND_LOCATION.
 * Without a real Foreground Service, Android 8+ kills the app's GPS when backgrounded.
 * 
 * On iOS and Web, this is a no-op (iOS handles background location via CLLocationManager).
 */

import { Capacitor } from '@capacitor/core';

let isServiceRunning = false;

const isAndroid = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/**
 * Start the Android Foreground Service with a persistent notification.
 * Must be called BEFORE starting geolocation watch for background tracking to work.
 */
export const startForegroundService = async (): Promise<void> => {
  if (!isAndroid() || isServiceRunning) return;

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');

    await ForegroundService.startForegroundService({
      id: 1001,
      title: 'AgriRoute - Rastreamento Ativo',
      body: 'Sua localização está sendo monitorada durante o frete.',
      smallIcon: 'ic_stat_navigation',
      // Android notification channel
      buttons: [
        {
          title: 'Abrir App',
          id: 1,
        },
      ],
    });

    isServiceRunning = true;
    console.log('[ForegroundService] ✅ Serviço iniciado com notificação persistente');
  } catch (err: any) {
    console.error('[ForegroundService] ❌ Falha ao iniciar:', err?.message || err);
    // Don't throw — tracking can still work in foreground without the service
  }
};

/**
 * Stop the Android Foreground Service and dismiss the notification.
 * Must be called when tracking stops (freight completed/cancelled).
 */
export const stopForegroundService = async (): Promise<void> => {
  if (!isAndroid() || !isServiceRunning) return;

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.stopForegroundService();
    isServiceRunning = false;
    console.log('[ForegroundService] ✅ Serviço encerrado');
  } catch (err: any) {
    console.error('[ForegroundService] ❌ Falha ao parar:', err?.message || err);
    isServiceRunning = false;
  }
};

/**
 * Update the notification body text (e.g., to show last update time).
 */
export const updateForegroundNotification = async (body: string): Promise<void> => {
  if (!isAndroid() || !isServiceRunning) return;

  try {
    const { ForegroundService } = await import('@capawesome-team/capacitor-android-foreground-service');
    await ForegroundService.startForegroundService({
      id: 1001,
      title: 'AgriRoute - Rastreamento Ativo',
      body,
      smallIcon: 'ic_stat_navigation',
    });
  } catch {
    // Silent fail — notification update is cosmetic
  }
};

/**
 * Check if the foreground service is currently running.
 */
export const isForegroundServiceRunning = (): boolean => isServiceRunning;
