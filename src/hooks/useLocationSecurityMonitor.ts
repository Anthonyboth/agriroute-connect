/**
 * useLocationSecurityMonitor
 * 
 * Hook de diagnóstico real de geolocalização para Android/Web.
 * Valida separadamente: permissão do navegador, status do GPS, accuracy, timeout.
 * 
 * REGRA CRÍTICA: Só acusa "GPS DESLIGADO" se:
 *   - permission === 'denied'
 *   - OU geolocation não disponível no browser
 *   NUNCA com base em timeout ou erro de posição indisponível.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface LocationDiagnostics {
  permissionStatus: PermissionState;
  isGeolocationAvailable: boolean;
  isCapacitor: boolean;
  lastAccuracy: number | null;
  lastTimestamp: number | null;
  batteryOptimizationHint: boolean;
  lastErrorCode: number | null;
  lastErrorMessage: string | null;
  isGPSDefinitelyOff: boolean; // só true em casos reais — nunca por timeout
}

const isCapacitorEnv = () => Capacitor.isNativePlatform();

/**
 * Verifica permissão real do navegador (Web) ou plugin nativo (Capacitor).
 * Nunca lança exceção — retorna 'unknown' em caso de falha.
 */
const checkRealPermission = async (): Promise<PermissionState> => {
  // Capacitor nativo
  if (isCapacitorEnv()) {
    try {
      const perm = await Geolocation.checkPermissions();
      if (perm.location === 'granted' || perm.coarseLocation === 'granted') return 'granted';
      if (perm.location === 'denied' || perm.coarseLocation === 'denied') return 'denied';
      return 'prompt';
    } catch {
      return 'unknown';
    }
  }

  // Web — Permissions API
  if (navigator?.permissions?.query) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state as PermissionState;
    } catch {
      // Fallback — navegador não suporta permissions query
    }
  }

  // Último recurso: verificar se API está disponível
  if (!('geolocation' in navigator)) return 'denied';
  return 'unknown';
};

/**
 * Interpreta código de erro da Geolocation API de forma correta.
 * 
 * Código 1 → Permissão negada → GPS definitivamente bloqueado
 * Código 2 → Posição indisponível → tentar novamente, NÃO acusar GPS desligado
 * Código 3 → Timeout → repetir silenciosamente, NÃO acusar GPS desligado
 */
export const interpretGPSErrorCode = (code: number): {
  isDefinitelyOff: boolean;
  userMessage: string;
  action: 'show_permission_button' | 'retry_silent' | 'retry_with_message';
} => {
  switch (code) {
    case 1:
      return {
        isDefinitelyOff: true,
        userMessage: 'Permissão de localização negada. Ative nas configurações do dispositivo.',
        action: 'show_permission_button'
      };
    case 2:
      return {
        isDefinitelyOff: false,
        userMessage: 'Posição temporariamente indisponível. Tentando novamente...',
        action: 'retry_silent'
      };
    case 3:
      return {
        isDefinitelyOff: false,
        userMessage: 'GPS demorando para responder. Aguardando...',
        action: 'retry_silent'
      };
    default:
      return {
        isDefinitelyOff: false,
        userMessage: 'Erro ao obter localização. Tentando novamente.',
        action: 'retry_with_message'
      };
  }
};

export const useLocationSecurityMonitor = () => {
  const [diagnostics, setDiagnostics] = useState<LocationDiagnostics>({
    permissionStatus: 'unknown',
    isGeolocationAvailable: 'geolocation' in navigator,
    isCapacitor: isCapacitorEnv(),
    lastAccuracy: null,
    lastTimestamp: null,
    batteryOptimizationHint: false,
    lastErrorCode: null,
    lastErrorMessage: null,
    isGPSDefinitelyOff: false,
  });

  const runDiagnostics = useCallback(async () => {
    const permission = await checkRealPermission();
    const isGeolocationAvailable = isCapacitorEnv() ? true : 'geolocation' in navigator;

    // GPS definitivamente desligado APENAS se permissão negada OU API indisponível
    const isGPSDefinitelyOff = permission === 'denied' || !isGeolocationAvailable;

    setDiagnostics(prev => ({
      ...prev,
      permissionStatus: permission,
      isGeolocationAvailable,
      isCapacitor: isCapacitorEnv(),
      isGPSDefinitelyOff,
    }));

    return { permission, isGeolocationAvailable, isGPSDefinitelyOff };
  }, []);

  const reportPositionSuccess = useCallback((accuracy: number) => {
    setDiagnostics(prev => ({
      ...prev,
      lastAccuracy: accuracy,
      lastTimestamp: Date.now(),
      lastErrorCode: null,
      lastErrorMessage: null,
      isGPSDefinitelyOff: false,
      // Accuracy > 500m pode indicar modo economia de bateria
      batteryOptimizationHint: accuracy > 500,
    }));
  }, []);

  const reportPositionError = useCallback((code: number, message: string) => {
    const { isDefinitelyOff } = interpretGPSErrorCode(code);
    setDiagnostics(prev => ({
      ...prev,
      lastErrorCode: code,
      lastErrorMessage: message,
      // Só marcar como definitivamente desligado se código 1 (permissão negada)
      isGPSDefinitelyOff: isDefinitelyOff ? true : prev.isGPSDefinitelyOff,
    }));
  }, []);

  useEffect(() => {
    runDiagnostics();
  }, [runDiagnostics]);

  return {
    diagnostics,
    runDiagnostics,
    reportPositionSuccess,
    reportPositionError,
    interpretGPSErrorCode,
  };
};
