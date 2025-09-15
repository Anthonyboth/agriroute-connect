import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProposalCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalProposal: {
    id: string;
    proposed_price: number;
    message?: string;
    driver_name: string;
  } | null;
  freightPrice: number;
  onSuccess?: () => void;
}

export const ProposalCounterModal: React.FC<ProposalCounterModalProps> = ({
  isOpen,
  onClose,
  originalProposal,
  freightPrice,
  onSuccess
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [counterPrice, setCounterPrice] = useState('');
  const [counterMessage, setCounterMessage] = useState('');

  if (!originalProposal) return null;

  const priceDifference = originalProposal.proposed_price - freightPrice;
  const isPriceIncrease = priceDifference > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !counterPrice) return;

    const finalPrice = parseFloat(counterPrice);
    if (isNaN(finalPrice) || finalPrice <= 0) {
      toast.error('Valor inválido');
      return;
    }

    setLoading(true);
    try {
      // Create message about counter proposal instead of using non-existent table
      const { error } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: originalProposal.id, // using proposal ID as reference
          sender_id: profile.id,
          message: `CONTRA-PROPOSTA: R$ ${finalPrice.toLocaleString()}\n\nValor original: R$ ${freightPrice.toLocaleString()}\nProposta do motorista: R$ ${originalProposal.proposed_price.toLocaleString()}\nMinha contra-proposta: R$ ${finalPrice.toLocaleString()}\n\n${counterMessage.trim() || 'Sem observações adicionais'}`,
          message_type: 'COUNTER_PROPOSAL'
        });

      if (error) throw error;

      toast.success('Contra-proposta enviada com sucesso!');
      
      onClose();
      onSuccess?.();
      resetForm();

    } catch (error: any) {
      console.error('Erro ao enviar contra-proposta:', error);
      toast.error('Erro ao enviar contra-proposta: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setCounterPrice('');
    setCounterMessage('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Fazer Contra-Proposta
          </DialogTitle>
          <DialogDescription>
            Negocie um valor intermediário com o motorista {originalProposal.driver_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Proposal Summary */}
          <div className="bg-secondary/30 p-4 rounded-lg space-y-3">
            <h3 className="font-semibold">Proposta Atual</h3>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Valor original:</span>
              <span className="font-medium">R$ {freightPrice.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Proposta do motorista:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">R$ {originalProposal.proposed_price.toLocaleString()}</span>
                <Badge variant={isPriceIncrease ? 'destructive' : 'default'} className="text-xs">
                  {isPriceIncrease ? '+' : ''}{priceDifference.toLocaleString()}
                </Badge>
              </div>
            </div>

            {originalProposal.message && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Justificativa:</p>
                <p className="text-sm">{originalProposal.message}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Counter Offer */}
            <div className="space-y-2">
              <Label>Sua Contra-Proposta (R$) *</Label>
              <Input
                type="number"
                placeholder="Digite o valor da sua contra-proposta"
                value={counterPrice}
                onChange={(e) => setCounterPrice(e.target.value)}
                step="0.01"
                min="1"
                required
              />
              <p className="text-xs text-muted-foreground">
                Sugestão: Valor entre R$ {freightPrice.toLocaleString()} e R$ {originalProposal.proposed_price.toLocaleString()}
              </p>
            </div>

            {/* Counter Message */}
            <div className="space-y-2">
              <Label>Justificativa da Contra-Proposta</Label>
              <Textarea
                placeholder="Ex: Posso pagar R$ 300 a mais considerando o pedágio, mas não os R$ 550 solicitados..."
                value={counterMessage}
                onChange={(e) => setCounterMessage(e.target.value)}
                rows={3}
              />
            </div>

            {/* Price Comparison */}
            {counterPrice && !isNaN(parseFloat(counterPrice)) && (
              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-2 text-sm">Comparação de Valores</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Valor original:</span>
                    <span>R$ {freightPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Proposta do motorista:</span>
                    <span>R$ {originalProposal.proposed_price.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-primary">
                    <span>Sua contra-proposta:</span>
                    <span>R$ {parseFloat(counterPrice).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || !counterPrice} className="gradient-primary">
                {loading ? 'Enviando...' : 'Enviar Contra-Proposta'}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};