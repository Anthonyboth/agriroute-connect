import React, { useState, useEffect } from 'react';
import { devLog } from '@/lib/devLogger';
import { WizardShell } from '@/components/wizard/WizardShell';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, 
  Building2, 
  FileCheck, 
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { useFiscalIssuer, IssuerType, RegisterIssuerData } from '@/hooks/useFiscalIssuer';
import { FiscalOnboardingStep1 } from './onboarding/FiscalOnboardingStep1';
import { FiscalOnboardingStep2 } from './onboarding/FiscalOnboardingStep2';
// ✅ Steps 3 e 4 removidos - certificado gerenciado em FiscalIssuerSetup
import { FiscalOnboardingStep5 } from './onboarding/FiscalOnboardingStep5';

interface FiscalOnboardingWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
  /** Modo de edição: permite navegar livremente entre etapas */
  editMode?: boolean;
}

// ✅ SIMPLIFICADO: Certificado é gerenciado fora do wizard (em FiscalIssuerSetup)
const STEPS = [
  { id: 1, title: 'Tipo de Emissor', icon: Building2 },
  { id: 2, title: 'Dados Cadastrais', icon: FileCheck },
  { id: 3, title: 'Termo de Responsabilidade', icon: CheckCircle2 },
];

export function FiscalOnboardingWizard({ onComplete, onCancel, editMode = false }: FiscalOnboardingWizardProps) {
  const { loading, issuer, getOnboardingProgress } = useFiscalIssuer();
  const [currentStep, setCurrentStep] = useState(editMode ? 2 : 1); // Ir direto para dados cadastrais em modo edição
  const [formData, setFormData] = useState<Partial<RegisterIssuerData>>({
    issuer_type: 'CPF',
    regime_tributario: 'simples_nacional',
  });
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hasLoadedIssuerData, setHasLoadedIssuerData] = useState(false);

  // ✅ CARREGAR DADOS DO EMISSOR EXISTENTE para o formulário
  useEffect(() => {
    if (hasLoadedIssuerData || !issuer) return;
    
    devLog("[FISCAL WIZARD] Carregando dados do emissor existente:", issuer);
    
    // Mapear dados do banco (issuer) para o formulário (RegisterIssuerData)
    const issuerData: Partial<RegisterIssuerData> = {
      issuer_type: (issuer.document_number?.length === 14 ? 'CNPJ' : 'CPF') as IssuerType,
      cpf_cnpj: issuer.document_number || '',
      razao_social: issuer.legal_name || '',
      nome_fantasia: issuer.trade_name || '',
      inscricao_estadual: issuer.state_registration || '',
      inscricao_municipal: issuer.municipal_registration || '',
      regime_tributario: issuer.tax_regime || 'simples_nacional',
      cnae_principal: issuer.cnae_code || '',
      // Endereço - carregar do banco
      endereco_logradouro: issuer.address_street || '',
      endereco_numero: issuer.address_number || '',
      endereco_complemento: issuer.address_complement || '',
      endereco_bairro: issuer.address_neighborhood || '',
      endereco_cidade: issuer.city || '',
      endereco_uf: issuer.uf || '',
      endereco_cep: issuer.address_zip_code || '',
      endereco_ibge: issuer.city_ibge_code || '',
      email_fiscal: issuer.fiscal_email || '',
      telefone_fiscal: issuer.fiscal_phone || '',
    };
    
    setFormData(prev => ({ ...prev, ...issuerData }));
    setHasLoadedIssuerData(true);
  }, [issuer, hasLoadedIssuerData]);

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

  // ✅ SIMPLIFICADO: Removidas etapas de certificado e validação SEFAZ (gerenciadas em FiscalIssuerSetup)
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
            onNext={handleNext}
            onBack={handleBack}
          />
        );
      case 3:
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
