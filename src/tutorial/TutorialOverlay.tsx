import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, PartyPopper } from 'lucide-react';
import { TutorialStep } from './tutorialSteps';
import { cn } from '@/lib/utils';

interface TutorialOverlayProps {
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  steps,
  currentStep,
  onNext,
  onPrev,
  onSkip,
  onComplete,
}) => {
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<'bottom' | 'top'>('bottom');
  const tooltipRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;
  const progress = ((currentStep + 1) / steps.length) * 100;

  const updateTarget = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      if (!step?.targetSelector) {
        setTargetRect(null);
        return;
      }
      const el = document.querySelector(step.targetSelector);
      if (el) {
        const rect = el.getBoundingClientRect();
        setTargetRect(rect);
        const spaceBelow = window.innerHeight - rect.bottom;
        setTooltipPosition(spaceBelow > 260 ? 'bottom' : 'top');
        if (rect.top < 0 || rect.bottom > window.innerHeight) {
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
        }
      } else {
        setTargetRect(null);
      }
    });
  }, [step]);

  useEffect(() => {
    updateTarget();
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [updateTarget]);

  if (!step) return null;

  const padding = 6;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-label="Tutorial guiado">
      {/* Backdrop - click to skip */}
      <div
        className="absolute inset-0 transition-opacity duration-300"
        onClick={onSkip}
        style={{ background: 'transparent' }}
      />

      {/* Spotlight overlay via box-shadow on a full-screen element */}
      {targetRect ? (
        <div
          className="absolute rounded-xl pointer-events-none transition-all duration-500 ease-out"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            zIndex: 10000,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
            border: '2px solid hsl(var(--primary))',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'rgba(0,0,0,0.6)', zIndex: 10000 }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className={cn(
          "absolute z-[10001] w-[min(380px,92vw)]",
          "bg-card/95 backdrop-blur-md border border-border/60",
          "rounded-2xl shadow-2xl",
          "transition-all duration-500 ease-out",
          !targetRect && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
        style={
          targetRect
            ? {
                left: Math.max(
                  12,
                  Math.min(
                    targetRect.left + targetRect.width / 2 - 190,
                    window.innerWidth - 392
                  )
                ),
                ...(tooltipPosition === 'bottom'
                  ? { top: targetRect.bottom + padding + 16 }
                  : { bottom: window.innerHeight - targetRect.top + padding + 16 }),
              }
            : undefined
        }
      >
        {/* Top accent bar */}
        <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-primary via-accent to-primary" />

        <div className="p-5">
          {/* Header row */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              {step.icon && (
                <span className="text-2xl leading-none" role="img" aria-hidden="true">
                  {step.icon}
                </span>
              )}
              <div>
                <p className="text-[11px] font-medium text-primary uppercase tracking-wider">
                  Etapa {currentStep + 1} de {steps.length}
                </p>
                <h3 className="text-base font-bold text-foreground leading-tight mt-0.5">
                  {step.title}
                </h3>
              </div>
            </div>
            <button
              onClick={onSkip}
              className="p-1.5 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
              aria-label="Fechar tutorial"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Description */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-4 pl-0.5">
            {step.description}
          </p>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={onSkip}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md hover:bg-muted/60"
            >
              Pular tour
            </button>

            <div className="flex gap-2">
              {!isFirst && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onPrev}
                  className="h-8 px-3 text-xs rounded-lg"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
                  Voltar
                </Button>
              )}
              <Button
                size="sm"
                onClick={isLast ? onComplete : onNext}
                className="h-8 px-4 text-xs rounded-lg bg-gradient-to-r from-primary to-accent hover:opacity-90 transition-opacity shadow-md"
              >
                {isLast ? (
                  <>
                    <PartyPopper className="h-3.5 w-3.5 mr-1" />
                    Concluir
                  </>
                ) : (
                  <>
                    Próximo
                    <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
