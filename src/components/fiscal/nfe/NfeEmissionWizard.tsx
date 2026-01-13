import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, 
  ChevronRight, 
  ChevronLeft, 
  Check,
  Building2,
  Package,
  DollarSign,
  Send,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface NfeEmissionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalIssuer: any;
  freightId?: string;
}

const STEPS = [
  { id: 1, title: 'Destinatário', icon: Building2 },
  { id: 2, title: 'Itens/Serviços', icon: Package },
  { id: 3, title: 'Valores', icon: DollarSign },
  { id: 4, title: 'Enviar', icon: Send },
];

export const NfeEmissionWizard: React.FC<NfeEmissionWizardProps> = ({
  isOpen,
  onClose,
  fiscalIssuer,
  freightId,
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    // Destinatário
    dest_cnpj_cpf: '',
    dest_razao_social: '',
    dest_ie: '',
    dest_email: '',
    dest_telefone: '',
    dest_logradouro: '',
    dest_numero: '',
    dest_bairro: '',
    dest_municipio: '',
    dest_uf: '',
    dest_cep: '',
    
    // Itens
    descricao: '',
    ncm: '',
    cfop: '5102',
    unidade: 'UN',
    quantidade: '1',
    valor_unitario: '',
    
    // Valores
    valor_total: '',
    valor_frete: '0',
    valor_desconto: '0',
    informacoes_adicionais: '',
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Auto-calcular valor total
    if (field === 'quantidade' || field === 'valor_unitario') {
      const qty = parseFloat(field === 'quantidade' ? value : formData.quantidade) || 0;
      const unit = parseFloat(field === 'valor_unitario' ? value : formData.valor_unitario) || 0;
      setFormData(prev => ({ ...prev, valor_total: (qty * unit).toFixed(2) }));
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.dest_cnpj_cpf && formData.dest_razao_social;
      case 2:
        return formData.descricao && formData.valor_unitario;
      case 3:
        return formData.valor_total && parseFloat(formData.valor_total) > 0;
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!fiscalIssuer?.id) {
      toast.error('Emissor fiscal não configurado');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload = {
        issuer_id: fiscalIssuer.id,
        freight_id: freightId,
        destinatario: {
          cnpj_cpf: formData.dest_cnpj_cpf.replace(/\D/g, ''),
          razao_social: formData.dest_razao_social,
          ie: formData.dest_ie,
          email: formData.dest_email,
          telefone: formData.dest_telefone,
          endereco: {
            logradouro: formData.dest_logradouro,
            numero: formData.dest_numero,
            bairro: formData.dest_bairro,
            municipio: formData.dest_municipio,
            uf: formData.dest_uf,
            cep: formData.dest_cep?.replace(/\D/g, ''),
          },
        },
        itens: [{
          descricao: formData.descricao,
          ncm: formData.ncm,
          cfop: formData.cfop,
          unidade: formData.unidade,
          quantidade: parseFloat(formData.quantidade),
          valor_unitario: parseFloat(formData.valor_unitario),
        }],
        valores: {
          total: parseFloat(formData.valor_total),
          frete: parseFloat(formData.valor_frete) || 0,
          desconto: parseFloat(formData.valor_desconto) || 0,
        },
        informacoes_adicionais: formData.informacoes_adicionais,
      };

      const { data, error } = await supabase.functions.invoke('nfe-emitir', {
        body: payload,
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('NF-e enviada para autorização!', {
          description: `Número: ${data.numero || 'Aguardando'}`,
        });
        onClose();
      } else {
        throw new Error(data?.message || 'Erro ao emitir NF-e');
      }
    } catch (error: any) {
      console.error('Erro ao emitir NF-e:', error);
      toast.error('Erro ao emitir NF-e', {
        description: error.message || 'Tente novamente',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="dest_cnpj_cpf">CNPJ/CPF *</Label>
                <Input
                  id="dest_cnpj_cpf"
                  value={formData.dest_cnpj_cpf}
                  onChange={(e) => updateField('dest_cnpj_cpf', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div>
                <Label htmlFor="dest_razao_social">Razão Social *</Label>
                <Input
                  id="dest_razao_social"
                  value={formData.dest_razao_social}
                  onChange={(e) => updateField('dest_razao_social', e.target.value)}
                  placeholder="Nome da empresa"
                />
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="dest_ie">Inscrição Estadual</Label>
                <Input
                  id="dest_ie"
                  value={formData.dest_ie}
                  onChange={(e) => updateField('dest_ie', e.target.value)}
                  placeholder="Opcional"
                />
              </div>
              <div>
                <Label htmlFor="dest_email">E-mail</Label>
                <Input
                  id="dest_email"
                  type="email"
                  value={formData.dest_email}
                  onChange={(e) => updateField('dest_email', e.target.value)}
                  placeholder="email@empresa.com"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-2">
                <Label htmlFor="dest_logradouro">Logradouro</Label>
                <Input
                  id="dest_logradouro"
                  value={formData.dest_logradouro}
                  onChange={(e) => updateField('dest_logradouro', e.target.value)}
                  placeholder="Rua, Avenida..."
                />
              </div>
              <div>
                <Label htmlFor="dest_numero">Número</Label>
                <Input
                  id="dest_numero"
                  value={formData.dest_numero}
                  onChange={(e) => updateField('dest_numero', e.target.value)}
                  placeholder="123"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="dest_bairro">Bairro</Label>
                <Input
                  id="dest_bairro"
                  value={formData.dest_bairro}
                  onChange={(e) => updateField('dest_bairro', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dest_municipio">Município</Label>
                <Input
                  id="dest_municipio"
                  value={formData.dest_municipio}
                  onChange={(e) => updateField('dest_municipio', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dest_uf">UF</Label>
                <Input
                  id="dest_uf"
                  value={formData.dest_uf}
                  onChange={(e) => updateField('dest_uf', e.target.value.toUpperCase())}
                  maxLength={2}
                  placeholder="SP"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div>
              <Label htmlFor="descricao">Descrição do Serviço/Produto *</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => updateField('descricao', e.target.value)}
                placeholder="Descreva o serviço ou produto"
                rows={3}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="ncm">NCM</Label>
                <Input
                  id="ncm"
                  value={formData.ncm}
                  onChange={(e) => updateField('ncm', e.target.value)}
                  placeholder="00000000"
                />
              </div>
              <div>
                <Label htmlFor="cfop">CFOP</Label>
                <Input
                  id="cfop"
                  value={formData.cfop}
                  onChange={(e) => updateField('cfop', e.target.value)}
                  placeholder="5102"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <Label htmlFor="unidade">Unidade</Label>
                <Input
                  id="unidade"
                  value={formData.unidade}
                  onChange={(e) => updateField('unidade', e.target.value.toUpperCase())}
                  placeholder="UN"
                />
              </div>
              <div>
                <Label htmlFor="quantidade">Quantidade</Label>
                <Input
                  id="quantidade"
                  type="number"
                  value={formData.quantidade}
                  onChange={(e) => updateField('quantidade', e.target.value)}
                  min="1"
                />
              </div>
              <div>
                <Label htmlFor="valor_unitario">Valor Unitário *</Label>
                <Input
                  id="valor_unitario"
                  type="number"
                  step="0.01"
                  value={formData.valor_unitario}
                  onChange={(e) => updateField('valor_unitario', e.target.value)}
                  placeholder="0,00"
                />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-3xl font-bold text-primary">
                    R$ {parseFloat(formData.valor_total || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="valor_frete">Valor do Frete</Label>
                <Input
                  id="valor_frete"
                  type="number"
                  step="0.01"
                  value={formData.valor_frete}
                  onChange={(e) => updateField('valor_frete', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="valor_desconto">Desconto</Label>
                <Input
                  id="valor_desconto"
                  type="number"
                  step="0.01"
                  value={formData.valor_desconto}
                  onChange={(e) => updateField('valor_desconto', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="informacoes_adicionais">Informações Adicionais</Label>
              <Textarea
                id="informacoes_adicionais"
                value={formData.informacoes_adicionais}
                onChange={(e) => updateField('informacoes_adicionais', e.target.value)}
                placeholder="Observações que aparecerão na nota"
                rows={3}
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Send className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Pronto para Enviar</h3>
              <p className="text-muted-foreground">
                Revise os dados abaixo antes de enviar para a SEFAZ
              </p>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destinatário:</span>
                  <span className="font-medium">{formData.dest_razao_social}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CNPJ/CPF:</span>
                  <span className="font-mono">{formData.dest_cnpj_cpf}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Descrição:</span>
                  <span className="font-medium truncate max-w-[200px]">{formData.descricao}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor Total:</span>
                  <span className="font-bold text-primary">
                    R$ {parseFloat(formData.valor_total || '0').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">
                    Ambiente: {fiscalIssuer?.ambiente === 'producao' ? 'Produção' : 'Homologação'}
                  </p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    {fiscalIssuer?.ambiente === 'producao' 
                      ? 'Esta nota terá validade jurídica.' 
                      : 'Esta é uma nota de teste, sem validade fiscal.'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Emitir NF-e
          </DialogTitle>
          <DialogDescription>
            Siga os passos para emitir sua Nota Fiscal Eletrônica
          </DialogDescription>
        </DialogHeader>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-6">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = currentStep === step.id;
            const isCompleted = currentStep > step.id;
            
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div className={`
                    w-10 h-10 rounded-full flex items-center justify-center transition-colors
                    ${isCompleted 
                      ? 'bg-green-600 text-white' 
                      : isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-muted-foreground'}
                  `}>
                    {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className={`text-xs mt-1 ${isActive ? 'font-medium' : 'text-muted-foreground'}`}>
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${
                    currentStep > step.id ? 'bg-green-600' : 'bg-muted'
                  }`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step Content */}
        <div className="min-h-[300px]">
          {renderStepContent()}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : onClose()}
            disabled={isSubmitting}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {currentStep === 1 ? 'Cancelar' : 'Voltar'}
          </Button>
          
          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Enviar para SEFAZ
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
