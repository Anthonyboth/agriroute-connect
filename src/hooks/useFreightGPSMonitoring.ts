import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPositionSafe } from '@/utils/location';
import { toast } from 'sonner';
import { useOngoingFreightLocation } from './useOngoingFreightLocation';

/**
 * Hook para monitoramento GPS CONTÍNUO durante frete ativo
 * - Atualiza localização a cada 60 segundos
 * - Detecta GPS desligado e reporta como incidente CRÍTICO
 * - NÃO atualiza tabela `freights` diretamente (evita erro de data)
 * 
 * @param freightId - ID do frete ativo
 * @param driverProfileId - ID do perfil do motorista
 * @param isFreightActive - Se o frete está em status ativo (IN_TRANSIT, LOADING, LOADED)
 * @param updateInterval - Intervalo de atualização em ms (padrão: 60000 = 60 segundos)
 */
export const useFreightGPSMonitoring = (
  freightId: string | null,
  driverProfileId: string | null,
  isFreightActive: boolean,
  updateInterval: number = 60000
) => {
  const { updateFromCoords } = useOngoingFreightLocation({
    driverProfileId,
    freightId,
    minUpdateInterval: 5000
  });

  useEffect(() => {
    if (!isFreightActive || !freightId || !driverProfileId) {
      console.log('[GPS Monitoring] Desativado - Condições não atendidas');
      return;
    }

    console.log('🚨 RASTREAMENTO GPS ATIVO - Frete:', freightId);
    
    let consecutiveFailures = 0;
    const MAX_FAILURES = 3;
    let lastIncidentReported: number | null = null;
    let isCancelled = false;

    // ✅ Verificar se o frete REALMENTE está ativo no banco antes de reportar incidentes
    const verifyFreightIsActive = async (): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from('freights')
          .select('id, status')
          .eq('id', freightId)
          .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'])
          .maybeSingle();

        if (error) {
          console.warn('[GPS Monitoring] Erro ao verificar status do frete:', error.message);
          return false; // Em caso de erro, NÃO reportar incidente
        }

        if (!data) {
          console.log('[GPS Monitoring] ⚠️ Frete não encontrado com status ativo. Ignorando incidente GPS.');
          return false;
        }

        return true;
      } catch {
        return false;
      }
    };

    const updateLocation = async () => {
      if (isCancelled) return;

      try {
        const position = await getCurrentPositionSafe(2);
        
        // ✅ Usar hook dedicado que NÃO atualiza tabela freights
        await updateFromCoords(position.coords);

        // Atualizar tracking do motorista afiliado (se existir)
        const { error: trackingError } = await supabase
          .from('affiliated_drivers_tracking')
          .update({
            current_lat: position.coords.latitude,
            current_lng: position.coords.longitude,
            last_gps_update: new Date().toISOString()
          })
          .eq('driver_profile_id', driverProfileId)
          .eq('current_freight_id', freightId);

        // Ignorar erro se motorista não é afiliado
        if (trackingError && trackingError.code !== 'PGRST116') {
          console.error('[GPS] Erro ao atualizar tracking:', trackingError);
        }
        
        // Reset contador de falhas
        consecutiveFailures = 0;
        console.log('✅ GPS atualizado:', {
          lat: position.coords.latitude.toFixed(6),
          lng: position.coords.longitude.toFixed(6),
          accuracy: `${position.coords.accuracy.toFixed(0)}m`,
          freight: freightId
        });
        
      } catch (error) {
        consecutiveFailures++;
        console.error(`❌ Falha GPS (${consecutiveFailures}/${MAX_FAILURES}):`, error);
        
        // Reportar incidente crítico após múltiplas falhas
        if (consecutiveFailures >= MAX_FAILURES) {
          const now = Date.now();
          const twoHours = 2 * 60 * 60 * 1000;
          
          if (lastIncidentReported && (now - lastIncidentReported) < twoHours) {
            const minutesAgo = Math.round((now - lastIncidentReported) / 60000);
            console.log(`[GPS] Incidente GPS_DISABLED já reportado há ${minutesAgo} minutos. Pulando...`);
            return;
          }

          // ✅ CRÍTICO: Verificar no banco se o frete REALMENTE está ativo
          const isReallyActive = await verifyFreightIsActive();
          if (!isReallyActive) {
            console.log('[GPS Monitoring] 🛑 Frete NÃO está ativo no banco. Suprimindo notificação GPS_DISABLED.');
            consecutiveFailures = 0; // Reset para não tentar novamente
            return;
          }
          
          try {
            await supabase.functions.invoke('tracking-service/incidents', {
              body: {
                freight_id: freightId,
                incident_type: 'GPS_DISABLED',
                severity: 'CRITICAL',
                description: `GPS desligado durante transporte ativo. Motorista: ${driverProfileId}. ${consecutiveFailures} falhas consecutivas.`,
                evidence_data: { 
                  consecutive_failures: consecutiveFailures,
                  error: String(error),
                  timestamp: new Date().toISOString()
                }
              }
            });

            lastIncidentReported = now;

            toast.error('🚨 GPS DESLIGADO DETECTADO!', {
              description: 'Reative o GPS imediatamente. O produtor foi notificado.',
              duration: 15000,
            });
          } catch (reportError) {
            console.error('[GPS] Erro ao reportar incidente:', reportError);
          }
        }
      }
    };

    const intervalId = setInterval(updateLocation, updateInterval);

    return () => {
      isCancelled = true;
      console.log('[GPS Monitoring] Parando rastreamento para frete:', freightId);
      clearInterval(intervalId);
    };
  }, [freightId, driverProfileId, isFreightActive, updateInterval, updateFromCoords]);
};
