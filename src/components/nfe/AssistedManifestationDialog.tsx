import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useFiscalResponsibility } from '@/hooks/useFiscalResponsibility';
import { FiscalResponsibilityModal } from '@/components/legal/FiscalResponsibilityModal';
import { SEFAZ_LINKS, type AssistedManifestationType } from '@/types/compliance';
import { MANIFESTATION_OPTIONS, ManifestationType } from '@/types/nfe';
import { 
  Copy, 
  ExternalLink, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  HelpCircle,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Shield,
  Clock,
  FileText,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AssistedManifestationDialogProps {
  open: boolean;
  onClose: () => void;
  nfeAccessKey: string;
  freightId?: string;
  onSuccess: () => void;
}

type Step = 'responsibility' | 'intro' | 'copy' | 'portal' | 'type' | 'justification' | 'confirm';

const STEP_ORDER: Step[] = ['responsibility', 'intro', 'copy', 'portal', 'type', 'justification', 'confirm'];

const manifestationIcons = {
  ciencia: Eye,
  confirmacao: CheckCircle,
  desconhecimento: HelpCircle,
  nao_realizada: XCircle,
};

export function AssistedManifestationDialog({
  open,
  onClose,
  nfeAccessKey,
  freightId,
  onSuccess,
}: AssistedManifestationDialogProps) {
  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [manifestationType, setManifestationType] = useState<AssistedManifestationType>('ciencia');
  const [justification, setJustification] = useState('');
  const [copied, setCopied] = useState(false);
  const [portalOpened, setPortalOpened] = useState(false);
  const [portalOpenedAt, setPortalOpenedAt] = useState<Date | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFiscalModal, setShowFiscalModal] = useState(false);
  const { toast } = useToast();

  const { accepted: fiscalAccepted, loading: fiscalLoading, acceptTerm } = useFiscalResponsibility();

  // Verificar se o termo fiscal foi aceito ao abrir
  useEffect(() => {
    if (open && !fiscalLoading && !fiscalAccepted) {
      setShowFiscalModal(true);
    }
  }, [open, fiscalLoading, fiscalAccepted]);

  // Get step index (skip responsibility if already accepted)
  const getActiveSteps = (): Step[] => {
    if (fiscalAccepted) {
      return STEP_ORDER.filter(s => s !== 'responsibility');
    }
    return STEP_ORDER;
  };

  const activeSteps = getActiveSteps();
  const currentStepIndex = activeSteps.indexOf(currentStep);

  // Check if justification is required
  const selectedOption = MANIFESTATION_OPTIONS.find(o => o.value === manifestationType);
  const requiresJustification = selectedOption?.requiresJustification || false;

  const resetState = () => {
    setCurrentStep(fiscalAccepted ? 'intro' : 'responsibility');
    setManifestationType('ciencia');
    setJustification('');
    setCopied(false);
    setPortalOpened(false);
    setPortalOpenedAt(null);
    setConfirmed(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFiscalAccept = async () => {
    const success = await acceptTerm();
    if (success) {
      setShowFiscalModal(false);
      setCurrentStep('intro');
    }
  };

  const goNext = () => {
    let nextStep = activeSteps[currentStepIndex + 1];
    
    // Skip justification step if not required
    if (nextStep === 'justification' && !requiresJustification) {
      nextStep = 'confirm';
    }
    
    if (nextStep) {
      setCurrentStep(nextStep);
    }
  };

  const goBack = () => {
    let prevStep = activeSteps[currentStepIndex - 1];
    
    // Skip justification step if not required
    if (prevStep === 'justification' && !requiresJustification) {
      prevStep = 'type';
    }
    
    if (prevStep) {
      setCurrentStep(prevStep);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(nfeAccessKey);
      setCopied(true);
      toast({
        title: 'Chave copiada!',
        description: 'A chave da NF-e foi copiada para a área de transferência.',
      });
      
      // Log action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('fiscal_compliance_logs').insert({
          user_id: user.id,
          action_type: 'nfe_key_copied',
          nfe_access_key: nfeAccessKey,
          freight_id: freightId,
        });
      }
    } catch (error) {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar a chave. Copie manualmente.',
        variant: 'destructive',
      });
    }
  };

  const openPortal = async () => {
    window.open(SEFAZ_LINKS.manifestacao, '_blank');
    setPortalOpened(true);
    setPortalOpenedAt(new Date());
    
    // Log action and update database
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('fiscal_compliance_logs').insert({
        user_id: user.id,
        action_type: 'portal_redirect',
        nfe_access_key: nfeAccessKey,
        freight_id: freightId,
        metadata: { portal_url: SEFAZ_LINKS.manifestacao },
      });

      // Update NFe document with redirect timestamp
      await supabase
        .from('nfe_documents')
        .update({ portal_redirect_at: new Date().toISOString() })
        .eq('access_key', nfeAccessKey);
    }
  };

  const handleConfirmManifestation = async () => {
    if (!confirmed) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      // Update NFe document status
      const { error: updateError } = await supabase
        .from('nfe_documents')
        .update({
          status: 'manifested',
          manifestation_type: manifestationType,
          manifestation_date: new Date().toISOString(),
          manifestation_mode: 'assisted',
          manifestation_justification: justification || null,
          user_declaration_at: new Date().toISOString(),
        })
        .eq('access_key', nfeAccessKey);

      if (updateError) throw updateError;

      // Log the action with full audit trail
      await supabase.from('fiscal_compliance_logs').insert({
        user_id: user.id,
        action_type: 'manifestation_declared',
        nfe_access_key: nfeAccessKey,
        freight_id: freightId,
        metadata: { 
          manifestation_type: manifestationType,
          manifestation_mode: 'assisted',
          justification: justification || null,
          portal_opened_at: portalOpenedAt?.toISOString(),
          sefaz_event_code: selectedOption?.sefazCode,
        },
      });

      toast({
        title: 'Manifestação registrada!',
        description: `${selectedOption?.label} registrada com sucesso.`,
      });

      handleClose();
      onSuccess();
    } catch (error) {
      console.error('[MANIFESTATION] Error:', error);
      toast({
        title: 'Erro ao registrar',
        description: 'Não foi possível registrar a manifestação. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatAccessKey = (key: string) => {
    return key.replace(/(.{4})/g, '$1 ').trim();
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 'responsibility': return fiscalAccepted;
      case 'intro': return true;
      case 'copy': return copied;
      case 'portal': return portalOpened;
      case 'type': return !!manifestationType;
      case 'justification': return !requiresJustification || justification.trim().length >= 15;
      case 'confirm': return confirmed;
      default: return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'responsibility':
        return (
          <div className="space-y-4">
            <Alert variant="default" className="bg-primary/5 border-primary/20">
              <Shield className="h-4 w-4 text-primary" />
              <AlertDescription>
                <strong>Termo de Responsabilidade:</strong> Antes de continuar, 
                você precisa aceitar o termo de responsabilidade fiscal.
              </AlertDescription>
            </Alert>
            <Button onClick={() => setShowFiscalModal(true)} className="w-full">
              <Shield className="h-4 w-4 mr-2" />
              Ver e Aceitar Termo
            </Button>
          </div>
        );

      case 'intro':
        return (
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Manifestação Assistida:</strong> Você realizará a manifestação 
                diretamente no Portal Nacional da NF-e. O AgriRoute apenas auxilia no processo.
              </AlertDescription>
            </Alert>
            
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Como funciona?
              </h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Copie a chave de acesso da NF-e</li>
                <li>Acesse o Portal Nacional da NF-e (SEFAZ)</li>
                <li>Faça login com gov.br ou certificado digital</li>
                <li>Realize a manifestação no portal</li>
                <li>Volte aqui e confirme a operação</li>
              </ol>
            </div>

            <Alert variant="default" className="bg-warning/10 border-warning/20">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-sm">
                Nenhum certificado digital, senha ou dado fiscal será 
                armazenado ou transmitido pelo AgriRoute.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'copy':
        return (
          <div className="space-y-4">
            <Label>Chave de Acesso da NF-e (44 dígitos)</Label>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm break-all border">
              {formatAccessKey(nfeAccessKey)}
            </div>
            <Button 
              onClick={copyToClipboard} 
              variant={copied ? 'secondary' : 'default'}
              className="w-full"
              size="lg"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? '✓ Chave Copiada!' : 'Copiar Chave de Acesso'}
            </Button>
            {copied && (
              <p className="text-sm text-success text-center flex items-center justify-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Chave copiada para a área de transferência
              </p>
            )}
          </div>
        );

      case 'portal':
        return (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-medium">No Portal da SEFAZ, você deve:</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Fazer login com gov.br ou certificado digital</li>
                <li>Acessar "Manifestação do Destinatário"</li>
                <li>Colar a chave da NF-e copiada</li>
                <li>Escolher o tipo de manifestação</li>
                <li>Confirmar a operação</li>
              </ol>
            </div>
            
            <Button 
              onClick={openPortal} 
              variant={portalOpened ? 'secondary' : 'default'}
              className="w-full"
              size="lg"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {portalOpened ? '✓ Portal Aberto' : 'Abrir Portal Nacional da NF-e'}
            </Button>
            
            {portalOpened && (
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  O portal foi aberto em uma nova aba.
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Clock className="h-3 w-3" />
                  Realize a manifestação e volte aqui para confirmar.
                </p>
              </div>
            )}
          </div>
        );

      case 'type':
        return (
          <div className="space-y-4">
            <Label>Qual manifestação você realizou no portal?</Label>
            <RadioGroup 
              value={manifestationType} 
              onValueChange={(v) => setManifestationType(v as AssistedManifestationType)}
              className="space-y-3"
            >
              {MANIFESTATION_OPTIONS.map((option) => {
                const Icon = manifestationIcons[option.value];
                return (
                  <div 
                    key={option.value}
                    className={cn(
                      "flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer",
                      manifestationType === option.value 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                    )}
                    onClick={() => setManifestationType(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={option.value} className="flex items-center gap-2 cursor-pointer">
                        <Icon className={cn("h-4 w-4", option.color)} />
                        <span className="font-medium">{option.label}</span>
                        <span className="text-xs text-muted-foreground">({option.sefazCode})</span>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                      {option.requiresJustification && (
                        <p className="text-xs text-warning mt-1">
                          ⚠️ Requer justificativa
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>
        );

      case 'justification':
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="justification">
                Justificativa (obrigatória para {selectedOption?.label})
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                Informe o motivo da manifestação. Mínimo 15 caracteres.
              </p>
            </div>
            <Textarea
              id="justification"
              placeholder="Descreva o motivo da manifestação..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="min-h-[100px]"
            />
            <div className="flex justify-between text-xs">
              <span className={cn(
                justification.length < 15 ? 'text-warning' : 'text-success'
              )}>
                {justification.length < 15 
                  ? `Faltam ${15 - justification.length} caracteres` 
                  : '✓ Justificativa válida'}
              </span>
              <span className="text-muted-foreground">{justification.length} caracteres</span>
            </div>
          </div>
        );

      case 'confirm':
        return (
          <div className="space-y-4">
            <Alert variant="default" className="bg-success/10 border-success/20">
              <CheckCircle className="h-4 w-4 text-success" />
              <AlertDescription>
                Confirme que você realizou a manifestação no portal oficial da SEFAZ.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chave:</span>
                <span className="font-mono">{nfeAccessKey.slice(0, 20)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo:</span>
                <span className="font-medium">{selectedOption?.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Código SEFAZ:</span>
                <span className="font-mono">{selectedOption?.sefazCode}</span>
              </div>
              {justification && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">Justificativa:</span>
                  <p className="text-sm mt-1">{justification}</p>
                </div>
              )}
            </div>

            <div className="flex items-start space-x-2 p-3 border rounded-lg">
              <Checkbox 
                id="confirm-manifestation" 
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <label htmlFor="confirm-manifestation" className="text-sm cursor-pointer leading-relaxed">
                Confirmo que realizei a manifestação <strong>{selectedOption?.label}</strong> no 
                Portal Nacional da NF-e e estou ciente da minha responsabilidade fiscal 
                conforme o termo aceito anteriormente.
              </label>
            </div>
          </div>
        );
    }
  };

  // Calculate progress
  const progressPercent = ((currentStepIndex + 1) / activeSteps.length) * 100;

  return (
    <>
      <Dialog open={open && !showFiscalModal} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-primary" />
              Manifestação Assistida
            </DialogTitle>
            <DialogDescription>
              Etapa {currentStepIndex + 1} de {activeSteps.length}
            </DialogDescription>
          </DialogHeader>

          {/* Progress bar */}
          <Progress value={progressPercent} className="h-1" />

          <div className="py-4">
            {renderStep()}
          </div>

          <div className="flex justify-between gap-2">
            {currentStepIndex > 0 ? (
              <Button variant="outline" onClick={goBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            ) : (
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
            )}

            {currentStep === 'confirm' ? (
              <Button 
                onClick={handleConfirmManifestation}
                disabled={!canProceed() || loading}
              >
                {loading ? 'Registrando...' : 'Confirmar Manifestação'}
              </Button>
            ) : (
              <Button onClick={goNext} disabled={!canProceed()}>
                Próximo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Fiscal Responsibility Modal */}
      <FiscalResponsibilityModal
        open={showFiscalModal}
        onAccept={handleFiscalAccept}
        loading={fiscalLoading}
      />
    </>
  );
}
