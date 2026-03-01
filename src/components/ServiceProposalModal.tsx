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
import { showErrorToast } from '@/lib/error-handler';
import { formatKm, formatBRL, formatTons } from '@/lib/formatters';
import { getPricePerTruck, getWeightInTons } from '@/lib/proposal-utils';
import { getCanonicalFreightPrice, type FreightPricingInput } from '@/lib/freightPriceContract';

interface ServiceProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: {
    id: string;
    service_type?: 'CARGA' | 'GUINCHO' | 'MUDANCA' | 'FRETE_MOTO' | 'ENTREGA_PACOTES' | 'TRANSPORTE_PET';
    price: number;
    distance_km?: number;
    weight?: number;
    cargo_type: string;
    origin_address: string;
    destination_address: string;
    pickup_date: string;
    delivery_date?: string;
    minimum_antt_price?: number;
    required_trucks?: number;
    pricing_type?: string | null;
    price_per_ton?: number | null;
    price_per_km?: number | null;
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
  
  // Bloquear modal para serviços urbanos (não aceitam contrapropostas)
  React.useEffect(() => {
    if (isOpen && ['GUINCHO', 'MUDANCA', 'FRETE_MOTO'].includes(freight.service_type || '')) {
      toast.error('Serviços urbanos não aceitam contrapropostas. Apenas aceite o frete.');
      onClose();
    }
  }, [isOpen, freight.service_type, onClose]);
  
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
  const [pricingType, setPricingType] = useState<'FIXED' | 'PER_KM' | 'PER_TON'>('FIXED');
  const [pricePerTon, setPricePerTon] = useState('');
const [pricePerKm, setPricePerKm] = useState('');

  // ✅ Função removida - usamos profile.id diretamente do useAuth

  const getServiceIcon = () => {
    switch (freight.service_type) {
      case 'GUINCHO':
        return <Wrench className="h-5 w-5 text-warning" />;
      case 'MUDANCA':
        return <Home className="h-5 w-5 text-accent" />;
      case 'FRETE_MOTO':
        return <Truck className="h-5 w-5 text-blue-500" />;
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
      case 'FRETE_MOTO':
        return 'Aceitar Frete por Moto';
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

    // ✅ REMOVIDO: Verificação de permissão bloqueante
    // Agora TODOS os motoristas podem enviar propostas
    // A única restrição é se o solicitante do frete não tem cadastro

    const priceValue =
      pricingType === 'PER_KM' ? pricePerKm :
      pricingType === 'PER_TON' ? pricePerTon :
      proposedPrice;
    
    if (!priceValue) {
      toast.error('Informe um valor.');
      return;
    }

    const priceFloat = parseFloat(priceValue);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      toast.error('Valor inválido');
      return;
    }
    
    // Validação específica para FRETE_MOTO
    if (freight.service_type === 'FRETE_MOTO' && priceFloat < 10) {
      toast.error('Frete por moto tem valor mínimo de R$ 10,00');
      return;
    }
    
    const distance = freight.distance_km || 0;
    const weightTons = (freight.weight || 0) / 1000;
    
    // Validação de "Por KM" - precisa ter distância
    if (pricingType === 'PER_KM' && distance <= 0) {
      toast.error('Para proposta por KM, precisamos da distância da rota. Use valor fixo ou aguarde o cálculo da rota.');
      return;
    }
    
    // Validação de "Por TON" - precisa ter peso
    if (pricingType === 'PER_TON' && weightTons <= 0) {
      toast.error('Para proposta por tonelada (TON), o frete precisa ter o peso configurado.');
      return;
    }
    
    const finalPrice =
      pricingType === 'PER_KM'
        ? priceFloat * distance
        : pricingType === 'PER_TON'
          ? priceFloat * weightTons
          : priceFloat;
    
    // Validar se o preço final é válido
    if (finalPrice <= 0) {
      toast.error('O valor da proposta deve ser maior que R$ 0,00');
      return;
    }

    setLoading(true);
    try {
      // ✅ Usa profile.id diretamente - funciona para MOTORISTA e TRANSPORTADORA
      if (!profile?.id) {
        toast.error('Perfil não encontrado. Faça login novamente.');
        setLoading(false);
        return;
      }
      
      const profileId = profile.id;
      
      // ✅ VERIFICAR SE SOLICITANTE TEM CADASTRO (antes de criar proposta)
      const { data: checkData, error: checkError } = await supabase.functions.invoke('check-freight-requester', {
        body: { freight_id: freight.id }
      });
      
      if (checkError) {
        console.error('Erro ao verificar solicitante:', checkError);
        toast.error('Erro ao verificar solicitante do frete');
        setLoading(false);
        return;
      }
      
      // Se solicitante não tem cadastro, bloquear proposta
      if (checkData?.requester?.has_registration === false) {
        toast.error('Não é possível enviar proposta: o solicitante deste frete não possui cadastro no sistema.', {
          duration: 8000
        });
        setLoading(false);
        return;
      }
      
      // Evitar múltiplas propostas para o mesmo frete
      const { data: existingProposal, error: proposalCheckError } = await supabase
        .from('freight_proposals')
        .select('status')
        .eq('freight_id', freight.id)
        .eq('driver_id', profileId)
        .maybeSingle();
      if (proposalCheckError) throw proposalCheckError;
      
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
        driver_id: profileId,
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
          const pricingInfo = pricingType === 'PER_KM' 
            ? `Valor por KM: R$ ${priceFloat.toLocaleString('pt-BR')}/km\n`
            : pricingType === 'PER_TON'
              ? `Valor por TON: R$ ${priceFloat.toLocaleString('pt-BR')}/ton\n`
              : '';
          messageContent = `CONTRA-PROPOSTA: R$ ${finalPrice.toLocaleString('pt-BR')}\n\n${pricingInfo}${message || 'Proposta enviada.'}`;
        }

        await supabase
          .from('freight_messages')
          .insert({
            freight_id: freight.id,
            sender_id: profileId,
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
      showErrorToast(toast, 'Erro ao enviar proposta', error);
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
    setPricePerTon('');
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
            min="0.01"
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
            min="0.01"
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

  const renderFreightMotoForm = () => (
    <>
      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
        <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
          ⚠️ Valor mínimo para frete por moto: R$ 10,00
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Valor do Frete (R$) *</Label>
          <Input
            type="number"
            placeholder="Mínimo R$ 10,00"
            value={proposedPrice}
            onChange={(e) => setProposedPrice(e.target.value)}
            step="0.01"
            min="10"
          />
          <p className="text-xs text-muted-foreground">
            O valor não pode ser inferior a R$ 10,00
          </p>
        </div>

        <div className="space-y-2">
          <Label>Observações</Label>
          <Textarea
            placeholder="Informações adicionais sobre o frete..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
          />
        </div>
      </div>
    </>
  );

  const renderCargaForm = () => {
    const distance = freight.distance_km || 0;
    const requiredTrucks = freight.required_trucks || 1;
    const hasMultipleTrucks = requiredTrucks > 1;
    
    // ✅ CRÍTICO: Calcular valores POR CARRETA
    const freightPricePerTruck = getPricePerTruck(freight.price, requiredTrucks);
    const weightPerTruckInTons = getWeightInTons(freight.weight, requiredTrucks);
    const minAnttTotal = freight.minimum_antt_price || 0;
    const minAnttPerTruck = minAnttTotal > 0 ? getPricePerTruck(minAnttTotal, requiredTrucks) : 0;
    
    // ✅ CRÍTICO: A proposta do banco é o TOTAL, precisa dividir por carretas
    const driverProposedPriceTotal = originalProposal?.proposed_price || 0;
    const driverProposedPerTruck = getPricePerTruck(driverProposedPriceTotal, requiredTrucks);
    
    // Calcular valor proposto atual
    const currentProposedPrice = pricingType === 'PER_KM' 
      ? (parseFloat(pricePerKm) || 0) * distance
      : pricingType === 'PER_TON'
        ? (parseFloat(pricePerTon) || 0) * weightPerTruckInTons
        : parseFloat(proposedPrice) || 0;
    
    const isBelowAntt = minAnttPerTruck > 0 && currentProposedPrice > 0 && currentProposedPrice < minAnttPerTruck;
    
    return (
      <>
        {/* ✅ AVISO: Frete com múltiplas carretas */}
        {hasMultipleTrucks && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 text-sm font-medium">
              <Truck className="h-4 w-4" />
              Frete com {requiredTrucks} carretas
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Você está fazendo proposta para <strong>1 carreta apenas</strong>.
            </p>
          </div>
        )}

        {/* ✅ PROPOSTA ATUAL: Valores usando contrato canônico */}
        {originalProposal && (() => {
          const freightPriceDisplay = getCanonicalFreightPrice({
            pricing_type: freight.pricing_type,
            price_per_ton: freight.price_per_ton,
            price_per_km: freight.price_per_km,
            price: freight.price,
            required_trucks: requiredTrucks,
            weight: freight.weight,
            distance_km: freight.distance_km,
          });
          return (
          <div className="bg-secondary/30 p-3 rounded-lg space-y-2 mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Proposta Atual
              {hasMultipleTrucks && <Badge variant="outline" className="text-xs">por carreta</Badge>}
            </h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Valor original:</span>
              <span className="font-medium">
                {freightPriceDisplay.primaryLabel}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Proposta do motorista:</span>
              <span className="font-medium">
                {(() => {
                  // Use canonical contract to display driver's proposal in the SAME unit as the freight
                  const driverPriceDisplay = getCanonicalFreightPrice({
                    pricing_type: freight.pricing_type,
                    price_per_ton: freight.pricing_type?.toUpperCase()?.includes('TON') && freight.weight && freight.weight > 0
                      ? (driverProposedPriceTotal / (freight.weight / 1000))
                      : null,
                    price_per_km: freight.pricing_type?.toUpperCase()?.includes('KM') && freight.distance_km && freight.distance_km > 0
                      ? (driverProposedPriceTotal / freight.distance_km)
                      : null,
                    price: driverProposedPriceTotal,
                    required_trucks: requiredTrucks,
                    weight: freight.weight,
                    distance_km: freight.distance_km,
                  });
                  return driverPriceDisplay.primaryLabel;
                })()}
              </span>
            </div>
            {freightPriceDisplay.secondaryLabel && (
              <div className="pt-1 text-xs text-muted-foreground">
                {freightPriceDisplay.secondaryLabel}
              </div>
            )}
          </div>
          );
        })()}

        {minAnttPerTruck > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg mb-4">
            <p className="text-sm text-blue-900 dark:text-blue-100 font-medium mb-1">
              ℹ️ Mínimo ANTT{hasMultipleTrucks ? ' por carreta' : ''}: {formatBRL(minAnttPerTruck, true)}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              Valor informativo conforme legislação. Você pode propor abaixo se desejar, mas será notificado.
            </p>
          </div>
        )}

        {isBelowAntt && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 p-3 rounded-lg mb-4">
            <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
              ⚠️ Você está propondo abaixo do mínimo ANTT
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300">
              Proposta: {formatBRL(currentProposedPrice, true)} | 
              Mínimo{hasMultipleTrucks ? ' /carreta' : ''}: {formatBRL(minAnttPerTruck, true)}
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
              O produtor será notificado. É permitido aceitar, mas considere os custos operacionais.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Tipo de Cobrança - sempre 3 opções */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Tipo de Cobrança
              {hasMultipleTrucks && <Badge variant="outline" className="text-xs">por carreta</Badge>}
            </Label>
            <Select 
              value={pricingType} 
              onValueChange={(value: 'FIXED' | 'PER_KM' | 'PER_TON') => setPricingType(value)}
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

          {/* Input dinâmico baseado no tipo */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {pricingType === 'PER_KM'
                ? 'Valor por KM (R$) *'
                : pricingType === 'PER_TON'
                  ? 'Valor por TON (R$) *'
                  : 'Valor Proposto (R$) *'}
              {hasMultipleTrucks && <Badge variant="outline" className="text-xs">por carreta</Badge>}
            </Label>
            
            {pricingType === 'PER_KM' ? (
              <Input
                type="number"
                placeholder="Digite o valor por km"
                value={pricePerKm}
                onChange={(e) => setPricePerKm(e.target.value)}
                step="0.01"
                min="0.01"
              />
            ) : pricingType === 'PER_TON' ? (
              <Input
                type="number"
                placeholder="Digite o valor por tonelada"
                value={pricePerTon}
                onChange={(e) => setPricePerTon(e.target.value)}
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
                min="0.01"
              />
            )}
            
            {/* Mensagem de validação e cálculo para PER_KM */}
            {pricingType === 'PER_KM' && (
              distance > 0 ? (
                pricePerKm ? (
                  <p className="text-sm text-muted-foreground">
                    Total calculado: {formatBRL(parseFloat(pricePerKm) * distance, true)}
                    {hasMultipleTrucks && ' (por carreta)'}
                  </p>
                ) : null
              ) : (
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  ⚠️ Distância não configurada. Não é possível propor por KM.
                </p>
              )
            )}
            
            {/* Mensagem de validação e cálculo para PER_TON */}
            {pricingType === 'PER_TON' && (
              weightPerTruckInTons > 0 ? (
                pricePerTon ? (
                  <p className="text-sm text-muted-foreground">
                    Total calculado: {formatBRL(parseFloat(pricePerTon) * weightPerTruckInTons, true)} ({weightPerTruckInTons.toFixed(1)} ton)
                    {hasMultipleTrucks && ' (por carreta)'}
                  </p>
                ) : null
              ) : (
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  ⚠️ Peso não configurado. Não é possível propor por TON.
                </p>
              )
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
  };

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
                <span className="text-sm">{formatKm(freight.distance_km)}</span>
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
            {freight.service_type === 'FRETE_MOTO' && renderFreightMotoForm()}
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