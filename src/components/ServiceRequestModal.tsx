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
import { 
  Wrench, 
  MapPin, 
  Clock, 
  AlertTriangle, 
  Car, 
  Truck, 
  Settings, 
  Fuel, 
  Zap, 
  Shield,
  Hammer,
  Construction,
  MoreHorizontal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { LocationFillButton } from './LocationFillButton';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceType: string;
  serviceTitle: string;
}

const serviceIcons: Record<string, React.ComponentType<any>> = {
  GUINCHO: Truck,
  MECANICO: Settings,
  BORRACHEIRO: Car,
  ELETRICISTA_AUTOMOTIVO: Zap,
  AUTO_ELETRICA: Zap,
  COMBUSTIVEL: Fuel,
  CHAVEIRO: Shield,
  SOLDADOR: Wrench,
  PINTURA: Settings,
  VIDRACEIRO: Settings,
  AR_CONDICIONADO: Settings,
  FREIOS: Settings,
  SUSPENSAO: Settings,
  GUINDASTE: Construction,
  OUTROS: Wrench
};

const vehicleTypes = [
  { value: 'MOTO', label: 'Motocicleta', multiplier: 0.7 },
  { value: 'CARRO', label: 'Carro de Passeio', multiplier: 1.0 },
  { value: 'CAMINHAO', label: 'Caminhão', multiplier: 1.8 },
  { value: 'ONIBUS', label: 'Ônibus', multiplier: 2.0 },
  { value: 'CARRETA', label: 'Carreta/Bitrem', multiplier: 2.5 }
];

export const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({ 
  isOpen, 
  onClose, 
  serviceType, 
  serviceTitle 
}) => {
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
    contact_name: '',
    additional_info: '',
    custom_service_description: '',
    origin_lat: undefined as number | undefined,
    origin_lng: undefined as number | undefined,
    destination_lat: undefined as number | undefined,
    destination_lng: undefined as number | undefined,
    city_name: '',
    state: ''
  });

  const calculatePricing = async () => {
    if (serviceType === 'GUINCHO' && (!formData.vehicle_type || !formData.distance_km)) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('service-pricing', {
        body: {
          service_type: serviceType,
          distance_km: parseFloat(formData.distance_km || '0'),
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

    // Validação básica
    if (!formData.origin_address || !formData.contact_phone || !formData.problem_description || !formData.city_name) {
      toast({
        title: "Erro",
        description: "Por favor, preencha todos os campos obrigatórios, incluindo a cidade.",
        variant: "destructive"
      });
      return;
    }

    // Validação específica para "Outros"
    if (serviceType === 'OUTROS' && !formData.custom_service_description) {
      toast({
        title: "Erro",
        description: "Por favor, especifique o tipo de serviço personalizado.",
        variant: "destructive"
      });
      return;
    }

    try {
      setLoading(true);

      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // User is authenticated - use existing freights table for GUINCHO or service_requests for others
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

        if (serviceType === 'GUINCHO') {
          // Create freight entry for GUINCHO service
          const { error } = await supabase
            .from('freights')
            .insert({
              producer_id: profile.id,
              service_type: 'GUINCHO',
              cargo_type: `Guincho - ${vehicleTypes.find(v => v.value === formData.vehicle_type)?.label || 'Serviço'}`,
              weight: 0,
              origin_address: formData.origin_address,
              destination_address: formData.destination_address || formData.origin_address,
              distance_km: parseFloat(formData.distance_km || '0'),
              pickup_date: new Date().toISOString().split('T')[0],
              delivery_date: new Date().toISOString().split('T')[0],
              price: pricing?.total_price || 0,
              description: `${formData.problem_description}\n\nContato: ${formData.contact_phone}\n\nInfo adicional: ${formData.additional_info}`,
              urgency: formData.emergency ? 'HIGH' : 'MEDIUM',
              status: 'OPEN'
            });

          if (error) throw error;
        } else {
          // Create service request for other services
          const serviceDescription = serviceType === 'OUTROS' 
            ? `${formData.custom_service_description}: ${formData.problem_description}`
            : formData.problem_description;
            
          const { error } = await supabase
            .from('service_requests')
            .insert({
              client_id: profile.id,
              service_type: serviceType === 'OUTROS' ? formData.custom_service_description : serviceType,
              location_address: formData.origin_address,
              location_lat: formData.origin_lat,
              location_lng: formData.origin_lng,
              city_name: formData.city_name,
              state: formData.state,
              problem_description: serviceDescription,
              vehicle_info: formData.vehicle_type ? vehicleTypes.find(v => v.value === formData.vehicle_type)?.label : '',
              urgency: formData.emergency ? 'HIGH' : 'MEDIUM',
              contact_phone: formData.contact_phone,
              contact_name: formData.contact_name,
              additional_info: formData.additional_info,
              is_emergency: formData.emergency,
              status: 'OPEN'
            });

          if (error) throw error;
        }
      } else {
        // User is not authenticated - use guest_requests table
        const guestPayload = {
          vehicle_type: formData.vehicle_type,
          origin_address: formData.origin_address,
          destination_address: formData.destination_address,
          distance_km: formData.distance_km,
          problem_description: formData.problem_description,
          emergency: formData.emergency,
          additional_info: formData.additional_info,
          contact_name: formData.contact_name,
          custom_service_description: formData.custom_service_description,
          pricing: pricing,
          origin_lat: formData.origin_lat,
          origin_lng: formData.origin_lng,
          destination_lat: formData.destination_lat,
          destination_lng: formData.destination_lng
        };

        const { error } = await supabase
          .from('guest_requests')
          .insert({
            request_type: 'SERVICE',
            service_type: serviceType === 'OUTROS' ? formData.custom_service_description : serviceType,
            contact_phone: formData.contact_phone,
            contact_name: formData.contact_name,
            city_name: formData.city_name,
            state: formData.state,
            payload: guestPayload,
            status: 'PENDING'
          });

        if (error) throw error;
      }

      toast({
        title: "Solicitação Enviada!",
        description: `Sua solicitação de ${serviceTitle.toLowerCase()} foi registrada. Em breve um prestador entrará em contato.`,
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
        contact_name: '',
        additional_info: '',
        custom_service_description: '',
        origin_lat: undefined,
        origin_lng: undefined,
        destination_lat: undefined,
        destination_lng: undefined,
        city_name: '',
        state: ''
      });
      setPricing(null);
    } catch (error) {
      console.error('Error creating service request:', error);
      toast({
        title: "Erro",
        description: "Não foi possível enviar a solicitação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const ServiceIcon = serviceIcons[serviceType] || Wrench;
  const isGuincho = serviceType === 'GUINCHO';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ServiceIcon className="h-5 w-5 text-primary" />
            Solicitar {serviceTitle}
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
                {isGuincho 
                  ? "Nossos guinchos operam 24 horas por dia. Serviços de emergência têm taxa adicional."
                  : `Prestadores de ${serviceTitle.toLowerCase()} disponíveis 24h. Atendimento prioritário para emergências.`
                }
              </p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Informações de contato */}
            <div className="space-y-2">
              <Label htmlFor="contact_name">Seu nome</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({...formData, contact_name: e.target.value})}
                placeholder="Como devemos te chamar?"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Telefone para contato *</Label>
              <Input
                id="contact_phone"
                type="tel"
                required
                value={formData.contact_phone}
                onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                placeholder="(XX) XXXXX-XXXX"
              />
            </div>
          </div>

          {/* Campo de cidade obrigatório */}
          <div className="space-y-2">
            <Label htmlFor="city_name">Cidade onde precisa do serviço *</Label>
            <Input
              id="city_name"
              value={formData.city_name}
              onChange={(e) => setFormData({...formData, city_name: e.target.value})}
              placeholder="Digite o nome da cidade"
              required
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Esta informação é obrigatória para encontrar prestadores na sua região
            </p>
          </div>

          {isGuincho && (
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
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="origin_address">
                {isGuincho ? "Local de Retirada *" : "Local do Atendimento *"}
              </Label>
              <div className="flex gap-2">
                <Input
                  id="origin_address"
                  value={formData.origin_address}
                  onChange={(e) => setFormData({...formData, origin_address: e.target.value})}
                  placeholder={isGuincho ? "Endereço completo onde está o veículo" : "Endereço completo onde precisa do serviço"}
                  required
                  className="flex-1"
                />
                  <LocationFillButton
                    onLocationFilled={(address, lat, lng) => {
                      // Extrair cidade do endereço quando usar GPS
                      const addressParts = address.split(',');
                      let cityFromAddress = '';
                      
                      if (addressParts.length >= 2) {
                        // Tentar extrair cidade do endereço
                        const secondLastPart = addressParts[addressParts.length - 2].trim();
                        cityFromAddress = secondLastPart;
                      }
                      
                      setFormData({
                        ...formData, 
                        origin_address: address,
                        origin_lat: lat,
                        origin_lng: lng,
                        // Se conseguiu extrair cidade, preencher automaticamente
                        ...(cityFromAddress && { city_name: cityFromAddress })
                      });
                    }}
                  />
              </div>
            </div>

            {isGuincho && (
              <div className="space-y-2">
                <Label htmlFor="destination_address">Local de Entrega</Label>
                <div className="flex gap-2">
                  <Input
                    id="destination_address"
                    value={formData.destination_address}
                    onChange={(e) => setFormData({...formData, destination_address: e.target.value})}
                    placeholder="Para onde levar o veículo"
                    className="flex-1"
                  />
                  <LocationFillButton
                    onLocationFilled={(address, lat, lng) => {
                      setFormData({
                        ...formData, 
                        destination_address: address,
                        destination_lat: lat,
                        destination_lng: lng
                      });
                    }}
                  />
                </div>

                {/* Opção de preencher endereço destino com base na cidade selecionada */}
                {formData.city_name && !formData.destination_address && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const cityAddress = `${formData.city_name}, ${formData.state}`;
                      setFormData({
                        ...formData,
                        destination_address: cityAddress
                      });
                    }}
                    className="text-xs"
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    Usar cidade selecionada
                  </Button>
                )}
              </div>
            )}
          </div>

          {serviceType === 'OUTROS' && (
            <div className="space-y-2">
              <Label htmlFor="custom_service_description">Tipo de Serviço Personalizado *</Label>
              <Input
                id="custom_service_description"
                required
                value={formData.custom_service_description}
                onChange={(e) => setFormData({...formData, custom_service_description: e.target.value})}
                placeholder="Ex: Troca de óleo, Alinhamento, Balanceamento, etc."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="problem_description">
              {isGuincho ? "Descrição do Problema *" : serviceType === 'OUTROS' ? "Descrição Detalhada do Serviço *" : `Descrição do Problema ${serviceTitle} *`}
            </Label>
            <Textarea
              id="problem_description"
              required
              value={formData.problem_description}
              onChange={(e) => setFormData({...formData, problem_description: e.target.value})}
              placeholder={
                isGuincho 
                  ? "Descreva o problema do veículo (pane, acidente, etc.)"
                  : serviceType === 'OUTROS'
                    ? "Descreva detalhadamente o que precisa ser feito"
                    : `Descreva detalhadamente o problema que precisa ser resolvido pelo(a) ${serviceTitle.toLowerCase()}`
              }
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="additional_info">Informações Adicionais</Label>
            <Textarea
              id="additional_info"
              value={formData.additional_info}
              onChange={(e) => setFormData({...formData, additional_info: e.target.value})}
              placeholder="Qualquer informação adicional que possa ajudar"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="emergency"
              checked={formData.emergency}
              onCheckedChange={(checked) => setFormData({...formData, emergency: !!checked})}
              className="h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
            />
            <Label htmlFor="emergency" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Esta é uma emergência (atendimento prioritário)
            </Label>
          </div>

          {isGuincho && formData.vehicle_type && formData.distance_km && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Cálculo de Preço</h3>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={calculatePricing}
                  disabled={loading}
                >
                  {loading ? 'Calculando...' : 'Calcular'}
                </Button>
              </div>
              
              {pricing && (
                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Preço base:</span>
                        <span>R$ {pricing.base_price?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Por km ({formData.distance_km}km):</span>
                        <span>R$ {pricing.distance_price?.toFixed(2)}</span>
                      </div>
                      {formData.emergency && (
                        <div className="flex justify-between text-warning">
                          <span>Taxa emergência:</span>
                          <span>R$ {pricing.emergency_fee?.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total estimado:</span>
                        <span>R$ {pricing.total_price?.toFixed(2)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Enviando...' : `Solicitar ${serviceTitle}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};