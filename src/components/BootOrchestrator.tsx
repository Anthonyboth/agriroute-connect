/**
 * BootOrchestrator - Orquestra o boot conectando useAuth ao AppBootContext
 * 
 * RESPONSABILIDADES:
 * 1. Escutar estado de auth (session/profile/loading)
 * 2. Transicionar AppBoot: CHECKING_AUTH → LOADING_PROFILE → READY
 * 3. Emitir logs estruturados para debugging
 * 4. Nunca bloquear em INITIALIZING
 */

import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAppBoot } from '@/contexts/AppBootContext';

export const BootOrchestrator: React.FC = () => {
  const { session, profile, loading: authLoading, user } = useAuth();
  const { phase, setPhase, setError, bootAttempt, recordStepTiming } = useAppBoot();
  
  const hasStartedRef = useRef(false);
  const lastAttemptRef = useRef(0);
  const stepStartRef = useRef<Record<string, number>>({});

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

  // Reset on new boot attempt
  useEffect(() => {
    if (bootAttempt !== lastAttemptRef.current) {
      lastAttemptRef.current = bootAttempt;
      hasStartedRef.current = false;
      stepStartRef.current = {};
      console.log(`🔁 [BootOrchestrator] Nova tentativa de boot #${bootAttempt}`);
    }
  }, [bootAttempt]);

  // Main orchestration effect
  useEffect(() => {
    // Prevent running multiple times in same attempt
    if (hasStartedRef.current && phase !== 'INITIALIZING') return;

    // Phase 1: Start checking auth
    if (phase === 'INITIALIZING' && !hasStartedRef.current) {
      hasStartedRef.current = true;
      logStep('SESSION', 'START');
      setPhase('CHECKING_AUTH');
      return;
    }

    // Phase 2: Auth check complete, now loading profile
    if (phase === 'CHECKING_AUTH') {
      // Session resolved (either have user or no user)
      if (!authLoading && session !== undefined) {
        logStep('SESSION', 'OK', { hasUser: !!user });
        
        if (!user) {
          // No user = no need to load profile, go to READY
          logStep('PROFILE', 'START');
          logStep('PROFILE', 'OK', { hasProfile: false, reason: 'no_user' });
          setPhase('READY');
          return;
        }
        
        // Has user, need to load profile
        logStep('PROFILE', 'START');
        setPhase('LOADING_PROFILE');
        return;
      }
    }

    // Phase 3: Profile loading
    if (phase === 'LOADING_PROFILE') {
      // Profile resolved (either have profile or auth finished without profile)
      if (!authLoading) {
        if (profile) {
          logStep('PROFILE', 'OK', { role: profile.role, status: profile.status });
          setPhase('READY');
        } else if (!user) {
          // User signed out during profile load
          logStep('PROFILE', 'OK', { hasProfile: false, reason: 'signed_out' });
          setPhase('READY');
        }
        // If authLoading=false but no profile and has user, profile fetch might have failed
        // Wait a bit more or let timeout handle it
      }
    }
  }, [phase, authLoading, session, user, profile, setPhase, setError, bootAttempt, recordStepTiming]);

  // Safety: if stuck in CHECKING_AUTH or LOADING_PROFILE for too long with authLoading=false
  useEffect(() => {
    if (!authLoading && (phase === 'CHECKING_AUTH' || phase === 'LOADING_PROFILE')) {
      // Give it a short grace period then force READY
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

  return null;
};

export default BootOrchestrator;
