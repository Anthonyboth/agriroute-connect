import { useEffect } from 'react';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

/**
 * Hook global para interceptar erros de API do Supabase
 * Captura erros HTTP 400-599 e reporta ao sistema de monitoramento
 */
export function useErrorMonitoring() {
  useEffect(() => {
    const errorMonitoring = ErrorMonitoringService.getInstance();
    
    // Interceptar fetch para capturar erros de API
    const originalFetch = window.fetch;
    
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      try {
        const response = await originalFetch(...args);
        
        // Capturar erros HTTP 400-599 de APIs Supabase
        if (!response.ok && typeof args[0] === 'string' && args[0].includes('supabase')) {
          const clonedResponse = response.clone();
          let errorData: any = {};
          
          try {
            errorData = await clonedResponse.json();
          } catch {
            // Se não for JSON, ignorar
          }
          
          errorMonitoring.captureError(
            new Error(`Supabase API Error: ${response.status} ${response.statusText}`),
            {
              source: 'supabase_api',
              statusCode: response.status,
              url: args[0],
              errorData,
              userFacing: true
            }
          );
        }
        
        return response;
      } catch (error) {
        // Capturar erros de rede (fetch falhou)
        errorMonitoring.captureError(error as Error, {
          source: 'fetch_error',
          url: typeof args[0] === 'string' ? args[0] : 'unknown',
          userFacing: true
        });
        throw error;
      }
    };
    
    return () => {
      // Restaurar fetch original ao desmontar
      window.fetch = originalFetch;
    };
  }, []);
}
