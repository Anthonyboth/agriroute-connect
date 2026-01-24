/**
 * AppBootContext - Gerenciamento centralizado do estado de boot da aplicação
 * 
 * REGRA CRÍTICA (iOS/PRODUÇÃO):
 * - NUNCA pode existir "tela travada" sem UI
 * - Timeout de 8s para bootstrap completo
 * - Fallback automático com botões de recuperação
 * - Log estruturado de cada etapa
 * 
 * Estados do boot:
 * 1. INITIALIZING - App está carregando (splash screen)
 * 2. CHECKING_AUTH - Verificando sessão de autenticação
 * 3. LOADING_PROFILE - Carregando perfil do usuário
 * 4. READY - App pronto para uso
 * 5. ERROR - Erro durante boot
 * 6. TIMEOUT - Bootstrap excedeu tempo limite
 */

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';

export type BootPhase = 
  | 'INITIALIZING' 
  | 'CHECKING_AUTH' 
  | 'LOADING_PROFILE' 
  | 'READY' 
  | 'ERROR'
  | 'TIMEOUT';

interface BootMetrics {
  bootStartedAt: number;
  authCheckedAt?: number;
  profileLoadedAt?: number;
  readyAt?: number;
  timeoutAt?: number;
}

interface AppBootState {
  phase: BootPhase;
  isLoading: boolean;
  error: string | null;
  metrics: BootMetrics;
  isTimeout: boolean;
}

interface AppBootContextValue extends AppBootState {
  setPhase: (phase: BootPhase) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  getLoadingMessage: () => string;
  getTotalBootTime: () => number | null;
  /** Forçar timeout (para testes) */
  forceTimeout: () => void;
}

const AppBootContext = createContext<AppBootContextValue | null>(null);

const SUPABASE_URL = "https://shnvtxejjecbnztdbbbl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg";

/** Enviar alerta de timeout para Telegram */
async function sendTimeoutAlert(metrics: BootMetrics, phase: BootPhase): Promise<void> {
  try {
    const platform = Capacitor.isNativePlatform() 
      ? Capacitor.getPlatform() 
      : 'web';
    
    const payload = {
      errorData: {
        errorType: 'BOOTSTRAP_TIMEOUT',
        errorCategory: 'BOOT',
        errorMessage: `⏰ Bootstrap timeout na fase: ${phase}`,
        module: 'AppBootContext',
        metadata: {
          phase,
          elapsedMs: Date.now() - metrics.bootStartedAt,
          metrics,
          platform,
          userAgent: navigator.userAgent,
          isOnline: navigator.onLine,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }
      }
    };

    await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-alert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
      },
      body: JSON.stringify(payload)
    });
    
    console.log('[AppBoot] Alerta de timeout enviado ao Telegram');
  } catch (e) {
    console.debug('[AppBoot] Falha ao enviar alerta:', e);
  }
}

const phaseMessages: Record<BootPhase, string> = {
  INITIALIZING: 'Iniciando...',
  CHECKING_AUTH: 'Verificando sessão...',
  LOADING_PROFILE: 'Carregando perfil...',
  READY: '',
  ERROR: 'Erro ao carregar',
  TIMEOUT: 'Tempo esgotado',
};

/** Timeout do bootstrap em ms */
const BOOTSTRAP_TIMEOUT_MS = 8000;

export const AppBootProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppBootState>({
    phase: 'INITIALIZING',
    isLoading: true,
    error: null,
    metrics: {
      bootStartedAt: Date.now(),
    },
    isTimeout: false,
  });
  
  const metricsRef = useRef<BootMetrics>({
    bootStartedAt: Date.now(),
  });
  
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCompletedRef = useRef(false);
  const hasTimedOutRef = useRef(false);

  const setPhase = useCallback((phase: BootPhase) => {
    // Ignorar se já deu timeout ou completou
    if (hasTimedOutRef.current && phase !== 'READY') return;
    
    const now = Date.now();
    
    // Atualizar métricas
    if (phase === 'LOADING_PROFILE') {
      metricsRef.current.authCheckedAt = now;
    } else if (phase === 'READY') {
      metricsRef.current.profileLoadedAt = now;
      metricsRef.current.readyAt = now;
      hasCompletedRef.current = true;
      hasTimedOutRef.current = false;
      
      // Cancelar timeout se existir
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }
    
    setState(prev => ({
      ...prev,
      phase,
      isLoading: phase !== 'READY' && phase !== 'ERROR' && phase !== 'TIMEOUT',
      isTimeout: phase === 'TIMEOUT',
      metrics: { ...metricsRef.current },
    }));
    
    // Log de métricas em dev
    if (import.meta.env.DEV) {
      const elapsed = now - metricsRef.current.bootStartedAt;
      console.log(`🚀 [AppBoot] Phase: ${phase} (${elapsed}ms desde boot)`);
    }
  }, []);

  const setError = useCallback((error: string | null) => {
    hasCompletedRef.current = true;
    
    // Cancelar timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setState(prev => ({
      ...prev,
      phase: error ? 'ERROR' : prev.phase,
      isLoading: false,
      error,
      isTimeout: false,
    }));
  }, []);

  const forceTimeout = useCallback(() => {
    if (hasCompletedRef.current) return;
    
    hasTimedOutRef.current = true;
    metricsRef.current.timeoutAt = Date.now();
    
    setState(prev => ({
      ...prev,
      phase: 'TIMEOUT',
      isLoading: false,
      isTimeout: true,
      metrics: { ...metricsRef.current },
    }));
    
    // Enviar alerta
    sendTimeoutAlert(metricsRef.current, state.phase);
  }, [state.phase]);

  const reset = useCallback(() => {
    hasCompletedRef.current = false;
    hasTimedOutRef.current = false;
    
    metricsRef.current = { bootStartedAt: Date.now() };
    
    setState({
      phase: 'INITIALIZING',
      isLoading: true,
      error: null,
      metrics: metricsRef.current,
      isTimeout: false,
    });
    
    // Reiniciar timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (!hasCompletedRef.current) {
        forceTimeout();
      }
    }, BOOTSTRAP_TIMEOUT_MS);
  }, [forceTimeout]);

  const getLoadingMessage = useCallback(() => {
    return phaseMessages[state.phase];
  }, [state.phase]);

  const getTotalBootTime = useCallback(() => {
    if (!metricsRef.current.readyAt) return null;
    return metricsRef.current.readyAt - metricsRef.current.bootStartedAt;
  }, []);

  // Setup do timeout no mount
  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      if (!hasCompletedRef.current && !hasTimedOutRef.current) {
        console.warn('[AppBoot] ⚠️ TIMEOUT! Fase atual:', state.phase);
        forceTimeout();
      }
    }, BOOTSTRAP_TIMEOUT_MS);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Apenas no mount

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
    forceTimeout,
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
  // NÃO mostrar durante TIMEOUT (fallback UI vai aparecer)
  return isLoading && (phase === 'CHECKING_AUTH' || phase === 'LOADING_PROFILE');
};

/**
 * Hook para verificar se deve mostrar fallback de timeout
 */
export const useShouldShowTimeoutFallback = (): boolean => {
  const { isTimeout, phase } = useAppBoot();
  return isTimeout || phase === 'TIMEOUT';
};

export default AppBootContext;
