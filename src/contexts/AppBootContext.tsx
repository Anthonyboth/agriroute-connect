/**
 * AppBootContext - Gerenciamento centralizado do estado de boot da aplicação
 * 
 * Resolve o problema de múltiplos estados de loading independentes
 * causando "pisca-pisca" e loaders duplicados.
 * 
 * Estados do boot:
 * 1. INITIALIZING - App está carregando (splash screen)
 * 2. CHECKING_AUTH - Verificando sessão de autenticação
 * 3. LOADING_PROFILE - Carregando perfil do usuário
 * 4. READY - App pronto para uso
 * 5. ERROR - Erro durante boot
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

export type BootPhase = 
  | 'INITIALIZING' 
  | 'CHECKING_AUTH' 
  | 'LOADING_PROFILE' 
  | 'READY' 
  | 'ERROR';

interface BootMetrics {
  bootStartedAt: number;
  authCheckedAt?: number;
  profileLoadedAt?: number;
  readyAt?: number;
}

interface AppBootState {
  phase: BootPhase;
  isLoading: boolean;
  error: string | null;
  metrics: BootMetrics;
}

interface AppBootContextValue extends AppBootState {
  setPhase: (phase: BootPhase) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  getLoadingMessage: () => string;
  getTotalBootTime: () => number | null;
}

const AppBootContext = createContext<AppBootContextValue | null>(null);

const phaseMessages: Record<BootPhase, string> = {
  INITIALIZING: 'Iniciando...',
  CHECKING_AUTH: 'Verificando sessão...',
  LOADING_PROFILE: 'Carregando perfil...',
  READY: '',
  ERROR: 'Erro ao carregar',
};

export const AppBootProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppBootState>({
    phase: 'INITIALIZING',
    isLoading: true,
    error: null,
    metrics: {
      bootStartedAt: Date.now(),
    },
  });
  
  const metricsRef = useRef<BootMetrics>({
    bootStartedAt: Date.now(),
  });

  const setPhase = useCallback((phase: BootPhase) => {
    const now = Date.now();
    
    // Atualizar métricas
    if (phase === 'LOADING_PROFILE') {
      metricsRef.current.authCheckedAt = now;
    } else if (phase === 'READY') {
      metricsRef.current.profileLoadedAt = now;
      metricsRef.current.readyAt = now;
    }
    
    setState(prev => ({
      ...prev,
      phase,
      isLoading: phase !== 'READY' && phase !== 'ERROR',
      metrics: { ...metricsRef.current },
    }));
    
    // Log de métricas em dev
    if (import.meta.env.DEV) {
      const elapsed = now - metricsRef.current.bootStartedAt;
      console.log(`🚀 [AppBoot] Phase: ${phase} (${elapsed}ms desde boot)`);
    }
  }, []);

  const setError = useCallback((error: string | null) => {
    setState(prev => ({
      ...prev,
      phase: error ? 'ERROR' : prev.phase,
      isLoading: false,
      error,
    }));
  }, []);

  const reset = useCallback(() => {
    metricsRef.current = { bootStartedAt: Date.now() };
    setState({
      phase: 'INITIALIZING',
      isLoading: true,
      error: null,
      metrics: metricsRef.current,
    });
  }, []);

  const getLoadingMessage = useCallback(() => {
    return phaseMessages[state.phase];
  }, [state.phase]);

  const getTotalBootTime = useCallback(() => {
    if (!metricsRef.current.readyAt) return null;
    return metricsRef.current.readyAt - metricsRef.current.bootStartedAt;
  }, []);

  // Log de métricas finais em dev
  useEffect(() => {
    if (state.phase === 'READY' && import.meta.env.DEV) {
      const totalTime = getTotalBootTime();
      const authTime = metricsRef.current.authCheckedAt 
        ? metricsRef.current.authCheckedAt - metricsRef.current.bootStartedAt 
        : null;
      const profileTime = metricsRef.current.profileLoadedAt && metricsRef.current.authCheckedAt
        ? metricsRef.current.profileLoadedAt - metricsRef.current.authCheckedAt
        : null;
      
      console.log('📊 [AppBoot] Boot completo:', {
        total: `${totalTime}ms`,
        auth: authTime ? `${authTime}ms` : 'N/A',
        profile: profileTime ? `${profileTime}ms` : 'N/A',
      });
    }
  }, [state.phase, getTotalBootTime]);

  const value: AppBootContextValue = {
    ...state,
    setPhase,
    setError,
    reset,
    getLoadingMessage,
    getTotalBootTime,
  };

  return (
    <AppBootContext.Provider value={value}>
      {children}
    </AppBootContext.Provider>
  );
};

export const useAppBoot = (): AppBootContextValue => {
  const context = useContext(AppBootContext);
  if (!context) {
    throw new Error('useAppBoot must be used within AppBootProvider');
  }
  return context;
};

/**
 * Hook para mostrar loader global apenas durante boot
 * Retorna true se deve mostrar o loader fullscreen
 */
export const useShouldShowBootLoader = (): boolean => {
  const { isLoading, phase } = useAppBoot();
  // Mostrar loader apenas durante CHECKING_AUTH e LOADING_PROFILE
  return isLoading && (phase === 'CHECKING_AUTH' || phase === 'LOADING_PROFILE');
};

export default AppBootContext;
