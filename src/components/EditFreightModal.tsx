import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon } from 'lucide-react';
import { AddressButton } from './AddressButton';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CARGO_TYPES } from '@/lib/cargo-types';

interface EditFreightModalProps {
  isOpen: boolean;
  onClose: () => void;
  freight: any;
  onSuccess: () => void;
}

export const EditFreightModal: React.FC<EditFreightModalProps> = ({
  isOpen,
  onClose,
  freight,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    cargo_type: '',
    weight: '',
    origin_address: '',
    origin_lat: undefined as number | undefined,
    origin_lng: undefined as number | undefined,
    destination_address: '',
    destination_lat: undefined as number | undefined,
    destination_lng: undefined as number | undefined,
    pickup_date: new Date(),
    delivery_date: new Date(),
    price: '',
    pricing_type: 'FIXED' as 'FIXED' | 'PER_KM' | 'PER_TON',
    description: '',
    urgency: 'MEDIUM',
    required_trucks: 1
  });
  const [loading, setLoading] = useState(false);
  const [initialValues, setInitialValues] = useState<any>(null);

  // Atualizar formulário sempre que o frete mudar
  useEffect(() => {
    if (freight && isOpen) {
      const initialData = {
        distance_km: freight.distance_km,
        vehicle_axles_required: freight.vehicle_axles_required,
        high_performance: freight.high_performance,
        cargo_type: freight.cargo_type
      };
      setInitialValues(initialData);
      
      // Determine pricing_type and the correct value to show
      const pricingType = freight.pricing_type || 'FIXED';
      let priceValue = '';
      if (pricingType === 'PER_KM' && freight.price_per_km) {
        priceValue = freight.price_per_km.toString();
      } else if (pricingType === 'PER_TON' && freight.price_per_km) {
        // price_per_km stores per-ton rate for PER_TON type
        priceValue = freight.price_per_km.toString();
      } else {
        priceValue = freight.price ? freight.price.toString() : '';
      }

      setFormData({
        cargo_type: freight.cargo_type || '',
        weight: freight.weight ? (freight.weight / 1000).toString() : '',
        origin_address: freight.origin_address || '',
        origin_lat: freight.origin_lat,
        origin_lng: freight.origin_lng,
        destination_address: freight.destination_address || '',
        destination_lat: freight.destination_lat,
        destination_lng: freight.destination_lng,
        pickup_date: freight.pickup_date ? new Date(freight.pickup_date) : new Date(),
        delivery_date: freight.delivery_date ? new Date(freight.delivery_date) : new Date(),
        price: priceValue,
        pricing_type: pricingType,
        description: freight.description || '',
        urgency: (freight.urgency as 'LOW' | 'MEDIUM' | 'HIGH') || 'MEDIUM',
        required_trucks: freight.required_trucks || 1
      });
    }
  }, [freight, isOpen]);

  // Resetar formulário quando fechar
  const handleClose = () => {
    setFormData({
      cargo_type: '',
      weight: '',
      origin_address: '',
      origin_lat: undefined,
      origin_lng: undefined,
      destination_address: '',
      destination_lat: undefined,
      destination_lng: undefined,
      pickup_date: new Date(),
      delivery_date: new Date(),
      price: '',
      pricing_type: 'FIXED',
      description: '',
      urgency: 'MEDIUM',
      required_trucks: 1
    });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Check if we need to recalculate ANTT minimum
      let updatedMinimumAntt = freight.minimum_antt_price;
      let anttCalculationFailed = false;
      
      // Determine if ANTT-relevant fields changed
      const distanceChanged = freight.distance_km !== initialValues?.distance_km;
      const axlesChanged = freight.vehicle_axles_required !== initialValues?.vehicle_axles_required;
      const highPerfChanged = freight.high_performance !== initialValues?.high_performance;
      const cargoChanged = freight.cargo_type !== initialValues?.cargo_type;
      
      const needsAnttRecalc = distanceChanged || axlesChanged || highPerfChanged || cargoChanged;

      if (needsAnttRecalc && freight.distance_km && freight.cargo_type) {
        try {
          console.log('[EditFreight] Recalculating ANTT minimum...');
          
          const tableType = freight.high_performance 
            ? (freight.vehicle_ownership === 'PROPRIO' ? 'C' : 'D')
            : (freight.vehicle_ownership === 'PROPRIO' ? 'A' : 'B');
          const axles = freight.vehicle_axles_required || 5;
          const requiredTrucks = freight.required_trucks || 1;
          
          const { data: anttData, error: anttError } = await supabase.functions.invoke('antt-calculator', {
            body: {
              cargo_type: freight.cargo_type,
              distance_km: freight.distance_km,
              axles: axles,
              table_type: tableType,
              required_trucks: requiredTrucks
            }
          });

          if (anttError) {
            console.error('[EditFreight] ANTT calculation error:', anttError);
            anttCalculationFailed = true;
          } else if (!anttData?.minimum_freight_value_total) {
            console.error('[EditFreight] Invalid ANTT response:', anttData);
            anttCalculationFailed = true;
          } else {
            updatedMinimumAntt = anttData.minimum_freight_value_total; // Usar valor TOTAL
            console.log('[EditFreight] ANTT recalculated:', {
              per_truck: anttData.minimum_freight_value,
              total: updatedMinimumAntt,
              trucks: requiredTrucks
            });
            toast.success(`ANTT recalculado: R$ ${updatedMinimumAntt.toFixed(2)}`);
          }
        } catch (anttError) {
          console.error('[EditFreight] Failed to recalculate ANTT:', anttError);
          anttCalculationFailed = true;
        }
        
        // ✅ VALIDAÇÃO: Não permitir salvar se recálculo falhou
        if (anttCalculationFailed && freight.service_type === 'CARGA') {
          toast.error('Erro ao recalcular ANTT. Por favor, tente novamente.');
          setLoading(false);
          return;
        }
      }

      // Calculate price and price_per_km based on pricing_type
      const priceValue = Number(formData.price);
      let finalPrice = priceValue;
      let finalPricePerKm: number | null = null;

      if (formData.pricing_type === 'PER_KM') {
        finalPricePerKm = priceValue;
        finalPrice = priceValue * (freight.distance_km || 0);
      } else if (formData.pricing_type === 'PER_TON') {
        finalPricePerKm = priceValue; // stored in price_per_km column
        const weightTon = Number(formData.weight) || 0;
        finalPrice = priceValue * weightTon;
      }

      const { data, error } = await supabase.functions.invoke('safe-update-freight', {
        body: {
          freight_id: freight.id,
          updates: {
            cargo_type: formData.cargo_type,
            weight: Number(formData.weight) * 1000,
            origin_address: formData.origin_address,
            origin_lat: formData.origin_lat,
            origin_lng: formData.origin_lng,
            destination_address: formData.destination_address,
            destination_lat: formData.destination_lat,
            destination_lng: formData.destination_lng,
            pickup_date: formData.pickup_date.toISOString().split('T')[0],
            delivery_date: formData.delivery_date.toISOString().split('T')[0],
            price: finalPrice,
            price_per_km: finalPricePerKm,
            pricing_type: formData.pricing_type,
            description: formData.description,
            urgency: formData.urgency as 'LOW' | 'MEDIUM' | 'HIGH',
            required_trucks: Number(formData.required_trucks),
            minimum_antt_price: updatedMinimumAntt
          }
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao atualizar');

      toast.success('Frete atualizado com sucesso!');
      onSuccess();
      handleClose();
    } catch (error) {
      console.error('Error updating freight:', error);
      toast.error('Erro ao atualizar frete');
    } finally {
      setLoading(false);
    }
  };

  const cargoTypes = CARGO_TYPES;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Frete</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cargo_type">Tipo de Carga</Label>
              <Select
                value={formData.cargo_type}
                onValueChange={(value) => setFormData({ ...formData, cargo_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de carga" />
                </SelectTrigger>
                <SelectContent>
                  {cargoTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="weight">Peso (Toneladas)</Label>
              <Input
                id="weight"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.weight}
                onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                placeholder="1.5"
                required
              />
              <p className="text-xs text-muted-foreground">
                Peso em toneladas (ex: 1.5 para 1.5t)
              </p>
            </div>
          </div>

          <AddressButton
            label="Endereço de Origem"
            value={formData.origin_address}
            onAddressChange={(addressData) => {
              setFormData(prev => ({
                ...prev,
                origin_address: addressData.fullAddress,
                origin_lat: addressData.lat,
                origin_lng: addressData.lng
              }));
            }}
            required
          />

          <AddressButton
            label="Endereço de Destino"
            value={formData.destination_address}
            onAddressChange={(addressData) => {
              setFormData(prev => ({
                ...prev,
                destination_address: addressData.fullAddress,
                destination_lat: addressData.lat,
                destination_lng: addressData.lng
              }));
            }}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Data de Coleta</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.pickup_date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.pickup_date}
                    onSelect={(date) => date && setFormData({ ...formData, pickup_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label>Data de Entrega</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(formData.delivery_date, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.delivery_date}
                    onSelect={(date) => date && setFormData({ ...formData, delivery_date: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="pricing_type">Tipo de Pagamento</Label>
              <Select
                value={formData.pricing_type}
                onValueChange={(value) => setFormData({ ...formData, pricing_type: value as 'FIXED' | 'PER_KM' | 'PER_TON' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">Valor Fixo</SelectItem>
                  <SelectItem value="PER_KM">Por KM</SelectItem>
                  <SelectItem value="PER_TON">Por Tonelada</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="price">
                {formData.pricing_type === 'PER_KM' ? 'Valor por KM (R$)' : 
                 formData.pricing_type === 'PER_TON' ? 'Valor por Tonelada (R$)' : 
                 'Valor Fixo (R$)'}
              </Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="urgency">Urgência</Label>
            <Select
              value={formData.urgency}
              onValueChange={(value) => setFormData({ ...formData, urgency: value })}
            >
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

          <div>
            <Label htmlFor="required_trucks">Número de Carretas</Label>
            <Input
              id="required_trucks"
              type="number"
              min="1"
              value={formData.required_trucks}
              onChange={(e) => setFormData({ ...formData, required_trucks: Number(e.target.value) })}
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Observações</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};