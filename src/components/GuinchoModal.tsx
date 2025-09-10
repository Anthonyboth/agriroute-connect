import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, MapPin, Clock, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface GuinchoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuinchoModal: React.FC<GuinchoModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<any>(null);
  const [formData, setFormData] = useState({
    vehicle_type: '',
    origin_address: '',
    destination_address: '',
    distance_km: '',
    problem_description: '',
    emergency: false,
    contact_phone: '',
    additional_info: ''
  });

  const vehicleTypes = [
    { value: 'MOTO', label: 'Motocicleta', multiplier: 0.7 },
    { value: 'CARRO', label: 'Carro de Passeio', multiplier: 1.0 },
    { value: 'CAMINHAO', label: 'Caminhão', multiplier: 1.8 },
    { value: 'ONIBUS', label: 'Ônibus', multiplier: 2.0 },
    { value: 'CARRETA', label: 'Carreta/Bitrem', multiplier: 2.5 }
  ];

  const calculatePricing = async () => {
    if (!formData.vehicle_type || !formData.distance_km) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('service-pricing', {
        body: {
          service_type: 'GUINCHO',
          distance_km: parseFloat(formData.distance_km),
          vehicle_type: formData.vehicle_type,
          additional_services: formData.emergency ? ['EMERGENCY'] : []
        }
      });

      if (error) throw error;
      setPricing(data);
    } catch (error) {
      console.error('Error calculating pricing:', error);
      toast({
        title: "Erro",
        description: "Não foi possível calcular o preço. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    try {
      setLoading(true);

      // Get current user profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Erro",
          description: "Você precisa estar logado para solicitar guincho.",
          variant: "destructive"
        });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        toast({
          title: "Erro",
          description: "Perfil não encontrado.",
          variant: "destructive"
        });
        return;
      }

      // Create freight entry for guincho service
      const { error } = await supabase
        .from('freights')
        .insert({
          producer_id: profile.id,
          service_type: 'GUINCHO',
          cargo_type: `Guincho - ${vehicleTypes.find(v => v.value === formData.vehicle_type)?.label}`,
          weight: 0, // Not applicable for guincho
          origin_address: formData.origin_address,
          destination_address: formData.destination_address,
          distance_km: parseFloat(formData.distance_km),
          pickup_date: new Date().toISOString().split('T')[0], // Today
          delivery_date: new Date().toISOString().split('T')[0], // Same day service
          price: pricing?.total_price || 0,
          description: `${formData.problem_description}\n\nContato: ${formData.contact_phone}\n\nInfo adicional: ${formData.additional_info}`,
          urgency: formData.emergency ? 'HIGH' : 'MEDIUM',
          status: 'OPEN'
        });

      if (error) throw error;

      toast({
        title: "Solicitação Enviada!",
        description: "Sua solicitação de guincho foi registrada. Em breve um motorista entrará em contato.",
      });

      onClose();
      setFormData({
        vehicle_type: '',
        origin_address: '',
        destination_address: '',
        distance_km: '',
        problem_description: '',
        emergency: false,
        contact_phone: '',
        additional_info: ''
      });
      setPricing(null);
    } catch (error) {
      console.error('Error creating guincho request:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a solicitação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-warning" />
            Solicitar Serviço de Guincho
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Emergency Alert */}
          <Card className="border-warning/20 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-warning mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-semibold">Serviço de Emergência 24h</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Nossos guinchos operam 24 horas por dia. Serviços de emergência têm taxa adicional.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vehicle_type">Tipo de Veículo</Label>
              <Select 
                value={formData.vehicle_type} 
                onValueChange={(value) => setFormData({...formData, vehicle_type: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de veículo" />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="distance_km">Distância (km)</Label>
              <Input
                id="distance_km"
                type="number"
                step="0.1"
                min="0"
                value={formData.distance_km}
                onChange={(e) => setFormData({...formData, distance_km: e.target.value})}
                placeholder="Ex: 15.5"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="origin_address">Local de Retirada</Label>
              <Input
                id="origin_address"
                value={formData.origin_address}
                onChange={(e) => setFormData({...formData, origin_address: e.target.value})}
                placeholder="Endereço completo onde está o veículo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination_address">Local de Destino</Label>
              <Input
                id="destination_address"
                value={formData.destination_address}
                onChange={(e) => setFormData({...formData, destination_address: e.target.value})}
                placeholder="Para onde levar o veículo"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="problem_description">Descrição do Problema</Label>
            <Textarea
              id="problem_description"
              value={formData.problem_description}
              onChange={(e) => setFormData({...formData, problem_description: e.target.value})}
              placeholder="Descreva o que aconteceu com o veículo (pane, acidente, etc.)"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_phone">Telefone de Contato</Label>
              <Input
                id="contact_phone"
                value={formData.contact_phone}
                onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                placeholder="(11) 99999-9999"
                required
              />
            </div>

            <div className="flex items-center space-x-2 mt-6">
              <Checkbox
                id="emergency"
                checked={formData.emergency}
                onCheckedChange={(checked) => setFormData({...formData, emergency: !!checked})}
              />
              <Label htmlFor="emergency" className="text-sm">
                Emergência (Serviço prioritário)
              </Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional_info">Informações Adicionais</Label>
            <Textarea
              id="additional_info"
              value={formData.additional_info}
              onChange={(e) => setFormData({...formData, additional_info: e.target.value})}
              placeholder="Qualquer informação adicional relevante"
            />
          </div>

          {/* Pricing */}
          {formData.vehicle_type && formData.distance_km && (
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">Calcular Preço</span>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={calculatePricing}
                    disabled={loading}
                  >
                    {loading ? 'Calculando...' : 'Calcular'}
                  </Button>
                </div>
                
                {pricing && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Taxa base:</span>
                      <span>R$ {pricing.base_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Por km (R$ {pricing.price_per_km.toFixed(2)}):</span>
                      <span>R$ {(pricing.price_per_km * parseFloat(formData.distance_km)).toFixed(2)}</span>
                    </div>
                    {pricing.service_details.additional_fees > 0 && (
                      <div className="flex justify-between text-sm">
                        <span>Taxas adicionais:</span>
                        <span>R$ {pricing.service_details.additional_fees.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Total estimado:</span>
                        <span className="text-primary">R$ {pricing.total_price.toFixed(2)}</span>
                      </div>
                    </div>
                    <Badge variant="default" className="text-xs">
                      Conforme tabela ANTT
                    </Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="gradient-primary text-primary-foreground">
              {loading ? 'Enviando...' : 'Solicitar Guincho'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default GuinchoModal;