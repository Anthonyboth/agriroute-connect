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
import { ScrollButtons } from '@/components/ui/scroll-buttons';
import { CalendarIcon, Clock, MapPin, Package } from 'lucide-react';
import { AddressButton } from './AddressButton';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getCityId } from '@/lib/city-utils';

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
  
  // Dados do frete - origem
  const [originAddress, setOriginAddress] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [originState, setOriginState] = useState('');
  const [originLat, setOriginLat] = useState<number>();
  const [originLng, setOriginLng] = useState<number>();
  
  // Dados do frete - destino
  const [destinationAddress, setDestinationAddress] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationState, setDestinationState] = useState('');
  const [destinationLat, setDestinationLat] = useState<number>();
  const [destinationLng, setDestinationLng] = useState<number>();
  
  // Dados do frete - outros
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
  
  // Controle explícito dos popovers do calendário para evitar abertura/acoplamento incorretos
  const [dateOpen, setDateOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !scheduledDate) return;

    // Validar endereços estruturados
    if (!originCity || !originState) {
      toast.error('Por favor, preencha o endereço de origem completo com cidade e estado');
      return;
    }
    if (!destinationCity || !destinationState) {
      toast.error('Por favor, preencha o endereço de destino completo com cidade e estado');
      return;
    }

    setLoading(true);
    try {
      // Buscar city_ids
      const originCityId = await getCityId(originCity, originState);
      const destinationCityId = await getCityId(destinationCity, destinationState);
      
      const freightData = {
        producer_id: profile.id,
        weight: parseFloat(weight) * 1000, // Convert tonnes to kg for database
        
        // Origem estruturada
        origin_address: originAddress,
        origin_city: originCity,
        origin_state: originState,
        origin_lat: originLat,
        origin_lng: originLng,
        origin_city_id: originCityId,
        
        // Destino estruturado
        destination_address: destinationAddress,
        destination_city: destinationCity,
        destination_state: destinationState,
        destination_lat: destinationLat,
        destination_lng: destinationLng,
        destination_city_id: destinationCityId,
        
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
      toast.error('Erro ao agendar frete. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setOriginAddress('');
    setOriginCity('');
    setOriginState('');
    setOriginLat(undefined);
    setOriginLng(undefined);
    setDestinationAddress('');
    setDestinationCity('');
    setDestinationState('');
    setDestinationLat(undefined);
    setDestinationLng(undefined);
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-primary" />
            Agendar Frete Futuro
          </DialogTitle>
          <DialogDescription>
            Agende um frete para uma data específica no futuro. Motoristas poderão encontrar seu frete e fazer propostas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2" id="scheduled-freight-content">
          <ScrollButtons scrollAreaId="scheduled-freight-content">
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Informações Básicas */}
              <div className="bg-card border rounded-lg p-6 space-y-6">
                <h3 className="text-lg font-semibold text-foreground">Informações do Frete</h3>
                
                {/* Tipo de Serviço */}
                <div className="space-y-2">
                  <Label>Tipo de Serviço</Label>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      <SelectItem value="CARGA">Transporte de Carga</SelectItem>
                      <SelectItem value="MUDANCA">Frete Urbano</SelectItem>
                      <SelectItem value="GUINCHO">Guincho</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Endereços */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <AddressButton
                    label="Endereço de Origem"
                    value={originAddress}
                    onAddressChange={(addressData) => {
                      setOriginAddress(addressData.fullAddress);
                      setOriginCity(addressData.city);
                      setOriginState(addressData.state);
                      setOriginLat(addressData.lat);
                      setOriginLng(addressData.lng);
                    }}
                    required
                  />
                  
                  <AddressButton
                    label="Endereço de Destino"
                    value={destinationAddress}
                    onAddressChange={(addressData) => {
                      setDestinationAddress(addressData.fullAddress);
                      setDestinationCity(addressData.city);
                      setDestinationState(addressData.state);
                      setDestinationLat(addressData.lat);
                      setDestinationLng(addressData.lng);
                    }}
                    required
                  />
                </div>

                {/* Cargo, Peso e Valor */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label>Tipo de Carga *</Label>
                    <div className="relative">
                      <Package className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Ex: Soja, Milho"
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
                </div>
              </div>

              {/* Seção de Agendamento */}
              <div className="bg-card border rounded-lg p-6 space-y-6">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  Agendamento
                </h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Coluna da Esquerda - Seleção de Data */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-base font-medium">Data Desejada *</Label>
                      <div className="relative">
                        <Button
                          type="button"
                          onClick={() => setDateOpen((v) => !v)}
                          variant="outline"
                          className="w-full justify-start text-left font-normal h-12"
                        >
                          <CalendarIcon className="mr-3 h-5 w-5" />
                          {scheduledDate ? (
                            <span className="text-base">
                              {format(scheduledDate, 'PPP', { locale: ptBR })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Selecione uma data</span>
                          )}
                        </Button>
                        {dateOpen && (
                          <div className="absolute left-0 top-full mt-2 z-[80] rounded-md border bg-popover p-2 shadow-md">
                            <Calendar
                              mode="single"
                              selected={scheduledDate}
                              onSelect={(d) => { setScheduledDate(d); setDateOpen(false); }}
                              disabled={(date) => date < minDate}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Resumo da Data Selecionada */}
                    {scheduledDate && (
                      <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                        <div className="text-center space-y-2">
                          <CalendarIcon className="h-8 w-8 text-primary mx-auto" />
                          <div className="font-semibold text-primary text-lg">
                            {format(scheduledDate, 'dd/MM/yyyy', { locale: ptBR })}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Data selecionada para o frete
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Coluna da Direita - Opções Flexíveis */}
                  <div className="space-y-6">
                    {/* Flexibilidade de Datas */}
                    <div className="space-y-4">
                      <div className="flex items-start space-x-3">
                        <Switch
                          id="flexible-dates"
                          checked={flexibleDates}
                          onCheckedChange={setFlexibleDates}
                          className="mt-1"
                        />
                        <div className="space-y-2">
                          <Label htmlFor="flexible-dates" className="text-base font-medium">
                            Aceitar datas alternativas
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Permita que motoristas proponham datas próximas à desejada para ter mais opções
                          </p>
                        </div>
                      </div>

                      {/* Range de Datas Flexíveis */}
                      {flexibleDates && (
                        <div className="space-y-4 p-4 bg-secondary/30 rounded-lg border">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="font-medium">Data Mais Cedo</Label>
                              <div className="relative">
                                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal" onClick={() => setStartOpen((v) => !v)}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {dateRangeStart ? (
                                    format(dateRangeStart, 'dd/MM', { locale: ptBR })
                                  ) : (
                                    <span className="text-muted-foreground">Opcional</span>
                                  )}
                                </Button>
                                {startOpen && (
                                  <div className="absolute left-0 top-full mt-2 z-[80] rounded-md border bg-popover p-2 shadow-md">
                                    <Calendar
                                      mode="single"
                                      selected={dateRangeStart}
                                      onSelect={(d) => { setDateRangeStart(d); setStartOpen(false); }}
                                      disabled={(date) => date < minDate || (scheduledDate && date > scheduledDate)}
                                      initialFocus
                                      className="pointer-events-auto"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="font-medium">Data Mais Tarde</Label>
                              <div className="relative">
                                <Button type="button" variant="outline" className="w-full justify-start text-left font-normal" onClick={() => setEndOpen((v) => !v)}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {dateRangeEnd ? (
                                    format(dateRangeEnd, 'dd/MM', { locale: ptBR })
                                  ) : (
                                    <span className="text-muted-foreground">Opcional</span>
                                  )}
                                </Button>
                                {endOpen && (
                                  <div className="absolute left-0 top-full mt-2 z-[80] rounded-md border bg-popover p-2 shadow-md">
                                    <Calendar
                                      mode="single"
                                      selected={dateRangeEnd}
                                      onSelect={(d) => { setDateRangeEnd(d); setEndOpen(false); }}
                                      disabled={(date) => scheduledDate && date < scheduledDate}
                                      initialFocus
                                      className="pointer-events-auto"
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Observações */}
              <div className="bg-card border rounded-lg p-6 space-y-4">
                <h3 className="text-lg font-semibold text-foreground">Observações</h3>
                <div className="space-y-2">
                  <Textarea
                    placeholder="Informações adicionais, requisitos especiais, horários de preferência..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>
              </div>

              {/* Dicas */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                  💡 Dicas para seu frete agendado
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                    <li>• Agende com antecedência para melhores propostas</li>
                    <li>• Use datas flexíveis para mais opções</li>
                  </ul>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
                    <li>• Informe detalhes nas observações</li>
                    <li>• Preços competitivos atraem mais motoristas</li>
                  </ul>
                </div>
              </div>

              {/* Botões */}
              <div className="flex justify-end gap-4 pt-6 border-t bg-background/50 p-6 -mx-6 -mb-6 rounded-b-lg">
                <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="px-8">
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading} className="gradient-primary px-8">
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
          </ScrollButtons>
        </div>
      </DialogContent>
    </Dialog>
  );
};