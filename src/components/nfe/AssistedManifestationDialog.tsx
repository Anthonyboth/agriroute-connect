import { useState } from 'react';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { SEFAZ_LINKS, type AssistedManifestationType } from '@/types/compliance';
import { MANIFESTATION_OPTIONS } from '@/types/nfe';
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
} from 'lucide-react';

interface AssistedManifestationDialogProps {
  open: boolean;
  onClose: () => void;
  nfeAccessKey: string;
  freightId?: string;
  onSuccess: () => void;
}

type Step = 'intro' | 'copy' | 'portal' | 'type' | 'confirm';

const STEP_ORDER: Step[] = ['intro', 'copy', 'portal', 'type', 'confirm'];

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
  const [copied, setCopied] = useState(false);
  const [portalOpened, setPortalOpened] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const currentStepIndex = STEP_ORDER.indexOf(currentStep);

  const resetState = () => {
    setCurrentStep('intro');
    setManifestationType('ciencia');
    setCopied(false);
    setPortalOpened(false);
    setConfirmed(false);
    setLoading(false);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const goNext = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEP_ORDER.length) {
      setCurrentStep(STEP_ORDER[nextIndex]);
    }
  };

  const goBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEP_ORDER[prevIndex]);
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
          user_declaration_at: new Date().toISOString(),
        })
        .eq('access_key', nfeAccessKey);

      if (updateError) throw updateError;

      // Log the action
      await supabase.from('fiscal_compliance_logs').insert({
        user_id: user.id,
        action_type: 'manifestation_declared',
        nfe_access_key: nfeAccessKey,
        freight_id: freightId,
        metadata: { 
          manifestation_type: manifestationType,
          manifestation_mode: 'assisted',
        },
      });

      toast({
        title: 'Manifestação registrada!',
        description: 'O status da NF-e foi atualizado com sucesso.',
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

  const renderStep = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Importante:</strong> A manifestação será feita por você diretamente no 
                Portal Nacional da NF-e. O AgriRoute apenas auxilia no processo.
              </AlertDescription>
            </Alert>
            
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-medium">O que é a Manifestação Assistida?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Você será direcionado ao portal oficial da SEFAZ</li>
                <li>• A manifestação é feita com seu login gov.br ou certificado</li>
                <li>• O AgriRoute registra que você realizou a manifestação</li>
                <li>• Nenhum dado fiscal é transmitido pelo app</li>
              </ul>
            </div>
          </div>
        );

      case 'copy':
        return (
          <div className="space-y-4">
            <Label>Chave de Acesso da NF-e</Label>
            <div className="bg-muted p-4 rounded-lg font-mono text-sm break-all">
              {formatAccessKey(nfeAccessKey)}
            </div>
            <Button 
              onClick={copyToClipboard} 
              variant={copied ? 'secondary' : 'default'}
              className="w-full"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copied ? 'Chave Copiada!' : 'Copiar Chave'}
            </Button>
            {copied && (
              <p className="text-sm text-success text-center">
                ✓ Chave copiada para a área de transferência
              </p>
            )}
          </div>
        );

      case 'portal':
        return (
          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <h4 className="font-medium">Passos no Portal da SEFAZ:</h4>
              <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                <li>Faça login com gov.br ou certificado digital</li>
                <li>Cole a chave da NF-e no campo indicado</li>
                <li>Escolha o tipo de manifestação desejado</li>
                <li>Confirme a operação no portal</li>
              </ol>
            </div>
            
            <Button 
              onClick={openPortal} 
              variant={portalOpened ? 'secondary' : 'default'}
              className="w-full"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {portalOpened ? 'Portal Aberto' : 'Abrir Portal da SEFAZ'}
            </Button>
            
            {portalOpened && (
              <p className="text-sm text-muted-foreground text-center">
                O portal foi aberto em uma nova aba. Realize a manifestação e volte aqui.
              </p>
            )}
          </div>
        );

      case 'type':
        return (
          <div className="space-y-4">
            <Label>Qual tipo de manifestação você realizou?</Label>
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
                    className={`flex items-start space-x-3 p-3 rounded-lg border transition-colors ${
                      manifestationType === option.value 
                        ? 'border-primary bg-primary/5' 
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor={option.value} className="flex items-center gap-2 cursor-pointer">
                        <Icon className={`h-4 w-4 ${option.color}`} />
                        <span className="font-medium">{option.label}</span>
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {option.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
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
              <p><strong>Chave:</strong> {nfeAccessKey.slice(0, 20)}...</p>
              <p><strong>Tipo:</strong> {MANIFESTATION_OPTIONS.find(o => o.value === manifestationType)?.label}</p>
            </div>

            <div className="flex items-start space-x-2 p-3 border rounded-lg">
              <Checkbox 
                id="confirm-manifestation" 
                checked={confirmed}
                onCheckedChange={(checked) => setConfirmed(checked === true)}
              />
              <label htmlFor="confirm-manifestation" className="text-sm cursor-pointer">
                Confirmo que realizei a manifestação da NF-e no Portal Nacional da NF-e e 
                estou ciente da minha responsabilidade fiscal.
              </label>
            </div>
          </div>
        );
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 'intro': return true;
      case 'copy': return copied;
      case 'portal': return portalOpened;
      case 'type': return !!manifestationType;
      case 'confirm': return confirmed;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Manifestação Assistida
          </DialogTitle>
          <DialogDescription>
            Etapa {currentStepIndex + 1} de {STEP_ORDER.length}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1">
          {STEP_ORDER.map((_, index) => (
            <div 
              key={index}
              className={`h-1 flex-1 rounded-full transition-colors ${
                index <= currentStepIndex ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

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
  );
}
