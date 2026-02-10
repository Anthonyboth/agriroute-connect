import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { WizardShell } from '@/components/wizard/WizardShell';
import { WizardProgress } from '@/components/wizard/WizardProgress';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  ExternalLink,
  Key,
  Loader2,
} from 'lucide-react';
import { NfaDataPreparation, type NfaFormData } from './NfaDataPreparation';
import { NfaPortalInstructions } from './NfaPortalInstructions';
import { NfaConfirmation } from './NfaConfirmation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const STEPS = [
  { id: 1, title: 'Acesso SEFAZ' },
  { id: 2, title: 'Dados da Nota' },
  { id: 3, title: 'Emitir no Portal' },
  { id: 4, title: 'Confirmar' },
];

const SEFAZ_SENHA_URL = 'https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811';

interface NfaAssistedWizardProps {
  isOpen: boolean;
  onClose: () => void;
  freightId?: string;
}

export const NfaAssistedWizard: React.FC<NfaAssistedWizardProps> = ({
  isOpen,
  onClose,
  freightId,
}) => {
  const [step, setStep] = useState(1);
  const [hasSefazPassword, setHasSefazPassword] = useState<'sim' | 'nao' | null>(null);
  const [formData, setFormData] = useState<NfaFormData>({
    recipientName: '',
    recipientDoc: '',
    description: '',
    amount: '',
    observations: '',
  });
  const [accessKey, setAccessKey] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const canAdvance = (): boolean => {
    switch (step) {
      case 1:
        return hasSefazPassword === 'sim';
      case 2:
        return !!(formData.recipientName && formData.recipientDoc && formData.description && formData.amount);
      case 3:
        return true;
      case 4:
        return accessKey.replace(/\s/g, '').length === 44;
      default:
        return false;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Get profile id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Upload PDF if provided
      let pdfUrl: string | null = null;
      if (pdfFile) {
        const filePath = `nfa/${profile.id}/${Date.now()}_${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, pdfFile);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);
          pdfUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase
        .from('nfa_documents' as any)
        .insert({
          user_id: profile.id,
          freight_id: freightId || null,
          access_key: accessKey,
          status: 'confirmed',
          pdf_url: pdfUrl,
          recipient_name: formData.recipientName,
          recipient_doc: formData.recipientDoc,
          description: formData.description,
          amount: parseFloat(formData.amount) || 0,
          observations: formData.observations || null,
        });

      if (error) throw error;

      toast.success('NFA-e registrada com sucesso!');
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar NFA-e:', err);
      toast.error(err.message || 'Erro ao registrar NFA-e');
    } finally {
      setSaving(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4 p-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Label className="text-base font-medium">
            Você já tem senha de contribuinte na SEFAZ-MT?
          </Label>
          <p className="text-sm text-muted-foreground">
            Para emitir NFA-e (Nota Fiscal Avulsa), você precisa de login no sistema fazendário.
            O login é sua <strong>Inscrição Estadual (IE)</strong> e a senha é a <strong>senha de contribuinte</strong>.
          </p>

          <RadioGroup
            value={hasSefazPassword || ''}
            onValueChange={(v) => setHasSefazPassword(v as 'sim' | 'nao')}
            className="space-y-3"
          >
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="sim" id="sefaz-sim" />
              <Label htmlFor="sefaz-sim" className="cursor-pointer flex-1">
                <span className="font-medium">Sim, já tenho senha</span>
                <p className="text-xs text-muted-foreground">Posso acessar o portal SEFAZ-MT com minha IE + senha</p>
              </Label>
            </div>
            <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="nao" id="sefaz-nao" />
              <Label htmlFor="sefaz-nao" className="cursor-pointer flex-1">
                <span className="font-medium">Não, preciso criar minha senha</span>
                <p className="text-xs text-muted-foreground">Ainda não tenho acesso ao sistema fazendário</p>
              </Label>
            </div>
          </RadioGroup>

          {hasSefazPassword === 'nao' && (
            <Alert className="border-primary/30 bg-primary/5">
              <Key className="h-4 w-4" />
              <AlertDescription className="space-y-3">
                <p className="font-medium">Como criar sua senha de contribuinte:</p>
                <ol className="text-sm list-decimal list-inside space-y-1">
                  <li>Acesse o link abaixo e clique em <strong>"Solicitar Senha"</strong></li>
                  <li>Preencha seus dados (selecione <strong>"Contribuinte"</strong>)</li>
                  <li>Depois, clique em <strong>"Liberar Senha"</strong> para ativá-la</li>
                </ol>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => window.open(SEFAZ_SENHA_URL, '_blank')}
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Solicitar Senha SEFAZ-MT
                </Button>
                <p className="text-xs text-muted-foreground">
                  Após criar e liberar a senha, volte aqui e selecione "Sim, já tenho senha".
                </p>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1: return renderStep1();
      case 2: return <NfaDataPreparation formData={formData} onChange={setFormData} />;
      case 3: return <NfaPortalInstructions />;
      case 4: return (
        <NfaConfirmation
          accessKey={accessKey}
          onAccessKeyChange={setAccessKey}
          pdfFile={pdfFile}
          onPdfFileChange={setPdfFile}
          freightId={freightId}
        />
      );
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl h-[85vh] p-0 flex flex-col">
        <WizardShell
          header={
            <DialogHeader className="p-6 pb-4">
              <DialogTitle>Emissão Assistida de NFA-e</DialogTitle>
              <DialogDescription>
                Siga o passo a passo para emitir sua Nota Fiscal Avulsa no portal SEFAZ-MT
              </DialogDescription>
            </DialogHeader>
          }
          progress={
            <div className="px-6 py-3">
              <WizardProgress
                steps={STEPS}
                currentStep={step}
              />
            </div>
          }
          footer={
            <div className="flex justify-between items-center p-4">
              <Button
                variant="outline"
                onClick={() => step === 1 ? onClose() : setStep(step - 1)}
                disabled={saving}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                {step === 1 ? 'Cancelar' : 'Voltar'}
              </Button>

              {step < 4 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canAdvance()}>
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={!canAdvance() || saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  {saving ? 'Salvando...' : 'Confirmar e Registrar'}
                </Button>
              )}
            </div>
          }
        >
          {renderCurrentStep()}
        </WizardShell>
      </DialogContent>
    </Dialog>
  );
};
