/**
 * useSecurityAntiError
 * 
 * Hook CENTRALIZADO de segurança anti-erros e anti-bugs.
 * 
 * Funcionalidades:
 * 1. Captura erros globais (window.onerror, unhandledrejection)
 * 2. Tenta auto-correção inteligente baseada no tipo de erro
 * 3. Reporta resultado (sucesso/falha) ao Telegram
 * 4. Invalida React Query quando necessário
 * 5. Mantém estatísticas de correção
 * 
 * USO: Montar UMA VEZ no App.tsx ou layout raiz.
 * 
 * @example
 * function App() {
 *   useSecurityAntiError();
 *   return <AppRoutes />;
 * }
 */

import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { SecurityAutoHealService } from '@/services/securityAutoHealService';

// Erros que NUNCA devem disparar auto-heal (são comportamento esperado)
const IGNORED_PATTERNS: Array<string | RegExp> = [
  'signal is aborted without reason',
  'The operation was aborted',
  'AbortError',
  /aborted/i,
  'ResizeObserver loop',
  'Query was cancelled',
  'CancelledError',
  // Erros do ServiceWorker/PWA
  'ServiceWorker',
  'sw.js',
  // Extensões de navegador
  'chrome-extension',
  'moz-extension',
  // React dev warnings
  '__REACT_DEVTOOLS',
];

function shouldIgnore(message: string): boolean {
  return IGNORED_PATTERNS.some(pattern =>
    typeof pattern === 'string'
      ? message.includes(pattern)
      : pattern.test(message)
  );
}

// Evitar instalar múltiplos listeners globais
let _globalInstalled = false;

export function useSecurityAntiError() {
  const queryClient = useQueryClient();
  const healService = useRef(SecurityAutoHealService.getInstance());
  const processingRef = useRef<Set<string>>(new Set());

  // Listener para invalidar queries quando o auto-heal pedir
  useEffect(() => {
    const handleInvalidate = () => {
      try {
        queryClient.invalidateQueries();
        console.log('[SecurityAntiError] React Query cache invalidado');
      } catch {
        // ignore
      }
    };

    window.addEventListener('security-invalidate-queries', handleInvalidate);
    return () => {
      window.removeEventListener('security-invalidate-queries', handleInvalidate);
    };
  }, [queryClient]);

  // Handler principal de erros
  const handleGlobalError = useCallback(async (error: Error, source: string) => {
    const msg = error.message || '';

    // Filtrar erros ignorados
    if (shouldIgnore(msg)) return;

    // Evitar processar o mesmo erro simultaneamente
    const errorKey = `${msg.substring(0, 80)}:${source}`;
    if (processingRef.current.has(errorKey)) return;
    processingRef.current.add(errorKey);

    try {
      await healService.current.handleError(error, {
        source,
        route: window.location.pathname,
      });
    } finally {
      // Liberar após 5 segundos para permitir re-processamento se necessário
      setTimeout(() => processingRef.current.delete(errorKey), 5000);
    }
  }, []);

  // Instalar listeners globais UMA VEZ
  useEffect(() => {
    if (_globalInstalled) return;
    _globalInstalled = true;

    // 1. Erros síncronos globais (window.onerror)
    const onError = (event: ErrorEvent) => {
      const error = event.error instanceof Error
        ? event.error
        : new Error(event.message || 'Erro global desconhecido');
      handleGlobalError(error, 'window.onerror');
    };

    // 2. Promise rejections não tratadas
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const error = reason instanceof Error
        ? reason
        : new Error(typeof reason === 'string' ? reason : JSON.stringify(reason || 'Unhandled rejection'));
      handleGlobalError(error, 'unhandledrejection');
    };

    // 3. Erros de console.error (interceptar para detectar erros React)
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      originalConsoleError.apply(console, args);

      // Detectar erros React que não viram exceções
      const firstArg = args[0];
      if (typeof firstArg === 'string') {
        // React internal errors que indicam bugs reais
        if (
          firstArg.includes('Uncaught Error') ||
          firstArg.includes('Maximum update depth') ||
          firstArg.includes('Too many re-renders') ||
          firstArg.includes('Rendered more hooks than during the previous render') ||
          firstArg.includes('Cannot update a component')
        ) {
          const errorMsg = args.map(a => typeof a === 'string' ? a : String(a)).join(' ');
          handleGlobalError(new Error(errorMsg.substring(0, 500)), 'console.error');
        }
      }
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      console.error = originalConsoleError;
      _globalInstalled = false;
    };
  }, [handleGlobalError]);

  // API pública para uso manual em componentes
  const reportAndHeal = useCallback(
    (error: Error, source?: string) => {
      return healService.current.handleError(error, {
        source: source || 'manual',
        route: window.location.pathname,
      });
    },
    []
  );

  const getHealStats = useCallback(() => {
    return healService.current.getStats();
  }, []);

  const getRecentLogs = useCallback((limit?: number) => {
    return healService.current.getRecentLogs(limit);
  }, []);

  return {
    reportAndHeal,
    getHealStats,
    getRecentLogs,
  };
}

export default useSecurityAntiError;
