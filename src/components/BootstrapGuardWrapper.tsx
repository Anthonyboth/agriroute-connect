/**
 * BootstrapGuardWrapper - Wrapper que protege contra "tela travada"
 * 
 * REGRA CRÍTICA (iOS/PRODUÇÃO):
 * - Monitora o estado de boot
 * - Exibe fallback se exceder timeout
 * - NUNCA permite tela vazia sem UI
 */

import React from 'react';
import { useAppBoot, useShouldShowTimeoutFallback } from '@/contexts/AppBootContext';
import { BootstrapFallback } from './BootstrapFallback';
import { GlobalLoader } from './AppLoader';

interface BootstrapGuardWrapperProps {
  children: React.ReactNode;
}

export const BootstrapGuardWrapper: React.FC<BootstrapGuardWrapperProps> = ({ children }) => {
  const { phase, isTimeout, reset, metrics, error, lastStep, stepTimings } = useAppBoot();
  const shouldShowFallback = useShouldShowTimeoutFallback();
  
  // Se deu timeout, mostrar fallback
  if (shouldShowFallback || isTimeout || phase === 'TIMEOUT') {
    return (
      <BootstrapFallback
        failedStep={lastStep || phase}
        elapsedMs={Date.now() - metrics.bootStartedAt}
        error={error || undefined}
        stepTimings={stepTimings}
        onRetry={() => {
          // ✅ CORREÇÃO: Apenas reset, SEM reload
          // O BootOrchestrator detecta bootAttempt e reexecuta
          console.log('🔄 [BootstrapGuard] Tentando novamente (sem reload)');
          reset();
        }}
      />
    );
  }
  
  // Se está em ERROR, mostrar fallback
  if (phase === 'ERROR') {
    return (
      <BootstrapFallback
        failedStep={lastStep || 'error'}
        error={error || 'Erro desconhecido'}
        stepTimings={stepTimings}
        onRetry={() => {
          // ✅ CORREÇÃO: Apenas reset, SEM reload
          console.log('🔄 [BootstrapGuard] Tentando novamente após erro');
          reset();
        }}
      />
    );
  }
  
  return <>{children}</>;
};

/**
 * BootTimeoutGuard - Componente que adiciona timeout global ao boot
 * Usa internamente dentro do AppBootProvider
 */
export const BootTimeoutGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { phase, forceTimeout, isLoading } = useAppBoot();
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCompletedRef = React.useRef(false);
  
  React.useEffect(() => {
    // Marcar como completado se chegou ao READY
    if (phase === 'READY') {
      hasCompletedRef.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
  }, [phase]);
  
  React.useEffect(() => {
    // Se ainda está carregando, iniciar timeout
    if (isLoading && !hasCompletedRef.current) {
      timeoutRef.current = setTimeout(() => {
        if (!hasCompletedRef.current) {
          console.warn('[BootTimeoutGuard] ⚠️ Forçando timeout');
          forceTimeout();
        }
      }, 10000); // 10s de segurança extra
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [isLoading, forceTimeout]);
  
  return <>{children}</>;
};

export default BootstrapGuardWrapper;
