import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { CalendarIcon, MapPin, Search, Target, Clock, Truck } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { CitySelector } from './CitySelector';
import { FreightCard } from './FreightCard';
import { cn } from '@/lib/utils';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { useDriverPermissions } from '@/hooks/useDriverPermissions';

interface DriverAvailabilityAreasManagerProps {
  driverId?: string;
  onFreightAction?: (freightId: string, action: string) => void;
}

interface AvailabilityEntry {
  date: Date;
  city: string;
  state: string;
}

interface Freight {
  id: string;
  cargo_type: string;
  weight: number;
  origin_address: string;
  destination_address: string;
  pickup_date: string;
  delivery_date: string;
  price: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  status: 'OPEN' | 'IN_NEGOTIATION' | 'ACCEPTED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  distance_km?: number;
  minimum_antt_price?: number;
  service_type?: string;
  producer?: {
    id: string;
    full_name: string;
    contact_phone?: string;
    role: string;
  };
}

export const DriverAvailabilityAreasManager: React.FC<DriverAvailabilityAreasManagerProps> = ({
  driverId,
  onFreightAction
}) => {
  // ✅ Obter permissões do motorista
  const { isAffiliated, companyId } = useCompanyDriver();
  const { canAcceptFreights } = useDriverPermissions();
  
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedCity, setSelectedCity] = useState<{city: string, state: string} | null>(null);
  const [availabilityEntries, setAvailabilityEntries] = useState<AvailabilityEntry[]>([]);
  const [regionFreights, setRegionFreights] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Carregar entradas de disponibilidade existentes
  const loadAvailabilityEntries = async () => {
    if (!driverId) return;

    try {
      const { data, error } = await supabase
        .from('driver_availability')
        .select('*')
        .eq('driver_id', driverId)
        .gte('available_date', new Date().toISOString().split('T')[0])
        .order('available_date', { ascending: true });

      if (error) throw error;

      const entries = (data || []).map(item => ({
        date: new Date(item.available_date),
        city: item.city,
        state: item.state
      }));

      setAvailabilityEntries(entries);
    } catch (error) {
      console.error('Error loading availability entries:', error);
    }
  };

  useEffect(() => {
    loadAvailabilityEntries();
  }, [driverId]);

  // Buscar fretes da região para a data selecionada
  const searchRegionFreights = async () => {
    if (!selectedDate || !selectedCity || !driverId) {
      toast.error('Selecione uma data e cidade primeiro');
      return;
    }

    setIsSearching(true);
    try {
      // Primeiro, salvar a disponibilidade
      await saveAvailability();

      // Buscar fretes na região para a data selecionada
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from('freights')
        .select(`
          *,
          producer:profiles!freights_producer_id_fkey(
            id,
            full_name,
            contact_phone,
            role
          )
        `)
        .eq('status', 'OPEN')
        .gte('pickup_date', dateStr)
        .lte('pickup_date', dateStr)
        .or(`origin_city.ilike.%${selectedCity.city}%,destination_city.ilike.%${selectedCity.city}%`)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setRegionFreights(data || []);
      
      if ((data || []).length === 0) {
        toast.info(`Nenhum frete encontrado em ${selectedCity.city}, ${selectedCity.state} para ${format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}`);
      } else {
        toast.success(`${data.length} fretes encontrados para a região e data selecionadas`);
      }
    } catch (error) {
      console.error('Error searching region freights:', error);
      toast.error('Erro ao buscar fretes da região');
    } finally {
      setIsSearching(false);
    }
  };

  // Salvar disponibilidade na base de dados
  const saveAvailability = async () => {
    if (!selectedDate || !selectedCity || !driverId) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    try {
      // Verificar se já existe entrada para esta data
      const { data: existing } = await supabase
        .from('driver_availability')
        .select('id')
        .eq('driver_id', driverId)
        .eq('available_date', dateStr)
        .eq('city', selectedCity.city)
        .eq('state', selectedCity.state)
        .maybeSingle();

      if (!existing) {
        const { error } = await supabase
          .from('driver_availability')
          .insert({
            driver_id: driverId,
            available_date: dateStr,
            city: selectedCity.city,
            state: selectedCity.state,
            notes: `Disponível em ${selectedCity.city}, ${selectedCity.state}`
          });

        if (error) throw error;

        // Atualizar estado local
        setAvailabilityEntries(prev => [...prev, {
          date: selectedDate,
          city: selectedCity.city,
          state: selectedCity.state
        }]);
      }
    } catch (error) {
      console.error('Error saving availability:', error);
    }
  };

  // Remover entrada de disponibilidade
  const removeAvailability = async (entry: AvailabilityEntry) => {
    if (!driverId) return;

    try {
      const dateStr = format(entry.date, 'yyyy-MM-dd');
      
      const { error } = await supabase
        .from('driver_availability')
        .delete()
        .eq('driver_id', driverId)
        .eq('available_date', dateStr)
        .eq('city', entry.city)
        .eq('state', entry.state);

      if (error) throw error;

      setAvailabilityEntries(prev => 
        prev.filter(e => !(
          e.date.getTime() === entry.date.getTime() && 
          e.city === entry.city && 
          e.state === entry.state
        ))
      );

      toast.success('Disponibilidade removida');
    } catch (error) {
      console.error('Error removing availability:', error);
      toast.error('Erro ao remover disponibilidade');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com informações */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Target className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-primary mb-1">Disponibilidade por Região e Data</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Defina quando e onde você estará disponível para encontrar fretes específicos por região e data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Formulário de busca */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Buscar Fretes por Região e Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Seletor de Data */}
            <div className="space-y-2">
              <Label>Data de Disponibilidade</Label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !selectedDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : "Selecione uma data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      setSelectedDate(date);
                      setIsDatePickerOpen(false);
                    }}
                    disabled={(date) => date < new Date() || date < new Date(Date.now() - 86400000)}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Seletor de Cidade */}
            <div className="space-y-2">
              <Label>Cidade da Região</Label>
              <CitySelector
                label=""
                value={selectedCity || undefined}
                onChange={setSelectedCity}
                placeholder="Digite o nome da cidade..."
              />
            </div>
          </div>

          <Button 
            onClick={searchRegionFreights}
            disabled={!selectedDate || !selectedCity || isSearching}
            className="w-full"
          >
            {isSearching ? (
              <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            Buscar Fretes da Região
          </Button>
        </CardContent>
      </Card>

      {/* Minhas Disponibilidades */}
      {availabilityEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Minhas Disponibilidades Programadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {availabilityEntries.map((entry) => (
                <div
                  key={`${entry.date.toISOString()}-${entry.city}-${entry.state}`}
                  className="p-3 border rounded-lg bg-muted/30 flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">
                      {format(entry.date, 'dd/MM/yyyy', { locale: ptBR })}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {entry.city}, {entry.state}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAvailability(entry)}
                    className="text-destructive hover:text-destructive"
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fretes Encontrados */}
      {regionFreights.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Fretes Encontrados
              </CardTitle>
              <Badge variant="secondary" className="text-lg font-semibold">
                {regionFreights.length} fretes
              </Badge>
            </div>
            {selectedDate && selectedCity && (
              <p className="text-sm text-muted-foreground">
                Fretes em <strong>{selectedCity.city}, {selectedCity.state}</strong> para <strong>{format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}</strong>
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
              {regionFreights.map((freight: any) => (
                <FreightCard
                  key={freight.id}
                  freight={{
                    ...freight,
                    distance_km: freight.distance_km || 0,
                    minimum_antt_price: freight.minimum_antt_price || 0
                  }}
                  showActions={true}
                  canAcceptFreights={canAcceptFreights}
                  isAffiliatedDriver={isAffiliated}
                  driverCompanyId={companyId}
                  onAction={(action) => onFreightAction?.(freight.id, action)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {regionFreights.length === 0 && selectedDate && selectedCity && !isSearching && (
        <Card>
          <CardContent className="text-center py-8">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum Frete Encontrado</h3>
            <p className="text-muted-foreground">
              Não há fretes disponíveis em <strong>{selectedCity.city}, {selectedCity.state}</strong> para{' '}
              <strong>{format(selectedDate, 'dd/MM/yyyy', { locale: ptBR })}</strong>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Tente uma data diferente ou outra cidade próxima.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};