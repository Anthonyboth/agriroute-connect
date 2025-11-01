import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPositionSafe } from '@/utils/location';
import { toast } from 'sonner';

/**
 * Hook para monitoramento GPS CONTÍNUO durante frete ativo
 * - Atualiza localização a cada 30 segundos
 * - Detecta GPS desligado e reporta como incidente CRÍTICO
 * - Atualiza tanto o frete quanto o tracking do motorista afiliado
 * 
 * @param freightId - ID do frete ativo
 * @param driverProfileId - ID do perfil do motorista
 * @param isFreightActive - Se o frete está em status ativo (IN_TRANSIT, LOADING, LOADED)
 * @param updateInterval - Intervalo de atualização em ms (padrão: 30000 = 30 segundos)
 */
export const useFreightGPSMonitoring = (
  freightId: string | null,
  driverProfileId: string | null,
  isFreightActive: boolean,
  updateInterval: number = 30000
) => {
  useEffect(() => {
    if (!isFreightActive || !freightId || !driverProfileId) {
      console.log('[GPS Monitoring] Desativado - Condições não atendidas');
      return;
    }

    console.log('🚨 RASTREAMENTO GPS ATIVO - Frete:', freightId);
    
    let consecutiveFailures = 0;
    const MAX_FAILURES = 2; // Reportar após 2 falhas consecutivas

    const updateLocation = async () => {
      try {
        const position = await getCurrentPositionSafe();
        
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const accuracy = position.coords.accuracy;
        
        // Atualizar localização no frete
        const { error: freightError } = await supabase
          .from('freights')
          .update({
            current_lat: lat,
            current_lng: lng,
            last_location_update: new Date().toISOString()
          })
          .eq('id', freightId);

        if (freightError) {
          console.error('[GPS] Erro ao atualizar frete:', freightError);
        }

        // Atualizar tracking do motorista afiliado (se existir)
        const { error: trackingError } = await supabase
          .from('affiliated_drivers_tracking')
          .update({
            current_lat: lat,
            current_lng: lng,
            last_gps_update: new Date().toISOString()
          })
          .eq('driver_profile_id', driverProfileId)
          .eq('current_freight_id', freightId);

        // Ignorar erro se motorista não é afiliado (não tem registro na tabela)
        if (trackingError && trackingError.code !== 'PGRST116') {
          console.error('[GPS] Erro ao atualizar tracking:', trackingError);
        }
        
        // Reset contador de falhas
        consecutiveFailures = 0;
        console.log('✅ GPS atualizado:', {
          lat: lat.toFixed(6),
          lng: lng.toFixed(6),
          accuracy: `${accuracy.toFixed(0)}m`,
          freight: freightId
        });
        
      } catch (error) {
        consecutiveFailures++;
        console.error(`❌ Falha GPS (${consecutiveFailures}/${MAX_FAILURES}):`, error);
        
        // Reportar incidente crítico após múltiplas falhas
        if (consecutiveFailures >= MAX_FAILURES) {
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

            toast.error('🚨 GPS DESLIGADO DETECTADO!', {
              description: 'Reative o GPS imediatamente. O produtor foi notificado.',
              duration: 15000,
            });
          } catch (reportError) {
            console.error('[GPS] Erro ao reportar incidente:', reportError);
          }
          
          // Reset após reportar
          consecutiveFailures = 0;
        }
      }
    };

    // ✅ NÃO atualizar imediatamente no mount - aguardar gesture/permissão do usuário
    // A primeira atualização virá do intervalo após 30s
    
    // Configurar intervalo de atualizações
    const intervalId = setInterval(updateLocation, updateInterval);

    // Cleanup ao desmontar ou quando frete não estiver mais ativo
    return () => {
      console.log('[GPS Monitoring] Parando rastreamento para frete:', freightId);
      clearInterval(intervalId);
    };
  }, [freightId, driverProfileId, isFreightActive, updateInterval]);
};
