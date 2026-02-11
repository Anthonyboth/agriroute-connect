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

/** Erro detalhado para instrumentação */
interface BootError {
  message: string;
  step: BootPhase;
  stack?: string;
  code?: string | number;
}

interface AppBootState {
  phase: BootPhase;
  isLoading: boolean;
  error: string | null;
  metrics: BootMetrics;
  isTimeout: boolean;
  /** Último step executado */
  lastStep: string | null;
  /** Timings por step (ms) */
  stepTimings: Record<string, number>;
  /** Erro detalhado */
  lastError: BootError | null;
  /** Contador de tentativas de boot */
  bootAttempt: number;
}

interface AppBootContextValue extends AppBootState {
  setPhase: (phase: BootPhase) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  getLoadingMessage: () => string;
  getTotalBootTime: () => number | null;
  /** Forçar timeout (para testes) */
  forceTimeout: () => void;
  /** Registrar timing de um step */
  recordStepTiming: (step: string, ms: number) => void;
}

const AppBootContext = createContext<AppBootContextValue | null>(null);

const SUPABASE_URL = "https://shnvtxejjecbnztdbbbl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg";

/** Enviar alerta de timeout para Telegram via report-error (verify_jwt=false) */
async function sendTimeoutAlert(
  metrics: BootMetrics, 
  phase: BootPhase,
  lastStep: string | null,
  stepTimings: Record<string, number>,
  lastError: { message: string; step: BootPhase; stack?: string; code?: string | number } | null
): Promise<void> {
  try {
    const platform = Capacitor.isNativePlatform() 
      ? Capacitor.getPlatform() 
      : 'web';
    
    const payload = {
      errorType: 'FRONTEND',
      errorCategory: 'CRITICAL',
      errorMessage: `BOOTSTRAP_TIMEOUT step=${lastStep || phase}`,
      module: 'AppBootContext',
      route: window.location.pathname,
      metadata: {
        bootstrapPhase: phase,
        lastStep,
        stepTimings,
        lastError: lastError ? {
          message: lastError.message,
          step: lastError.step,
          code: lastError.code,
        } : null,
        elapsedMs: Date.now() - metrics.bootStartedAt,
        metrics,
        platform,
        userAgent: navigator.userAgent,
        isOnline: navigator.onLine,
        url: window.location.href,
        timestamp: new Date().toISOString(),
      }
    };

    // Usar report-error que tem verify_jwt=false e encaminha para Telegram internamente
    await fetch(`${SUPABASE_URL}/functions/v1/report-error`, {
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

/** Timeout do bootstrap em ms - mais generoso para cold starts */
const BOOTSTRAP_TIMEOUT_MS = Capacitor.isNativePlatform() ? 12000 : 10000;

export const AppBootProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppBootState>({
    phase: 'INITIALIZING',
    isLoading: true,
    error: null,
    metrics: {
      bootStartedAt: Date.now(),
    },
    isTimeout: false,
    lastStep: null,
    stepTimings: {},
    lastError: null,
    bootAttempt: 1,
  });
  
  const metricsRef = useRef<BootMetrics>({
    bootStartedAt: Date.now(),
  });
  
  const phaseRef = useRef<BootPhase>('INITIALIZING');
  const lastStepRef = useRef<string | null>(null);
  const stepTimingsRef = useRef<Record<string, number>>({});
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCompletedRef = useRef(false);
  const hasTimedOutRef = useRef(false);

  const recordStepTiming = useCallback((step: string, ms: number) => {
    stepTimingsRef.current[step] = ms;
    setState(prev => ({
      ...prev,
      lastStep: step,
      stepTimings: { ...stepTimingsRef.current },
    }));
  }, []);

  const setPhase = useCallback((phase: BootPhase) => {
    // Ignorar se já deu timeout ou completou
    if (hasTimedOutRef.current && phase !== 'READY') return;
    
    const now = Date.now();
    
    // Atualizar refs PRIMEIRO (antes do setState)
    phaseRef.current = phase;
    lastStepRef.current = phase;
    
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
      lastStep: phase,
      isLoading: phase !== 'READY' && phase !== 'ERROR' && phase !== 'TIMEOUT',
      isTimeout: phase === 'TIMEOUT',
      metrics: { ...metricsRef.current },
    }));
    
    // Log de métricas em dev
    const elapsed = now - metricsRef.current.bootStartedAt;
    console.log(`🚀 [AppBoot] Phase: ${phase} (${elapsed}ms desde boot)`);
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
    
    // Ler valores ATUAIS dos refs (não do state stale)
    const currentPhase = phaseRef.current;
    const currentLastStep = lastStepRef.current;
    
    hasTimedOutRef.current = true;
    metricsRef.current.timeoutAt = Date.now();
    
    const lastError: BootError = {
      message: `Bootstrap timeout na fase ${currentPhase}`,
      step: currentPhase,
    };
    
    setState(prev => ({
      ...prev,
      phase: 'TIMEOUT',
      isLoading: false,
      isTimeout: true,
      metrics: { ...metricsRef.current },
      lastError,
    }));
    
    // Enviar alerta com dados de instrumentação usando refs atuais
    sendTimeoutAlert(
      metricsRef.current, 
      currentPhase,
      currentLastStep,
      stepTimingsRef.current,
      lastError
    );
  }, []);

  const reset = useCallback(() => {
    hasCompletedRef.current = false;
    hasTimedOutRef.current = false;
    
    metricsRef.current = { bootStartedAt: Date.now() };
    stepTimingsRef.current = {};
    
    setState(prev => ({
      phase: 'INITIALIZING',
      isLoading: true,
      error: null,
      metrics: metricsRef.current,
      isTimeout: false,
      lastStep: null,
      stepTimings: {},
      lastError: null,
      bootAttempt: prev.bootAttempt + 1,
    }));
    
    console.log('🔄 [AppBoot] Reset - reiniciando boot');
    
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
        console.warn('[AppBoot] ⚠️ TIMEOUT! Fase atual:', phaseRef.current);
        forceTimeout();
      }
    }, BOOTSTRAP_TIMEOUT_MS);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [forceTimeout]); // forceTimeout is stable (no deps)

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
    recordStepTiming,
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
