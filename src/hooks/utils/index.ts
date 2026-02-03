/**
 * Índice de hooks utilitários para o AgriRoute
 * 
 * Estes hooks centralizam lógica comum e garantem:
 * - Tratamento de erros consistente
 * - Retry automático para operações de rede
 * - Debounce/throttle para evitar chamadas excessivas
 * - Idempotência para ações críticas
 * - Performance e monitoramento
 * - Cache local para reduzir chamadas ao servidor
 */

// Operações assíncronas com retry
export {
  useAsyncOperation,
  useMutation,
  useDebouncedQuery,
} from '../useAsyncOperation';

// Throttle e debounce
export {
  useThrottle,
  useSingleFlight,
  useDebounce,
} from '../useThrottle';

// Idempotência e prevenção de duplicatas
export {
  useIdempotentAction,
  useSubmitLock,
  useOnce,
} from '../useIdempotentAction';

// Monitoramento de performance
export {
  usePerformanceMonitor,
  useRenderPerformance,
} from '../usePerformanceMonitor';

// Cache local
export {
  useLocalCache,
  invalidateCacheByPrefix,
  clearAllCache,
} from '../useLocalCache';

// Formulários
export { useForm } from '../useFormState';

// Monitoramento de rede
export {
  useNetworkMonitor,
  useOnlineStatus,
} from '../useNetworkMonitor';

// Estados de loading
export {
  useLoadingState,
  useSimpleLoading,
  useLoadingWithTimeout,
} from '../useLoadingState';

// Modais
export {
  useModal,
  useModalStack,
  useConfirmation,
} from '../useModalState';

// Operações Supabase
export {
  useSupabaseQuery,
  useSupabaseMutation,
  useSupabaseRpc,
  useSupabaseHealth,
} from '../useSupabaseOperations';

// Preços de frete
export {
  useFreightPricing,
  calculateFreightPricing,
  extractPricingData,
  getPaymentAmount,
} from '../useFreightPricing';

// Ciclo de vida do frete (gestão completa)
export {
  useFreightLifecycle,
  FREIGHT_STATUS_ORDER,
} from '../useFreightLifecycle';

// Status de frete (wrapper simplificado)
export {
  useFreightStatus,
} from '../useFreightStatus';
