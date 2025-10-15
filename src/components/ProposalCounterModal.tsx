import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ProposalCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalProposal: {
    id: string;
    freight_id: string;
    proposed_price: number;
    message?: string;
    driver_name: string;
  } | null;
  freightPrice: number;
  freightDistance?: number;
  onSuccess?: () => void;
}

export const ProposalCounterModal: React.FC<ProposalCounterModalProps> = ({
  isOpen,
  onClose,
  originalProposal,
  freightPrice,
  freightDistance = 0,
  onSuccess
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pricingType, setPricingType] = useState<'FIXED' | 'PER_KM'>('PER_KM');
  const [counterPrice, setCounterPrice] = useState('');
  const [counterPricePerKm, setCounterPricePerKm] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  

  if (!originalProposal) return null;

  const priceDifference = originalProposal.proposed_price - freightPrice;
  const isPriceIncrease = priceDifference > 0;

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!profile) {
      toast.error('É necessário estar autenticado.');
      return;
    }
    
    const priceValue = pricingType === 'FIXED' ? counterPrice : counterPricePerKm;
    if (!priceValue) {
      toast.error('Informe um valor.');
      return;
    }

    const priceFloat = parseFloat(priceValue);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      toast.error('Valor inválido');
      return;
    }

    const finalPrice = pricingType === 'FIXED' ? priceFloat : priceFloat * freightDistance;
    
    // Validar se o preço final é válido
    if (finalPrice <= 0) {
      toast.error('O valor da proposta deve ser maior que R$ 0,00');
      return;
    }

    setLoading(true);
    try {
      // Timeout para evitar travamentos
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout na operação')), 10000)
      );

      const operationPromise = (async () => {
        // Buscar o frete para verificar contexto
        const { data: freight, error: freightError } = await supabase
          .from('freights')
          .select('producer_id, driver_id')
          .eq('id', originalProposal.freight_id)
          .single();

        if (freightError) {
          console.error('Erro ao buscar frete:', freightError);
          throw new Error('Erro ao verificar permissões do frete');
        }

        let hasPermission = freight.producer_id === profile.id || freight.driver_id === profile.id;

         // Apenas motoristas AUTÔNOMOS podem enviar contra-proposta
         if (profile.role === 'MOTORISTA') {
           // Garantir que motoristas tenham o papel 'driver' para RLS
           await supabase.rpc('ensure_current_user_role', { _role: 'driver' });
           // Impedir múltiplas propostas do mesmo motorista
           const { data: existing, error: checkErr } = await supabase
             .from('freight_proposals')
             .select('status')
             .eq('freight_id', originalProposal.freight_id)
             .eq('driver_id', profile.id)
             .maybeSingle();
           if (checkErr) {
             console.error('Erro ao verificar proposta existente:', checkErr);
             throw checkErr;
           }
           if (existing && (existing.status === 'PENDING' || existing.status === 'ACCEPTED')) {
             throw new Error(existing.status === 'PENDING' ? 'Você já enviou uma proposta para este frete.' : 'Sua proposta já foi aceita.');
           }

           const { error: createProposalError } = await supabase
             .from('freight_proposals')
             .insert({
               freight_id: originalProposal.freight_id,
               driver_id: profile.id,
               proposed_price: finalPrice,
               status: 'PENDING',
               message: pricingType === 'PER_KM'
                 ? `Proposta por km: R$ ${priceFloat.toLocaleString('pt-BR')}/km (Total estimado: R$ ${finalPrice.toLocaleString('pt-BR')} para ${freightDistance} km)`
                 : 'Proposta enviada via contra-proposta.'
             });

           if (createProposalError) {
             console.error('Erro ao criar proposta:', createProposalError);
             throw new Error('Não foi possível registrar sua proposta');
           }

           hasPermission = true;
         }

        if (!hasPermission) {
          throw new Error('Você não tem permissão para enviar mensagens neste frete');
        }

        const messageContent = pricingType === 'FIXED'
          ? `CONTRA-PROPOSTA: R$ ${finalPrice.toLocaleString('pt-BR')}\n\nValor original: R$ ${freightPrice.toLocaleString('pt-BR')}\nProposta do motorista: R$ ${originalProposal.proposed_price.toLocaleString('pt-BR')}\nMinha contra-proposta: R$ ${finalPrice.toLocaleString('pt-BR')}\n\n${counterMessage.trim() || 'Sem observações adicionais'}`
          : `CONTRA-PROPOSTA POR KM: R$ ${priceFloat.toLocaleString('pt-BR')}/km\n\nValor original: R$ ${freightPrice.toLocaleString('pt-BR')}\nProposta do motorista: R$ ${originalProposal.proposed_price.toLocaleString('pt-BR')}\nMinha contra-proposta: R$ ${priceFloat.toLocaleString('pt-BR')}/km (Total: R$ ${finalPrice.toLocaleString('pt-BR')} para ${freightDistance} km)\n\n${counterMessage.trim() || 'Sem observações adicionais'}`;

        const { error } = await supabase
          .from('freight_messages')
          .insert({
            freight_id: originalProposal.freight_id,
            sender_id: profile.id,
            message: messageContent,
            message_type: 'COUNTER_PROPOSAL'
          });

        if (error) throw error;

        return true;
      })();

      await Promise.race([operationPromise, timeoutPromise]);

      toast.success('Contra-proposta enviada com sucesso!');
      
      onClose();
      onSuccess?.();
      resetForm();

    } catch (error: any) {
      console.error('Erro ao enviar contra-proposta:', error);
      toast.error('Erro ao enviar contra-proposta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPricingType('PER_KM');
    setCounterPrice('');
    setCounterPricePerKm('');
    setCounterMessage('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            Fazer Contra-Proposta
          </DialogTitle>
          <DialogDescription className="text-sm">
            Negocie um valor intermediário com o motorista {originalProposal.driver_name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* Current Proposal Summary */}
          <div className="bg-secondary/30 p-3 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm">Proposta Atual</h3>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor original:</span>
              <span className="font-medium">R$ {freightPrice.toLocaleString()}</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Proposta do motorista:</span>
              <div className="flex items-center gap-2">
                <span className="font-medium">R$ {originalProposal.proposed_price.toLocaleString()}</span>
                <Badge variant={isPriceIncrease ? 'destructive' : 'default'} className="text-xs">
                  {isPriceIncrease ? '+' : ''}{priceDifference.toLocaleString()}
                </Badge>
              </div>
            </div>

            {originalProposal.message && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">Justificativa:</p>
                <p className="text-xs">{originalProposal.message}</p>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Pricing Type */}
            <div className="space-y-1">
              <Label className="text-sm">Tipo de Cobrança</Label>
              <Select value={pricingType} onValueChange={(value: 'FIXED' | 'PER_KM') => setPricingType(value)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o tipo de cobrança" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PER_KM">Por Quilômetro</SelectItem>
                  <SelectItem value="FIXED">Valor Fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Counter Offer */}
            <div className="space-y-1">
              <Label className="text-sm">{pricingType === 'FIXED' ? 'Sua Contra-Proposta (R$) *' : 'Valor por KM (R$) *'}</Label>
              
              {pricingType === 'FIXED' ? (
                <Input
                  type="number"
                  placeholder="Digite o valor da sua contra-proposta"
                  value={counterPrice}
                  onChange={(e) => setCounterPrice(e.target.value)}
                  step="0.01"
                  min="0.01"
                  required
                  className="h-9"
                />
              ) : (
                <Input
                  type="number"
                  placeholder="Digite o valor por km"
                  value={counterPricePerKm}
                  onChange={(e) => setCounterPricePerKm(e.target.value)}
                  step="0.01"
                  min="0.01"
                  required
                  className="h-9"
                />
              )}

              <div className="text-xs text-muted-foreground">
                {pricingType === 'FIXED' ? (
                  `Sugestão: Valor entre R$ ${freightPrice.toLocaleString()} e R$ ${originalProposal.proposed_price.toLocaleString()}`
                ) : (
                  <>
                    Distância do frete: {freightDistance} km
                    {counterPricePerKm && (
                      <div className="mt-1 font-medium">
                        Total calculado: R$ {(parseFloat(counterPricePerKm) * freightDistance).toLocaleString()}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Counter Message */}
            <div className="space-y-1">
              <Label className="text-sm">Justificativa da Contra-Proposta</Label>
              <Textarea
                placeholder="Ex: Posso pagar R$ 300 a mais considerando o pedágio, mas não os R$ 550 solicitados..."
                value={counterMessage}
                onChange={(e) => setCounterMessage(e.target.value)}
                rows={2}
                className="text-sm resize-none"
              />
            </div>

            {/* Price Comparison */}
            {((pricingType === 'FIXED' && counterPrice && !isNaN(parseFloat(counterPrice))) || 
              (pricingType === 'PER_KM' && counterPricePerKm && !isNaN(parseFloat(counterPricePerKm)))) && (
              <div className="p-2 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-1 text-sm">Comparação de Valores</h4>
                <div className="space-y-1 text-xs">
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
                    <span>
                      {pricingType === 'FIXED' 
                        ? `R$ ${parseFloat(counterPrice).toLocaleString()}`
                        : `R$ ${parseFloat(counterPricePerKm).toLocaleString()}/km (Total: R$ ${(parseFloat(counterPricePerKm) * freightDistance).toLocaleString()})`
                      }
                    </span>
                  </div>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="flex justify-end gap-2 pt-3 border-t flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} size="sm">
            Cancelar
          </Button>
          <Button 
            type="submit" 
            disabled={
              loading || 
              (pricingType === 'FIXED' 
                ? !counterPrice 
                : !counterPricePerKm || !freightDistance || freightDistance <= 0)
            } 
            className="gradient-primary"
            size="sm"
            onClick={handleSubmit}
          >
            {loading ? 'Enviando...' : 'Enviar Contra-Proposta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};