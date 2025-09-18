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

interface FreightData {
  id: string;
  producer_name: string;
  origin_address: string;
  destination_address: string;
  scheduled_date: string;
  cargo_type: string;
  weight: number;
  price: number;
  price_per_km?: number;
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
  const [pricingType, setPricingType] = useState<'FIXED' | 'PER_KM'>(freight?.price_per_km ? 'PER_KM' : 'FIXED');
  const [message, setMessage] = useState('');
  const [proposalType, setProposalType] = useState<'exact' | 'alternative'>('exact');
  const [pricingSelectOpen, setPricingSelectOpen] = useState(false);

  if (!freight) return null;

  const originalDate = new Date(freight.scheduled_date);
  const minDate = freight.date_range_start ? new Date(freight.date_range_start) : new Date();
  const maxDate = freight.date_range_end ? new Date(freight.date_range_end) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !proposedDate) return;

    setLoading(true);
    try {
      const daysDifference = differenceInDays(proposedDate, originalDate);
      
      if (proposalType === 'exact') {
        // Usar upsert para evitar erro de constraint única
        const finalPrice = pricingType === 'FIXED' 
          ? parseFloat(proposedPrice) || freight.price
          : parseFloat(proposedPricePerKm) * (freight.distance_km || 0);

        const proposalData = {
          freight_id: freight.id,
          driver_id: profile.id,
          proposed_price: finalPrice,
          message: message.trim() || null,
          delivery_estimate_days: 1
        };

        const { error } = await supabase
          .from('freight_proposals')
          .upsert([proposalData], {
            onConflict: 'freight_id,driver_id'
          });

        if (error) throw error;
        toast.success('Proposta enviada com sucesso!');
      } else {
        // Proposta com data alternativa
        // Verificar se já existe uma proposta flexível para este frete
        const { data: existingFlexibleProposal, error: checkFlexibleError } = await supabase
          .from('flexible_freight_proposals')
          .select('id')
          .eq('freight_id', freight.id)
          .eq('driver_id', profile.id)
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
          : parseFloat(proposedPricePerKm) * (freight.distance_km || 0);

        const flexibleProposalData = {
          freight_id: freight.id,
          driver_id: profile.id,
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
      console.error('Erro ao enviar proposta:', error);
      toast.error('Erro ao processar ação: ' + (error.message || 'Tente novamente'));
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setProposedDate(undefined);
    setProposedPrice('');
    setProposedPricePerKm('');
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
    <Dialog open={isOpen} onOpenChange={onClose}>
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
              R$ {freight.price.toLocaleString()}
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
                Período flexível: {format(new Date(freight.date_range_start), 'dd/MM')} até{' '}
                {format(new Date(freight.date_range_end), 'dd/MM')}
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

          {/* Tipo de Cobrança */}
          <div className="space-y-2">
            <Label>Tipo de Cobrança</Label>
            <Select
              open={pricingSelectOpen}
              onOpenChange={setPricingSelectOpen}
              value={pricingType}
              onValueChange={(value: 'FIXED' | 'PER_KM') => {
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
                <SelectItem value="FIXED">Valor Fixo</SelectItem>
                <SelectItem value="PER_KM">Por Quilômetro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Valor Proposto */}
          <div className="space-y-2">
            <Label>{pricingType === 'FIXED' ? 'Valor Fixo (R$)' : 'Valor por KM (R$)'}</Label>
            
            <div className={pricingType === 'FIXED' ? 'block' : 'hidden'}>
              <Input
                type="number"
                placeholder={`Valor original: R$ ${freight.price.toLocaleString()}`}
                value={proposedPrice}
                onChange={(e) => setProposedPrice(e.target.value)}
                step="0.01"
                min="1"
                inputMode="decimal"
                disabled={pricingType !== 'FIXED'}
                aria-hidden={pricingType !== 'FIXED'}
              />
            </div>
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

            <div className="text-xs text-muted-foreground">
              {pricingType === 'FIXED' ? (
                `Deixe em branco para manter o valor original (R$ ${freight.price.toLocaleString()})`
              ) : (
                <>
                  Distância estimada: {freight.distance_km || 0} km
                  {proposedPricePerKm && (
                    <div className="mt-1 font-medium">
                      Total calculado: R$ {(parseFloat(proposedPricePerKm) * (freight.distance_km || 0)).toLocaleString()}
                    </div>
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
                    : parseFloat(proposedPricePerKm) * (freight.distance_km || 0) || freight.price
                  ).toLocaleString()}
                  {pricingType === 'PER_KM' && proposedPricePerKm && ` (R$ ${proposedPricePerKm}/km)`}
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