/**
 * Hook dedicado para atualização de localização em fretes EM ANDAMENTO.
 * 
 * REGRA CRÍTICA: Fretes em andamento NÃO têm restrição de data!
 * Uma vez que o motorista aceitou o frete e está na aba "Em Andamento",
 * ele pode atualizar os status pelo tempo que precisar.
 * 
 * Este hook NÃO atualiza a tabela `freights` diretamente para evitar
 * conflitos com o trigger `validate_freight_input` que valida datas.
 * 
 * A localização é armazenada em:
 * - driver_current_locations (fonte principal para mapas)
 * - profiles (fallback e compatibilidade)
 * - driver_location_history (histórico para auditoria)
 */

import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface LocationUpdate {
  lat: number;
  lng: number;
  accuracy?: number;
  heading?: number;
  speed?: number;
}

interface UseOngoingFreightLocationOptions {
  /** ID do perfil do motorista */
  driverProfileId: string | null;
  /** ID do frete ativo (para histórico) */
  freightId: string | null;
  /** Intervalo mínimo entre atualizações (ms) - default 5000 */
  minUpdateInterval?: number;
}

export const useOngoingFreightLocation = ({
  driverProfileId,
  freightId,
  minUpdateInterval = 5000
}: UseOngoingFreightLocationOptions) => {
  const lastUpdateRef = useRef<number>(0);
  const isUpdatingRef = useRef<boolean>(false);

  /**
   * Atualiza a localização do motorista.
   * 
   * IMPORTANTE: Esta função NÃO atualiza a tabela `freights`
   * para evitar conflitos com o trigger de validação de datas.
   */
  const updateLocation = useCallback(async (location: LocationUpdate): Promise<boolean> => {
    if (!driverProfileId) {
      console.warn('[OngoingFreightLocation] driverProfileId não fornecido');
      return false;
    }

    // Throttle para evitar spam de atualizações
    const now = Date.now();
    if (now - lastUpdateRef.current < minUpdateInterval) {
      return false;
    }

    // Evitar atualizações simultâneas
    if (isUpdatingRef.current) {
      return false;
    }

    isUpdatingRef.current = true;
    lastUpdateRef.current = now;

    const timestamp = new Date().toISOString();

    try {
      // 1. Atualizar driver_current_locations (fonte principal para mapas)
      const { error: currentLocError } = await supabase
        .from('driver_current_locations')
        .upsert(
          {
            driver_profile_id: driverProfileId,
            lat: location.lat,
            lng: location.lng,
            last_gps_update: timestamp,
            updated_at: timestamp
          },
          { onConflict: 'driver_profile_id' }
        );

      if (currentLocError) {
        // Ignorar erro de RLS - pode não ter política de INSERT para este usuário
        // A localização ainda será salva no profiles como fallback
        console.warn('[OngoingFreightLocation] Erro em driver_current_locations (ignorando):', currentLocError.message);
      }

      // 2. Atualizar profiles (fallback e compatibilidade)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          current_location_lat: location.lat,
          current_location_lng: location.lng,
          last_gps_update: timestamp
        })
        .eq('id', driverProfileId);

      if (profileError) {
        console.error('[OngoingFreightLocation] Erro ao atualizar profiles:', profileError);
        return false;
      }

      // 3. Salvar no histórico (para auditoria e tracking detalhado)
      if (freightId) {
        const { error: historyError } = await supabase.rpc('insert_driver_location_history', {
          p_driver_profile_id: driverProfileId,
          p_freight_id: freightId,
          p_lat: location.lat,
          p_lng: location.lng,
          p_accuracy: location.accuracy ?? null,
          p_heading: location.heading ?? null,
          p_speed: location.speed ?? null
        });

        if (historyError) {
          // Não falhar se o histórico não puder ser salvo
          console.warn('[OngoingFreightLocation] Erro ao salvar histórico:', historyError.message);
        }
      }

      console.log('✅ [OngoingFreightLocation] Localização atualizada:', {
        lat: location.lat.toFixed(6),
        lng: location.lng.toFixed(6),
        driverProfileId,
        freightId
      });

      return true;

    } catch (error) {
      console.error('[OngoingFreightLocation] Erro inesperado:', error);
      return false;
    } finally {
      isUpdatingRef.current = false;
    }
  }, [driverProfileId, freightId, minUpdateInterval]);

  /**
   * Atualiza a localização a partir de GeolocationCoordinates
   */
  const updateFromCoords = useCallback(async (coords: GeolocationCoordinates): Promise<boolean> => {
    return updateLocation({
      lat: coords.latitude,
      lng: coords.longitude,
      accuracy: coords.accuracy,
      heading: coords.heading ?? undefined,
      speed: coords.speed ?? undefined
    });
  }, [updateLocation]);

  return {
    updateLocation,
    updateFromCoords
  };
};
