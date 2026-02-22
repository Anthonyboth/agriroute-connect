/**
 * useBootstrapGuard - Hook de proteção contra "tela travada"
 * 
 * REGRA CRÍTICA:
 * - Timeout máximo de 8s para bootstrap completo
 * - Se exceder, exibir fallback com ações de recuperação
 * - Logar no Telegram quando houver timeout
 * - Rastrear cada etapa do bootstrap
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

export type BootstrapStep = 
  | 'INIT'
  | 'SESSION'
  | 'PROFILE'
  | 'ROUTE'
  | 'READY'
  | 'TIMEOUT'
  | 'ERROR';

interface BootstrapState {
  currentStep: BootstrapStep;
  startedAt: number;
  stepTimings: Record<string, number>;
  error: string | null;
  isTimeout: boolean;
}

interface BootstrapGuardOptions {
  /** Timeout máximo em ms (default: 8000) */
  timeoutMs?: number;
  /** Callback quando ocorrer timeout */
  onTimeout?: (state: BootstrapState) => void;
  /** Callback quando bootstrap completar */
  onReady?: (totalTimeMs: number) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://shnvtxejjecbnztdbbbl.supabase.co";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";

/**
 * Enviar alerta de timeout para Telegram via report-error (verify_jwt=false)
 */
async function sendBootstrapTimeoutAlert(state: BootstrapState): Promise<void> {
  try {
    const platform = Capacitor.isNativePlatform() 
      ? Capacitor.getPlatform() 
      : 'web';
    
    const payload = {
      errorType: 'FRONTEND',
      errorCategory: 'CRITICAL',
      errorMessage: `BOOTSTRAP_TIMEOUT na etapa: ${state.currentStep}`,
      module: 'useBootstrapGuard',
      route: window.location.pathname,
      metadata: {
        bootstrapStep: state.currentStep,
        elapsedMs: Date.now() - state.startedAt,
        stepTimings: state.stepTimings,
        error: state.error,
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
    
    // Alert sent silently
  } catch (e) {
    console.debug('[BootstrapGuard] Falha ao enviar alerta:', e);
  }
}

export function useBootstrapGuard(options: BootstrapGuardOptions = {}) {
  const { 
    timeoutMs = 8000, 
    onTimeout, 
    onReady 
  } = options;
  
  const [state, setState] = useState<BootstrapState>({
    currentStep: 'INIT',
    startedAt: Date.now(),
    stepTimings: {},
    error: null,
    isTimeout: false,
  });
  
  const mountedRef = useRef(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTimedOutRef = useRef(false);
  const hasCompletedRef = useRef(false);

  // Avançar para próxima etapa
  const setStep = useCallback((step: BootstrapStep) => {
    if (!mountedRef.current || hasTimedOutRef.current) return;
    
    const now = Date.now();
    
    setState(prev => {
      const newTimings = {
        ...prev.stepTimings,
        [step]: now - prev.startedAt,
      };
      
      // Log em dev
      if (import.meta.env.DEV) {
        console.log(`[BootstrapGuard] Step: ${step} (${newTimings[step]}ms desde início)`);
      }
      
      return {
        ...prev,
        currentStep: step,
        stepTimings: newTimings,
      };
    });
    
    // Se chegou ao READY, cancelar timeout e chamar callback
    if (step === 'READY' && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      const totalTime = now - state.startedAt;
      if (import.meta.env.DEV) {
        console.log(`[BootstrapGuard] ✅ Bootstrap completo em ${totalTime}ms`);
      }
      
      onReady?.(totalTime);
    }
  }, [onReady, state.startedAt]);

  // Reportar erro
  const setError = useCallback((error: string) => {
    if (!mountedRef.current) return;
    
    setState(prev => ({
      ...prev,
      error,
      currentStep: 'ERROR',
    }));
  }, []);

  // Reset do estado
  const reset = useCallback(() => {
    hasTimedOutRef.current = false;
    hasCompletedRef.current = false;
    
    setState({
      currentStep: 'INIT',
      startedAt: Date.now(),
      stepTimings: {},
      error: null,
      isTimeout: false,
    });
  }, []);

  // Setup do timeout
  useEffect(() => {
    mountedRef.current = true;
    
    // Criar timeout
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current || hasCompletedRef.current) return;
      
      hasTimedOutRef.current = true;
      
      const finalState: BootstrapState = {
        ...state,
        isTimeout: true,
        currentStep: 'TIMEOUT',
      };
      
      console.warn('[BootstrapGuard] ⚠️ TIMEOUT! Etapa:', state.currentStep);
      
      setState(finalState);
      
      // Enviar alerta ao Telegram
      sendBootstrapTimeoutAlert(finalState);
      
      // Callback
      onTimeout?.(finalState);
    }, timeoutMs);
    
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []); // Executar apenas uma vez no mount

  return {
    ...state,
    setStep,
    setError,
    reset,
    elapsedMs: Date.now() - state.startedAt,
  };
}

export default useBootstrapGuard;
