import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronLeft, ChevronRight, SkipForward } from 'lucide-react';
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
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  const updateTarget = useCallback(() => {
    if (!step?.targetSelector) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      
      // Determine tooltip position
      const spaceBelow = window.innerHeight - rect.bottom;
      setTooltipPosition(spaceBelow > 220 ? 'bottom' : 'top');

      // Scroll element into view if needed
      if (rect.top < 0 || rect.bottom > window.innerHeight) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      setTargetRect(null);
    }
  }, [step]);

  useEffect(() => {
    updateTarget();
    // Observe DOM changes and resize
    const observer = new MutationObserver(updateTarget);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [updateTarget]);

  if (!step) return null;

  const padding = 8;

  return (
    <div className="fixed inset-0 z-[9999]" role="dialog" aria-label="Tutorial guiado">
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-black/50 transition-opacity duration-300" />

      {/* Highlight cutout */}
      {targetRect && (
        <div
          className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_4000px_rgba(0,0,0,0.5)] transition-all duration-300 pointer-events-none"
          style={{
            top: targetRect.top - padding,
            left: targetRect.left - padding,
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
            zIndex: 10000,
            background: 'transparent',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        ref={tooltipRef}
        className={cn(
          "absolute z-[10001] w-[min(360px,90vw)] bg-card border border-border rounded-xl shadow-2xl p-5 transition-all duration-300",
          !targetRect && "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        )}
        style={
          targetRect
            ? {
                left: Math.max(
                  16,
                  Math.min(
                    targetRect.left + targetRect.width / 2 - 180,
                    window.innerWidth - 376
                  )
                ),
                ...(tooltipPosition === 'bottom'
                  ? { top: targetRect.bottom + padding + 12 }
                  : { bottom: window.innerHeight - targetRect.top + padding + 12 }),
              }
            : undefined
        }
      >
        {/* Close button */}
        <button
          onClick={onSkip}
          className="absolute top-2 right-2 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar tutorial"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress bar */}
        <div className="flex items-center gap-1 mb-3">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i <= currentStep ? "bg-primary" : "bg-muted"
              )}
            />
          ))}
        </div>

        <p className="text-xs text-muted-foreground mb-1">
          Etapa {currentStep + 1} de {steps.length}
        </p>

        <h3 className="text-base font-semibold text-foreground mb-1">{step.title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{step.description}</p>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onSkip}
            className="text-xs text-muted-foreground"
          >
            <SkipForward className="h-3 w-3 mr-1" />
            Pular
          </Button>

          <div className="flex gap-2">
            {!isFirst && (
              <Button variant="outline" size="sm" onClick={onPrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
            <Button size="sm" onClick={isLast ? onComplete : onNext}>
              {isLast ? 'Concluir' : 'Próximo'}
              {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
