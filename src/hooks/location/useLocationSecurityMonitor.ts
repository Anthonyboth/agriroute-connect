/**
 * useLocationSecurityMonitor (v2 — Arquitetura Robusta)
 *
 * Hook principal de captura e monitoramento de localização.
 *
 * GARANTIAS:
 *   ✅ Só exibe "GPS DESLIGADO" em casos comprovados (permissão = denied)
 *   ✅ Timeout (código 3) é silencioso
 *   ✅ Posição indisponível (código 2) não gera alerta crítico
 *   ✅ Funciona em Android Chrome, WebView e Capacitor nativo
 *   ✅ Expõe start/stop, status, coords e debug info
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { locationAlertManager } from '@/services/location/locationAlertManager';

// ── Tipos ──────────────────────────────────────────────────────────────────

export type LocationStatus =
  | 'IDLE'
  | 'OK'
  | 'NO_PERMISSION'
  | 'GPS_OFF'
  | 'LOW_ACCURACY'
  | 'TIMEOUT'
  | 'UNAVAILABLE'
  | 'BACKGROUND_RESTRICTED';

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface LocationCoords {
  lat: number;
  lng: number;
  accuracy: number;
  heading: number | null;
  speed: number | null;
  timestamp: number;
}

export interface LocationDebugInfo {
  platform: string;
  isCapacitor: boolean;
  isAndroid: boolean;
  lastErrorCode: number | null;
  lastErrorMessage: string | null;
  watchActive: boolean;
  consecutiveErrors: number;
}

export interface LocationSecurityMonitorResult {
  status: LocationStatus;
  coords: LocationCoords | null;
  permission: PermissionState;
  lastFixAt: string | null;
  start: () => void;
  stop: () => void;
  requestPermission: () => Promise<void>;
  debug: LocationDebugInfo;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const isCapacitorEnv = () => Capacitor.isNativePlatform();
const isAndroidEnv = () => isCapacitorEnv() && Capacitor.getPlatform() === 'android';

/**
 * Verifica permissão real, sem lançar exceção.
 */
const checkRealPermission = async (): Promise<PermissionState> => {
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

  if (navigator?.permissions?.query) {
    try {
      const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
      return result.state as PermissionState;
    } catch { /* sem suporte */ }
  }

  if (!('geolocation' in navigator)) return 'denied';
  return 'unknown';
};

/**
 * Interpreta código de erro da Geolocation API.
 * NUNCA converte timeout em "GPS desligado".
 */
export const interpretGPSErrorCode = (code: number): {
  isDefinitelyOff: boolean;
  status: LocationStatus;
  action: 'show_permission_button' | 'retry_silent' | 'retry_with_message';
} => {
  switch (code) {
    case 1:
      return { isDefinitelyOff: true, status: 'NO_PERMISSION', action: 'show_permission_button' };
    case 2:
      return { isDefinitelyOff: false, status: 'UNAVAILABLE', action: 'retry_silent' };
    case 3:
      return { isDefinitelyOff: false, status: 'TIMEOUT', action: 'retry_silent' };
    default:
      return { isDefinitelyOff: false, status: 'UNAVAILABLE', action: 'retry_with_message' };
  }
};

// ── Hook ───────────────────────────────────────────────────────────────────

export const useLocationSecurityMonitor = (): LocationSecurityMonitorResult => {
  const [status, setStatus] = useState<LocationStatus>('IDLE');
  const [coords, setCoords] = useState<LocationCoords | null>(null);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [lastFixAt, setLastFixAt] = useState<string | null>(null);

  const watchHandleRef = useRef<{ clear: () => void } | null>(null);
  const activeRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const lastErrorCodeRef = useRef<number | null>(null);
  const lastErrorMessageRef = useRef<string | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleSuccess = useCallback((rawCoords: GeolocationCoordinates | {
    latitude: number; longitude: number; accuracy: number;
    heading?: number | null; speed?: number | null;
  }) => {
    const newCoords: LocationCoords = {
      lat: rawCoords.latitude,
      lng: rawCoords.longitude,
      accuracy: rawCoords.accuracy,
      heading: rawCoords.heading ?? null,
      speed: rawCoords.speed ?? null,
      timestamp: Date.now(),
    };

    consecutiveErrorsRef.current = 0;
    lastErrorCodeRef.current = null;

    // LOW_ACCURACY é aviso leve — não bloqueia
    if (rawCoords.accuracy > 150) {
      setStatus('LOW_ACCURACY');
      locationAlertManager.show('LOW_ACCURACY');
    } else {
      // Se estava em estado ruim antes → notificar restauração
      if (status === 'GPS_OFF' || status === 'NO_PERMISSION' || status === 'UNAVAILABLE') {
        locationAlertManager.show('RESTORED');
      }
      setStatus('OK');
    }

    setCoords(newCoords);
    setLastFixAt(new Date().toISOString());
    setPermission('granted');
  }, [status]);

  const handleError = useCallback(async (err: { code: number; message: string } | GeolocationPositionError) => {
    if (!activeRef.current) return;

    const { isDefinitelyOff, status: errStatus, action } = interpretGPSErrorCode(err.code);

    lastErrorCodeRef.current = err.code;
    lastErrorMessageRef.current = err.message;
    consecutiveErrorsRef.current += 1;

    // TIMEOUT → completamente silencioso
    if (action === 'retry_silent' && err.code === 3) {
      setStatus('TIMEOUT');
      return;
    }

    // POSIÇÃO INDISPONÍVEL (código 2) → silencioso, sem alerta crítico
    if (err.code === 2) {
      setStatus('UNAVAILABLE');
      // Só avisa se muitas falhas consecutivas (> 5)
      if (consecutiveErrorsRef.current > 5) {
        locationAlertManager.show('UNAVAILABLE');
      }
      return;
    }

    // PERMISSÃO NEGADA (código 1) → crítico
    if (isDefinitelyOff) {
      // Confirmar com Permissions API antes de acusar definitivamente
      const realPerm = await checkRealPermission();
      setPermission(realPerm);

      if (realPerm === 'denied') {
        setStatus('NO_PERMISSION');
        locationAlertManager.show('NO_PERMISSION');
      } else if (realPerm === 'granted') {
        // Falso positivo — dispositivo reportou denied mas Permissions API diz granted
        // Tratar como UNAVAILABLE temporário
        setStatus('UNAVAILABLE');
        console.warn('[GPS] Código 1 mas permissão real = granted — possível falso negativo nativo');
      } else {
        setStatus(errStatus);
      }
      return;
    }

    setStatus(errStatus);
  }, []);

  // ── Start / Stop ──────────────────────────────────────────────────────────

  const start = useCallback(() => {
    if (watchHandleRef.current) return; // já ativo
    if (!isCapacitorEnv() && !('geolocation' in navigator)) {
      setStatus('NO_PERMISSION');
      setPermission('denied');
      return;
    }

    activeRef.current = true;
    consecutiveErrorsRef.current = 0;

    if (isCapacitorEnv()) {
      let watchId: string;
      Geolocation.watchPosition(
        { enableHighAccuracy: true },
        (pos, err) => {
          if (!activeRef.current) return;
          if (err) {
            const errCode = (err as any)?.code ?? 2;
            handleError({ code: errCode, message: String((err as any)?.message ?? err) });
            return;
          }
          if (pos) handleSuccess(pos.coords);
        }
      ).then((id) => {
        watchId = id as unknown as string;
        watchHandleRef.current = {
          clear: () => {
            if (watchId) Geolocation.clearWatch({ id: watchId });
            watchHandleRef.current = null;
          },
        };
      }).catch((err) => {
        console.warn('[GPS-Monitor] Erro ao iniciar watchPosition nativo:', err);
        handleError({ code: 1, message: String(err?.message ?? err) });
      });
    } else {
      const id = navigator.geolocation.watchPosition(
        (pos) => { if (activeRef.current) handleSuccess(pos.coords); },
        (err) => { if (activeRef.current) handleError(err); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
      watchHandleRef.current = {
        clear: () => {
          navigator.geolocation.clearWatch(id);
          watchHandleRef.current = null;
        },
      };
    }

    setStatus('IDLE'); // aguardando primeiro fix
  }, [handleSuccess, handleError]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (watchHandleRef.current) {
      watchHandleRef.current.clear();
      watchHandleRef.current = null;
    }
    setStatus('IDLE');
    locationAlertManager.reset();
  }, []);

  // ── requestPermission ─────────────────────────────────────────────────────

  const requestPermission = useCallback(async () => {
    if (isCapacitorEnv()) {
      try {
        const perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
        const granted = perm.location === 'granted' || perm.coarseLocation === 'granted';
        setPermission(granted ? 'granted' : 'denied');
        if (granted) start();
      } catch (err) {
        console.warn('[GPS-Monitor] Erro ao solicitar permissão nativa:', err);
        setPermission('denied');
      }
    } else {
      if (!('geolocation' in navigator)) return;
      navigator.geolocation.getCurrentPosition(
        () => { setPermission('granted'); start(); },
        () => setPermission('denied'),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [start]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (watchHandleRef.current) {
        watchHandleRef.current.clear();
        watchHandleRef.current = null;
      }
    };
  }, []);

  // ── Verificação inicial de permissão (silenciosa) ─────────────────────────

  useEffect(() => {
    checkRealPermission().then(setPermission);
  }, []);

  return {
    status,
    coords,
    permission,
    lastFixAt,
    start,
    stop,
    requestPermission,
    debug: {
      platform: Capacitor.getPlatform(),
      isCapacitor: isCapacitorEnv(),
      isAndroid: isAndroidEnv(),
      lastErrorCode: lastErrorCodeRef.current,
      lastErrorMessage: lastErrorMessageRef.current,
      watchActive: !!watchHandleRef.current,
      consecutiveErrors: consecutiveErrorsRef.current,
    },
  };
};
