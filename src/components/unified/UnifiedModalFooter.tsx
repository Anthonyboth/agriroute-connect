import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';

interface UnifiedModalFooterProps {
  currentStep: number;
  totalSteps: number;
  onBack?: () => void;
  onNext?: () => void;
  onSubmit?: () => void;
  isLoading?: boolean;
  canGoBack?: boolean;
  canGoNext?: boolean;
  backLabel?: string;
  nextLabel?: string;
  submitLabel?: string;
  className?: string;
}

/**
 * Problema 5: Footer unificado para modais com navegação de etapas
 * Botões sempre visíveis e acessíveis (Problema 1 - acessibilidade para idosos)
 */
export const UnifiedModalFooter: React.FC<UnifiedModalFooterProps> = ({
  currentStep,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  isLoading = false,
  canGoBack = true,
  canGoNext = true,
  backLabel = 'Voltar',
  nextLabel = 'Continuar',
  submitLabel = 'Confirmar',
  className
}) => {
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;

  return (
    <div
      className={cn(
        "flex items-center justify-between pt-4 border-t mt-4 gap-4",
        className
      )}
    >
      {/* Botão Voltar - sempre visível mas pode estar desabilitado */}
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={isFirstStep || !canGoBack || isLoading}
        className={cn(
          "min-w-[120px] h-12 text-base font-medium",
          isFirstStep && "opacity-50"
        )}
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {backLabel}
      </Button>

      {/* Indicador de etapa atual */}
      <span className="text-sm text-muted-foreground font-medium">
        Etapa {currentStep} de {totalSteps}
      </span>

      {/* Botão Próximo/Confirmar */}
      {isLastStep ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isLoading}
          className="min-w-[120px] h-12 text-base font-medium bg-primary hover:bg-primary/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-2" />
              {submitLabel}
            </>
          )}
        </Button>
      ) : (
        <Button
          type="button"
          onClick={onNext}
          disabled={!canGoNext || isLoading}
          className="min-w-[120px] h-12 text-base font-medium"
        >
          {nextLabel}
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      )}
    </div>
  );
};

export default UnifiedModalFooter;
