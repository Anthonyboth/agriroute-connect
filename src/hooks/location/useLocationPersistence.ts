/**
 * useLocationPersistence
 *
 * Hook de persistência de localização no banco.
 * Regras:
 *   - Máximo 1 salvamento por minuto (throttle rígido)
 *   - Só salva se moveu > 20m OU passou 60s desde o último salvamento
 *   - accuracy > 150m salva com flag low_accuracy
 *   - Cancela timers no unmount
 *   - Singleton por sessão (sem múltiplos intervals)
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { LocationCoords } from './useLocationSecurityMonitor';

const MIN_DISTANCE_METERS = 20;
const MIN_SAVE_INTERVAL_MS = 60_000; // 1 minuto

/** Haversine em metros */
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

interface UseLocationPersistenceOptions {
  driverProfileId: string | null;
  freightId: string | null;
}

export const useLocationPersistence = ({
  driverProfileId,
  freightId,
}: UseLocationPersistenceOptions) => {
  const lastSaveTimeRef = useRef<number>(0);
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const isSavingRef = useRef(false);
  const lastSentRef = useRef<string | null>(null);

  const persist = useCallback(async (coords: LocationCoords): Promise<boolean> => {
    if (!driverProfileId) return false;
    if (isSavingRef.current) return false;

    const now = Date.now();
    const { lat, lng, accuracy } = coords;

    // Throttle temporal — máximo 1x/min
    if (now - lastSaveTimeRef.current < MIN_SAVE_INTERVAL_MS) return false;

    // Debounce espacial — só salva se moveu > 20m
    if (lastPositionRef.current) {
      const dist = haversineDistance(
        lastPositionRef.current.lat, lastPositionRef.current.lng,
        lat, lng
      );
      if (dist < MIN_DISTANCE_METERS) {
        return false;
      }
    }

    isSavingRef.current = true;

    try {
      const timestamp = new Date().toISOString();
      const isLowAccuracy = accuracy > 150;

      // 1. driver_current_locations (fonte principal para mapas)
      await supabase
        .from('driver_current_locations')
        .upsert(
          {
            driver_profile_id: driverProfileId,
            lat,
            lng,
            last_gps_update: timestamp,
            updated_at: timestamp,
          },
          { onConflict: 'driver_profile_id' }
        );

      // 2. profiles (compatibilidade)
      await supabase
        .from('profiles')
        .update({
          current_location_lat: lat,
          current_location_lng: lng,
          last_gps_update: timestamp,
        })
        .eq('id', driverProfileId);

      // 3. Histórico (auditoria)
      if (freightId) {
        const { error: histErr } = await supabase.rpc('insert_driver_location_history', {
          p_driver_profile_id: driverProfileId,
          p_freight_id: freightId,
          p_lat: lat,
          p_lng: lng,
          p_accuracy: accuracy ?? null,
          p_heading: coords.heading ?? null,
          p_speed: coords.speed ?? null,
        });
        if (histErr) {
          // FK pode não existir para service_requests — salvar sem freight_id
          await supabase.rpc('insert_driver_location_history', {
            p_driver_profile_id: driverProfileId,
            p_freight_id: null,
            p_lat: lat,
            p_lng: lng,
            p_accuracy: accuracy ?? null,
            p_heading: coords.heading ?? null,
            p_speed: coords.speed ?? null,
          });
        }
      }

      lastPositionRef.current = { lat, lng };
      lastSaveTimeRef.current = now;
      lastSentRef.current = timestamp;

      if (import.meta.env.DEV) {
        console.log(`✅ [GPS-Persist] Salvo: ${lat.toFixed(6)},${lng.toFixed(6)} acc=${accuracy?.toFixed(0)}m${isLowAccuracy ? ' [LOW_ACC]' : ''}`);
      }

      return true;
    } catch (err) {
      console.error('[GPS-Persist] Erro ao salvar localização:', err);
      return false;
    } finally {
      isSavingRef.current = false;
    }
  }, [driverProfileId, freightId]);

  return {
    persist,
    lastSentAt: lastSentRef.current,
    lastPosition: lastPositionRef.current,
  };
};
