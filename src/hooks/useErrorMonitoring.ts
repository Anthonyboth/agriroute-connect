import { useEffect } from 'react';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

/**
 * Hook global para interceptar erros de API do Supabase
 * Captura erros HTTP 400-599 e reporta ao sistema de monitoramento
 */
export function useErrorMonitoring() {
  useEffect(() => {
    console.log('🔍 [useErrorMonitoring] Hook inicializado');
    const errorMonitoring = ErrorMonitoringService.getInstance();
    
    // Interceptar fetch para capturar erros de API
    const originalFetch = window.fetch;
    
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      console.log('🌐 [useErrorMonitoring] Fetch interceptado:', args[0]);
      
      try {
        const response = await originalFetch(...args);
        
        // Capturar erros HTTP 400-599 de APIs Supabase
        if (!response.ok && typeof args[0] === 'string' && args[0].includes('supabase')) {
          console.log('❌ [useErrorMonitoring] Erro HTTP capturado:', response.status);
          
          const clonedResponse = response.clone();
          let errorData: any = {};
          
          try {
            errorData = await clonedResponse.json();
            console.log('📋 [useErrorMonitoring] Dados do erro:', errorData);
          } catch {
            console.warn('⚠️ [useErrorMonitoring] Não foi possível parsear JSON do erro');
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
        console.error('💥 [useErrorMonitoring] Erro de fetch:', error);
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
      console.log('🔍 [useErrorMonitoring] Hook desmontado');
      // Restaurar fetch original ao desmontar
      window.fetch = originalFetch;
    };
  }, []);
}
