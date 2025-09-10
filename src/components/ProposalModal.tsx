import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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
    message: '',
    justification: '',
    delivery_estimate_days: 1,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverProfile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .insert({
          freight_id: freight.id,
          driver_id: driverProfile.id,
          proposed_price: proposalData.proposed_price,
          message: proposalData.message,
          justification: proposalData.justification,
          delivery_estimate_days: proposalData.delivery_estimate_days,
        });

      if (error) throw error;

      toast({
        title: "Proposta enviada!",
        description: "Sua proposta foi enviada com sucesso para o produtor.",
      });

      setOpen(false);
      setProposalData({
        proposed_price: freight.price || 0,
        message: '',
        justification: '',
        delivery_estimate_days: 1,
      });
      
      onProposalSent?.();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar proposta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const priceDifference = proposalData.proposed_price - freight.price;
  const isCounterOffer = priceDifference !== 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full">
          {freight.service_type === 'GUINCHO' ? 'Aceitar Chamado' : 
           freight.service_type === 'MUDANCA' ? 'Fazer Orçamento' : 
           'Fazer Proposta'}
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-md">
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
          {/* Valor da Proposta */}
          <div className="space-y-2">
            <Label htmlFor="proposed_price" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Valor da Proposta (R$)
            </Label>
            <Input
              id="proposed_price"
              type="number"
              step="0.01"
              min="0"
              value={proposalData.proposed_price}
              onChange={(e) => setProposalData(prev => ({ 
                ...prev, 
                proposed_price: Number(e.target.value) 
              }))}
              required
            />
            <div className="text-sm text-muted-foreground">
              Valor original: R$ {freight.price.toLocaleString('pt-BR')}
              {isCounterOffer && (
                <span className={`block ${priceDifference > 0 ? 'text-red-600' : 'text-green-600'}`}>
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
            <p>• Valor: R$ {proposalData.proposed_price.toLocaleString('pt-BR')}</p>
            <p>• Prazo: {proposalData.delivery_estimate_days} dia{proposalData.delivery_estimate_days > 1 ? 's' : ''}</p>
            <p>• Distância: {freight.distance_km} km</p>
            <p>• Peso: {freight.weight >= 1000 ? `${(freight.weight / 1000).toFixed(1)}t` : `${freight.weight}kg`}</p>
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