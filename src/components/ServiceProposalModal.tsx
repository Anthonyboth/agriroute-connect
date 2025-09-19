import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Wrench, Home, Package, DollarSign, Clock, Users, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ServiceProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: {
    id: string;
    service_type?: 'CARGA' | 'GUINCHO' | 'MUDANCA';
    price: number;
    distance_km?: number;
    weight?: number;
    cargo_type: string;
    origin_address: string;
    destination_address: string;
    pickup_date: string;
    delivery_date?: string;
  };
  originalProposal?: {
    id: string;
    proposed_price: number;
    message?: string;
    driver_name: string;
  };
  onSuccess?: () => void;
}

export const ServiceProposalModal: React.FC<ServiceProposalModalProps> = ({
  isOpen,
  onClose,
  freight,
  originalProposal,
  onSuccess
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const formId = 'service-proposal-form';
  
  // Campos comuns
  const [proposedPrice, setProposedPrice] = useState('');
  const [message, setMessage] = useState('');
  
  // Campos específicos para Guincho
  const [urgencyLevel, setUrgencyLevel] = useState('NORMAL');
  const [estimatedTime, setEstimatedTime] = useState('');
  
  // Campos específicos para Mudança
  const [hasElevator, setHasElevator] = useState('');
  const [helpers, setHelpers] = useState('');
  const [packaging, setPackaging] = useState(false);
  
  // Campos específicos para Carga (contra-proposta)
  const [pricingType, setPricingType] = useState<'FIXED' | 'PER_KM'>('FIXED');
  const [pricePerKm, setPricePerKm] = useState('');

  const getServiceIcon = () => {
    switch (freight.service_type) {
      case 'GUINCHO':
        return <Wrench className="h-5 w-5 text-warning" />;
      case 'MUDANCA':
        return <Home className="h-5 w-5 text-accent" />;
      default:
        return <Package className="h-5 w-5 text-primary" />;
    }
  };

  const getModalTitle = () => {
    if (originalProposal) {
      return 'Fazer Contra-Proposta';
    }
    
    switch (freight.service_type) {
      case 'GUINCHO':
        return 'Aceitar Chamado de Guincho';
      case 'MUDANCA':
        return 'Fazer Orçamento de Mudança';
      default:
        return 'Aceitar Frete';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!profile) {
      toast.error('É necessário estar autenticado.');
      return;
    }

    const priceValue = pricingType === 'PER_KM' ? pricePerKm : proposedPrice;
    if (!priceValue) {
      toast.error('Informe um valor.');
      return;
    }

    const priceFloat = parseFloat(priceValue);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      toast.error('Valor inválido');
      return;
    }

    setLoading(true);
    try {
      const finalPrice = pricingType === 'PER_KM' ? priceFloat * (freight.distance_km || 0) : priceFloat;
      
      // Evitar múltiplas propostas para o mesmo frete
      const { data: existingProposal, error: checkError } = await supabase
        .from('freight_proposals')
        .select('status')
        .eq('freight_id', freight.id)
        .eq('driver_id', profile.id)
        .maybeSingle();
      if (checkError) throw checkError;
      
      if (existingProposal) {
        if (existingProposal.status === 'PENDING') {
          toast.info('Você já enviou uma proposta para este frete.');
          onClose();
          return;
        }
        if (existingProposal.status === 'ACCEPTED') {
          toast.info('Sua proposta já foi aceita pelo produtor.');
          onClose();
          onSuccess?.();
          resetForm();
          return;
        }
      }
      
      // Criar nova proposta (apenas se não existir PENDING)
      let proposalData: any = {
        freight_id: freight.id,
        driver_id: profile.id,
        proposed_price: finalPrice,
        status: 'PENDING',
        message: message
      };

      // Inserir nova proposta
      const { error } = await supabase
        .from('freight_proposals')
        .insert(proposalData);

      if (error) throw error;

      // Criar mensagem no chat se for contra-proposta ou orçamento
      if (originalProposal || freight.service_type === 'MUDANCA') {
        let messageContent = '';
        
        if (freight.service_type === 'GUINCHO') {
          messageContent = `ACEITE DO CHAMADO DE GUINCHO\n\nValor: R$ ${finalPrice.toLocaleString('pt-BR')}\nTempo estimado: ${estimatedTime || 'A definir'}\n\n${message || 'Aceito o chamado conforme solicitado.'}`;
        } else if (freight.service_type === 'MUDANCA') {
          messageContent = `ORÇAMENTO DE MUDANÇA\n\nValor: R$ ${finalPrice.toLocaleString('pt-BR')}\nElevador: ${hasElevator || 'Não informado'}\nAjudantes: ${helpers || 'Não informado'}\nEmbalagem: ${packaging ? 'Incluso' : 'Não incluso'}\n\n${message || 'Orçamento conforme especificações.'}`;
        } else {
          messageContent = `CONTRA-PROPOSTA: R$ ${finalPrice.toLocaleString('pt-BR')}\n\n${pricingType === 'PER_KM' ? `Valor por KM: R$ ${priceFloat.toLocaleString('pt-BR')}/km\n` : ''}${message || 'Proposta enviada.'}`;
        }

        await supabase
          .from('freight_messages')
          .insert({
            freight_id: freight.id,
            sender_id: profile.id,
            message: messageContent,
            message_type: originalProposal ? 'COUNTER_PROPOSAL' : 'PROPOSAL'
          });
      }

      toast.success(
        freight.service_type === 'GUINCHO' ? 'Chamado aceito com sucesso!' :
        freight.service_type === 'MUDANCA' ? 'Orçamento enviado com sucesso!' :
        originalProposal ? 'Contra-proposta enviada com sucesso!' : 'Proposta enviada com sucesso!'
      );
      
      onClose();
      onSuccess?.();
      resetForm();

    } catch (error: any) {
      console.error('Erro ao enviar proposta:', error);
      toast.error('Erro ao enviar proposta: ' + (error.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProposedPrice('');
    setMessage('');
    setUrgencyLevel('NORMAL');
    setEstimatedTime('');
    setHasElevator('');
    setHelpers('');
    setPackaging(false);
    setPricingType('FIXED');
    setPricePerKm('');
  };

  const renderGuinchoForm = () => (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Urgência</Label>
            <Select value={urgencyLevel} onValueChange={setUrgencyLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BAIXA">Baixa</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="ALTA">Alta</SelectItem>
                <SelectItem value="EMERGENCIA">Emergência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tempo Estimado</Label>
            <Input
              placeholder="Ex: 30 min"
              value={estimatedTime}
              onChange={(e) => setEstimatedTime(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Valor do Serviço (R$) *</Label>
          <Input
            type="number"
            placeholder="Digite o valor do serviço"
            value={proposedPrice}
            onChange={(e) => setProposedPrice(e.target.value)}
            step="0.01"
            min="1"
          />
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            placeholder="Informações adicionais sobre o atendimento..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
          />
        </div>
      </div>
    </>
  );

  const renderMudancaForm = () => (
    <>
      <div className="space-y-4">

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tem Elevador?</Label>
            <Select value={hasElevator} onValueChange={setHasElevator}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SIM_ORIGEM">Sim na origem</SelectItem>
                <SelectItem value="SIM_DESTINO">Sim no destino</SelectItem>
                <SelectItem value="SIM_AMBOS">Sim em ambos</SelectItem>
                <SelectItem value="NAO">Não tem</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Ajudantes Necessários</Label>
            <Input
              placeholder="Ex: 2 ajudantes"
              value={helpers}
              onChange={(e) => setHelpers(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="packaging"
            checked={packaging}
            onChange={(e) => setPackaging(e.target.checked)}
            className="rounded"
          />
          <Label htmlFor="packaging">Incluir embalagem e desmontagem</Label>
        </div>

        <div className="space-y-2">
          <Label>Valor do Orçamento (R$) *</Label>
          <Input
            type="number"
            placeholder="Digite o valor do orçamento"
            value={proposedPrice}
            onChange={(e) => setProposedPrice(e.target.value)}
            step="0.01"
            min="1"
          />
        </div>

        <div className="space-y-2">
          <Label>Detalhes do Orçamento</Label>
          <Textarea
            placeholder="Descreva os detalhes do serviço, prazo, condições..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </>
  );

  const renderCargaForm = () => (
    <>
      {originalProposal && (
        <div className="bg-secondary/30 p-3 rounded-lg space-y-2 mb-4">
          <h3 className="font-semibold text-sm">Proposta Atual</h3>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Valor original:</span>
            <span className="font-medium">R$ {freight.price.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Proposta do motorista:</span>
            <span className="font-medium">R$ {originalProposal.proposed_price.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {originalProposal && (
          <div className="space-y-2">
            <Label>Tipo de Cobrança</Label>
            <Select value={pricingType} onValueChange={(value: 'FIXED' | 'PER_KM') => setPricingType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PER_KM">Por Quilômetro</SelectItem>
                <SelectItem value="FIXED">Valor Fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>{pricingType === 'PER_KM' ? 'Valor por KM (R$) *' : 'Valor Proposto (R$) *'}</Label>
          {pricingType === 'PER_KM' ? (
            <Input
              type="number"
              placeholder="Digite o valor por km"
              value={pricePerKm}
              onChange={(e) => setPricePerKm(e.target.value)}
              step="0.01"
              min="0.01"
            />
          ) : (
            <Input
              type="number"
              placeholder="Digite o valor da proposta"
              value={proposedPrice}
              onChange={(e) => setProposedPrice(e.target.value)}
              step="0.01"
              min="1"
            />
          )}
          {pricingType === 'PER_KM' && freight.distance_km && pricePerKm && (
            <p className="text-sm text-muted-foreground">
              Total calculado: R$ {(parseFloat(pricePerKm) * freight.distance_km).toLocaleString()}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>{originalProposal ? 'Justificativa da Contra-Proposta' : 'Observações'}</Label>
          <Textarea
            placeholder={originalProposal ? "Explique sua contra-proposta..." : "Informações adicionais sobre o frete..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {getServiceIcon()}
            {getModalTitle()}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {/* Informações do Frete */}
          <div className="bg-secondary/20 p-3 rounded-lg mb-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Origem:</span>
              <span className="text-sm">{freight.origin_address}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Destino:</span>
              <span className="text-sm">{freight.destination_address}</span>
            </div>
            {freight.distance_km && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Distância:</span>
                <span className="text-sm">{freight.distance_km} km</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Data:</span>
              <span className="text-sm">{new Date(freight.pickup_date).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>

          <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            {freight.service_type === 'GUINCHO' && renderGuinchoForm()}
            {freight.service_type === 'MUDANCA' && renderMudancaForm()}
            {(!freight.service_type || freight.service_type === 'CARGA') && renderCargaForm()}
          </form>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t flex-shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button 
            type="submit"
            form={formId}
            disabled={loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {loading ? 'Enviando...' : 
             freight.service_type === 'GUINCHO' ? 'Aceitar Chamado' :
             freight.service_type === 'MUDANCA' ? 'Enviar Orçamento' :
             originalProposal ? 'Enviar Contra-Proposta' : 'Enviar Proposta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};