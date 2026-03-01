import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Clock, MapPin, Package, ArrowRight } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-handler';
import { formatDate } from '@/lib/formatters';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';

interface FreightData {
  id: string;
  producer_name: string;
  origin_address: string;
  destination_address: string;
  scheduled_date: string;
  pickup_date?: string;
  cargo_type: string;
  weight: number;
  price: number;
  pricing_type?: string;
  price_per_km?: number;
  price_per_ton?: number;
  required_trucks?: number;
  distance_km?: number;
  flexible_dates: boolean;
  date_range_start?: string;
  date_range_end?: string;
  description?: string;
}

interface FlexibleProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: FreightData | null;
  onSuccess?: () => void;
}

export const FlexibleProposalModal: React.FC<FlexibleProposalModalProps> = ({
  isOpen,
  onClose,
  freight,
  onSuccess
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  const [proposedDate, setProposedDate] = useState<Date>();
  const [proposedPrice, setProposedPrice] = useState('');
  const [proposedPricePerKm, setProposedPricePerKm] = useState('');
  const [proposedPricePerTon, setProposedPricePerTon] = useState('');
  const [pricingType, setPricingType] = useState<'FIXED' | 'PER_KM' | 'PER_TON'>(freight?.price_per_km ? 'PER_KM' : 'FIXED');
  const [message, setMessage] = useState('');
  const [proposalType, setProposalType] = useState<'exact' | 'alternative'>('exact');
  const [pricingSelectOpen, setPricingSelectOpen] = useState(false);

  if (!freight) return null;

  // Usar scheduled_date ou pickup_date como fallback
  const effectiveDate = freight.scheduled_date || freight.pickup_date || new Date().toISOString();
  const originalDate = new Date(effectiveDate);
  const minDate = freight.date_range_start ? new Date(freight.date_range_start) : new Date();
  const maxDate = freight.date_range_end ? new Date(freight.date_range_end) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposedDate) return;

    // ✅ Validações de tipo de precificação
    const distance = freight.distance_km || 0;
    const weightTons = (freight.weight || 0) / 1000;
    
    if (pricingType === 'PER_KM' && distance <= 0) {
      toast.error('Para proposta por KM, o frete precisa ter a distância configurada.');
      return;
    }
    
    if (pricingType === 'PER_TON' && weightTons <= 0) {
      toast.error('Para proposta por tonelada, o frete precisa ter o peso configurado.');
      return;
    }
    if (!proposedDate) return;

    setLoading(true);
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
      return data?.[0]?.id ?? null;
    })();
    if (!driverProfileId) {
      toast.error('Você precisa de um perfil de Motorista para enviar propostas.');
      setLoading(false);
      return;
    }
    try {
      const daysDifference = differenceInDays(proposedDate, originalDate);
      
      if (proposalType === 'exact') {
        const finalPrice = pricingType === 'FIXED' 
          ? parseFloat(proposedPrice) || freight.price
          : pricingType === 'PER_KM'
            ? parseFloat(proposedPricePerKm) * distance
            : parseFloat(proposedPricePerTon) * weightTons;

        const proposalData = {
          freight_id: freight.id,
          driver_id: profile.id,
          proposed_price: finalPrice,
          message: message.trim() || null,
          delivery_estimate_days: 1
        };

        // Impedir múltiplas propostas para o mesmo frete
        const { data: existing, error: existingError } = await supabase
          .from('freight_proposals')
          .select('status')
          .eq('freight_id', freight.id)
          .eq('driver_id', driverProfileId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing && (existing.status === 'PENDING' || existing.status === 'ACCEPTED')) {
          toast.error(existing.status === 'PENDING' ? 'Você já enviou uma proposta para este frete.' : 'Sua proposta já foi aceita.');
          return;
        }

        const { error } = await supabase
          .from('freight_proposals')
          .insert([ { ...proposalData, status: 'PENDING' } ]);

        if (error) throw error;
        toast.success('Proposta enviada com sucesso!');
      } else {
        // Proposta com data alternativa
        // Verificar se já existe uma proposta flexível para este frete
        const { data: existingFlexibleProposal, error: checkFlexibleError } = await supabase
          .from('flexible_freight_proposals')
          .select('id')
          .eq('freight_id', freight.id)
          .eq('driver_id', driverProfileId)
          .single();

        if (checkFlexibleError && checkFlexibleError.code !== 'PGRST116') {
          throw checkFlexibleError;
        }

        if (existingFlexibleProposal) {
          toast.error('Você já fez uma proposta flexível para este frete');
          return;
        }

        const finalPrice = pricingType === 'FIXED' 
          ? parseFloat(proposedPrice) || freight.price
          : pricingType === 'PER_KM'
            ? parseFloat(proposedPricePerKm) * distance
            : parseFloat(proposedPricePerTon) * weightTons;

        const flexibleProposalData = {
          freight_id: freight.id,
          driver_id: driverProfileId,
          proposed_date: format(proposedDate, 'yyyy-MM-dd'),
          original_date: format(originalDate, 'yyyy-MM-dd'),
          days_difference: daysDifference,
          proposed_price: finalPrice,
          message: message.trim() || null
        };

        const { error } = await supabase
          .from('flexible_freight_proposals')
          .insert([flexibleProposalData]);

        if (error) throw error;
        toast.success('Proposta com data alternativa enviada!');
      }

      resetForm();
      onClose();
      onSuccess?.();

    } catch (error: any) {
      showErrorToast(toast, 'Erro ao enviar proposta', error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProposedDate(undefined);
    setProposedPrice('');
    setProposedPricePerKm('');
    setProposedPricePerTon('');
    setPricingType(freight?.price_per_km ? 'PER_KM' : 'FIXED');
    setMessage('');
    setProposalType('exact');
  };

  const getDaysDifferenceText = () => {
    if (!proposedDate) return '';
    const days = differenceInDays(proposedDate, originalDate);
    if (days === 0) return 'Data original';
    if (days > 0) return `${days} dias após a data desejada`;
    return `${Math.abs(days)} dias antes da data desejada`;
  };

  const getDateStatus = () => {
    if (!proposedDate) return 'neutral';
    const days = differenceInDays(proposedDate, originalDate);
    if (days === 0) return 'exact';
    return 'alternative';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Fazer Proposta de Frete
          </DialogTitle>
          <DialogDescription>
            Envie sua proposta para este frete agendado. Você pode propor a data original ou uma alternativa.
          </DialogDescription>
        </DialogHeader>

        {/* Informações do Frete */}
        <div className="bg-secondary/30 p-4 rounded-lg space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-semibold">{freight.producer_name}</h3>
              <p className="text-sm text-muted-foreground">
                {freight.cargo_type} - {(freight.weight / 1000).toFixed(1)}t
              </p>
            </div>
            <Badge variant="secondary" className="text-lg px-3">
              {precoPreenchidoDoFrete(freight.id, freight, { unitOnly: true }).primaryText}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{freight.origin_address}</span>
              <ArrowRight className="h-3 w-3" />
              <span>{freight.destination_address}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <span>Data desejada: {format(originalDate, 'PPP', { locale: ptBR })}</span>
              {freight.flexible_dates && (
                <Badge variant="outline" className="text-xs">Aceita alternativas</Badge>
              )}
            </div>

            {freight.flexible_dates && freight.date_range_start && freight.date_range_end && (
              <div className="text-xs text-muted-foreground">
                Período flexível: {formatDate(freight.date_range_start)} até{' '}
                {formatDate(freight.date_range_end)}
              </div>
            )}
          </div>

          {freight.description && (
            <p className="text-sm text-muted-foreground border-t pt-2">
              {freight.description}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seleção de Data */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data Proposta *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {proposedDate ? (
                      format(proposedDate, 'PPP', { locale: ptBR })
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={proposedDate}
                    onSelect={(date) => {
                      setProposedDate(date);
                      if (date) {
                        const days = differenceInDays(date, originalDate);
                        setProposalType(days === 0 ? 'exact' : 'alternative');
                      }
                    }}
                    disabled={(date) => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      if (date < today) return true;
                      if (maxDate && date > maxDate) return true;
                      return false;
                    }}
                    modifiers={{
                      original: originalDate,
                      inRange: freight.date_range_start && freight.date_range_end ? (date) => {
                        const start = new Date(freight.date_range_start!);
                        const end = new Date(freight.date_range_end!);
                        return date >= start && date <= end;
                      } : undefined
                    }}
                    modifiersStyles={{
                      original: { backgroundColor: 'hsl(var(--primary))', color: 'white' },
                      inRange: { backgroundColor: 'hsl(var(--secondary))' }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>

              {proposedDate && (
                <div className="flex items-center gap-2">
                  <Badge 
                    variant={getDateStatus() === 'exact' ? 'default' : 'secondary'}
                    className="text-xs"
                  >
                    {getDaysDifferenceText()}
                  </Badge>
                  {getDateStatus() === 'alternative' && (
                    <span className="text-xs text-muted-foreground">
                      (Data alternativa)
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Tipo de Cobrança - 3 opções */}
          <div className="space-y-2">
            <Label>Tipo de Cobrança</Label>
            <Select
              open={pricingSelectOpen}
              onOpenChange={setPricingSelectOpen}
              value={pricingType}
              onValueChange={(value: 'FIXED' | 'PER_KM' | 'PER_TON') => {
                const el = document.activeElement as HTMLElement | null;
                el?.blur?.();
                setTimeout(() => {
                  setPricingType(value);
                  setPricingSelectOpen(false);
                }, 0);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de cobrança" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED">Valor Fixo (R$)</SelectItem>
                <SelectItem value="PER_KM">Por Quilômetro (R$/km)</SelectItem>
                <SelectItem value="PER_TON">Por Tonelada (R$/ton)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Valor Proposto - 3 tipos */}
          <div className="space-y-2">
            <Label>
              {pricingType === 'FIXED' 
                ? 'Valor Fixo (R$)' 
                : pricingType === 'PER_KM' 
                  ? 'Valor por KM (R$)' 
                  : 'Valor por Tonelada (R$)'}
            </Label>
            
            {/* Valor Fixo */}
            <div className={pricingType === 'FIXED' ? 'block' : 'hidden'}>
              <Input
                type="number"
                placeholder={`Valor original: ${precoPreenchidoDoFrete(freight.id, freight, { unitOnly: true }).primaryText}`}
                value={proposedPrice}
                onChange={(e) => setProposedPrice(e.target.value)}
                step="0.01"
                min="1"
                inputMode="decimal"
                disabled={pricingType !== 'FIXED'}
                aria-hidden={pricingType !== 'FIXED'}
              />
            </div>
            
            {/* Por KM */}
            <div className={pricingType === 'PER_KM' ? 'block' : 'hidden'}>
              <Input
                type="number"
                placeholder={freight.price_per_km ? `Valor original: R$ ${freight.price_per_km.toLocaleString()}/km` : "8.50"}
                value={proposedPricePerKm}
                onChange={(e) => setProposedPricePerKm(e.target.value)}
                step="0.01"
                min="0.01"
                inputMode="decimal"
                disabled={pricingType !== 'PER_KM'}
                aria-hidden={pricingType !== 'PER_KM'}
              />
            </div>
            
            {/* Por Tonelada */}
            <div className={pricingType === 'PER_TON' ? 'block' : 'hidden'}>
              <Input
                type="number"
                placeholder="150.00"
                value={proposedPricePerTon}
                onChange={(e) => setProposedPricePerTon(e.target.value)}
                step="0.01"
                min="0.01"
                inputMode="decimal"
                disabled={pricingType !== 'PER_TON'}
                aria-hidden={pricingType !== 'PER_TON'}
              />
            </div>

            <div className="text-xs text-muted-foreground">
              {pricingType === 'FIXED' ? (
                `Deixe em branco para manter o valor original (${precoPreenchidoDoFrete(freight.id, freight, { unitOnly: true }).primaryText})`
              ) : pricingType === 'PER_KM' ? (
                <>
                  {(freight.distance_km || 0) > 0 ? (
                    <>
                      Distância estimada: {freight.distance_km || 0} km
                      {proposedPricePerKm && (
                        <div className="mt-1 font-medium text-primary">
                          Total calculado: R$ {(parseFloat(proposedPricePerKm) * (freight.distance_km || 0)).toLocaleString()}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      ⚠️ Distância não configurada. Não é possível propor por KM.
                    </span>
                  )}
                </>
              ) : (
                <>
                  {((freight.weight || 0) / 1000) > 0 ? (
                    <>
                      Peso: {((freight.weight || 0) / 1000).toFixed(1)} toneladas
                      {proposedPricePerTon && (
                        <div className="mt-1 font-medium text-primary">
                          Total calculado: R$ {(parseFloat(proposedPricePerTon) * ((freight.weight || 0) / 1000)).toLocaleString()} ({((freight.weight || 0) / 1000).toFixed(1)} ton)
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-yellow-600 dark:text-yellow-400">
                      ⚠️ Peso não configurado. Não é possível propor por tonelada.
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Mensagem */}
          <div className="space-y-2">
            <Label>Mensagem para o Produtor</Label>
            <Textarea
              placeholder="Apresente-se, explique sua experiência, justifique a data alternativa se aplicável..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          {/* Resumo da Proposta */}
          {proposedDate && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-2">Resumo da Proposta</h4>
              <div className="space-y-1 text-sm">
                <div>Data: {format(proposedDate, 'PPP', { locale: ptBR })}</div>
                <div>
                  Valor: R$ {(pricingType === 'FIXED' 
                    ? parseFloat(proposedPrice) || freight.price
                    : pricingType === 'PER_KM'
                      ? parseFloat(proposedPricePerKm) * (freight.distance_km || 0) || freight.price
                      : parseFloat(proposedPricePerTon) * ((freight.weight || 0) / 1000) || freight.price
                  ).toLocaleString()}
                  {pricingType === 'PER_KM' && proposedPricePerKm && ` (R$ ${proposedPricePerKm}/km)`}
                  {pricingType === 'PER_TON' && proposedPricePerTon && ` (R$ ${proposedPricePerTon}/ton)`}
                </div>
                <div className="text-muted-foreground">{getDaysDifferenceText()}</div>
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !proposedDate} className="gradient-primary">
              {loading ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                'Enviar Proposta'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};