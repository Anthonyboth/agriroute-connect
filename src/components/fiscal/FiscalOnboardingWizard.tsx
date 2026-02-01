import React, { useState, useEffect } from 'react';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  ArrowRight, 
  Building2, 
  FileCheck, 
  Key, 
  Shield, 
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useFiscalIssuer, IssuerType, RegisterIssuerData } from '@/hooks/useFiscalIssuer';
import { FiscalOnboardingStep1 } from './onboarding/FiscalOnboardingStep1';
import { FiscalOnboardingStep2 } from './onboarding/FiscalOnboardingStep2';
import { FiscalOnboardingStep3 } from './onboarding/FiscalOnboardingStep3';
import { FiscalOnboardingStep4 } from './onboarding/FiscalOnboardingStep4';
import { FiscalOnboardingStep5 } from './onboarding/FiscalOnboardingStep5';

interface FiscalOnboardingWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
  /** Modo de edição: permite navegar livremente entre etapas */
  editMode?: boolean;
}

const STEPS = [
  { id: 1, title: 'Tipo de Emissor', icon: Building2 },
  { id: 2, title: 'Dados Cadastrais', icon: FileCheck },
  { id: 3, title: 'Certificado Digital', icon: Key },
  { id: 4, title: 'Validação SEFAZ', icon: Shield },
  { id: 5, title: 'Termo de Responsabilidade', icon: CheckCircle2 },
];

export function FiscalOnboardingWizard({ onComplete, onCancel, editMode = false }: FiscalOnboardingWizardProps) {
  const { loading, issuer, getOnboardingProgress } = useFiscalIssuer();
  const [currentStep, setCurrentStep] = useState(editMode ? 2 : 1); // Ir direto para dados cadastrais em modo edição
  const [formData, setFormData] = useState<Partial<RegisterIssuerData>>({
    issuer_type: 'CPF',
    regime_tributario: 'simples_nacional',
  });
  const [hasInitialized, setHasInitialized] = useState(false);

  // Sync step with issuer status (apenas no primeiro render e se não for modo edição)
  useEffect(() => {
    if (hasInitialized || editMode) return;
    
    if (issuer) {
      const progress = getOnboardingProgress();
      // Em modo normal, ir para a próxima etapa incompleta
      // Mas NÃO fechar automaticamente se já completou - permitir edição
      if (progress.step >= 5) {
        // Emissor já configurado - ir para etapa 2 (dados cadastrais) para permitir edição
        setCurrentStep(2);
      } else {
        setCurrentStep(Math.max(1, progress.step + 1));
      }
      setHasInitialized(true);
    }
  }, [issuer, getOnboardingProgress, hasInitialized, editMode]);

  const progressPercent = (currentStep / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepComplete = () => {
    if (currentStep === STEPS.length) {
      onComplete?.();
    } else {
      handleNext();
    }
  };

  const updateFormData = (updates: Partial<RegisterIssuerData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <FiscalOnboardingStep1
            data={formData}
            onUpdate={updateFormData}
            onNext={handleNext}
          />
        );
      case 2:
        return (
          <FiscalOnboardingStep2
            data={formData}
            onUpdate={updateFormData}
            onNext={handleStepComplete}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <FiscalOnboardingStep3
            onNext={handleStepComplete}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <FiscalOnboardingStep4
            onNext={handleStepComplete}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <FiscalOnboardingStep5
            onComplete={onComplete}
            onBack={handleBack}
          />
        );
      default:
        return null;
    }
  };

  return (
    <WizardShell
      header={
        <div className="p-6">
          <h2 className="text-2xl font-bold">Cadastro Fiscal</h2>
          <p className="text-muted-foreground mt-1">
            Configure seu emissor para emitir NF-e no AgriRoute
          </p>
        </div>
      }
      progress={
        <div className="px-6 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              Etapa {currentStep} de {STEPS.length}
            </span>
            <span className="text-sm text-muted-foreground">
              {STEPS[currentStep - 1].title}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
          
          {/* Step indicators */}
          <div className="flex justify-between mt-4">
            {STEPS.map((step) => {
              const StepIcon = step.icon;
              const isCompleted = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              
              return (
                <div
                  key={step.id}
                  className={`flex flex-col items-center ${
                    isCurrent ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                      isCurrent
                        ? 'border-primary bg-primary/10'
                        : isCompleted
                        ? 'border-green-600 bg-green-600/10'
                        : 'border-muted'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : (
                      <StepIcon className="h-5 w-5" />
                    )}
                  </div>
                  <span className="text-xs mt-1 hidden sm:block">{step.title}</span>
                </div>
              );
            })}
          </div>
        </div>
      }
      footer={
        <div className="p-4 flex justify-between">
          <Button
            variant="outline"
            onClick={currentStep === 1 ? onCancel : handleBack}
            disabled={loading}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          
          {/* Next button is handled by each step component */}
          <div className="text-sm text-muted-foreground flex items-center">
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          </div>
        </div>
      }
    >
      <div className="p-6">
        {renderStep()}
      </div>
    </WizardShell>
  );
}
