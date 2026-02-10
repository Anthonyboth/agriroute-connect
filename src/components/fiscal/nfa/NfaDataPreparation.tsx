import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Copy, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export interface NfaFormData {
  recipientName: string;
  recipientDoc: string;
  description: string;
  amount: string;
  observations: string;
}

interface NfaDataPreparationProps {
  formData: NfaFormData;
  onChange: (data: NfaFormData) => void;
}

export const NfaDataPreparation: React.FC<NfaDataPreparationProps> = ({ formData, onChange }) => {
  const handleChange = (field: keyof NfaFormData, value: string) => {
    onChange({ ...formData, [field]: value });
  };

  const handleCopyAll = () => {
    const text = [
      `Destinatário: ${formData.recipientName}`,
      `CPF/CNPJ: ${formData.recipientDoc}`,
      `Descrição: ${formData.description}`,
      `Valor: R$ ${formData.amount}`,
      formData.observations ? `Observações: ${formData.observations}` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      toast.success('Dados copiados! Cole no portal SEFAZ.');
    }).catch(() => {
      toast.error('Erro ao copiar. Copie manualmente.');
    });
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados da Nota Fiscal Avulsa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Preencha aqui os dados que você vai usar no portal SEFAZ. Depois, use o botão "Copiar" para facilitar.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nfa-recipient">Nome do Destinatário</Label>
              <Input
                id="nfa-recipient"
                placeholder="Ex: Fazenda São João Ltda"
                value={formData.recipientName}
                onChange={(e) => handleChange('recipientName', e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nfa-doc">CPF ou CNPJ do Destinatário</Label>
              <Input
                id="nfa-doc"
                placeholder="Ex: 12.345.678/0001-90"
                value={formData.recipientDoc}
                onChange={(e) => handleChange('recipientDoc', e.target.value)}
                maxLength={18}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="nfa-desc">Descrição do Produto/Serviço</Label>
            <Textarea
              id="nfa-desc"
              placeholder="Ex: Serviço de borracharia - troca de pneu dianteiro"
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nfa-amount">Valor Total (R$)</Label>
            <Input
              id="nfa-amount"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              value={formData.amount}
              onChange={(e) => handleChange('amount', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nfa-obs">Observações (opcional)</Label>
            <Textarea
              id="nfa-obs"
              placeholder="Ex: Referente ao frete #1234"
              value={formData.observations}
              onChange={(e) => handleChange('observations', e.target.value)}
              maxLength={300}
              rows={2}
            />
          </div>

          <Button onClick={handleCopyAll} className="w-full" variant="secondary">
            <Copy className="h-4 w-4 mr-2" />
            Copiar Todos os Dados
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
