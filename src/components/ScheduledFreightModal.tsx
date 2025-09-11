import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, MapPin, Package } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ScheduledFreightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ScheduledFreightModal: React.FC<ScheduledFreightModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Dados do frete
  const [originAddress, setOriginAddress] = useState('');
  const [destinationAddress, setDestinationAddress] = useState('');
  const [weight, setWeight] = useState('');
  const [cargoType, setCargoType] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  
  // Dados do agendamento
  const [scheduledDate, setScheduledDate] = useState<Date>();
  const [flexibleDates, setFlexibleDates] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState<Date>();
  const [dateRangeEnd, setDateRangeEnd] = useState<Date>();
  const [serviceType, setServiceType] = useState('CARGA');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !scheduledDate) return;

    setLoading(true);
    try {
      const freightData = {
        producer_id: profile.id,
        weight: parseFloat(weight),
        origin_address: originAddress,
        destination_address: destinationAddress,
        cargo_type: cargoType,
        description,
        price: parseFloat(price),
        service_type: serviceType,
        status: 'OPEN' as const,
        
        // Campos de agendamento
        is_scheduled: true,
        scheduled_date: format(scheduledDate, 'yyyy-MM-dd'),
        flexible_dates: flexibleDates,
        date_range_start: flexibleDates && dateRangeStart ? format(dateRangeStart, 'yyyy-MM-dd') : null,
        date_range_end: flexibleDates && dateRangeEnd ? format(dateRangeEnd, 'yyyy-MM-dd') : null,
        
        pickup_date: format(scheduledDate, 'yyyy-MM-dd'),
        delivery_date: format(new Date(scheduledDate.getTime() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // +1 dia
        urgency: 'LOW' as const // Fretes agendados são menos urgentes
      };

      const { error } = await supabase
        .from('freights')
        .insert(freightData);

      if (error) throw error;

      toast.success('Frete agendado com sucesso!');
      resetForm();
      onClose();
      onSuccess?.();

    } catch (error: any) {
      console.error('Erro ao agendar frete:', error);
      toast.error('Erro ao agendar frete: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setOriginAddress('');
    setDestinationAddress('');
    setWeight('');
    setCargoType('');
    setDescription('');
    setPrice('');
    setScheduledDate(undefined);
    setFlexibleDates(false);
    setDateRangeStart(undefined);
    setDateRangeEnd(undefined);
    setServiceType('CARGA');
  };

  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1); // Mínimo amanhã

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Agendar Frete Futuro
          </DialogTitle>
          <DialogDescription>
            Agende um frete para uma data específica no futuro. Motoristas poderão encontrar seu frete e fazer propostas.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo de Serviço */}
          <div className="space-y-2">
            <Label>Tipo de Serviço</Label>
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CARGA">Transporte de Carga</SelectItem>
                <SelectItem value="MUDANCA">Frete Urbano</SelectItem>
                <SelectItem value="GUINCHO">Guincho</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Endereços */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Endereço de Origem *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cidade, Estado - CEP"
                  value={originAddress}
                  onChange={(e) => setOriginAddress(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço de Destino *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cidade, Estado - CEP"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Cargo e Peso */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Carga *</Label>
              <div className="relative">
                <Package className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ex: Soja, Milho, Fertilizantes"
                  value={cargoType}
                  onChange={(e) => setCargoType(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Peso (toneladas) *</Label>
              <Input
                type="number"
                placeholder="Ex: 25"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                step="0.1"
                min="0.1"
                required
              />
            </div>
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label>Valor Estimado (R$) *</Label>
            <Input
              type="number"
              placeholder="Ex: 1500.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              step="0.01"
              min="1"
              required
            />
          </div>

          {/* Data do Agendamento */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data Desejada *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {scheduledDate ? (
                      format(scheduledDate, 'PPP', { locale: ptBR })
                    ) : (
                      <span>Selecione uma data</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    disabled={(date) => date < minDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Flexibilidade de Datas */}
            <div className="flex items-center space-x-3">
              <Switch
                id="flexible-dates"
                checked={flexibleDates}
                onCheckedChange={setFlexibleDates}
              />
              <div className="space-y-1">
                <Label htmlFor="flexible-dates">Aceitar datas alternativas</Label>
                <p className="text-sm text-muted-foreground">
                  Permita que motoristas proponham datas próximas à desejada
                </p>
              </div>
            </div>

            {/* Range de Datas Flexíveis */}
            {flexibleDates && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-secondary/30 rounded-lg">
                <div className="space-y-2">
                  <Label>Data Mais Cedo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRangeStart ? (
                          format(dateRangeStart, 'dd/MM', { locale: ptBR })
                        ) : (
                          <span>Opcional</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateRangeStart}
                        onSelect={setDateRangeStart}
                        disabled={(date) => date < minDate || (scheduledDate && date > scheduledDate)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Data Mais Tarde</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRangeEnd ? (
                          format(dateRangeEnd, 'dd/MM', { locale: ptBR })
                        ) : (
                          <span>Opcional</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateRangeEnd}
                        onSelect={setDateRangeEnd}
                        disabled={(date) => scheduledDate && date < scheduledDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Informações adicionais, requisitos especiais, horários de preferência..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gradient-primary">
              {loading ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Agendando...
                </>
              ) : (
                'Agendar Frete'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};