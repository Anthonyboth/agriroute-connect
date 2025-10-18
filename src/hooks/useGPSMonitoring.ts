import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentPositionSafe } from '@/utils/location';
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
    if (!isActive || !freightId) return;

    console.log('Iniciando monitoramento de GPS para frete:', freightId);
    
    let consecutiveFailures = 0;
    const MAX_FAILURES = 2; // Reportar após 2 falhas consecutivas para evitar falsos positivos

    const checkGPSStatus = async () => {
      try {
        const position = await getCurrentPositionSafe();
        
        // GPS está funcionando corretamente
        consecutiveFailures = 0;
        console.log('GPS ativo:', {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        
      } catch (error) {
        consecutiveFailures++;
        console.warn(`Falha ao obter localização (${consecutiveFailures}/${MAX_FAILURES}):`, error);
        
        // Só reportar incidente após múltiplas falhas consecutivas
        if (consecutiveFailures >= MAX_FAILURES) {
          console.error('GPS desligado ou sem permissão - reportando incidente');
          
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
            console.error('Erro ao reportar incidente de GPS:', reportError);
          }
          
          // Reset contador após reportar
          consecutiveFailures = 0;
        }
      }
    };

    // Verificação inicial imediata
    checkGPSStatus();

    // Configurar verificação periódica
    const intervalId = setInterval(checkGPSStatus, checkInterval);

    // Cleanup
    return () => {
      clearInterval(intervalId);
    };
  }, [freightId, isActive, checkInterval]);
};
