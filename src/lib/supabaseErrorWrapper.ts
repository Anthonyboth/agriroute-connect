import { ErrorMonitoringService } from '@/services/errorMonitoringService';

/**
 * Tipo genérico para respostas do Supabase
 */
type SupabaseResponse<T> = {
  data: T | null;
  error: any;
};

/**
 * Contexto para rastreamento de erros
 */
interface ErrorContext {
  module: string;
  functionName: string;
  operation: string;
  additionalInfo?: Record<string, any>;
}

/**
 * Wrapper para operações Supabase que reporta automaticamente erros
 * ao sistema de monitoramento
 * 
 * @example
 * ```typescript
 * const { data, error } = await supabaseWithErrorMonitoring(
 *   () => supabase.from('freights').select('*'),
 *   {
 *     module: 'DriverDashboard',
 *     functionName: 'fetchFreights',
 *     operation: 'SELECT freights'
 *   }
 * );
 * ```
 */
export async function supabaseWithErrorMonitoring<T>(
  operation: () => Promise<SupabaseResponse<T>>,
  context: ErrorContext
): Promise<SupabaseResponse<T>> {
  const result = await operation();
  
  if (result.error) {
    // ✅ Reportar erro ao sistema de monitoramento
    ErrorMonitoringService.getInstance().captureError(
      new Error(`Supabase Error: ${result.error.message || 'Unknown error'}`),
      {
        ...context,
        source: 'supabase',
        errorCode: result.error.code,
        errorDetails: result.error.details,
        errorHint: result.error.hint,
        userFacing: true,
        // Adicionar informações extras se fornecidas
        ...(context.additionalInfo || {})
      }
    );
  }
  
  return result;
}
