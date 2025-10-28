import { useEffect, useRef } from 'react';

interface Freight {
  id: string;
  status: string;
  driver_id?: string;
}

interface UseGPSMonitoringProps {
  freight?: Freight | null;
  enabled?: boolean;
}

export function useGPSMonitoring({ freight, enabled = true }: UseGPSMonitoringProps) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // ✅ VALIDAÇÃO CRÍTICA: Verificar se está habilitado
    if (!enabled) {
      return;
    }

    // ✅ VALIDAÇÃO CRÍTICA: Verificar se freight existe
    if (!freight) {
      console.log('[useGPSMonitoring] ⚠️ Freight é null/undefined, abortando');
      return;
    }

    // ✅ VALIDAÇÃO CRÍTICA: Verificar se tem propriedades necessárias
    if (!freight.id || !freight.status) {
      console.log('[useGPSMonitoring] ⚠️ Freight sem id ou status:', freight);
      return;
    }

    // ✅ Só monitorar status que requerem GPS
    const statusesRequiringGPS = [
      'IN_PROGRESS',
      'IN_TRANSIT',
      'AT_PICKUP',
      'AT_DELIVERY'
    ];

    if (!statusesRequiringGPS.includes(freight.status)) {
      console.log('[useGPSMonitoring] Status não requer GPS:', freight.status);
      return;
    }

    console.log('[useGPSMonitoring] ✅ Iniciando monitoramento para:', freight.id);

    const captureLocation = () => {
      if (!navigator.geolocation) {
        console.error('[useGPSMonitoring] Geolocalização não disponível');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          console.log('[GPS] Localização capturada:', { latitude, longitude, timestamp: new Date().toISOString() });
          // TODO: Enviar para backend quando endpoint estiver pronto
        },
        (error) => {
          console.error('[GPS] Erro ao obter localização:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000
        }
      );
    };

    // Capturar localização imediatamente
    captureLocation();

    // Capturar a cada 30 segundos
    intervalRef.current = setInterval(captureLocation, 30000);

    // Cleanup
    return () => {
      console.log('[useGPSMonitoring] Parando monitoramento');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [freight?.id, freight?.status, enabled]);

  return null;
}