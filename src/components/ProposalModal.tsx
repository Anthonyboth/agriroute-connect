import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { showErrorToast } from '@/lib/error-handler';
import { DollarSign, MessageCircle, Calendar } from 'lucide-react';


interface ProposalModalProps {
  freight: any;
  driverProfile: any;
  onProposalSent?: () => void;
}

export const ProposalModal: React.FC<ProposalModalProps> = ({
  freight,
  driverProfile,
  onProposalSent
}) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [proposalData, setProposalData] = useState({
    proposed_price: freight.price || 0,
    proposed_price_per_km: '',
    pricing_type: freight.price_per_km ? 'PER_KM' : 'FIXED' as 'FIXED' | 'PER_KM',
    message: '',
    justification: '',
    delivery_estimate_days: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const driverProfileId = await (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('user_id', user.id)
        .in('role', ['MOTORISTA', 'MOTORISTA_AFILIADO'])
        .limit(1);
      if (error) throw error;
      return data?.[0]?.id ?? (driverProfile?.id ?? null);
    })();
    if (!driverProfileId) {
      toast({ title: 'Perfil inválido', description: 'Você precisa de um perfil de Motorista para enviar propostas.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      // Verificar se já existe uma proposta pendente para evitar múltiplas propostas
      const { data: existingProposal, error: checkError } = await supabase
        .from('freight_proposals')
        .select('status')
        .eq('freight_id', freight.id)
        .eq('driver_id', driverProfileId)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingProposal) {
        if (existingProposal.status === 'PENDING') {
          toast({
            title: "Proposta já enviada",
            description: "Você já enviou uma proposta para este frete. Aguarde a resposta do produtor.",
            variant: "destructive",
          });
          setOpen(false);
          return;
        }
        if (existingProposal.status === 'ACCEPTED') {
          toast({
            title: "Proposta aceita",
            description: "Sua proposta já foi aceita pelo produtor.",
          });
          setOpen(false);
          onProposalSent?.();
          return;
        }
      }

      // Inserir nova proposta (apenas se não existir PENDING)
      const { error } = await supabase
        .from('freight_proposals')
        .insert({
          freight_id: freight.id,
          driver_id: driverProfileId,
          proposed_price: proposalData.pricing_type === 'FIXED' 
            ? proposalData.proposed_price 
            : parseFloat(proposalData.proposed_price_per_km) * (freight.distance_km || 0),
          message: proposalData.message,
          justification: proposalData.justification,
          delivery_estimate_days: proposalData.delivery_estimate_days,
          status: 'PENDING'
        });

      if (error) throw error;

      toast({
        title: "Proposta enviada!",
        description: "Sua proposta foi enviada com sucesso para o produtor.",
      });

      setOpen(false);
      setProposalData({
        proposed_price: freight.price || 0,
        proposed_price_per_km: '',
        pricing_type: freight.price_per_km ? 'PER_KM' : 'FIXED' as 'FIXED' | 'PER_KM',
        message: '',
        justification: '',
        delivery_estimate_days: 1,
      });
      
      onProposalSent?.();
    } catch (error: any) {
      console.error('Error sending proposal:', error);
      showErrorToast(toast, 'Erro ao enviar proposta', error);
    } finally {
      setLoading(false);
    }
  };

  const perKm = parseFloat(proposalData.proposed_price_per_km || '0');
  const distance = Number(freight.distance_km ?? 0);
  const finalProposedPrice = proposalData.pricing_type === 'FIXED'
    ? Number(proposalData.proposed_price || 0)
    : (Number.isFinite(perKm) ? perKm * distance : 0);
  
  const priceDifference = Number(finalProposedPrice) - Number(freight.price || 0);
  const isCounterOffer = Number.isFinite(priceDifference) && priceDifference !== 0;

  return (
    <Dialog open={open} onOpenChange={(openState) => { if (!openState) setOpen(false); }}>
      <DialogTrigger asChild>
        <Button className="w-full">
          {freight.service_type === 'GUINCHO' ? 'Aceitar Chamado' : 
           freight.service_type === 'MUDANCA' ? 'Fazer Orçamento' : 
           'Fazer Proposta'}
        </Button>
      </DialogTrigger>
      
      <DialogContent
        className="max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Fazer Proposta
          </DialogTitle>
          <DialogDescription>
            Envie sua proposta para este frete de {freight.cargo_type}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo de Cobrança */}
          <div className="space-y-2">
            <Label>Tipo de Cobrança</Label>
            <Select value={proposalData.pricing_type} onValueChange={(value: 'FIXED' | 'PER_KM') => {
              // Evita travamento ao fechar o dropdown no mobile
              const el = document.activeElement as HTMLElement | null;
              el?.blur?.();
              setTimeout(() => setProposalData(prev => ({ ...prev, pricing_type: value })), 0);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PER_KM">Por Quilômetro</SelectItem>
                <SelectItem value="FIXED">Valor Fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Valor da Proposta */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              {proposalData.pricing_type === 'FIXED' ? 'Valor Fixo (R$)' : 'Valor por KM (R$)'}
            </Label>

            {/* Mantemos ambos os inputs montados para evitar travamentos ao trocar o tipo */}
            <div className="space-y-2">
              {/* Input de valor fixo */}
              <Input
                type="number"
                step="0.01"
                min="0"
                value={proposalData.proposed_price}
                onChange={(e) => setProposalData(prev => ({
                  ...prev,
                  proposed_price: Number(e.target.value)
                }))}
                required={proposalData.pricing_type === 'FIXED'}
                disabled={proposalData.pricing_type !== 'FIXED'}
                aria-hidden={proposalData.pricing_type !== 'FIXED'}
                className={proposalData.pricing_type === 'FIXED' ? '' : 'hidden'}
              />

              {/* Input de valor por KM */}
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                pattern="[0-9]*[.,]?[0-9]*"
                value={proposalData.proposed_price_per_km}
                onChange={(e) => setProposalData(prev => ({
                  ...prev,
                  proposed_price_per_km: e.target.value
                }))}
                placeholder="8.50"
                required={proposalData.pricing_type === 'PER_KM'}
                disabled={proposalData.pricing_type !== 'PER_KM'}
                aria-hidden={proposalData.pricing_type !== 'PER_KM'}
                className={proposalData.pricing_type === 'PER_KM' ? '' : 'hidden'}
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              {freight.price_per_km ? (
                <>
                  Valor original: R$ {freight.price_per_km.toLocaleString('pt-BR')}/km
                  <br />
                  Distância: {freight.distance_km} km
                </>
              ) : (
                <>Valor original: R$ {freight.price.toLocaleString('pt-BR')}</>
              )}
              
              {proposalData.pricing_type === 'PER_KM' && proposalData.proposed_price_per_km && (
                <div className="mt-1 font-medium">
                  Total calculado: R$ {(parseFloat(proposalData.proposed_price_per_km || '0') * (freight.distance_km || 0)).toLocaleString('pt-BR')}
                </div>
              )}
              
              {isCounterOffer && (
                <span className={`block mt-1 ${priceDifference > 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {priceDifference > 0 ? '+' : ''}R$ {priceDifference.toLocaleString('pt-BR')}
                </span>
              )}
            </div>
          </div>

          {/* Prazo de Entrega */}
          <div className="space-y-2">
            <Label htmlFor="delivery_estimate" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Prazo de Entrega (dias)
            </Label>
            <Input
              id="delivery_estimate"
              type="number"
              min="1"
              max="30"
              value={proposalData.delivery_estimate_days}
              onChange={(e) => setProposalData(prev => ({ 
                ...prev, 
                delivery_estimate_days: Number(e.target.value) 
              }))}
              required
            />
          </div>

          {/* Justificativa (se for contraproposta) */}
          {isCounterOffer && (
            <div className="space-y-2">
              <Label htmlFor="justification">Justificativa da Contraproposta</Label>
              <Textarea
                id="justification"
                placeholder="Ex: Distância maior, estrada em más condições, combustível alto..."
                value={proposalData.justification}
                onChange={(e) => setProposalData(prev => ({ 
                  ...prev, 
                  justification: e.target.value 
                }))}
                rows={3}
              />
            </div>
          )}

          {/* Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="message" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Mensagem para o Produtor
            </Label>
            <Textarea
              id="message"
              placeholder="Apresente-se e destaque seus diferenciais..."
              value={proposalData.message}
              onChange={(e) => setProposalData(prev => ({ 
                ...prev, 
                message: e.target.value 
              }))}
              rows={3}
            />
          </div>

          {/* Resumo da Proposta */}
          <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
            <h4 className="font-semibold">Resumo da Proposta:</h4>
            <p>• Valor: R$ {finalProposedPrice.toLocaleString('pt-BR')} {proposalData.pricing_type === 'PER_KM' ? `(R$ ${proposalData.proposed_price_per_km}/km)` : ''}</p>
            <p>• Prazo: {proposalData.delivery_estimate_days} dia{proposalData.delivery_estimate_days > 1 ? 's' : ''}</p>
            <p>• Distância: {freight.distance_km} km</p>
            <p>• Peso: {(freight.weight / 1000).toFixed(1)}t</p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="flex-1"
            >
              {loading ? 'Enviando...' : 'Enviar Proposta'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};