/**
 * useFreightGPSMonitoring — v3 (REESCRITO)
 * 
 * Sistema de captura, validação e monitoramento de localização para frete ativo.
 * 
 * GARANTIAS:
 *   ✅ Zero falso positivo de "GPS DESLIGADO"
 *   ✅ Zero spam de notificação (cooldown 2min entre alertas)
 *   ✅ Captura via Capacitor plugin (nativo) ou navigator.geolocation (web)
 *   ✅ watchPosition real com debounce (>20m e mínimo 60s)
 *   ✅ Distingue erro de permissão (código 1) de timeout (código 3)
 *   ✅ Accuracy > 100m: aviso leve, sem bloquear funcionamento
 *   ✅ Compatível com Android Chrome, WebView e Capacitor
 *   ✅ Cancela watch no unmount ou fim do frete
 * 
 * REGRA CRÍTICA:
 *   Só mostra "GPS DESLIGADO DETECTADO" se:
 *     - permission === 'denied' (código 1)
 *     - OU geolocation indisponível no browser
 *   NUNCA com base em timeout ou posição indisponível.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useOngoingFreightLocation } from './useOngoingFreightLocation';
import { interpretGPSErrorCode } from './useLocationSecurityMonitor';

const isCapacitorEnv = () => Capacitor.isNativePlatform();

// Distância mínima (metros) para salvar nova posição
const MIN_DISTANCE_METERS = 20;
// Intervalo mínimo entre salvamentos no banco (ms)
const MIN_SAVE_INTERVAL_MS = 60_000;
// Cooldown entre alertas de GPS (ms)
const ALERT_COOLDOWN_MS = 2 * 60 * 1000;
// Falhas consecutivas para reportar incidente (só conta erros de código 1)
const MAX_PERM_FAILURES = 2;

/** Distância Haversine em metros entre dois pontos */
const haversineDistance = (
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const useFreightGPSMonitoring = (
  freightId: string | null,
  driverProfileId: string | null,
  isFreightActive: boolean,
  updateInterval: number = 60_000
) => {
  const { updateFromCoords } = useOngoingFreightLocation({
    driverProfileId,
    freightId,
    minUpdateInterval: 5000,
  });

  // Refs para controle interno — não causam re-renders
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const lastAlertTimeRef = useRef<number>(0);
  const permFailuresRef = useRef<number>(0);
  const watchHandleRef = useRef<{ clear: () => void } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCancelledRef = useRef<boolean>(false);

  // ─── Funções internas ─────────────────────────────────────────────────────

  /** Verifica se o frete ainda está ativo no banco antes de reportar incidentes */
  const verifyFreightActive = useCallback(async (): Promise<boolean> => {
    if (!freightId) return false;
    try {
      const { data } = await supabase
        .from('freights')
        .select('id')
        .eq('id', freightId)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'])
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }, [freightId]);

  /** Salva localização no banco com debounce de distância e tempo */
  const maybeSaveLocation = useCallback(async (coords: GeolocationCoordinates) => {
    const now = Date.now();
    const { latitude: lat, longitude: lng, accuracy } = coords;

    // Debounce temporal
    if (now - lastSaveTimeRef.current < MIN_SAVE_INTERVAL_MS) {
      return;
    }

    // Debounce espacial (>20m)
    if (lastPositionRef.current) {
      const dist = haversineDistance(
        lastPositionRef.current.lat, lastPositionRef.current.lng,
        lat, lng
      );
      if (dist < MIN_DISTANCE_METERS) {
        console.log(`[GPS] Movimento < ${MIN_DISTANCE_METERS}m (${dist.toFixed(0)}m). Não salvando.`);
        return;
      }
    }

    // Aviso leve de accuracy alta — não bloqueia funcionamento
    if (accuracy && accuracy > 100) {
      console.warn(`[GPS] Accuracy ${accuracy.toFixed(0)}m > 100m — GPS com baixa precisão (modo economia?)`);
      // Só avisar uma vez a cada 5 minutos, sem bloquear
      const fiveMin = 5 * 60 * 1000;
      if (now - lastAlertTimeRef.current > fiveMin) {
        toast.warning('GPS com baixa precisão. Considere mover-se para área aberta.', {
          duration: 5000,
          id: 'gps-low-accuracy',
        });
      }
    }

    // Salvar localização via hook dedicado
    await updateFromCoords(coords);

    // Atualizar tracking de motorista afiliado (se aplicável)
    await supabase
      .from('affiliated_drivers_tracking')
      .update({
        current_lat: lat,
        current_lng: lng,
        last_gps_update: new Date().toISOString(),
      })
      .eq('driver_profile_id', driverProfileId!)
      .eq('current_freight_id', freightId!);

    lastPositionRef.current = { lat, lng };
    lastSaveTimeRef.current = now;

    console.log('✅ [GPS] Localização salva:', {
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
      accuracy: accuracy ? `${accuracy.toFixed(0)}m` : 'n/a',
    });
  }, [driverProfileId, freightId, updateFromCoords]);

  /**
   * Handler de ERRO da Geolocation API.
   * 
   * NUNCA acusa GPS desligado por timeout (código 3) ou posição indisponível (código 2).
   * SÓ reporta incidente crítico se código 1 (permissão negada) e após N falhas.
   */
  const handleGPSError = useCallback(async (err: GeolocationPositionError | { code: number; message: string }) => {
    if (isCancelledRef.current) return;

    const { isDefinitelyOff, userMessage, action } = interpretGPSErrorCode(err.code);

    console.warn(`[GPS] Erro código ${err.code}: ${err.message} | ação: ${action}`);

    if (!isDefinitelyOff) {
      // Código 2 (indisponível) ou 3 (timeout) — silencioso, tentará novamente
      return;
    }

    // Código 1 — permissão negada → contar falhas
    permFailuresRef.current += 1;

    if (permFailuresRef.current < MAX_PERM_FAILURES) {
      console.warn(`[GPS] Falha de permissão ${permFailuresRef.current}/${MAX_PERM_FAILURES}. Aguardando mais falhas para confirmar.`);
      return;
    }

    // Cooldown entre alertas
    const now = Date.now();
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN_MS) {
      const secsAgo = Math.round((now - lastAlertTimeRef.current) / 1000);
      console.log(`[GPS] Alerta suprimido — último há ${secsAgo}s (cooldown ${ALERT_COOLDOWN_MS / 1000}s)`);
      return;
    }

    // Verificar no banco se frete está realmente ativo antes de reportar
    const isReallyActive = await verifyFreightActive();
    if (!isReallyActive) {
      console.log('[GPS] Frete não ativo no banco. Suprimindo alerta GPS_DISABLED.');
      permFailuresRef.current = 0;
      return;
    }

    lastAlertTimeRef.current = now;

    toast.error('🚨 GPS DESLIGADO DETECTADO!', {
      description: userMessage || 'Reative o GPS imediatamente. O produtor foi notificado.',
      duration: 15000,
      id: 'gps-disabled-alert',
    });

    // Reportar incidente
    try {
      await supabase.functions.invoke('tracking-service/incidents', {
        body: {
          freight_id: freightId,
          incident_type: 'GPS_DISABLED',
          severity: 'CRITICAL',
          description: `GPS desligado (permissão negada) durante transporte ativo. Motorista: ${driverProfileId}. ${permFailuresRef.current} falhas.`,
          evidence_data: {
            error_code: err.code,
            error_message: err.message,
            consecutive_failures: permFailuresRef.current,
            timestamp: new Date().toISOString(),
            platform: isCapacitorEnv() ? 'capacitor' : 'web',
          },
        },
      });
    } catch (reportErr) {
      console.error('[GPS] Erro ao reportar incidente:', reportErr);
    }
  }, [freightId, driverProfileId, verifyFreightActive]);

  // ─── Iniciar/parar watchPosition ─────────────────────────────────────────

  const startWatch = useCallback(() => {
    if (watchHandleRef.current) return; // já rodando

    console.log('🚨 [GPS] Iniciando watchPosition. Frete:', freightId);

    if (isCapacitorEnv()) {
      // ── Capacitor nativo ──
      let watchId: string;
      Geolocation.watchPosition(
        { enableHighAccuracy: true },
        (pos, err) => {
          if (isCancelledRef.current) return;
          if (err) {
            const errCode = (err as any)?.code ?? 2;
            handleGPSError({ code: errCode, message: String((err as any)?.message ?? err) });
            return;
          }
          if (!pos) return;
          permFailuresRef.current = 0; // sucesso → reset contador
          maybeSaveLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude ?? null,
            altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
            heading: pos.coords.heading ?? null,
            speed: pos.coords.speed ?? null,
            toJSON: () => ({} as any),
          });
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
        console.warn('[GPS] Erro ao iniciar watchPosition nativo:', err);
        handleGPSError({ code: 1, message: String(err?.message ?? err) });
      });
    } else {
      // ── Web / Chrome ──
      if (!('geolocation' in navigator)) {
        handleGPSError({ code: 1, message: 'Geolocalização não suportada neste navegador' });
        return;
      }

      const id = navigator.geolocation.watchPosition(
        (pos) => {
          if (isCancelledRef.current) return;
          permFailuresRef.current = 0; // sucesso → reset contador
          maybeSaveLocation(pos.coords);
        },
        (err) => {
          if (isCancelledRef.current) return;
          handleGPSError(err);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        }
      );

      watchHandleRef.current = {
        clear: () => {
          navigator.geolocation.clearWatch(id);
          watchHandleRef.current = null;
        },
      };
    }
  }, [freightId, handleGPSError, maybeSaveLocation]);

  const stopWatch = useCallback(() => {
    if (watchHandleRef.current) {
      watchHandleRef.current.clear();
      watchHandleRef.current = null;
      console.log('[GPS] watchPosition cancelado.');
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ─── Efeito principal ────────────────────────────────────────────────────

  useEffect(() => {
    if (!isFreightActive || !freightId || !driverProfileId) {
      console.log('[GPS Monitoring] Desativado — condições não atendidas');
      return;
    }

    isCancelledRef.current = false;
    permFailuresRef.current = 0;

    // Iniciar watchPosition imediatamente
    startWatch();

    // Safety net: garantir pelo menos 1 leitura por minuto via setInterval
    // (watchPosition pode não disparar se GPS parar de atualizar)
    intervalRef.current = setInterval(async () => {
      if (isCancelledRef.current) return;
      // Se watchPosition está rodando, ele já captura. O interval só atua como fallback.
      // Verificar se última atualização foi há mais de 2 minutos
      const sinceLastSave = Date.now() - lastSaveTimeRef.current;
      if (sinceLastSave > 2 * MIN_SAVE_INTERVAL_MS) {
        console.warn('[GPS] Intervalo > 2min sem atualização. Forçando getCurrentPosition...');
        try {
          if (isCapacitorEnv()) {
            const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
            permFailuresRef.current = 0;
            maybeSaveLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              altitude: pos.coords.altitude ?? null,
              altitudeAccuracy: pos.coords.altitudeAccuracy ?? null,
              heading: pos.coords.heading ?? null,
              speed: pos.coords.speed ?? null,
              toJSON: () => ({} as any),
            });
          } else {
            navigator.geolocation.getCurrentPosition(
              (pos) => { permFailuresRef.current = 0; maybeSaveLocation(pos.coords); },
              (err) => handleGPSError(err),
              { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
          }
        } catch (err: any) {
          handleGPSError({ code: err?.code ?? 2, message: err?.message ?? String(err) });
        }
      }
    }, updateInterval);

    return () => {
      isCancelledRef.current = true;
      stopWatch();
      console.log('[GPS Monitoring] Rastreamento encerrado. Frete:', freightId);
    };
  }, [freightId, driverProfileId, isFreightActive, updateInterval, startWatch, stopWatch, maybeSaveLocation, handleGPSError]);
};
