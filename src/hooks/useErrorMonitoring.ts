import { useEffect } from 'react';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

// ✅ Lista centralizada de URLs de monitoramento (Correção 4)
const MONITORING_ENDPOINTS = [
  'telegram-error-notifier',
  'report-error',
  'report-user-panel-error',
  'send-telegram-alert',
  'process-telegram-queue'
];

// ✅ URLs de desenvolvimento que não devem gerar alertas
const DEV_SKIP_URLS = [
  '@vite/client',
  '__vite_ping',
  '/__vite',
  'hot-update',
  '.hot-update.',
  'lovable.js'
];

const isMonitoringUrl = (url: string): boolean => 
  MONITORING_ENDPOINTS.some(endpoint => url.includes(endpoint));

const isDevSkipUrl = (url: string): boolean =>
  DEV_SKIP_URLS.some(pattern => url.includes(pattern));

/**
 * Hook global para interceptar erros de API do Supabase
 * Captura erros HTTP 400-599 e reporta ao sistema de monitoramento
 */
export function useErrorMonitoring() {
  useEffect(() => {
    // ✅ Guard: instalar patch apenas uma vez por sessão
    if ((window as any).__fetchPatched) {
      return;
    }
    (window as any).__fetchPatched = true;
    
    if (import.meta.env.DEV) {
      console.log('🔍 [useErrorMonitoring] Hook inicializado');
    }
    const errorMonitoring = ErrorMonitoringService.getInstance();
    
    // Interceptar fetch para capturar erros de API
    const originalFetch = window.fetch;
    
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      // ✅ Extrair URL antes do try/catch (Correção 1 e 4)
      const urlString =
        typeof args[0] === 'string'
          ? args[0]
          : args[0] instanceof Request
            ? args[0].url
            : ((args[0] as any)?.url as string | undefined) || '';
      const isMonitoringRequest = isMonitoringUrl(urlString);
      const isDevRequest = isDevSkipUrl(urlString);
      
      if (import.meta.env.DEV && !isMonitoringRequest) {
        console.log('🌐 [useErrorMonitoring] Fetch interceptado:', args[0]);
      }
      
      try {
        // ✅ Verificar se deve pular monitoramento antes de fazer request
        const skipMonitoring = args[1]?.headers && 
          (args[1].headers as Record<string, string>)['X-Skip-Error-Monitoring'] === 'true';
        
        const response = await originalFetch(...args);
        
        // ✅ Não reportar se flag X-Skip-Error-Monitoring, URL de monitoramento ou dev
        if (skipMonitoring || isMonitoringRequest || isDevRequest) {
          return response;
        }
        
        // Capturar erros HTTP 400-599 de APIs Supabase
        if (!response.ok && urlString.includes('supabase')) {
          // ✅ Não reportar erros de "conflito" esperados (ex.: regra de negócio)
          // Evita alarmes/"blank screen" quando a API retorna 409 intencionalmente.
          const isExpectedIssuerConflict =
            response.status === 409 &&
            urlString.includes('/functions/v1/fiscal-issuer-register');

          if (isExpectedIssuerConflict) {
            return response;
          }

          if (import.meta.env.DEV) {
            console.log('❌ [useErrorMonitoring] Erro HTTP capturado:', response.status);
          }
          
          const clonedResponse = response.clone();
          let errorData: any = {};
          
          try {
            errorData = await clonedResponse.json();
            if (import.meta.env.DEV) {
              console.log('📋 [useErrorMonitoring] Dados do erro:', errorData);
            }
          } catch {
            // Fallback: alguns endpoints retornam texto (ou JSON inválido)
            try {
              const text = await clonedResponse.text();
              if (text) errorData = { raw: text };
            } catch {
              // ignore
            }
            if (import.meta.env.DEV) {
              console.warn('⚠️ [useErrorMonitoring] Não foi possível parsear JSON do erro');
            }
          }
          
          // Melhorar mensagem de erro para rotas de auth
          let errorMessage = `Supabase API Error: ${response.status} ${response.statusText}`;
          const isAuthRoute = urlString.includes('/auth/v1/');
          
          if (isAuthRoute && errorData) {
            const detailedMessage = errorData.error_description || errorData.msg || errorData.message;
            if (detailedMessage) {
              errorMessage = `Auth Error: ${detailedMessage}`;
            }
          }
          
          errorMonitoring.captureError(
            new Error(errorMessage),
            {
              source: 'supabase_api',
              statusCode: response.status,
              url: urlString || 'unknown',
              errorData,
              userFacing: true
            }
          );
        }
        
        return response;
      } catch (error) {
        // ✅ Correção 1: NÃO reportar erros de rede das próprias chamadas de monitoramento ou dev
        if (isMonitoringRequest || isDevRequest) {
          console.debug('[useErrorMonitoring] Erro de rede em chamada interna - suprimido');
          throw error;
        }

        // ✅ Correção 2: NÃO reportar AbortError (cancelamento normal de fetch por cleanup de useEffect)
        if (error instanceof DOMException && (error as DOMException).name === 'AbortError') {
          throw error;
        }
        
        console.error('💥 [useErrorMonitoring] Erro de fetch:', error);
        // Capturar erros de rede (fetch falhou)
        errorMonitoring.captureError(error as Error, {
          source: 'fetch_error',
          url: urlString || 'unknown',
          userFacing: true
        });
        throw error;
      }
    };
    
    return () => {
      if (import.meta.env.DEV) {
        console.log('🔍 [useErrorMonitoring] Hook desmontado');
      }
      // ✅ Não restaurar fetch - manter patch ativo até reload
    };
  }, []);
}
