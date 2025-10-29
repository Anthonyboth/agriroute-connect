import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPositionSafe, checkPermissionSafe, requestPermissionSafe } from '@/utils/location';
import { toast } from 'sonner';

/**
 * Hook para monitoramento contínuo do GPS durante um frete ativo
 * Detecta quando o GPS é desligado e reporta como incidente
 * 
 * @param freightId - ID do frete sendo monitorado
 * @param isActive - Se o monitoramento deve estar ativo
 * @param checkInterval - Intervalo de verificação em milissegundos (padrão: 60000 = 1 minuto)
 */
export const useGPSMonitoring = (
  freightId: string | null,
  isActive: boolean,
  checkInterval: number = 60000
) => {
  useEffect(() => {
    // ✅ Early exit with null-safety checks
    if (!isActive || !freightId) {
      console.log('[useGPSMonitoring] Skipping: isActive=', isActive, 'freightId=', freightId);
      return;
    }

    let mounted = true;
    let consecutiveFailures = 0;
    let intervalId: NodeJS.Timeout;
    const MAX_FAILURES = 2;

    const initMonitoring = async () => {
      // ✅ Double-check freight ID is still valid
      if (!freightId || !mounted) {
        console.warn('[useGPSMonitoring] Cannot initialize: freightId is null or component unmounted');
        return;
      }

      // Verificar permissão antes de iniciar
      const hasPerm = await checkPermissionSafe();
      if (!hasPerm) {
        const granted = await requestPermissionSafe();
        if (!granted || !mounted) {
          toast.info('Ative sua localização para monitoramento do frete.', { duration: 5000 });
          return;
        }
      }

      console.log('[useGPSMonitoring] Iniciando monitoramento de GPS para frete:', freightId);

      const checkGPSStatus = async () => {
      try {
        // ✅ Verify freightId before making API calls
        if (!freightId) {
          console.warn('[useGPSMonitoring] Aborting GPS check: freightId is null');
          return;
        }

        const position = await getCurrentPositionSafe();
        
        // GPS está funcionando corretamente
        consecutiveFailures = 0;
        console.log('[useGPSMonitoring] GPS ativo:', {
          freightId,
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        
      } catch (error) {
        consecutiveFailures++;
        
        // Só reportar incidente após múltiplas falhas consecutivas
        if (consecutiveFailures >= MAX_FAILURES) {
          console.error('[useGPSMonitoring] GPS desligado - reportando incidente. FreightId:', freightId);
          
          // ✅ Additional null-safety check before reporting
          if (!freightId) {
            console.error('[useGPSMonitoring] Cannot report incident: freightId is null');
            return;
          }

          // Reportar incidente ao backend
          try {
            await supabase.functions.invoke('tracking-service/incidents', {
              body: {
                freight_id: freightId,
                incident_type: 'GPS_DISABLED',
                severity: 'HIGH',
                description: `GPS foi desligado durante o transporte. Última falha: ${new Date().toISOString()}`,
                evidence_data: {
                  consecutive_failures: consecutiveFailures,
                  error_message: String(error)
                }
              }
            });

            toast.error('GPS desligado detectado!', {
              description: 'Reative o GPS imediatamente para continuar o transporte.',
              duration: 10000,
            });
          } catch (reportError) {
            console.error('[useGPSMonitoring] Erro ao reportar incidente de GPS:', reportError);
          }
          
          // Reset contador após reportar
          consecutiveFailures = 0;
        }
      }
    };

      // Verificação inicial imediata
      checkGPSStatus();

      // Configurar verificação periódica
      intervalId = setInterval(checkGPSStatus, checkInterval);
    };

    initMonitoring();

    // Cleanup
    return () => {
      mounted = false;
      if (intervalId) clearInterval(intervalId);
    };
  }, [freightId, isActive, checkInterval]);
};
