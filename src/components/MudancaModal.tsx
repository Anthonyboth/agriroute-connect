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
import { Home, Package, Truck, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface MudancaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MudancaModal: React.FC<MudancaModalProps> = ({ isOpen, onClose }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [pricing, setPricing] = useState<any>(null);
  const [formData, setFormData] = useState({
    origin_address: '',
    destination_address: '',
    distance_km: '',
    rooms: '',
    pickup_date: '',
    delivery_date: '',
    estimated_volume: '',
    additional_services: [] as string[],
    special_items: '',
    contact_phone: '',
    additional_info: ''
  });

  const additionalServices = [
    { id: 'MONTAGEM_MOVEIS', label: 'Montagem/Desmontagem de Móveis', price: 150 },
    { id: 'EMBALAGEM', label: 'Serviço de Embalagem', price: 100 },
    { id: 'ELEVADOR', label: 'Uso de Elevador', price: 80 },
    { id: 'ESCADA', label: 'Subida/Descida de Escadas', price: 60 },
    { id: 'SEGURO_EXTRA', label: 'Seguro Adicional', price: 120 }
  ];

  const calculatePricing = async () => {
    if (!formData.rooms || !formData.distance_km) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('service-pricing', {
        body: {
          service_type: 'MUDANCA',
          distance_km: parseFloat(formData.distance_km),
          rooms: parseInt(formData.rooms),
          additional_services: formData.additional_services
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

  const handleServiceChange = (serviceId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      additional_services: checked 
        ? [...prev.additional_services, serviceId]
        : prev.additional_services.filter(id => id !== serviceId)
    }));
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
          description: "Você precisa estar logado para solicitar mudança.",
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

      // Create freight entry for mudança service
      const { error } = await supabase
        .from('freights')
        .insert({
          producer_id: profile.id,
          service_type: 'MUDANCA',
          cargo_type: `Mudança - ${formData.rooms} cômodo(s)`,
          weight: parseFloat(formData.estimated_volume) || 0,
          origin_address: formData.origin_address,
          destination_address: formData.destination_address,
          distance_km: parseFloat(formData.distance_km),
          pickup_date: formData.pickup_date,
          delivery_date: formData.delivery_date,
          price: pricing?.total_price || 0,
          description: `Mudança residencial\n\nCômodos: ${formData.rooms}\nVolume estimado: ${formData.estimated_volume}m³\nItens especiais: ${formData.special_items}\nContato: ${formData.contact_phone}\nServiços adicionais: ${formData.additional_services.join(', ')}\n\nInfo adicional: ${formData.additional_info}`,
          urgency: 'MEDIUM',
          status: 'OPEN'
        });

      if (error) throw error;

      toast({
        title: "Solicitação Enviada!",
        description: "Sua solicitação de mudança foi registrada. Em breve um transportador entrará em contato.",
      });

      onClose();
      setFormData({
        origin_address: '',
        destination_address: '',
        distance_km: '',
        rooms: '',
        pickup_date: '',
        delivery_date: '',
        estimated_volume: '',
        additional_services: [],
        special_items: '',
        contact_phone: '',
        additional_info: ''
      });
      setPricing(null);
    } catch (error) {
      console.error('Error creating mudança request:', error);
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Home className="h-5 w-5 text-accent" />
            Solicitar Frete Urbano
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Info Card */}
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-accent mb-2">
                <Package className="h-4 w-4" />
                <span className="font-semibold">Fretes Urbanos e Mudanças</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Serviços de frete urbano e mudanças com diversos tipos de veículos: carretas baú, F-400, Strada e carros pequenos. Preços regulamentados pela ANTT.
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rooms">Número de Cômodos</Label>
              <Select 
                value={formData.rooms} 
                onValueChange={(value) => setFormData({...formData, rooms: value})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Quantos cômodos?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 cômodo (Kitnet)</SelectItem>
                  <SelectItem value="2">2 cômodos</SelectItem>
                  <SelectItem value="3">3 cômodos</SelectItem>
                  <SelectItem value="4">4 cômodos</SelectItem>
                  <SelectItem value="5">5 cômodos</SelectItem>
                  <SelectItem value="6">6+ cômodos</SelectItem>
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
                placeholder="Ex: 25.0"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="origin_address">Endereço de Origem</Label>
              <Input
                id="origin_address"
                value={formData.origin_address}
                onChange={(e) => setFormData({...formData, origin_address: e.target.value})}
                placeholder="Endereço completo de onde sair"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destination_address">Endereço de Destino</Label>
              <Input
                id="destination_address"
                value={formData.destination_address}
                onChange={(e) => setFormData({...formData, destination_address: e.target.value})}
                placeholder="Para onde vai a mudança"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pickup_date">Data de Coleta</Label>
              <Input
                id="pickup_date"
                type="date"
                value={formData.pickup_date}
                onChange={(e) => setFormData({...formData, pickup_date: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delivery_date">Data de Entrega</Label>
              <Input
                id="delivery_date"
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({...formData, delivery_date: e.target.value})}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimated_volume">Volume Estimado (m³)</Label>
              <Input
                id="estimated_volume"
                type="number"
                step="0.1"
                min="0"
                value={formData.estimated_volume}
                onChange={(e) => setFormData({...formData, estimated_volume: e.target.value})}
                placeholder="Ex: 15.0"
              />
            </div>
          </div>

          {/* Additional Services */}
          <div className="space-y-3">
            <Label>Serviços Adicionais</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {additionalServices.map((service) => (
                <div key={service.id} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <Checkbox
                    id={service.id}
                    checked={formData.additional_services.includes(service.id)}
                    onCheckedChange={(checked) => handleServiceChange(service.id, !!checked)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={service.id} className="text-sm font-normal">
                      {service.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      +R$ {service.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="special_items">Itens Especiais</Label>
            <Textarea
              id="special_items"
              value={formData.special_items}
              onChange={(e) => setFormData({...formData, special_items: e.target.value})}
              placeholder="Piano, obras de arte, itens frágeis, etc."
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

            <div className="space-y-2">
              <Label htmlFor="additional_info">Informações Adicionais</Label>
              <Textarea
                id="additional_info"
                value={formData.additional_info}
                onChange={(e) => setFormData({...formData, additional_info: e.target.value})}
                placeholder="Observações importantes"
              />
            </div>
          </div>

          {/* Pricing */}
          {formData.rooms && formData.distance_km && (
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
                        <span>Serviços adicionais:</span>
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
              {loading ? 'Enviando...' : 'Solicitar Frete Urbano'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default MudancaModal;