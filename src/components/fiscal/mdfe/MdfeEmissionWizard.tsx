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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  FileSpreadsheet, 
  FileKey,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  Zap,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MdfeEmissionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalIssuer: any;
  freightId?: string;
}

export const MdfeEmissionWizard: React.FC<MdfeEmissionWizardProps> = ({
  isOpen,
  onClose,
  fiscalIssuer,
  freightId,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modo, setModo] = useState<'NORMAL' | 'CONTINGENCIA'>('CONTINGENCIA');
  const [documentos, setDocumentos] = useState<Array<{ tipo: string; chave: string }>>([
    { tipo: 'CTE', chave: '' }
  ]);

  const hasCertificate = !!fiscalIssuer?.certificate_uploaded_at;

  const handleAddDocumento = () => {
    if (documentos.length < 20) {
      setDocumentos([...documentos, { tipo: 'CTE', chave: '' }]);
    }
  };

  const handleRemoveDocumento = (index: number) => {
    if (documentos.length > 1) {
      setDocumentos(documentos.filter((_, i) => i !== index));
    }
  };

  const handleDocumentoChange = (index: number, field: 'tipo' | 'chave', value: string) => {
    const newDocs = [...documentos];
    if (field === 'chave') {
      newDocs[index][field] = value.replace(/\D/g, '').slice(0, 44);
    } else {
      newDocs[index][field] = value;
    }
    setDocumentos(newDocs);
  };

  const handleSubmit = async () => {
    if (!freightId) {
      toast.error('Frete não selecionado');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const docsValidos = documentos.filter(d => d.chave.length === 44);

      const payload = {
        freight_id: freightId,
        modo,
        documentos: docsValidos,
      };

      const { data, error } = await supabase.functions.invoke('mdfe-emitir', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('MDF-e emitido com sucesso!', {
          description: `Número: ${data.numero} | Chave: ${data.chave_acesso?.slice(-8) || ''}`,
        });
        onClose();
      } else {
        throw new Error(data?.error || data?.message || 'Erro ao emitir MDF-e');
      }
    } catch (error: any) {
      console.error('Erro ao emitir MDF-e:', error);
      toast.error('Erro ao emitir MDF-e', {
        description: error.message || 'Tente novamente',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setModo('CONTINGENCIA');
      setDocumentos([{ tipo: 'CTE', chave: '' }]);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-purple-600" />
            Emitir MDF-e
          </DialogTitle>
          <DialogDescription>
            Manifesto de Documentos Fiscais Eletrônico
          </DialogDescription>
        </DialogHeader>

        {!hasCertificate ? (
          <Alert className="border-yellow-500/50 bg-yellow-500/10">
            <FileKey className="h-4 w-4 text-yellow-600" />
            <AlertDescription>
              <p className="font-medium mb-2">Certificado Digital Necessário</p>
              <p className="text-sm">
                Para emitir MDF-e, é necessário fazer upload do seu certificado digital A1.
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
                Para emitir MDF-e, selecione um frete primeiro.
              </p>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Modo de Emissão</CardTitle>
              </CardHeader>
              <CardContent>
                <RadioGroup value={modo} onValueChange={(v) => setModo(v as 'NORMAL' | 'CONTINGENCIA')}>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="CONTINGENCIA" id="contingencia" />
                    <Label htmlFor="contingencia" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Zap className="h-4 w-4 text-yellow-600" />
                      <div>
                        <p className="font-medium">Contingência (FSDA)</p>
                        <p className="text-xs text-muted-foreground">
                          Gera documento imediato, transmite depois
                        </p>
                      </div>
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                    <RadioGroupItem value="NORMAL" id="normal" />
                    <Label htmlFor="normal" className="flex items-center gap-2 cursor-pointer flex-1">
                      <Shield className="h-4 w-4 text-green-600" />
                      <div>
                        <p className="font-medium">Normal</p>
                        <p className="text-xs text-muted-foreground">
                          Transmite imediatamente à SEFAZ
                        </p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Documentos Transportados</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Informe as chaves de acesso dos CT-e ou NF-e transportados
                </p>
                {documentos.map((doc, index) => (
                  <div key={index} className="flex gap-2">
                    <select
                      value={doc.tipo}
                      onChange={(e) => handleDocumentoChange(index, 'tipo', e.target.value)}
                      className="w-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="CTE">CT-e</option>
                      <option value="NFE">NF-e</option>
                    </select>
                    <Input
                      placeholder="Chave de acesso (44 dígitos)"
                      value={doc.chave}
                      onChange={(e) => handleDocumentoChange(index, 'chave', e.target.value)}
                      maxLength={44}
                      className="font-mono text-xs flex-1"
                    />
                    {documentos.length > 1 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleRemoveDocumento(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {documentos.length < 20 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddDocumento}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Documento
                  </Button>
                )}
              </CardContent>
            </Card>

            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <p className="text-sm">
                  Dados do veículo, condutor e percurso serão preenchidos automaticamente
                  a partir do cadastro do frete e veículo.
                </p>
              </AlertDescription>
            </Alert>
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
                'Emitir MDF-e'
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
