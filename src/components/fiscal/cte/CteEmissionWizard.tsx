import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Truck, 
  FileKey,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CteEmissionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalIssuer: any;
  freightId?: string;
}

export const CteEmissionWizard: React.FC<CteEmissionWizardProps> = ({
  isOpen,
  onClose,
  fiscalIssuer,
  freightId,
}) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nfeChaves, setNfeChaves] = useState<string[]>(['']);
  const [formData, setFormData] = useState({
    natureza_operacao: 'PRESTACAO DE SERVICO DE TRANSPORTE',
    cfop: '5353',
    valor_frete: '',
    observacoes: '',
  });

  const hasCertificate = !!fiscalIssuer?.certificate_uploaded_at;

  const handleAddNfeChave = () => {
    if (nfeChaves.length < 10) {
      setNfeChaves([...nfeChaves, '']);
    }
  };

  const handleRemoveNfeChave = (index: number) => {
    if (nfeChaves.length > 1) {
      setNfeChaves(nfeChaves.filter((_, i) => i !== index));
    }
  };

  const handleNfeChaveChange = (index: number, value: string) => {
    const newChaves = [...nfeChaves];
    newChaves[index] = value.replace(/\D/g, '').slice(0, 44);
    setNfeChaves(newChaves);
  };

  const handleSubmit = async () => {
    if (!fiscalIssuer?.id) {
      toast.error('Emissor fiscal não configurado');
      return;
    }

    if (!freightId) {
      toast.error('Frete não selecionado');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const chavesValidas = nfeChaves.filter(c => c.length === 44);

      const payload = {
        frete_id: freightId,
        empresa_id: fiscalIssuer.id,
        nfe_chaves: chavesValidas,
      };

      const { data, error } = await supabase.functions.invoke('cte-emitir', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('CT-e enviado para autorização!', {
          description: `Referência: ${data.referencia || 'Aguardando'}`,
        });
        onClose();
      } else {
        throw new Error(data?.error || data?.message || 'Erro ao emitir CT-e');
      }
    } catch (error: any) {
      console.error('Erro ao emitir CT-e:', error);
      toast.error('Erro ao emitir CT-e', {
        description: error.message || 'Tente novamente',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setStep(1);
      setNfeChaves(['']);
      setFormData({
        natureza_operacao: 'PRESTACAO DE SERVICO DE TRANSPORTE',
        cfop: '5353',
        valor_frete: '',
        observacoes: '',
      });
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-green-600" />
            Emitir CT-e
          </DialogTitle>
          <DialogDescription>
            Conhecimento de Transporte Eletrônico
          </DialogDescription>
        </DialogHeader>

        {!hasCertificate ? (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <FileKey className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <p className="font-medium mb-2">Certificado Digital Necessário</p>
              <p className="text-sm">
                Para emitir CT-e, é necessário fazer upload do seu certificado digital A1.
                Acesse a aba "Emissor" para configurar.
              </p>
            </AlertDescription>
          </Alert>
        ) : !freightId ? (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <p className="font-medium mb-2">Frete não selecionado</p>
              <p className="text-sm">
                Para emitir CT-e, selecione um frete primeiro.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {step === 1 && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Documentos Fiscais Referenciados</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Informe as chaves de acesso das NF-e transportadas (44 dígitos)
                    </p>
                    {nfeChaves.map((chave, index) => (
                      <div key={index} className="flex gap-2">
                        <Input
                          placeholder="Chave de acesso da NF-e (44 dígitos)"
                          value={chave}
                          onChange={(e) => handleNfeChaveChange(index, e.target.value)}
                          maxLength={44}
                          className="font-mono text-xs"
                        />
                        {nfeChaves.length > 1 && (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => handleRemoveNfeChave(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    {nfeChaves.length < 10 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddNfeChave}
                        className="w-full"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Adicionar NF-e
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Observações</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Textarea
                      placeholder="Observações adicionais (opcional)"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      rows={3}
                    />
                  </CardContent>
                </Card>

                <Alert>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <p className="text-sm">
                      Os dados do frete (origem, destino, motorista, veículo) serão preenchidos 
                      automaticamente a partir do cadastro do frete.
                    </p>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          {hasCertificate && freightId && (
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Emitindo...
                </>
              ) : (
                'Emitir CT-e'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
