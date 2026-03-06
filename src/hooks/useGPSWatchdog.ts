import { useEffect, useRef, useCallback, useState } from 'react';
import { checkPermissionSafe, getCurrentPositionSafe, isNative } from '@/utils/location';
import { supabase } from '@/integrations/supabase/client';
import { sendNotification } from '@/utils/notify';
import { toast } from 'sonner';

interface UseGPSWatchdogOptions {
  /** Profile ID of the driver */
  profileId: string | undefined;
  /** Active freight ID (only monitors when there's an active freight) */
  activeFreightId: string | undefined;
  /** Whether tracking is currently active */
  isTracking: boolean;
  /** Polling interval in ms (default 10s) */
  pollIntervalMs?: number;
  /** Callback when GPS is lost */
  onGPSLost?: () => void;
  /** Callback when GPS is restored */
  onGPSRestored?: (lat: number, lng: number) => void;
}

interface GPSWatchdogState {
  gpsLost: boolean;
  lastKnownLat: number | null;
  lastKnownLng: number | null;
  lastKnownAt: Date | null;
}

/**
 * Hook dedicado para detectar quando o GPS do dispositivo é desativado
 * durante um frete ativo. Quando detectado:
 * 1. Registra a última localização conhecida no banco
 * 2. Envia notificação persistente ao motorista
 * 3. Loga incidente no incident_logs
 */
export function useGPSWatchdog({
  profileId,
  activeFreightId,
  isTracking,
  pollIntervalMs = 10_000,
  onGPSLost,
  onGPSRestored,
}: UseGPSWatchdogOptions): GPSWatchdogState {
  const [gpsLost, setGpsLost] = useState(false);
  const [lastKnownLat, setLastKnownLat] = useState<number | null>(null);
  const [lastKnownLng, setLastKnownLng] = useState<number | null>(null);
  const [lastKnownAt, setLastKnownAt] = useState<Date | null>(null);

  const consecutiveFailsRef = useRef(0);
  const hasLoggedIncidentRef = useRef(false);
  const lastGoodCoordsRef = useRef<{ lat: number; lng: number; at: Date } | null>(null);

  // Reset incident flag when freight changes
  useEffect(() => {
    hasLoggedIncidentRef.current = false;
  }, [activeFreightId]);

  // Store last known good coords on every successful position update
  const recordGoodPosition = useCallback((lat: number, lng: number) => {
    const now = new Date();
    lastGoodCoordsRef.current = { lat, lng, at: now };
    setLastKnownLat(lat);
    setLastKnownLng(lng);
    setLastKnownAt(now);
  }, []);

  // Log GPS disabled incident to database
  const logGPSDisabledIncident = useCallback(async () => {
    if (!profileId || !activeFreightId || hasLoggedIncidentRef.current) return;
    hasLoggedIncidentRef.current = true;

    const lastCoords = lastGoodCoordsRef.current;
    const timestamp = new Date().toISOString();

    // 1. Log incident
    await supabase.from('incident_logs').insert({
      freight_id: activeFreightId,
      incident_type: 'GPS_DISABLED',
      description: `GPS desativado pelo dispositivo. Última posição: ${lastCoords ? `${lastCoords.lat.toFixed(6)}, ${lastCoords.lng.toFixed(6)}` : 'desconhecida'}`,
      user_id: profileId,
      severity: 'HIGH',
      auto_generated: true,
    });

    // 2. Save last known location in profiles
    if (lastCoords) {
      await supabase
        .from('profiles')
        .update({
          current_location_lat: lastCoords.lat,
          current_location_lng: lastCoords.lng,
          last_gps_update: timestamp,
          location_enabled: false,
        })
        .eq('id', profileId);

      // Also update driver_current_locations
      await supabase
        .from('driver_current_locations')
        .upsert(
          {
            driver_profile_id: profileId,
            lat: lastCoords.lat,
            lng: lastCoords.lng,
            last_gps_update: timestamp,
            updated_at: timestamp,
          },
          { onConflict: 'driver_profile_id' }
        );
    }

    // 3. Send persistent notification to the driver
    await sendNotification({
      user_id: profileId,
      title: '⚠️ GPS Desativado!',
      message: 'O GPS do seu dispositivo foi desativado durante um frete ativo. Ative a localização imediatamente para continuar o rastreamento.',
      type: 'gps_disabled',
      data: {
        freight_id: activeFreightId,
        last_lat: lastCoords?.lat,
        last_lng: lastCoords?.lng,
        detected_at: timestamp,
      },
    });

    console.log('[GPSWatchdog] 🔴 GPS disabled incident logged, notification sent');
  }, [profileId, activeFreightId]);

  // Main polling loop — only runs when tracking is active with an active freight
  useEffect(() => {
    if (!isTracking || !activeFreightId || !profileId) return;

    const interval = setInterval(async () => {
      try {
        // Quick permission check first (fast, no GPS hardware call)
        const hasPermission = await checkPermissionSafe();

        if (!hasPermission) {
          consecutiveFailsRef.current++;
          if (consecutiveFailsRef.current >= 2 && !gpsLost) {
            setGpsLost(true);
            onGPSLost?.();
            await logGPSDisabledIncident();
            toast.error('⚠️ GPS Desativado!', {
              description: 'Localização desligada. Ative o GPS para continuar o rastreamento da carga.',
              duration: 20000,
              id: 'gps-watchdog-lost',
            });
          }
          return;
        }

        // Permission OK — try actual position to confirm GPS hardware is on
        const pos = await getCurrentPositionSafe(1);
        if (pos?.coords) {
          recordGoodPosition(pos.coords.latitude, pos.coords.longitude);
          consecutiveFailsRef.current = 0;

          if (gpsLost) {
            // GPS restored!
            setGpsLost(false);
            hasLoggedIncidentRef.current = false;
            onGPSRestored?.(pos.coords.latitude, pos.coords.longitude);

            // Update location_enabled back to true
            await supabase
              .from('profiles')
              .update({ location_enabled: true })
              .eq('id', profileId);

            toast.success('✅ GPS Restaurado!', {
              description: 'Localização ativa novamente. Rastreamento continua.',
              duration: 5000,
              id: 'gps-watchdog-restored',
            });
          }
        }
      } catch {
        consecutiveFailsRef.current++;
        if (consecutiveFailsRef.current >= 3 && !gpsLost) {
          setGpsLost(true);
          onGPSLost?.();
          await logGPSDisabledIncident();
          toast.error('⚠️ GPS Desativado!', {
            description: 'Não foi possível obter localização. Verifique se o GPS está ativado.',
            duration: 20000,
            id: 'gps-watchdog-lost',
          });
        }
      }
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [isTracking, activeFreightId, profileId, gpsLost, pollIntervalMs, onGPSLost, onGPSRestored, recordGoodPosition, logGPSDisabledIncident]);

  return {
    gpsLost,
    lastKnownLat,
    lastKnownLng,
    lastKnownAt,
  };
}
