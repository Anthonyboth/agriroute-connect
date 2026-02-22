import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getStepsForRole, TutorialStep } from './tutorialSteps';
import {
  getTutorialState,
  setTutorialState,
  shouldAutoStartTutorial,
  canReplayTutorial,
  initTutorialReplayWindow,
} from './tutorialStorage';
import { TutorialOverlay } from './TutorialOverlay';

interface TutorialContextValue {
  isActive: boolean;
  canReplay: boolean;
  startTutorial: () => void;
}

const TutorialContext = createContext<TutorialContextValue>({
  isActive: false,
  canReplay: false,
  startTutorial: () => {},
});

export const useTutorial = () => useContext(TutorialContext);

/**
 * Clicks a tab element if the target selector refers to a tab trigger.
 * This ensures the tab panel is visible before the tutorial tries to highlight it.
 */
function activateTabIfNeeded(selector?: string) {
  if (!selector) return;

  // Find the target element
  const el = document.querySelector(selector);
  if (!el) return;

  // Check if it's a tab trigger (Radix tabs use role="tab" or [data-state])
  const isTab =
    el.getAttribute('role') === 'tab' ||
    el.hasAttribute('data-state') ||
    el.closest('[role="tablist"]');

  if (isTab) {
    // Click to activate the tab
    (el as HTMLElement).click();
    // Scroll into view
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  } else {
    // Even if not a tab, ensure it's visible
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const location = useLocation();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<TutorialStep[]>([]);
  const autoStartChecked = useRef(false);

  const profileId = profile?.id;
  const role = profile?.active_mode || profile?.role;
  const createdAt = (profile as any)?.created_at;

  // Rotas onde o tutorial NÃO deve iniciar (cadastro, auth, onboarding)
  const isOnboardingRoute = /^\/(complete-profile|auth|driver-type|onboarding|register|signup|login|convite)/i.test(location.pathname);

  // O tutorial só deve iniciar se o perfil estiver aprovado e completo
  const profileStatus = (profile as any)?.status;
  const isProfileReady = profileStatus === 'APPROVED' || profileStatus === 'ACTIVE';

  // Initialize replay window
  useEffect(() => {
    if (profileId && createdAt) {
      initTutorialReplayWindow(profileId, createdAt);
    }
  }, [profileId, createdAt]);

  // Check if can replay
  const canReplay = profileId ? canReplayTutorial(profileId, createdAt) : false;

  // Auto-start on first load after signup - NUNCA durante cadastro ou com perfil pendente
  useEffect(() => {
    if (!profileId || !role || autoStartChecked.current) return;
    if (isOnboardingRoute || !isProfileReady) {
      autoStartChecked.current = true;
      return;
    }
    autoStartChecked.current = true;

    // Aguardar dashboard renderizar antes de iniciar tutorial
    const startIfNeeded = () => {
      if (shouldAutoStartTutorial(profileId, createdAt)) {
        const roleSteps = getStepsForRole(role);
        setSteps(roleSteps);
        setCurrentStep(0);
        setIsActive(true);
        setTutorialState(profileId, { started_at: new Date().toISOString() });
        setTimeout(() => activateTabIfNeeded(roleSteps[0]?.targetSelector), 300);
      }
    };

    const checkDashboardReady = () =>
      document.querySelector('[data-dashboard-ready="true"]') !== null;

    let cleanupFn: () => void = () => {};

    if (checkDashboardReady()) {
      const timer = setTimeout(() => startIfNeeded(), 500);
      cleanupFn = () => clearTimeout(timer);
    } else {
      let startTimer: ReturnType<typeof setTimeout> | null = null;
      const observer = new MutationObserver(() => {
        if (checkDashboardReady()) {
          observer.disconnect();
          startTimer = setTimeout(() => startIfNeeded(), 500);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      const fallback = setTimeout(() => observer.disconnect(), 10000);
      cleanupFn = () => {
        observer.disconnect();
        clearTimeout(fallback);
        if (startTimer) clearTimeout(startTimer);
      };
    }

    return () => cleanupFn();
  }, [profileId, role, createdAt, isOnboardingRoute, isProfileReady]);

  const startTutorial = useCallback(() => {
    if (!profileId || !role) return;
    const roleSteps = getStepsForRole(role);
    setSteps(roleSteps);
    setCurrentStep(0);
    setIsActive(true);
    setTutorialState(profileId, { started_at: new Date().toISOString() });
    // Activate tab for first step if needed
    setTimeout(() => activateTabIfNeeded(roleSteps[0]?.targetSelector), 300);
  }, [profileId, role]);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.min(prev + 1, steps.length - 1);
      // Activate the tab for the next step so it becomes visible
      setTimeout(() => activateTabIfNeeded(steps[next]?.targetSelector), 100);
      return next;
    });
  }, [steps]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => {
      const next = Math.max(prev - 1, 0);
      setTimeout(() => activateTabIfNeeded(steps[next]?.targetSelector), 100);
      return next;
    });
  }, [steps]);

  const handleSkip = useCallback(() => {
    setIsActive(false);
    if (profileId) {
      setTutorialState(profileId, { skipped_at: new Date().toISOString() });
    }
  }, [profileId]);

  const handleComplete = useCallback(() => {
    setIsActive(false);
    if (profileId) {
      setTutorialState(profileId, { completed_at: new Date().toISOString() });
    }
  }, [profileId]);

  return (
    <TutorialContext.Provider value={{ isActive, canReplay, startTutorial }}>
      {children}
      {isActive && steps.length > 0 && (
        <TutorialOverlay
          steps={steps}
          currentStep={currentStep}
          onNext={handleNext}
          onPrev={handlePrev}
          onSkip={handleSkip}
          onComplete={handleComplete}
        />
      )}
    </TutorialContext.Provider>
  );
};
