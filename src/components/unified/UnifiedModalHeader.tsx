import React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  label: string;
}

interface UnifiedModalHeaderProps {
  steps: Step[];
  currentStep: number;
  title?: string;
  description?: string;
  className?: string;
}

/**
 * Problema 5: Componente de header unificado para modais com sistema de etapas
 * Padrão visual consistente para todos os modais com wizard/steps
 */
export const UnifiedModalHeader: React.FC<UnifiedModalHeaderProps> = ({
  steps,
  currentStep,
  title,
  description,
  className
}) => {
  return (
    <div className={cn("space-y-4", className)}>
      {title && (
        <div className="text-center">
          <h2 className="text-xl font-bold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}

      {/* Indicador de progresso visual */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                  currentStep > step.id
                    ? "bg-primary text-primary-foreground"
                    : currentStep === step.id
                    ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {currentStep > step.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className={cn(
                  "text-xs mt-1 font-medium",
                  currentStep >= step.id ? "text-primary" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "h-1 w-8 rounded-full transition-all duration-300 mb-5",
                  currentStep > step.id ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default UnifiedModalHeader;
