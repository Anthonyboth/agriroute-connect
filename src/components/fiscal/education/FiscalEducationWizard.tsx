import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ChevronLeft, 
  ChevronRight, 
  FileText,
  Building2,
  ShieldCheck,
  MapPin,
  CheckCircle,
  AlertTriangle,
  XCircle,
  GraduationCap,
  ExternalLink,
  Info
} from 'lucide-react';
import { DocumentGuideCard } from './DocumentGuideCard';
import { StateChecklist } from './StateChecklist';
import { SupportButton } from './SupportButton';
import { 
  DocumentType, 
  ALL_DOCUMENT_TYPES,
  getDocumentInfo,
  BRAZILIAN_UFS
} from '@/lib/fiscal-requirements';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const WIZARD_STORAGE_KEY = 'agriroute_fiscal_wizard_completed';

interface FiscalEducationWizardProps {
  onComplete: () => void;
  onSkip?: () => void;
  defaultUf?: string;
  userRole?: string;
}

const STEPS = [
  { id: 1, title: 'Tipos de Documento', icon: FileText },
  { id: 2, title: 'Cadastro Mínimo', icon: Building2 },
  { id: 3, title: 'Certificado A1', icon: ShieldCheck },
  { id: 4, title: 'Inscrição Estadual', icon: MapPin },
  { id: 5, title: 'Validação por Estado', icon: MapPin },
  { id: 6, title: 'Resumo', icon: CheckCircle },
];

export const FiscalEducationWizard: React.FC<FiscalEducationWizardProps> = ({
  onComplete,
  onSkip,
  defaultUf = 'MT',
  userRole = 'PRODUTOR',
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('NFE');
  const [selectedUf, setSelectedUf] = useState(defaultUf);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  // Filtrar documentos por role
  const getRelevantDocTypes = (): DocumentType[] => {
    switch (userRole) {
      case 'PRODUTOR':
        return ['NFE', 'GTA'];
      case 'MOTORISTA':
        return ['CTE', 'MDFE'];
      case 'PRESTADOR_SERVICOS':
        return ['NFE', 'NFSE'];
      case 'TRANSPORTADORA':
        return ['NFE', 'CTE', 'MDFE'];
      default:
        return ALL_DOCUMENT_TYPES;
    }
  };

  const relevantDocTypes = getRelevantDocTypes();
  const progress = (currentStep / STEPS.length) * 100;

  const handleNext = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Salvar no localStorage que completou o wizard
    localStorage.setItem(WIZARD_STORAGE_KEY, JSON.stringify({
      completed: true,
      completedAt: new Date().toISOString(),
      uf: selectedUf,
    }));
    onComplete();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <Step1DocumentTypes 
          relevantDocTypes={relevantDocTypes} 
          selectedDocType={selectedDocType}
          onSelectDocType={setSelectedDocType}
          userRole={userRole}
        />;
      case 2:
        return <Step2MinimumRegistration />;
      case 3:
        return <Step3Certificate />;
      case 4:
        return <Step4StateRegistration />;
      case 5:
        return <Step5StateValidation 
          selectedDocType={selectedDocType}
          selectedUf={selectedUf}
          onUfChange={setSelectedUf}
        />;
      case 6:
        return <Step6Summary 
          acceptedTerms={acceptedTerms}
          onAcceptTerms={setAcceptedTerms}
        />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b bg-gradient-to-r from-primary/10 to-primary/5">
        <div className="flex items-center gap-3 mb-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h2 className="text-xl font-bold">Guia Fiscal - Antes de Emitir</h2>
        </div>
        
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Etapa {currentStep} de {STEPS.length}: {STEPS[currentStep - 1].title}
            </span>
            <span className="font-medium">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
        
        {/* Step indicators */}
        <div className="flex justify-between mt-4 overflow-x-auto pb-2">
          {STEPS.map((step) => {
            const StepIcon = step.icon;
            const isActive = step.id === currentStep;
            const isCompleted = step.id < currentStep;
            
            return (
              <div 
                key={step.id}
                className={`flex flex-col items-center min-w-[60px] ${
                  isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'
                }`}
              >
                <div className={`p-2 rounded-full ${
                  isActive ? 'bg-primary/20' : isCompleted ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
                }`}>
                  {isCompleted ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-4 w-4" />
                  )}
                </div>
                <span className="text-xs mt-1 text-center hidden sm:block">{step.title}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 md:p-6">
          {renderStepContent()}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-4 border-t bg-muted/30">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
          <SupportButton 
            variant="outline" 
            size="sm"
            context={{ screen: `Wizard Fiscal - Etapa ${currentStep}` }}
          />
          
          <div className="flex gap-2">
            {currentStep > 1 && (
              <Button variant="outline" onClick={handlePrev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Anterior
              </Button>
            )}
            
            {currentStep < STEPS.length ? (
              <Button onClick={handleNext}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button 
                onClick={handleComplete}
                disabled={!acceptedTerms}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Entendi minhas obrigações
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============= STEP COMPONENTS =============

const Step1DocumentTypes: React.FC<{
  relevantDocTypes: DocumentType[];
  selectedDocType: DocumentType;
  onSelectDocType: (dt: DocumentType) => void;
  userRole: string;
}> = ({ relevantDocTypes, selectedDocType, onSelectDocType, userRole }) => {
  const roleLabels: Record<string, string> = {
    PRODUTOR: 'Produtor Rural',
    MOTORISTA: 'Motorista',
    PRESTADOR_SERVICOS: 'Prestador de Serviços',
    TRANSPORTADORA: 'Transportadora',
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Entenda os Tipos de Documento</h3>
        <p className="text-muted-foreground">
          Como <strong>{roleLabels[userRole] || 'usuário'}</strong>, você pode precisar emitir os seguintes documentos fiscais:
        </p>
      </div>

      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          Clique em cada documento para ver mais detalhes sobre quando e como usar.
        </AlertDescription>
      </Alert>

      <div className="grid gap-3 md:grid-cols-2">
        {relevantDocTypes.map((docType) => (
          <DocumentGuideCard
            key={docType}
            docType={docType}
            isSelected={selectedDocType === docType}
            onClick={() => onSelectDocType(docType)}
          />
        ))}
      </div>

      {selectedDocType && (
        <Card className="mt-4">
          <CardContent className="p-4">
            <DocumentGuideCard docType={selectedDocType} showFullInfo />
          </CardContent>
        </Card>
      )}
    </div>
  );
};

const Step2MinimumRegistration: React.FC = () => {
  const items = [
    {
      title: 'CNPJ ou CPF Ativo',
      description: 'Seu documento deve estar ativo e regular na Receita Federal.',
      icon: CheckCircle,
      link: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp',
      linkLabel: 'Consultar CNPJ',
    },
    {
      title: 'Endereço Completo',
      description: 'Logradouro, número, bairro, cidade, UF e CEP. O código IBGE da cidade é preenchido automaticamente.',
      icon: MapPin,
    },
    {
      title: 'CNAE Compatível',
      description: 'O código de atividade econômica deve ser compatível com o que você faz.',
      icon: Building2,
      link: 'https://cnae.ibge.gov.br/',
      linkLabel: 'Consultar CNAE',
    },
    {
      title: 'Regime Tributário',
      description: 'MEI, Simples Nacional, Lucro Presumido, etc. Cada regime tem regras específicas.',
      icon: FileText,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Seu Cadastro Mínimo</h3>
        <p className="text-muted-foreground">
          Antes de emitir qualquer documento fiscal, você precisa ter os seguintes dados cadastrados:
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => (
          <Card key={idx}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h4 className="font-medium">{item.title}</h4>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                  {item.link && (
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="px-0 h-auto mt-1"
                      onClick={() => window.open(item.link, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      {item.linkLabel}
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert className="border-yellow-500/30 bg-yellow-500/5">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription>
          <strong>⚠️ Atenção MEI:</strong> MEI <strong>não é obrigado</strong> a emitir NF-e. 
          Conforme orientação da SEFAZ-MT, MEI pode emitir <strong>NF-a (Nota Fiscal Avulsa)</strong> diretamente no portal da SEFAZ.
          A emissão de NF-e por MEI é voluntária e depende de Inscrição Estadual (IE) ativa + credenciamento específico.
        </AlertDescription>
      </Alert>
    </div>
  );
};

const Step3Certificate: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Certificado Digital A1</h3>
        <p className="text-muted-foreground">
          Para emitir documentos fiscais em produção (NF-e, CT-e, MDF-e), você precisa de um certificado digital.
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            O que é o Certificado A1?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm">
            O certificado digital A1 é um arquivo com extensão <code className="bg-muted px-1 rounded">.pfx</code> ou{' '}
            <code className="bg-muted px-1 rounded">.p12</code> que funciona como sua assinatura digital.
            Ele garante que a SEFAZ saiba que você é realmente quem está emitindo o documento.
          </p>
          
          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-3 rounded-lg border bg-background">
              <h5 className="font-medium mb-1">✅ O que precisa</h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Arquivo .pfx ou .p12</li>
                <li>• Senha do certificado</li>
                <li>• Validade de 1 ano</li>
                <li>• Mesmo CNPJ/CPF do emissor</li>
              </ul>
            </div>
            <div className="p-3 rounded-lg border bg-background">
              <h5 className="font-medium mb-1">🏢 Onde comprar</h5>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Serasa Experian</li>
                <li>• Certisign</li>
                <li>• Soluti</li>
                <li>• Valid Certificadora</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Por que pedimos isso?</strong> A SEFAZ exige assinatura digital em todos os documentos fiscais eletrônicos.
          Sem o certificado, a transmissão é rejeitada.
        </AlertDescription>
      </Alert>

      <div className="flex justify-center">
        <Button variant="outline" onClick={() => window.open('https://www.iti.gov.br/icp-brasil/estrutura', '_blank')}>
          <ExternalLink className="h-4 w-4 mr-2" />
          Lista de Certificadoras Credenciadas
        </Button>
      </div>
    </div>
  );
};

const Step4StateRegistration: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Inscrição Estadual + Credenciamento</h3>
        <p className="text-muted-foreground">
          Além do certificado, a maioria dos estados exige Inscrição Estadual (IE) e credenciamento específico na SEFAZ.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Inscrição Estadual (IE)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              É o cadastro da sua empresa/propriedade junto à Secretaria da Fazenda do seu estado.
              Identifica você como contribuinte de ICMS.
            </p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('http://www.sintegra.gov.br/', '_blank')}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Consultar no SINTEGRA
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Credenciamento SEFAZ</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">
              É uma habilitação adicional para emitir documentos fiscais eletrônicos.
              Sem ela, a SEFAZ pode rejeitar suas notas (ex: erro 230).
            </p>
            <Badge variant="outline" className="bg-yellow-100 text-yellow-700">
              Varia por estado
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Alert className="border-red-500/30 bg-red-500/5">
        <XCircle className="h-4 w-4 text-red-600" />
        <AlertDescription>
          <strong>Atenção para MT (Mato Grosso):</strong> O estado costuma exigir credenciamento específico.
          Verifique seu status no portal da SEFAZ-MT antes de tentar emitir.
        </AlertDescription>
      </Alert>

      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h5 className="font-medium mb-2">O que acontece sem credenciamento?</h5>
          <p className="text-sm text-muted-foreground">
            A SEFAZ rejeita a nota fiscal com erros como "Emitente não credenciado para emissão de NF-e" 
            ou códigos específicos como 203, 230, 234 etc. É preciso resolver a situação antes de emitir.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const Step5StateValidation: React.FC<{
  selectedDocType: DocumentType;
  selectedUf: string;
  onUfChange: (uf: string) => void;
}> = ({ selectedDocType, selectedUf, onUfChange }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Validação por Estado</h3>
        <p className="text-muted-foreground">
          Cada estado pode ter requisitos específicos. Selecione seu estado e tipo de documento para ver o checklist:
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Tipo de Documento</label>
          <Select value={selectedDocType} disabled>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={selectedDocType}>
                {getDocumentInfo(selectedDocType).name}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Estado (UF)</label>
          <Select value={selectedUf} onValueChange={onUfChange}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {BRAZILIAN_UFS.map(({ uf, name }) => (
                <SelectItem key={uf} value={uf}>
                  {uf} - {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <StateChecklist 
        docType={selectedDocType}
        uf={selectedUf}
        showUfSelector={false}
      />
    </div>
  );
};

const Step6Summary: React.FC<{
  acceptedTerms: boolean;
  onAcceptTerms: (v: boolean) => void;
}> = ({ acceptedTerms, onAcceptTerms }) => {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-2">Resumo e Confirmação</h3>
        <p className="text-muted-foreground">
          Você completou o guia fiscal! Agora você sabe o que é necessário para emitir documentos fiscais.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-medium">Tipos de Documento</h4>
            <p className="text-xs text-muted-foreground">Você sabe o que é cada documento</p>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 text-center">
            <ShieldCheck className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-medium">Certificado A1</h4>
            <p className="text-xs text-muted-foreground">Você entende a importância</p>
          </CardContent>
        </Card>
        
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 text-center">
            <MapPin className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <h4 className="font-medium">Requisitos do Estado</h4>
            <p className="text-xs text-muted-foreground">Você viu o checklist</p>
          </CardContent>
        </Card>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Lembre-se: antes de emitir qualquer documento, verifique se todos os requisitos obrigatórios estão atendidos.
          O sistema irá alertá-lo caso algo esteja faltando.
        </AlertDescription>
      </Alert>

      {/* Aceite Jurídico Obrigatório */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 space-y-4">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Declaração de Responsabilidade Fiscal
          </h4>
          
          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
            <p className="italic">
              "Declaro que estou ciente das obrigações fiscais exigidas pela SEFAZ do meu estado, 
              que sou responsável pela regularidade do meu cadastro e que entendo que a negativa 
              de emissão por parte do fisco não caracteriza falha do sistema."
            </p>
          </div>
          
          <div className="flex items-start gap-3 pt-2">
            <Checkbox 
              id="accept-terms"
              checked={acceptedTerms}
              onCheckedChange={(checked) => onAcceptTerms(checked === true)}
            />
            <label htmlFor="accept-terms" className="text-sm cursor-pointer leading-relaxed">
              <strong>Confirmo que li e aceito a declaração acima.</strong> Estou ciente de que devo 
              verificar meu credenciamento na SEFAZ, ter um certificado A1 válido e manter meus 
              dados cadastrais atualizados antes de emitir documentos fiscais eletrônicos. 
              Entendo que o AgriRoute atua como <strong>apoio operacional</strong> e não executa 
              atos fiscais automatizados.
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="text-center bg-muted/30 p-4 rounded-lg">
        <p className="text-sm text-muted-foreground mb-3">
          Dúvidas sobre sua situação fiscal? Nossa equipe pode ajudar.
        </p>
        <SupportButton 
          context={{ screen: 'Wizard Fiscal - Resumo' }} 
          variant="default"
          size="default"
        />
      </div>
    </div>
  );
};

export default FiscalEducationWizard;

// Helper para verificar se wizard já foi completado
export function hasCompletedFiscalWizard(): boolean {
  try {
    const data = localStorage.getItem(WIZARD_STORAGE_KEY);
    if (!data) return false;
    const parsed = JSON.parse(data);
    return parsed.completed === true;
  } catch {
    return false;
  }
}

export function resetFiscalWizard(): void {
  localStorage.removeItem(WIZARD_STORAGE_KEY);
}
