/**
 * Foreground Service — DESABILITADO (Play Store Compliance)
 * 
 * Esta versão do app NÃO usa localização em segundo plano.
 * Todas as funções são no-ops para compatibilidade com Google Play.
 * O rastreamento funciona apenas com o app em primeiro plano.
 * 
 * Para reabilitar background tracking, restaure a versão anterior
 * deste arquivo e adicione as permissões no AndroidManifest.xml.
 */

import { Capacitor } from '@capacitor/core';

const isAndroidPlatform = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

/**
 * No-op: Foreground Service desabilitado nesta versão.
 */
export const startForegroundService = async (): Promise<void> => {
  if (isAndroidPlatform()) {
    console.log('[ForegroundService] ⚠️ Desabilitado nesta versão (sem background location)');
  }
};

/**
 * No-op: Foreground Service desabilitado nesta versão.
 */
export const stopForegroundService = async (): Promise<void> => {
  // no-op
};

/**
 * No-op: Foreground Service desabilitado nesta versão.
 */
export const updateForegroundNotification = async (_body: string): Promise<void> => {
  // no-op
};

/**
 * No-op: Foreground Service desabilitado nesta versão.
 */
export const setStopTrackingCallback = (_cb: () => void): void => {
  // no-op
};

/**
 * Check if the foreground service is currently running.
 * Always returns false in this build.
 */
export const isForegroundServiceRunning = (): boolean => false;
