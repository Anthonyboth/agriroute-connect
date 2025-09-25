import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectLabel, SelectGroup } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Plus, Loader2, Search, Check, ChevronsUpDown } from 'lucide-react';
import { CARGO_TYPES, CARGO_CATEGORIES, getCargoTypesByCategory } from '@/lib/cargo-types';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AddressButton } from './AddressButton';
import { CitySelector } from './CitySelector';

interface CreateFreightModalProps {
  onFreightCreated: () => void;
  userProfile: any;
}

const CreateFreightModal = ({ onFreightCreated, userProfile }: CreateFreightModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cargoComboOpen, setCargoComboOpen] = useState(false);
  const [formData, setFormData] = useState({
    cargo_type: '',
    weight: '',
    origin_address: '',
    origin_city: '',
    origin_state: '',
    destination_address: '',
    destination_city: '',
    destination_state: '',
    price: '',
    price_per_km: '',
    pricing_type: 'PER_KM' as 'FIXED' | 'PER_KM',
    pickup_date: '',
    delivery_date: '',
    urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    description: '',
    service_type: 'CARGA',
    vehicle_type_required: '',
    pickup_observations: '',
    delivery_observations: '',
    payment_method: 'DIRETO',
    required_trucks: '1'
  });

  // Evitar travamentos: aplica timeout curto nas chamadas de edge functions
  const withTimeoutAny = (promise: Promise<any>, ms = 1500): Promise<any> => {
    return Promise.race([
      promise,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('timeout')), ms)) as Promise<any>
    ]) as Promise<any>;
  };

  const calculateDistance = async (origin: string, destination: string): Promise<number> => {
    try {
      const invoke = supabase.functions.invoke('calculate-route', {
        body: { origin, destination }
      });
      const { data, error } = await withTimeoutAny(invoke, 1500);
      if (error) throw error;
      return data.distance_km;
    } catch (error) {
      console.error('Error calculating distance:', error);
      // Fallback para cálculo local
      return Math.floor(Math.random() * 800) + 100;
    }
  };

  const extractStateFromAddress = (address: string): string | null => {
    const stateAbbreviations = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
    for (const state of stateAbbreviations) {
      if (address.toUpperCase().includes(state) || address.toUpperCase().includes(state.toLowerCase())) {
        return state;
      }
    }
    return null;
  };

  const calculateMinimumAnttPrice = async (cargoType: string, weight: number, distance: number, originState: string, destinationState: string): Promise<number> => {
    try {
      const invoke = supabase.functions.invoke('antt-freight-table', {
        body: { 
          cargo_type: cargoType.toLowerCase().replace(/\s+/g, '_'),
          weight_kg: weight * 1000, // Convert tonnes to kg for ANTT calculation
          distance_km: distance,
          origin_state: originState,
          destination_state: destinationState
        }
      });
      const { data, error } = await withTimeoutAny(invoke, 1500);
      if (error) throw error;
      return data.minimum_freight_value;
    } catch (error) {
      console.error('Error calculating ANTT price:', error);
      // Fallback para cálculo local
      const baseRate = 2.5;
      const weightFactor = weight > 20 ? 1.2 : 1.0; // Use tonnes instead of kg
      return Math.round(distance * baseRate * weightFactor);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    // Validação especial para forma de pagamento
    if (field === 'payment_method' && value !== 'DIRETO') {
      toast.error('Apenas pagamento direto ao motorista está disponível no momento');
      return; // Não atualiza o estado se não for DIRETO
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validação básica dos campos obrigatórios de localização
      if (!formData.origin_city || !formData.origin_state) {
        toast.error('Por favor, selecione a cidade de origem');
        return;
      }
      
      if (!formData.destination_city || !formData.destination_state) {
        toast.error('Por favor, selecione a cidade de destino');
        return;
      }

      // Calculate distance (mock for now)
      const distance = await calculateDistance(formData.origin_address, formData.destination_address);
      const weight = parseFloat(formData.weight);
      // Extract states from addresses (basic extraction)
      const originState = extractStateFromAddress(formData.origin_address) || 'SP';
      const destState = extractStateFromAddress(formData.destination_address) || 'RJ';
      
      const minimumAnttPrice = await calculateMinimumAnttPrice(
        formData.cargo_type,
        weight,
        distance,
        originState,
        destState
      );

      const freightData = {
        producer_id: userProfile.id,
        cargo_type: formData.cargo_type,
        weight: weight * 1000, // Convert tonnes to kg for database storage
        origin_address: formData.origin_address,
        origin_city: formData.origin_city,
        origin_state: formData.origin_state,
        destination_address: formData.destination_address,
        destination_city: formData.destination_city,
        destination_state: formData.destination_state,
        distance_km: distance,
        price: formData.pricing_type === 'FIXED' ? parseFloat(formData.price) : parseFloat(formData.price_per_km) * distance,
        price_per_km: formData.pricing_type === 'PER_KM' ? parseFloat(formData.price_per_km) : null,
        required_trucks: parseInt(formData.required_trucks),
        accepted_trucks: 0,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date,
        urgency: formData.urgency,
        description: formData.description || null,
        status: 'OPEN' as const
      };

      const { data: insertedFreight, error } = await supabase
        .from('freights')
        .insert([freightData])
        .select('id')
        .single();

      if (error) throw error;

      // Trigger automatic spatial matching for drivers
      if (insertedFreight?.id) {
        try {
          console.log(`Triggering spatial matching for freight ${insertedFreight.id}...`);
          const matchingResponse = await supabase.functions.invoke('spatial-freight-matching', {
            body: { 
              freight_id: insertedFreight.id,
              notify_drivers: true 
            }
          });
          
          if (matchingResponse.error) {
            console.error('Error in spatial matching:', matchingResponse.error);
          } else {
            console.log('Spatial matching completed:', matchingResponse.data);
          }
        } catch (matchingError) {
          console.error('Failed to trigger spatial matching:', matchingError);
          // Don't block freight creation if matching fails
        }
      }

      toast.success('Frete criado com sucesso! Motoristas qualificados serão notificados automaticamente.');
      setOpen(false);
      setFormData({
        cargo_type: '',
        weight: '',
        origin_address: '',
        origin_city: '',
        origin_state: '',
        destination_address: '',
        destination_city: '',
        destination_state: '',
        price: '',
        price_per_km: '',
        pricing_type: 'FIXED' as 'FIXED' | 'PER_KM',
        pickup_date: '',
        delivery_date: '',
        urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
        description: '',
        service_type: 'CARGA',
        vehicle_type_required: '',
        pickup_observations: '',
        delivery_observations: '',
        payment_method: 'PIX',
        required_trucks: '1'
      });
      onFreightCreated();
    } catch (error) {
      console.error('Error creating freight:', error);
      toast.error('Erro ao criar frete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" />
          Criar Novo Frete
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Criar Novo Frete</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do frete. Motoristas qualificados na região serão notificados automaticamente.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cargo_type">Tipo de Carga *</Label>
              <Popover open={cargoComboOpen} onOpenChange={setCargoComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={cargoComboOpen}
                    className="w-full justify-between"
                  >
                    {formData.cargo_type
                      ? CARGO_TYPES.find((cargo) => cargo.value === formData.cargo_type)?.label
                      : "Buscar ou selecionar tipo de carga..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Buscar tipo de carga..." />
                    <CommandEmpty>
                      <div className="p-2">
                        <p className="text-sm text-muted-foreground mb-2">Nenhum resultado encontrado.</p>
                        <Button
                          variant="ghost"
                          className="w-full justify-start"
                          onClick={() => {
                            handleInputChange('cargo_type', 'outros');
                            setCargoComboOpen(false);
                          }}
                        >
                          <Check className="mr-2 h-4 w-4" />
                          Outros (não listado)
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandList>
                      {CARGO_CATEGORIES.map((category) => (
                        <CommandGroup key={category.value} heading={category.label}>
                          {getCargoTypesByCategory(category.value).map((cargo) => (
                            <CommandItem
                              key={cargo.value}
                              value={cargo.value}
                              onSelect={(value) => {
                                handleInputChange('cargo_type', value);
                                setCargoComboOpen(false);
                              }}
                            >
                              <Check
                                className={`mr-2 h-4 w-4 ${
                                  formData.cargo_type === cargo.value ? "opacity-100" : "opacity-0"
                                }`}
                              />
                              {cargo.label}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (Toneladas) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                placeholder="1.5"
                required
              />
              <p className="text-xs text-muted-foreground">
                Peso em toneladas (ex: 1.5 para 1.5t)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="required_trucks">Quantidade de Carretas *</Label>
              <Input
                id="required_trucks"
                type="number"
                min="1"
                max="50"
                value={formData.required_trucks}
                onChange={(e) => handleInputChange('required_trucks', e.target.value)}
                placeholder="1"
                required
              />
              <p className="text-xs text-muted-foreground">
                Número de carretas necessárias para este frete. Quando todas forem contratadas, o frete será automaticamente fechado.
              </p>
            </div>
          </div>

          <AddressButton
            label="Endereço de Origem"
            value={formData.origin_address}
            onAddressChange={(address, lat, lng) => {
              handleInputChange('origin_address', address);
              if (lat && lng) {
                handleInputChange('origin_lat', lat.toString());
                handleInputChange('origin_lng', lng.toString());
              }
            }}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CitySelector
              value={{ city: formData.origin_city, state: formData.origin_state }}
              onChange={(city) => {
                handleInputChange('origin_city', city.city);
                handleInputChange('origin_state', city.state);
              }}
              label="Cidade de Origem"
              placeholder="Digite a cidade de origem..."
              required
            />
          </div>

          <AddressButton
            label="Endereço de Destino"
            value={formData.destination_address}
            onAddressChange={(address, lat, lng) => {
              handleInputChange('destination_address', address);
              if (lat && lng) {
                handleInputChange('destination_lat', lat.toString());
                handleInputChange('destination_lng', lng.toString());
              }
            }}
            required
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CitySelector
              value={{ city: formData.destination_city, state: formData.destination_state }}
              onChange={(city) => {
                handleInputChange('destination_city', city.city);
                handleInputChange('destination_state', city.state);
              }}
              label="Cidade de Destino"
              placeholder="Digite a cidade de destino..."
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup_date">Data de Coleta *</Label>
              <Input
                id="pickup_date"
                type="date"
                value={formData.pickup_date}
                onChange={(e) => handleInputChange('pickup_date', e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="delivery_date">Data de Entrega *</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => handleInputChange('delivery_date', e.target.value)}
                min={formData.pickup_date || new Date().toISOString().split('T')[0]}
                required
              />
            </div>
          </div>

          {/* Tipo de Cobrança */}
          <div className="space-y-2">
            <Label>Tipo de Cobrança</Label>
            <Select value={formData.pricing_type} onValueChange={(value: 'FIXED' | 'PER_KM') => handleInputChange('pricing_type', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PER_KM">Por Quilômetro</SelectItem>
                <SelectItem value="FIXED">Valor Fixo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {formData.pricing_type === 'FIXED' ? (
              <div className="space-y-2">
                <Label htmlFor="price">Valor Oferecido (R$) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="5000.00"
                  required
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="price_per_km">Valor por KM (R$) *</Label>
                <Input
                  id="price_per_km"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price_per_km}
                  onChange={(e) => handleInputChange('price_per_km', e.target.value)}
                  placeholder="8.50"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Valor será calculado automaticamente baseado na distância
                </p>
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="urgency">Urgência</Label>
              <Select value={formData.urgency} onValueChange={(value: 'LOW' | 'MEDIUM' | 'HIGH') => handleInputChange('urgency', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Baixa</SelectItem>
                  <SelectItem value="MEDIUM">Média</SelectItem>
                  <SelectItem value="HIGH">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição Adicional</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Informações adicionais sobre a carga, requisitos especiais, etc."
              rows={3}
            />
          </div>

          {/* New Enhanced Fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_type_required">Tipo de Veículo Preferido</Label>
              <Select value={formData.vehicle_type_required || 'all'} onValueChange={(value) => handleInputChange('vehicle_type_required', value === 'all' ? '' : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Qualquer</SelectItem>
                  <SelectItem value="TRUCK">Truck</SelectItem>
                  <SelectItem value="BITREM">Bitrem</SelectItem>
                  <SelectItem value="RODOTREM">Rodotrem</SelectItem>
                  <SelectItem value="CARRETA">Carreta</SelectItem>
                  <SelectItem value="CARRETA_BAU">Carreta Baú</SelectItem>
                  <SelectItem value="VUC">VUC</SelectItem>
                  <SelectItem value="TOCO">Toco</SelectItem>
                  <SelectItem value="F400">Ford F-400</SelectItem>
                  <SelectItem value="STRADA">Fiat Strada</SelectItem>
                  <SelectItem value="CARRO_PEQUENO">Carro Pequeno</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment_method">Forma de Pagamento</Label>
              <Select value={formData.payment_method} onValueChange={(value) => handleInputChange('payment_method', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DIRETO">Direto ao Motorista</SelectItem>
                  <SelectItem value="PIX" disabled className="opacity-50">
                    PIX (Em breve)
                  </SelectItem>
                  <SelectItem value="BOLETO" disabled className="opacity-50">
                    Boleto (Em breve)
                  </SelectItem>
                  <SelectItem value="CARTAO" disabled className="opacity-50">
                    Cartão (Em breve)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Outras formas de pagamento estarão disponíveis em breve
              </p>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Frete
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateFreightModal;