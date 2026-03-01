import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Truck, Scale } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatBRL, getPricePerTruck, formatTons } from '@/lib/formatters';
import { getCanonicalFreightPrice } from '@/lib/freightPriceContract';

interface ProposalCounterModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalProposal: {
    id: string;
    freight_id: string;
    proposed_price: number; // Já é o valor por carreta do motorista
    proposal_pricing_type?: string | null; // ✅ Tipo de precificação da proposta do motorista
    proposal_unit_price?: number | null; // ✅ Valor unitário da proposta do motorista
    message?: string;
    driver_name: string;
    driver_id: string; // ✅ ID do motorista para target_driver_id no chat
  } | null;
  freightPrice: number; // Preço TOTAL do frete
  freightDistance?: number;
  freightWeight?: number; // Peso TOTAL em kg
  requiredTrucks?: number;
  freightPricingType?: string; // ✅ Tipo de precificação original (FIXED, PER_KM, PER_TON)
  freightPricePerKm?: number; // ✅ Valor unitário original por km ou ton
  onSuccess?: () => void;
}

export const ProposalCounterModal: React.FC<ProposalCounterModalProps> = ({
  isOpen,
  onClose,
  originalProposal,
  freightPrice,
  freightDistance = 0,
  freightWeight = 0,
  requiredTrucks = 1,
  freightPricingType,
  freightPricePerKm,
  onSuccess
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pricingType, setPricingType] = useState<'FIXED' | 'PER_KM' | 'PER_TON'>('FIXED');
  const [counterPrice, setCounterPrice] = useState('');
  const [counterPricePerKm, setCounterPricePerKm] = useState('');
  const [counterPricePerTon, setCounterPricePerTon] = useState('');
  const [counterMessage, setCounterMessage] = useState('');

  // ✅ CRÍTICO: Calcular valores POR CARRETA (hooks ANTES do early return)
  const hasMultipleTrucks = requiredTrucks > 1;
  const pricePerTruck = useMemo(() => getPricePerTruck(freightPrice, requiredTrucks), [freightPrice, requiredTrucks]);
  const weightPerTruck = useMemo(() => (freightWeight || 0) / requiredTrucks, [freightWeight, requiredTrucks]);
  const weightPerTruckInTons = weightPerTruck / 1000;

  // ✅ CRÍTICO: Calcular valor unitário do motorista baseado no tipo de precificação do FRETE
  const driverDisplayUnitPrice = useMemo(() => {
    if (!originalProposal) return 0;
    const proposedPrice = originalProposal.proposed_price;
    const propPricingType = originalProposal.proposal_pricing_type;
    const propUnitPrice = originalProposal.proposal_unit_price;
    // Se o motorista já enviou com o mesmo tipo do frete e tem unit price, usar direto
    if (propPricingType === freightPricingType && propUnitPrice) {
      return propUnitPrice;
    }
    // Calcular unitário a partir do total proposto
    if (freightPricingType === 'PER_TON' && weightPerTruckInTons > 0) {
      return proposedPrice / weightPerTruckInTons;
    }
    if (freightPricingType === 'PER_KM' && freightDistance > 0) {
      return proposedPrice / freightDistance;
    }
    return proposedPrice; // FIXED - mostrar total
  }, [originalProposal, freightPricingType, weightPerTruckInTons, freightDistance]);

  if (!originalProposal) return null;

  // A proposta do motorista já é por carreta
  const driverProposedPrice = originalProposal.proposed_price;
  const driverPricingType = originalProposal.proposal_pricing_type;
  const driverUnitPrice = originalProposal.proposal_unit_price;

  // ✅ Diferença unitária (na mesma unidade do frete)
  const originalUnitPrice = freightPricePerKm || 0; // price_per_km armazena o valor unitário (ton ou km)
  const unitPriceDifference = driverDisplayUnitPrice - (freightPricingType === 'FIXED' ? pricePerTruck : originalUnitPrice);
  const isPriceIncrease = unitPriceDifference > 0;

  // ✅ Formatar exibição do valor do motorista SEMPRE na unidade do frete
  const formatDriverProposal = () => {
    if (freightPricingType === 'PER_KM') {
      return `R$ ${driverDisplayUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/km`;
    }
    if (freightPricingType === 'PER_TON') {
      return `R$ ${driverDisplayUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ton`;
    }
    return formatBRL(driverProposedPrice, true);
  };

  // ✅ Formatar diferença na mesma unidade
  const formatUnitDifference = () => {
    const suffix = freightPricingType === 'PER_KM' ? '/km' : freightPricingType === 'PER_TON' ? '/ton' : '';
    const formatted = `R$ ${Math.abs(unitPriceDifference).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${suffix}`;
    return `${isPriceIncrease ? '+' : '-'}${formatted}`;
  };

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();

    if (!profile) {
      toast.error('É necessário estar autenticado.');
      return;
    }
    
    const priceValue = pricingType === 'FIXED' 
      ? counterPrice 
      : pricingType === 'PER_KM' 
        ? counterPricePerKm 
        : counterPricePerTon;
        
    if (!priceValue) {
      toast.error('Informe um valor.');
      return;
    }

    const priceFloat = parseFloat(priceValue);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      toast.error('Valor inválido');
      return;
    }

    // ✅ Calcular preço final POR CARRETA
    const finalPrice = pricingType === 'FIXED' 
      ? priceFloat 
      : pricingType === 'PER_KM' 
        ? priceFloat * freightDistance 
        : priceFloat * weightPerTruckInTons;
    
    if (finalPrice <= 0) {
      toast.error('O valor da proposta deve ser maior que R$ 0,00');
      return;
    }

    setLoading(true);
    try {
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout na operação')), 10000)
      );

      const operationPromise = (async () => {
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

        if (profile.role === 'MOTORISTA') {
          await supabase.rpc('ensure_current_user_role', { _role: 'driver' });
          const { data: existing, error: checkErr } = await supabase
            .from('freight_proposals')
            .select('id, status')
            .eq('freight_id', originalProposal.freight_id)
            .eq('driver_id', profile.id)
            .maybeSingle();
          if (checkErr) {
            console.error('Erro ao verificar proposta existente:', checkErr);
            throw checkErr;
          }
          if (existing && existing.status === 'ACCEPTED') {
            throw new Error('Sua proposta já foi aceita.');
          }
          if (existing && existing.status === 'PENDING') {
            throw new Error('Você já enviou uma proposta para este frete.');
          }

          // ✅ Mensagem indica claramente que é para 1 carreta
          const proposalMessage = hasMultipleTrucks
            ? `[Proposta para 1 carreta] ${pricingType === 'PER_KM' 
                ? `R$ ${priceFloat.toLocaleString('pt-BR')}/km (Total: ${formatBRL(finalPrice, true)})` 
                : pricingType === 'PER_TON'
                  ? `R$ ${priceFloat.toLocaleString('pt-BR')}/ton (Total: ${formatBRL(finalPrice, true)})`
                  : formatBRL(finalPrice, true)}`
            : pricingType === 'PER_KM'
              ? `Proposta por km: R$ ${priceFloat.toLocaleString('pt-BR')}/km (Total: ${formatBRL(finalPrice, true)} para ${freightDistance} km)`
              : 'Resposta à contra-proposta do produtor.';

          // Se existe proposta com COUNTER_PROPOSED, atualizar ao invés de criar nova
          if (existing && existing.status === 'COUNTER_PROPOSED') {
            const { error: updateError } = await supabase
              .from('freight_proposals')
              .update({
                proposed_price: finalPrice,
                proposal_pricing_type: pricingType,
                proposal_unit_price: priceFloat,
                status: 'PENDING',
                message: proposalMessage
              })
              .eq('id', existing.id);

            if (updateError) {
              console.error('Erro ao atualizar proposta:', updateError);
              throw new Error('Não foi possível atualizar sua proposta');
            }
          } else {
            const { error: createProposalError } = await supabase
              .from('freight_proposals')
              .insert({
                freight_id: originalProposal.freight_id,
                driver_id: profile.id,
                proposed_price: finalPrice,
                proposal_pricing_type: pricingType,
                proposal_unit_price: priceFloat,
                status: 'PENDING',
                message: proposalMessage
              });

            if (createProposalError) {
              console.error('Erro ao criar proposta:', createProposalError);
              throw new Error('Não foi possível registrar sua proposta');
            }
          }

          hasPermission = true;
        } else if (profile.role === 'PRODUTOR' && freight.producer_id === profile.id) {
          // ✅ Produtor fazendo contraproposta: atualizar status da proposta original para COUNTER_PROPOSED
          const { error: updateError } = await supabase
            .from('freight_proposals')
            .update({
              status: 'COUNTER_PROPOSED'
            })
            .eq('id', originalProposal.id);

          if (updateError) {
            console.error('Erro ao atualizar proposta para COUNTER_PROPOSED:', updateError);
            // Continuar mesmo com erro - a mensagem no chat ainda será enviada
          }
          hasPermission = true;
        }

        if (!hasPermission) {
          throw new Error('Você não tem permissão para enviar mensagens neste frete');
        }

        // ✅ Helper para formatar valor original unitário
        const formatOriginalUnit = () => {
          if (freightPricingType === 'PER_KM' && freightPricePerKm) {
            return `R$ ${freightPricePerKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/km`;
          }
          if (freightPricingType === 'PER_TON' && freightPricePerKm) {
            return `R$ ${freightPricePerKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ton`;
          }
          return formatBRL(pricePerTruck, true) + (hasMultipleTrucks ? ' /carreta' : '');
        };

        // ✅ Mensagem de chat com valores unitários
        const messageContent = hasMultipleTrucks
          ? `CONTRA-PROPOSTA (1 carreta de ${requiredTrucks}):\n\n` +
            `Valor original: ${formatOriginalUnit()}\n` +
            `Proposta do motorista: ${formatBRL(driverProposedPrice, true)}\n` +
            `Minha contra-proposta: ${pricingType === 'FIXED' 
              ? formatBRL(finalPrice, true)
              : pricingType === 'PER_KM'
                ? `R$ ${priceFloat.toLocaleString('pt-BR')}/km (Total: ${formatBRL(finalPrice, true)})`
                : `R$ ${priceFloat.toLocaleString('pt-BR')}/ton (Total: ${formatBRL(finalPrice, true)})`}\n\n` +
            `${counterMessage.trim() || 'Sem observações adicionais'}`
          : pricingType === 'FIXED'
            ? `CONTRA-PROPOSTA: ${formatBRL(finalPrice, true)}\n\n` +
              `Valor original: ${formatOriginalUnit()}\n` +
              `Proposta do motorista: ${formatBRL(driverProposedPrice, true)}\n` +
              `Minha contra-proposta: ${formatBRL(finalPrice, true)}\n\n` +
              `${counterMessage.trim() || 'Sem observações adicionais'}`
            : pricingType === 'PER_KM'
              ? `CONTRA-PROPOSTA POR KM: R$ ${priceFloat.toLocaleString('pt-BR')}/km\n\n` +
                `Valor original: ${formatOriginalUnit()}\n` +
                `Proposta do motorista: ${formatBRL(driverProposedPrice, true)}\n` +
                `Minha contra-proposta: R$ ${priceFloat.toLocaleString('pt-BR')}/km (Total: ${formatBRL(finalPrice, true)} para ${freightDistance} km)\n\n` +
                `${counterMessage.trim() || 'Sem observações adicionais'}`
              : `CONTRA-PROPOSTA POR TONELADA: R$ ${priceFloat.toLocaleString('pt-BR')}/ton\n\n` +
                `Valor original: ${formatOriginalUnit()}\n` +
                `Proposta do motorista: ${formatBRL(driverProposedPrice, true)}\n` +
                `Minha contra-proposta: R$ ${priceFloat.toLocaleString('pt-BR')}/ton (Total: ${formatBRL(finalPrice, true)} para ${weightPerTruckInTons.toFixed(1)} ton)\n\n` +
                `${counterMessage.trim() || 'Sem observações adicionais'}`;

        const { error } = await supabase
          .from('freight_messages')
          .insert({
            freight_id: originalProposal.freight_id,
            sender_id: profile.id,
            target_driver_id: originalProposal.driver_id,
            message: messageContent,
            message_type: 'COUNTER_PROPOSAL'
          });

        if (error) throw error;

        return true;
      })();

      await Promise.race([operationPromise, timeoutPromise]);

      toast.success(hasMultipleTrucks 
        ? 'Contra-proposta para 1 carreta enviada!' 
        : 'Contra-proposta enviada com sucesso!');
      
      onClose();
      onSuccess?.();
      resetForm();

    } catch (error: any) {
      console.error('Erro ao enviar contra-proposta:', error);
      
      let errorMessage = 'Erro ao enviar contra-proposta.';
      
      if (error?.message) {
        if (error.message.includes('Você já enviou')) {
          errorMessage = error.message;
        } else if (error.message.includes('Sua proposta já foi aceita')) {
          errorMessage = error.message;
        } else if (error.message.includes('permissão')) {
          errorMessage = 'Você não tem permissão para enviar contra-proposta neste frete.';
        } else if (error.message.includes('RLS') || error.message.includes('row-level security')) {
          errorMessage = 'Erro de permissão. Verifique se você está participando deste frete.';
        } else if (error.message.includes('Timeout')) {
          errorMessage = 'A operação demorou muito. Tente novamente.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPricingType('FIXED');
    setCounterPrice('');
    setCounterPricePerKm('');
    setCounterPricePerTon('');
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
            {hasMultipleTrucks ? (
              <span className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Proposta para <strong>1 carreta</strong> de {requiredTrucks} disponíveis
              </span>
            ) : (
              <>Negocie um valor com o motorista {originalProposal.driver_name}</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {/* ✅ AVISO: Frete com múltiplas carretas */}
          {hasMultipleTrucks && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm font-medium">
                <Truck className="h-4 w-4" />
                Frete com {requiredTrucks} carretas
              </div>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Você está negociando o valor para <strong>1 carreta apenas</strong>.
              </p>
            </div>
          )}

          {/* Current Proposal Summary - ✅ Valores por carreta */}
          <div className="bg-secondary/30 p-3 rounded-lg space-y-2">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Proposta Atual
              {hasMultipleTrucks && <Badge variant="outline" className="text-xs">por carreta</Badge>}
            </h3>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor original:</span>
              <span className="font-medium">
                {getCanonicalFreightPrice({
                  pricing_type: freightPricingType,
                  price_per_km: freightPricePerKm,
                  price: freightPrice,
                  required_trucks: requiredTrucks,
                  weight: freightWeight,
                  distance_km: freightDistance,
                }).primaryLabel}
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Proposta do motorista:</span>
              <span className="font-medium">{formatDriverProposal()}</span>
            </div>
            {(freightPricingType === 'PER_KM' || freightPricingType === 'PER_TON') && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total calculado:</span>
                <span>{formatBRL(driverProposedPrice, true)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Diferença:</span>
              <Badge variant={isPriceIncrease ? 'destructive' : 'default'} className="text-xs">
                {formatUnitDifference()}
              </Badge>
            </div>

            {hasMultipleTrucks && (
              <div className="pt-1 text-xs text-muted-foreground">
                Peso por carreta: {formatTons(weightPerTruck)} • Distância: {freightDistance} km
              </div>
            )}

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
              <Select value={pricingType} onValueChange={(value: 'FIXED' | 'PER_KM' | 'PER_TON') => setPricingType(value)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o tipo de cobrança" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Valor Fixo (R$)</SelectItem>
                  <SelectItem value="PER_KM">Por Quilômetro (R$/km)</SelectItem>
                  <SelectItem value="PER_TON">Por Tonelada (R$/ton)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Counter Offer - ✅ Labels indicam "por carreta" */}
            <div className="space-y-1">
              <Label className="text-sm flex items-center gap-2">
                {pricingType === 'PER_TON' ? <Scale className="h-4 w-4" /> : <DollarSign className="h-4 w-4" />}
                {pricingType === 'FIXED' 
                  ? 'Sua Contra-Proposta (R$)' 
                  : pricingType === 'PER_KM' 
                    ? 'Valor por KM (R$)' 
                    : 'Valor por Tonelada (R$)'}
                {hasMultipleTrucks && <Badge variant="outline" className="text-xs">por carreta</Badge>}
              </Label>
              
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
              ) : pricingType === 'PER_KM' ? (
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
              ) : (
                <Input
                  type="number"
                  placeholder="Digite o valor por tonelada"
                  value={counterPricePerTon}
                  onChange={(e) => setCounterPricePerTon(e.target.value)}
                  step="0.01"
                  min="0.01"
                  required
                  className="h-9"
                />
              )}

              <div className="text-xs text-muted-foreground">
                {pricingType === 'FIXED' ? (
                  <>
                    Sugestão: Valor entre {formatBRL(pricePerTruck, true)} e {formatBRL(driverProposedPrice, true)}
                    {hasMultipleTrucks && <span className="block mt-1">Os valores acima são por carreta.</span>}
                  </>
                ) : pricingType === 'PER_KM' ? (
                  <>
                    Distância do frete: {freightDistance} km
                    {counterPricePerKm && (
                      <div className="mt-1 font-medium text-primary">
                        Total calculado: {formatBRL(parseFloat(counterPricePerKm) * freightDistance, true)}
                        {hasMultipleTrucks && ' (por carreta)'}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    Peso por carreta: {formatTons(weightPerTruck)}
                    {counterPricePerTon && (
                      <div className="mt-1 font-medium text-primary">
                        Total calculado: {formatBRL(parseFloat(counterPricePerTon) * weightPerTruckInTons, true)}
                        {hasMultipleTrucks && ' (por carreta)'}
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

            {/* Price Comparison - ✅ Valores por carreta */}
            {((pricingType === 'FIXED' && counterPrice && !isNaN(parseFloat(counterPrice))) || 
              (pricingType === 'PER_KM' && counterPricePerKm && !isNaN(parseFloat(counterPricePerKm))) ||
              (pricingType === 'PER_TON' && counterPricePerTon && !isNaN(parseFloat(counterPricePerTon)))) && (
              <div className="p-2 bg-primary/5 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-1 text-sm flex items-center gap-2">
                  Comparação de Valores
                  {hasMultipleTrucks && <Badge variant="outline" className="text-xs">por carreta</Badge>}
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span>Valor original:</span>
                    <span>
                      {freightPricingType === 'PER_KM' && freightPricePerKm
                        ? `R$ ${freightPricePerKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/km`
                        : freightPricingType === 'PER_TON' && freightPricePerKm
                          ? `R$ ${freightPricePerKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/ton`
                          : formatBRL(pricePerTruck, true)
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Proposta do motorista:</span>
                    <span>{formatBRL(driverProposedPrice, true)}</span>
                  </div>
                  <div className="flex items-center justify-between font-medium text-primary">
                    <span>Sua contra-proposta:</span>
                    <span>
                      {pricingType === 'FIXED' 
                        ? formatBRL(parseFloat(counterPrice), true)
                        : pricingType === 'PER_KM'
                          ? `R$ ${parseFloat(counterPricePerKm).toLocaleString('pt-BR')}/km (Total: ${formatBRL(parseFloat(counterPricePerKm) * freightDistance, true)})`
                          : `R$ ${parseFloat(counterPricePerTon).toLocaleString('pt-BR')}/ton (Total: ${formatBRL(parseFloat(counterPricePerTon) * weightPerTruckInTons, true)})`
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
                : pricingType === 'PER_KM'
                  ? !counterPricePerKm || !freightDistance || freightDistance <= 0
                  : !counterPricePerTon || !weightPerTruckInTons || weightPerTruckInTons <= 0)
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