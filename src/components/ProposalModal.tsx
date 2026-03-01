import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { showErrorToast } from '@/lib/error-handler';
import { DollarSign, MessageCircle, Calendar, Truck, Scale } from 'lucide-react';
import { usePanelCapabilities } from '@/hooks/usePanelCapabilities';
import { formatKm, formatBRL, getPricePerTruck, formatTons } from '@/lib/formatters';
import { getCanonicalFreightPrice } from '@/lib/freightPriceContract';


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
  const { can, reason } = usePanelCapabilities();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // ✅ CRÍTICO: Motorista vê e propõe apenas para 1 carreta
  const requiredTrucks = freight.required_trucks || 1;
  const hasMultipleTrucks = requiredTrucks > 1;
  const pricePerTruck = useMemo(() => getPricePerTruck(freight.price, requiredTrucks), [freight.price, requiredTrucks]);
  const weightPerTruck = useMemo(() => (freight.weight || 0) / requiredTrucks, [freight.weight, requiredTrucks]);
  const weightInTons = weightPerTruck / 1000;
  const distance = Number(freight.distance_km ?? 0);

  const [proposalData, setProposalData] = useState({
    proposed_price: pricePerTruck, // ✅ Valor inicial é por carreta
    proposed_price_per_km: '',
    proposed_price_per_ton: '',
    pricing_type: freight.price_per_km ? 'PER_KM' : 'FIXED' as 'FIXED' | 'PER_KM' | 'PER_TON',
    message: '',
    justification: '',
    delivery_estimate_days: 1,
  });

  // ✅ Calcular preço final baseado no tipo de precificação
  const finalProposedPrice = useMemo(() => {
    if (proposalData.pricing_type === 'FIXED') {
      return Number(proposalData.proposed_price || 0);
    }
    if (proposalData.pricing_type === 'PER_KM') {
      const perKm = parseFloat(proposalData.proposed_price_per_km || '0');
      return Number.isFinite(perKm) ? perKm * distance : 0;
    }
    if (proposalData.pricing_type === 'PER_TON') {
      const perTon = parseFloat(proposalData.proposed_price_per_ton || '0');
      return Number.isFinite(perTon) ? perTon * weightInTons : 0;
    }
    return 0;
  }, [proposalData, distance, weightInTons]);

  // ✅ Comparação é sempre com preço por carreta (não total)
  const priceDifference = finalProposedPrice - pricePerTruck;
  const isCounterOffer = Number.isFinite(priceDifference) && priceDifference !== 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // ✅ Verificar permissão centralizada PRIMEIRO
    if (!can('submit_freight_proposal')) {
      toast({
        title: "Não permitido",
        description: reason('submit_freight_proposal') || 'Você não tem permissão para enviar propostas.',
        variant: "destructive",
      });
      return;
    }
    
    // Validar valor antes de prosseguir
    if (finalProposedPrice <= 0) {
      toast({
        title: "Valor inválido",
        description: "O valor da proposta deve ser maior que R$ 0,00",
        variant: "destructive",
      });
      return;
    }
    
    // Validar se pricing_type é PER_KM e distância é 0
    if (proposalData.pricing_type === 'PER_KM' && distance <= 0) {
      toast({
        title: "Distância não configurada",
        description: "Para proposta por KM, o frete precisa ter a distância configurada. Use valor fixo ou aguarde a configuração.",
        variant: "destructive",
      });
      return;
    }

    // Validar se pricing_type é PER_TON e peso é 0
    if (proposalData.pricing_type === 'PER_TON' && weightInTons <= 0) {
      toast({
        title: "Peso não configurado",
        description: "Para proposta por tonelada, o frete precisa ter o peso configurado.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);

    try {
      // Buscar perfil MOTORISTA autônomo apenas
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: driverData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'MOTORISTA')
        .maybeSingle();

      if (profileError) throw profileError;
      if (!driverData) {
        toast({
          title: "Perfil inválido",
          description: reason('submit_freight_proposal') || "Erro ao verificar perfil.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const driverProfileId = driverData.id;

      // Garantir que o usuário tenha o papel 'driver' para RLS
      await supabase.rpc('ensure_current_user_role', { _role: 'driver' });
      
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

      // ✅ Mensagem indica claramente que é para 1 carreta
      let proposalMessage = proposalData.message || '';
      if (hasMultipleTrucks) {
        proposalMessage = `[Proposta para 1 carreta] ${proposalMessage}`;
      }

      // Inserir nova proposta (apenas se não existir PENDING)
      // ✅ Calcular valor unitário para salvar
      const unitPrice = proposalData.pricing_type === 'PER_KM'
        ? parseFloat(proposalData.proposed_price_per_km || '0')
        : proposalData.pricing_type === 'PER_TON'
          ? parseFloat(proposalData.proposed_price_per_ton || '0')
          : finalProposedPrice;

      const { error } = await supabase
        .from('freight_proposals')
        .insert({
          freight_id: freight.id,
          driver_id: driverProfileId,
          proposed_price: finalProposedPrice, // ✅ Valor já calculado por carreta
          proposal_pricing_type: proposalData.pricing_type,
          proposal_unit_price: unitPrice,
          message: proposalMessage,
          justification: proposalData.justification,
          delivery_estimate_days: proposalData.delivery_estimate_days,
          status: 'PENDING'
        });

      if (error) throw error;

      toast({
        title: "Proposta enviada!",
        description: hasMultipleTrucks 
          ? `Sua proposta para 1 carreta (${formatBRL(finalProposedPrice, true)}) foi enviada.`
          : "Sua proposta foi enviada com sucesso para o produtor.",
      });

      setOpen(false);
      resetProposalData();
      
      onProposalSent?.();
    } catch (error: any) {
      console.error('Error sending proposal:', error);
      showErrorToast(toast, 'Erro ao enviar proposta', error);
    } finally {
      setLoading(false);
    }
  };

  const resetProposalData = () => {
    setProposalData({
      proposed_price: pricePerTruck,
      proposed_price_per_km: '',
      proposed_price_per_ton: '',
      pricing_type: freight.price_per_km ? 'PER_KM' : 'FIXED' as 'FIXED' | 'PER_KM' | 'PER_TON',
      message: '',
      justification: '',
      delivery_estimate_days: 1,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(openState) => { if (!openState) setOpen(false); else setOpen(true); }}>
      <DialogTrigger asChild>
        <Button className="w-full" onClick={() => setOpen(true)}>
          {freight.service_type === 'GUINCHO' ? 'Aceitar Chamado' : 
           freight.service_type === 'MUDANCA' ? 'Fazer Orçamento' : 
           'Fazer Proposta'}
        </Button>
      </DialogTrigger>
      
      <DialogContent
        className="max-w-md max-h-[90vh] flex flex-col"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Fazer Proposta
          </DialogTitle>
          <DialogDescription>
            {hasMultipleTrucks ? (
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Proposta para <strong>1 carreta</strong> de {requiredTrucks} disponíveis
              </span>
            ) : (
              <>Envie sua proposta para este frete de {freight.cargo_type}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          {/* ✅ AVISO: Frete com múltiplas carretas */}
          {hasMultipleTrucks && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm font-medium">
                <Truck className="h-4 w-4" />
                Frete com {requiredTrucks} carretas
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Você está fazendo proposta para <strong>1 carreta apenas</strong>. 
                Valor original: {getCanonicalFreightPrice({
                  pricing_type: freight.pricing_type,
                  price_per_km: freight.price_per_km,
                  price: freight.price,
                  required_trucks: freight.required_trucks,
                  weight: freight.weight,
                  distance_km: freight.distance_km,
                }).primaryLabel}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tipo de Cobrança */}
            <div className="space-y-2">
              <Label>Tipo de Cobrança</Label>
              <Select 
                value={proposalData.pricing_type} 
                onValueChange={(value: 'FIXED' | 'PER_KM' | 'PER_TON') => {
                  const el = document.activeElement as HTMLElement | null;
                  el?.blur?.();
                  setTimeout(() => setProposalData(prev => ({ ...prev, pricing_type: value })), 0);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Valor Fixo (R$)</SelectItem>
                  <SelectItem value="PER_KM">Por Quilômetro (R$/km)</SelectItem>
                  <SelectItem value="PER_TON">Por Tonelada (R$/ton)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor da Proposta */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                {proposalData.pricing_type === 'PER_TON' ? (
                  <Scale className="h-4 w-4" />
                ) : (
                  <DollarSign className="h-4 w-4" />
                )}
                {proposalData.pricing_type === 'FIXED' 
                  ? 'Valor Fixo (R$)' 
                  : proposalData.pricing_type === 'PER_KM' 
                    ? 'Valor por KM (R$)' 
                    : 'Valor por Tonelada (R$)'}
                {hasMultipleTrucks && (
                  <Badge variant="outline" className="text-xs ml-2">por carreta</Badge>
                )}
              </Label>

              <div className="space-y-2">
                {/* Input de valor fixo */}
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
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
                  min="0.01"
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

                {/* ✅ NOVO: Input de valor por tonelada */}
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  inputMode="decimal"
                  pattern="[0-9]*[.,]?[0-9]*"
                  value={proposalData.proposed_price_per_ton}
                  onChange={(e) => setProposalData(prev => ({
                    ...prev,
                    proposed_price_per_ton: e.target.value
                  }))}
                  placeholder="150.00"
                  required={proposalData.pricing_type === 'PER_TON'}
                  disabled={proposalData.pricing_type !== 'PER_TON'}
                  aria-hidden={proposalData.pricing_type !== 'PER_TON'}
                  className={proposalData.pricing_type === 'PER_TON' ? '' : 'hidden'}
                />
              </div>
              
              <div className="text-sm text-muted-foreground">
                {/* ✅ Mostrar valor unitário usando contrato canônico */}
                <p className="font-medium">
                  Valor original: {(() => {
                    const pd = getCanonicalFreightPrice({
                      pricing_type: freight.pricing_type,
                      price_per_km: freight.price_per_km,
                      price: freight.price,
                      required_trucks: freight.required_trucks,
                      weight: freight.weight,
                      distance_km: freight.distance_km,
                    });
                    return pd.primaryLabel;
                  })()}
                </p>
                <p className="text-xs">
                  Distância: {formatKm(distance)} • Peso: {formatTons(weightPerTruck)}
                </p>
                
                {proposalData.pricing_type === 'PER_KM' && proposalData.proposed_price_per_km && (
                  <div className="mt-1 font-medium text-primary">
                    Total calculado: {formatBRL(finalProposedPrice, true)}
                  </div>
                )}

                {proposalData.pricing_type === 'PER_TON' && proposalData.proposed_price_per_ton && (
                  <div className="mt-1 font-medium text-primary">
                    Total calculado: {formatBRL(finalProposedPrice, true)} ({weightInTons.toFixed(1)} ton)
                  </div>
                )}
                
                {isCounterOffer && (
                  <span className={`block mt-1 ${priceDifference > 0 ? 'text-destructive' : 'text-green-600'}`}>
                    {priceDifference > 0 ? '+' : ''}{formatBRL(priceDifference, true)} vs. original
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
                  rows={2}
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
                rows={2}
              />
            </div>

            {/* Resumo da Proposta */}
            <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
              <h4 className="font-semibold flex items-center gap-2">
                Resumo da Proposta
                {hasMultipleTrucks && (
                  <Badge variant="secondary" className="text-xs">1 carreta</Badge>
                )}
              </h4>
              <p>• Valor: {formatBRL(finalProposedPrice, true)} 
                {proposalData.pricing_type === 'PER_KM' && ` (R$ ${proposalData.proposed_price_per_km}/km)`}
                {proposalData.pricing_type === 'PER_TON' && ` (R$ ${proposalData.proposed_price_per_ton}/ton)`}
              </p>
              <p>• Prazo: {proposalData.delivery_estimate_days} dia{proposalData.delivery_estimate_days > 1 ? 's' : ''}</p>
              <p>• Distância: {formatKm(distance)}</p>
              <p>• Peso: {formatTons(weightPerTruck)}{hasMultipleTrucks && ' (por carreta)'}</p>
            </div>
          </form>
        </div>

        <div className="flex gap-2 pt-4 border-t flex-shrink-0">
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
            onClick={handleSubmit}
          >
            {loading ? 'Enviando...' : 'Enviar Proposta'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
