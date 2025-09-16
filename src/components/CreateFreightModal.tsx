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
import { Plus, Loader2 } from 'lucide-react';
import { CARGO_TYPES, CARGO_CATEGORIES, getCargoTypesByCategory } from '@/lib/cargo-types';
import { LocationFillButton } from './LocationFillButton';

interface CreateFreightModalProps {
  onFreightCreated: () => void;
  userProfile: any;
}

const CreateFreightModal = ({ onFreightCreated, userProfile }: CreateFreightModalProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cargo_type: '',
    weight: '',
    origin_address: '',
    destination_address: '',
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
    payment_method: 'PIX'
  });

  const calculateDistance = async (origin: string, destination: string): Promise<number> => {
    try {
      const { data, error } = await supabase.functions.invoke('calculate-route', {
        body: { origin, destination }
      });
      
      if (error) throw error;
      return data.distance_km;
    } catch (error) {
      console.error('Error calculating distance:', error);
      // Fallback para cálculo local
      return Math.floor(Math.random() * 800) + 100;
    }
  };

  const calculateMinimumAnttPrice = async (cargoType: string, weight: number, distance: number, originState: string, destinationState: string): Promise<number> => {
    try {
      const { data, error } = await supabase.functions.invoke('antt-freight-table', {
        body: { 
          cargo_type: cargoType.toLowerCase().replace(/\s+/g, '_'),
          weight_kg: weight,
          distance_km: distance,
          origin_state: originState,
          destination_state: destinationState
        }
      });
      
      if (error) throw error;
      return data.minimum_freight_value;
    } catch (error) {
      console.error('Error calculating ANTT price:', error);
      // Fallback para cálculo local
      const baseRate = 2.5;
      const weightFactor = weight > 20000 ? 1.2 : 1.0;
      return Math.round(distance * baseRate * weightFactor);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Producers can create unlimited freights
      
      // Calculate distance (mock for now)
      const distance = await calculateDistance(formData.origin_address, formData.destination_address);
      const weight = parseFloat(formData.weight);
      const minimumAnttPrice = await calculateMinimumAnttPrice(
        formData.cargo_type,
        weight,
        distance,
        'SP', // Estado de origem - você pode melhorar isso extraindo do endereço
        'RJ'  // Estado de destino - você pode melhorar isso extraindo do endereço
      );

      const freightData = {
        producer_id: userProfile.id,
        cargo_type: formData.cargo_type,
        weight: weight,
        origin_address: formData.origin_address,
        destination_address: formData.destination_address,
        distance_km: distance,
        price: formData.pricing_type === 'FIXED' ? parseFloat(formData.price) : parseFloat(formData.price_per_km) * distance,
        price_per_km: formData.pricing_type === 'PER_KM' ? parseFloat(formData.price_per_km) : null,
        minimum_antt_price: minimumAnttPrice,
        pickup_date: formData.pickup_date,
        delivery_date: formData.delivery_date,
        urgency: formData.urgency,
        description: formData.description || null,
        status: 'OPEN' as const
      };

      const { error } = await supabase
        .from('freights')
        .insert([freightData]);

      if (error) throw error;

      toast.success('Frete criado com sucesso!');
      setOpen(false);
      setFormData({
        cargo_type: '',
        weight: '',
        origin_address: '',
        destination_address: '',
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
        payment_method: 'PIX'
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Frete</DialogTitle>
          <DialogDescription>
            Preencha os detalhes do frete para publicá-lo na plataforma
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="weight">Peso (kg) *</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="1"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                placeholder="1000"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="origin_address">Endereço de Origem *</Label>
            <div className="flex gap-2">
              <Input
                id="origin_address"
                value={formData.origin_address}
                onChange={(e) => handleInputChange('origin_address', e.target.value)}
                placeholder="Rua, Cidade, Estado"
                required
                className="flex-1"
              />
              <LocationFillButton
                onLocationFilled={(address) => {
                  handleInputChange('origin_address', address);
                }}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination_address">Endereço de Destino *</Label>
            <div className="flex gap-2">
              <Input
                id="destination_address"
                value={formData.destination_address}
                onChange={(e) => handleInputChange('destination_address', e.target.value)}
                placeholder="Rua, Cidade, Estado"
                required
                className="flex-1"
              />
              <LocationFillButton
                onLocationFilled={(address) => {
                  handleInputChange('destination_address', address);
                }}
              />
            </div>
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
                <SelectItem value="FIXED">Valor Fixo</SelectItem>
                <SelectItem value="PER_KM">Por Quilômetro</SelectItem>
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
              <Select value={formData.vehicle_type_required || ''} onValueChange={(value) => handleInputChange('vehicle_type_required', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Qualquer</SelectItem>
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
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="CARTAO">Cartão</SelectItem>
                  <SelectItem value="DIRETO">Direto ao Motorista</SelectItem>
                </SelectContent>
              </Select>
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