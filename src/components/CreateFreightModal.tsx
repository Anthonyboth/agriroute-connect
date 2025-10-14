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
import { Plus, Loader2, Truck, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { ANTTValidation } from './ANTTValidation';
import { CARGO_TYPES, CARGO_CATEGORIES, getCargoTypesByCategory, cargoRequiresAxles, AXLE_OPTIONS, VEHICLE_TYPES_URBAN } from '@/lib/cargo-types';
import { LocationFillButton } from './LocationFillButton';
import { CitySelector } from './CitySelector';
import { StructuredAddressInput } from './StructuredAddressInput';
import { freightSchema, validateInput } from '@/lib/validations';
import { getCityId } from '@/lib/city-utils';

interface CreateFreightModalProps {
  onFreightCreated: () => void;
  userProfile: any;
}

const CreateFreightModal = ({ onFreightCreated, userProfile }: CreateFreightModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAxlesSelector, setShowAxlesSelector] = useState(false);
  const [calculatedAnttPrice, setCalculatedAnttPrice] = useState<number | null>(null);
  const [anttDetails, setAnttDetails] = useState<any>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number>(0);
  const [formData, setFormData] = useState({
    cargo_type: '',
    weight: '',
    origin_address: '',
    origin_city: '',
    origin_state: '',
    origin_city_id: undefined as string | undefined,
    origin_lat: undefined as number | undefined,
    origin_lng: undefined as number | undefined,
    destination_address: '',
    destination_city: '',
    destination_state: '',
    destination_city_id: undefined as string | undefined,
    destination_lat: undefined as number | undefined,
    destination_lng: undefined as number | undefined,
    price: '',
    price_per_km: '',
    pricing_type: 'PER_KM' as 'FIXED' | 'PER_KM',
    pickup_date: '',
    delivery_date: '',
    urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    description: '',
    service_type: 'CARGA',
    vehicle_type_required: '',
    vehicle_axles_required: '',
    high_performance: false,
    vehicle_ownership: 'PROPRIO' as 'PROPRIO' | 'TERCEIROS',
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
      const axles = formData.vehicle_axles_required ? parseInt(formData.vehicle_axles_required) : 5;
      
      // Derivar table_type (A/B/C/D)
      let table_type: 'A' | 'B' | 'C' | 'D';
      if (formData.high_performance) {
        table_type = formData.vehicle_ownership === 'PROPRIO' ? 'C' : 'D';
      } else {
        table_type = formData.vehicle_ownership === 'PROPRIO' ? 'A' : 'B';
      }

      const invoke = supabase.functions.invoke('antt-calculator', {
        body: {
          cargo_type: cargoType,
          distance_km: distance,
          axles,
          origin_state: originState || formData.origin_state,
          destination_state: destinationState || formData.destination_state,
          table_type,
        }
      });
      const { data, error } = await withTimeoutAny(invoke, 5000);
      if (error) throw error;

      // Persistir no estado para consistência visual da UI
      setCalculatedAnttPrice(data.minimum_freight_value);
      setAnttDetails(data.calculation_details);

      return (data?.minimum_freight_value as number) ?? 0;
    } catch (error) {
      console.error('❌ Erro ao calcular ANTT:', error);
      toast.error("Não foi possível calcular o preço mínimo ANTT. Tente novamente.");
      return 0;
    }
  };

  const handleInputChange = (field: string, value: any) => {
    // Validação especial para forma de pagamento
    if (field === 'payment_method' && value !== 'DIRETO') {
      toast.error('Apenas pagamento direto ao motorista está disponível no momento');
      return; // Não atualiza o estado se não for DIRETO
    }
    
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Detectar se carga requer seleção de eixos
  React.useEffect(() => {
    if (formData.cargo_type) {
      const requiresAxles = cargoRequiresAxles(formData.cargo_type);
      setShowAxlesSelector(requiresAxles);
      
      // Limpar campos conflitantes
      if (requiresAxles) {
        setFormData(prev => ({ ...prev, vehicle_type_required: '' }));
      } else {
        setFormData(prev => ({ ...prev, vehicle_axles_required: '', high_performance: false }));
        setCalculatedAnttPrice(null);
        setAnttDetails(null);
      }
    }
  }, [formData.cargo_type]);

  // Calcular preço ANTT automaticamente
  const calculateAnttPrice = async () => {
    if (!formData.cargo_type || !calculatedDistance || !formData.vehicle_axles_required) {
      return;
    }
    
    try {
      const axles = parseInt(formData.vehicle_axles_required);
      
      // Derivar table_type (A/B/C/D)
      let table_type: 'A' | 'B' | 'C' | 'D';
      if (formData.high_performance) {
        table_type = formData.vehicle_ownership === 'PROPRIO' ? 'C' : 'D';
      } else {
        table_type = formData.vehicle_ownership === 'PROPRIO' ? 'A' : 'B';
      }

      console.log('🔢 Calculating ANTT price...', {
        cargo_type: formData.cargo_type,
        distance_km: calculatedDistance,
        axles,
        table_type
      });

      const { data, error } = await supabase.functions.invoke('antt-calculator', {
        body: {
          cargo_type: formData.cargo_type,
          distance_km: calculatedDistance,
          axles,
          origin_state: formData.origin_state,
          destination_state: formData.destination_state,
          table_type
        }
      });
      
      if (error) {
        console.error('❌ Error calculating ANTT:', error);
        throw error;
      }
      
      console.log('✅ ANTT calculated:', data);
      setCalculatedAnttPrice(data.minimum_freight_value);
      setAnttDetails(data.calculation_details);
      
      // Sugerir preço se ainda não preenchido
      if (!formData.price && !formData.price_per_km) {
        if (formData.pricing_type === 'FIXED') {
          handleInputChange('price', String(data.suggested_freight_value));
        } else {
          const pricePerKm = data.suggested_freight_value / calculatedDistance;
          handleInputChange('price_per_km', pricePerKm.toFixed(2));
        }
      }
    } catch (error) {
      console.error('Erro ao calcular ANTT:', error);
      toast.error('Erro ao calcular preço ANTT. Tente novamente.');
    }
  };

  // Recalcular ANTT quando parâmetros mudarem
  React.useEffect(() => {
    if (showAxlesSelector && formData.vehicle_axles_required && calculatedDistance > 0) {
      calculateAnttPrice();
    }
  }, [formData.cargo_type, formData.vehicle_axles_required, calculatedDistance, formData.high_performance, formData.vehicle_ownership, showAxlesSelector]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Verificar autenticação antes de criar frete
    if (!userProfile?.id) {
      toast.error('Faça login como produtor para criar um frete.');
      setLoading(false);
      return;
    }
    
    setLoading(true);

    try {
      console.log('=== INICIANDO CRIAÇÃO DE FRETE ===');
      console.log('Dados do formulário:', formData);
      
      // Validação básica dos campos obrigatórios de localização
      if (!formData.origin_city || !formData.origin_state) {
        toast.error('Por favor, selecione a cidade de origem');
        return;
      }
      
      if (!formData.destination_city || !formData.destination_state) {
        toast.error('Por favor, selecione a cidade de destino');
        return;
      }

      // Validação do peso
      const weight = parseFloat(formData.weight);
      if (isNaN(weight) || weight <= 0) {
        toast.error('Peso deve ser maior que zero');
        return;
      }

      console.log('Peso validado:', weight, 'toneladas');

      // Calculate distance (mock for now)
      const distance = await calculateDistance(formData.origin_address, formData.destination_address);
      setCalculatedDistance(distance); // Salvar para cálculo ANTT
      
      // Usar UF selecionada no formulário; se ausente, tentar extrair do endereço
      const originState = formData.origin_state || extractStateFromAddress(formData.origin_address) || 'SP';
      const destState = formData.destination_state || extractStateFromAddress(formData.destination_address) || 'RJ';
      
      const minimumAnttPrice = await calculateMinimumAnttPrice(
        formData.cargo_type,
        weight,
        distance,
        originState,
        destState
      );

      // Buscar city_ids para origem e destino
      const originCityId = formData.origin_city_id || await getCityId(formData.origin_city, formData.origin_state);
      const destinationCityId = formData.destination_city_id || await getCityId(formData.destination_city, formData.destination_state);

      if (!originCityId || !destinationCityId) {
        console.warn('⚠️ city_id não encontrado:', {
          origin: { city: formData.origin_city, state: formData.origin_state, id: originCityId },
          destination: { city: formData.destination_city, state: formData.destination_state, id: destinationCityId }
        });
      }

      const freightData = {
        producer_id: userProfile.id,
        cargo_type: formData.cargo_type,
        weight: weight * 1000, // Convert tonnes to kg for database storage
        origin_address: formData.origin_address,
        origin_city: formData.origin_city,
        origin_state: formData.origin_state,
        origin_city_id: originCityId,
        origin_lat: formData.origin_lat,
        origin_lng: formData.origin_lng,
        destination_address: formData.destination_address,
        destination_city: formData.destination_city,
        destination_state: formData.destination_state,
        destination_city_id: destinationCityId,
        destination_lat: formData.destination_lat,
        destination_lng: formData.destination_lng,
        distance_km: distance,
        minimum_antt_price: minimumAnttPrice,
        price: formData.pricing_type === 'FIXED' ? parseFloat(formData.price) : parseFloat(formData.price_per_km) * distance,
        price_per_km: formData.pricing_type === 'PER_KM' ? parseFloat(formData.price_per_km) : null,
        required_trucks: parseInt(formData.required_trucks),
        accepted_trucks: 0,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date,
        urgency: formData.urgency,
        description: formData.description || null,
        vehicle_type_required: (formData.vehicle_type_required || null) as any,
        vehicle_axles_required: formData.vehicle_axles_required ? parseInt(formData.vehicle_axles_required) : null,
        high_performance: formData.high_performance || false,
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
        origin_city_id: undefined,
        origin_lat: undefined,
        origin_lng: undefined,
        destination_address: '',
        destination_city: '',
        destination_state: '',
        destination_city_id: undefined,
        destination_lat: undefined,
        destination_lng: undefined,
        price: '',
        price_per_km: '',
        pricing_type: 'PER_KM' as 'FIXED' | 'PER_KM',
        pickup_date: '',
        delivery_date: '',
        urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
        description: '',
        service_type: 'CARGA',
        vehicle_type_required: '',
        vehicle_axles_required: '',
        high_performance: false,
        vehicle_ownership: 'PROPRIO' as 'PROPRIO' | 'TERCEIROS',
        pickup_observations: '',
        delivery_observations: '',
        payment_method: 'DIRETO',
        required_trucks: '1'
      });
      onFreightCreated();
    } catch (error) {
      console.error('=== ERRO NA CRIAÇÃO DO FRETE ===', error);
      
      let errorMessage = 'Erro ao criar frete';
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // Tratar mensagens de erro específicas
        if (error.message.includes('weight')) {
          errorMessage = 'Erro na validação do peso. Verifique se o valor está correto.';
        }
      }
      
      toast.error(errorMessage);
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
              <Select
                value={formData.cargo_type}
                onValueChange={(value) => handleInputChange('cargo_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de carga" />
                </SelectTrigger>
                <SelectContent>
                  {CARGO_CATEGORIES.map((category) => (
                    <SelectGroup key={category.value}>
                      <SelectLabel className="font-semibold text-primary">
                        {category.label}
                      </SelectLabel>
                      {getCargoTypesByCategory(category.value).map((cargo) => (
                        <SelectItem key={cargo.value} value={cargo.value}>
                          {cargo.label}
                        </SelectItem>
                      ))}
                      {category.value !== 'outros' && <Separator className="my-1" />}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
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
                Peso em toneladas (valor mínimo 0.01)
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
                Número de carretas necessárias. Cada motorista pode aceitar por valores diferentes através do sistema de propostas.
              </p>
            </div>
          </div>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <CitySelector
    value={{ city: formData.origin_city, state: formData.origin_state }}
    onChange={(city) => {
      handleInputChange('origin_city', city.city);
      handleInputChange('origin_state', city.state);
      if (city.id) {
        handleInputChange('origin_city_id', city.id);
      }
      if (city.lat && city.lng) {
        handleInputChange('origin_lat', String(city.lat));
        handleInputChange('origin_lng', String(city.lng));
      }
    }}
    label="Cidade de Origem"
    placeholder="Digite a cidade de origem..."
    required
  />
</div>

<StructuredAddressInput
  label="Endereço de Origem"
  value={formData.origin_address}
  onChange={(address) => handleInputChange('origin_address', address)}
  required
/>

<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
  <CitySelector
    value={{ city: formData.destination_city, state: formData.destination_state }}
    onChange={(city) => {
      handleInputChange('destination_city', city.city);
      handleInputChange('destination_state', city.state);
      if (city.id) {
        handleInputChange('destination_city_id', city.id);
      }
      if (city.lat && city.lng) {
        handleInputChange('destination_lat', String(city.lat));
        handleInputChange('destination_lng', String(city.lng));
      }
    }}
    label="Cidade de Destino"
    placeholder="Digite a cidade de destino..."
    required
  />
</div>

<StructuredAddressInput
  label="Endereço de Destino"
  value={formData.destination_address}
  onChange={(address) => handleInputChange('destination_address', address)}
  required
/>

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

          {/* Seleção Condicional: Eixos ou Tipo de Veículo */}
          {showAxlesSelector ? (
            <>
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  Para fretes rurais, o preço mínimo ANTT é calculado automaticamente baseado no número de eixos.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="vehicle_axles_required">Número de Eixos Requerido *</Label>
                <Select value={formData.vehicle_axles_required || ''} onValueChange={(value) => handleInputChange('vehicle_axles_required', value)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {AXLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={String(opt.value)}>
                        {opt.label} • {opt.capacity} • {opt.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
                <div>
                  <Label>Propriedade do veículo/implemento</Label>
                  <select
                    value={formData.vehicle_ownership}
                    onChange={(e) => handleInputChange('vehicle_ownership', e.target.value as 'PROPRIO' | 'TERCEIROS')}
                    className="w-full mt-1 px-3 py-2 border rounded-md"
                  >
                    <option value="PROPRIO">Próprio</option>
                    <option value="TERCEIROS">Terceiros</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="high_performance" 
                    checked={formData.high_performance} 
                    onCheckedChange={(checked) => handleInputChange('high_performance', checked)} 
                  />
                  <Label htmlFor="high_performance" className="text-sm">⚡ Alto Desempenho</Label>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Tabela ANTT: {formData.high_performance 
                    ? (formData.vehicle_ownership === 'PROPRIO' ? 'C (Alto desempenho + Próprio)' : 'D (Alto desempenho + Terceiros)')
                    : (formData.vehicle_ownership === 'PROPRIO' ? 'A (Lotação + Próprio)' : 'B (Lotação + Terceiros)')}
                </p>
              </div>
              
              {calculatedAnttPrice && formData.vehicle_axles_required && (formData.price || formData.price_per_km) && (
                <ANTTValidation
                  proposedPrice={formData.pricing_type === 'FIXED' ? parseFloat(formData.price || '0') : parseFloat(formData.price_per_km || '0') * calculatedDistance}
                  minimumAnttPrice={calculatedAnttPrice}
                  distance={calculatedDistance}
                  cargoType={formData.cargo_type}
                  axles={parseInt(formData.vehicle_axles_required)}
                  highPerformance={formData.high_performance}
                  anttDetails={anttDetails}
                />
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="vehicle_type_required">Tipo de Veículo Preferido</Label>
                <Select value={formData.vehicle_type_required || 'all'} onValueChange={(value) => handleInputChange('vehicle_type_required', value === 'all' ? '' : value)}>
                  <SelectTrigger><SelectValue placeholder="Qualquer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Qualquer</SelectItem>
                    {VEHICLE_TYPES_URBAN.map((type) => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Forma de Pagamento</Label>
                <Select value={formData.payment_method} onValueChange={(value) => handleInputChange('payment_method', value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRETO">Direto ao Motorista</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

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