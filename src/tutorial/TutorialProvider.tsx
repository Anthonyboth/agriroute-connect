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
  const isOnboardingRoute = /^\/(complete-profile|auth|driver-type|onboarding)/i.test(location.pathname);

  // Initialize replay window
  useEffect(() => {
    if (profileId && createdAt) {
      initTutorialReplayWindow(profileId, createdAt);
    }
  }, [profileId, createdAt]);

  // Check if can replay
  const canReplay = profileId ? canReplayTutorial(profileId, createdAt) : false;

  // Auto-start on first load after signup - NUNCA durante cadastro
  useEffect(() => {
    if (!profileId || !role || autoStartChecked.current || isOnboardingRoute) return;
    autoStartChecked.current = true;

    // Delay to let dashboard render
    const timer = setTimeout(() => {
      if (shouldAutoStartTutorial(profileId, createdAt)) {
        const roleSteps = getStepsForRole(role);
        setSteps(roleSteps);
        setCurrentStep(0);
        setIsActive(true);
        setTutorialState(profileId, { started_at: new Date().toISOString() });
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [profileId, role, createdAt, isOnboardingRoute]);

  const startTutorial = useCallback(() => {
    if (!profileId || !role) return;
    const roleSteps = getStepsForRole(role);
    setSteps(roleSteps);
    setCurrentStep(0);
    setIsActive(true);
    setTutorialState(profileId, { started_at: new Date().toISOString() });
  }, [profileId, role]);

  const handleNext = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }, [steps.length]);

  const handlePrev = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }, []);

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
