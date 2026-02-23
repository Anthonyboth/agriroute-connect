/**
 * BootOrchestrator - Orquestra o boot conectando useAuth ao AppBootContext
 * 
 * RESPONSABILIDADES:
 * 1. Escutar estado de auth (session/profile/loading)
 * 2. Transicionar AppBoot: CHECKING_AUTH → LOADING_PROFILE → READY
 * 3. Emitir logs estruturados para debugging
 * 4. Nunca bloquear em INITIALIZING
 * 5. Resiliente a AuthProvider ausente (não crashar se context falhar)
 */

import React, { useEffect, useRef, useContext } from 'react';
import { AuthContext } from '@/hooks/useAuth';
import { useAppBoot } from '@/contexts/AppBootContext';

export const BootOrchestrator: React.FC = () => {
  // Use AuthContext directly instead of useAuth() to avoid throwing
  // when AuthProvider is missing or crashed during initialization
  const authContext = useContext(AuthContext);
  const { phase, setPhase, setError, bootAttempt, recordStepTiming } = useAppBoot();
  
  const hasStartedRef = useRef(false);
  const lastAttemptRef = useRef(0);
  const stepStartRef = useRef<Record<string, number>>({});

  const session = authContext?.session;
  const profile = authContext?.profile;
  const authLoading = authContext?.loading ?? true;
  const user = authContext?.user;

  // Log helper
  const logStep = (step: string, status: 'START' | 'OK' | 'FAIL', details?: any) => {
    const now = Date.now();
    const elapsed = stepStartRef.current[step] ? now - stepStartRef.current[step] : 0;
    
    if (status === 'START') {
      stepStartRef.current[step] = now;
    }
    
    const emoji = status === 'START' ? '🔄' : status === 'OK' ? '✅' : '❌';
    console.log(`${emoji} [BootOrchestrator] BOOTSTRAP_STEP_${status}: ${step}${elapsed ? ` (${elapsed}ms)` : ''}`, details || '');
    
    // Record timing on completion
    if ((status === 'OK' || status === 'FAIL') && elapsed > 0) {
      recordStepTiming?.(step, elapsed);
    }
  };

  // If AuthProvider is not available, force READY immediately
  useEffect(() => {
    if (!authContext && phase !== 'READY') {
      console.warn('[BootOrchestrator] AuthProvider not available - forcing READY');
      setPhase('READY');
    }
  }, [authContext, phase, setPhase]);

  // Reset on new boot attempt
  useEffect(() => {
    if (bootAttempt !== lastAttemptRef.current) {
      lastAttemptRef.current = bootAttempt;
      hasStartedRef.current = false;
      stepStartRef.current = {};
      console.log(`🔁 [BootOrchestrator] Nova tentativa de boot #${bootAttempt}`);
    }
  }, [bootAttempt]);

  // Main orchestration effect - deterministic transitions
  useEffect(() => {
    // Skip if AuthProvider is not available
    if (!authContext) return;

    // Phase 1: Immediately transition out of INITIALIZING
    if (phase === 'INITIALIZING') {
      if (!hasStartedRef.current) {
        hasStartedRef.current = true;
        logStep('SESSION', 'START');
      }
      setPhase('CHECKING_AUTH');
      return;
    }

    // Phase 2: Auth check complete, now loading profile
    if (phase === 'CHECKING_AUTH' && !authLoading && session !== undefined) {
      logStep('SESSION', 'OK', { hasUser: !!user });
      
      if (!user) {
        logStep('PROFILE', 'START');
        logStep('PROFILE', 'OK', { hasProfile: false, reason: 'no_user' });
        setPhase('READY');
        return;
      }
      
      logStep('PROFILE', 'START');
      setPhase('LOADING_PROFILE');
      return;
    }

    // Phase 3: Profile loading
    if (phase === 'LOADING_PROFILE' && !authLoading) {
      if (profile) {
        logStep('PROFILE', 'OK', { role: profile.role, status: profile.status });
        setPhase('READY');
      } else if (!user) {
        logStep('PROFILE', 'OK', { hasProfile: false, reason: 'signed_out' });
        setPhase('READY');
      }
    }
  }, [authContext, phase, authLoading, session, user, profile, setPhase, setError, bootAttempt, recordStepTiming]);

  // Safety: if stuck in INITIALIZING (hasStarted but phase didn't change)
  useEffect(() => {
    if (phase === 'INITIALIZING' && hasStartedRef.current) {
      const timer = setTimeout(() => {
        if (phase === 'INITIALIZING') {
          console.warn('[BootOrchestrator] Forçando transição de INITIALIZING - setPhase pode ter falhado');
          logStep('SESSION', 'START');
          setPhase('CHECKING_AUTH');
        }
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [phase, setPhase]);

  // Safety: if stuck in CHECKING_AUTH or LOADING_PROFILE for too long with authLoading=false
  useEffect(() => {
    if (!authLoading && (phase === 'CHECKING_AUTH' || phase === 'LOADING_PROFILE')) {
      const timer = setTimeout(() => {
        if (phase === 'CHECKING_AUTH' || phase === 'LOADING_PROFILE') {
          console.warn(`[BootOrchestrator] Forçando READY - auth não está carregando mas phase=${phase}`);
          logStep(phase === 'CHECKING_AUTH' ? 'SESSION' : 'PROFILE', 'OK', { forced: true });
          setPhase('READY');
        }
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [authLoading, phase, setPhase]);

  // Critical safety: if stuck in CHECKING_AUTH for >6s regardless of authLoading,
  // force READY. This prevents timeout for anonymous users on slow connections
  // where Supabase getSession() takes too long.
  useEffect(() => {
    if (phase === 'CHECKING_AUTH' || phase === 'LOADING_PROFILE') {
      const maxWait = setTimeout(() => {
        if (phase === 'CHECKING_AUTH' || phase === 'LOADING_PROFILE') {
          console.warn(`[BootOrchestrator] ⚠️ Forçando READY após 6s - phase=${phase} authLoading=${authLoading}`);
          logStep(phase === 'CHECKING_AUTH' ? 'SESSION' : 'PROFILE', 'OK', { forced: true, reason: 'max_wait_exceeded' });
          setPhase('READY');
        }
      }, 6000);
      
      return () => clearTimeout(maxWait);
    }
  }, [phase, setPhase]);

  return null;
};

export default BootOrchestrator;
