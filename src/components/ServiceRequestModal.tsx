import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, MapPin, Truck, AlertTriangle } from 'lucide-react';
import { UserLocationSelector } from './UserLocationSelector';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ServiceRequestModalProps {
  trigger?: React.ReactNode;
  // Controlled mode props
  isOpen?: boolean;
  onClose?: () => void;
  serviceType?: string;
  serviceTitle?: string;
}

interface UserLocation {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

const serviceTypes = [
  { value: 'MECANICO', label: 'Mecânico', icon: '🔧' },
  { value: 'BORRACHEIRO', label: 'Borracheiro', icon: '🛞' },
  { value: 'GUINCHO', label: 'Guincho', icon: '🚛' },
  { value: 'ELETRICA', label: 'Elétrica', icon: '⚡' },
  { value: 'CARGA', label: 'Transporte de Carga', icon: '📦' },
  { value: 'COMBUSTIVEL', label: 'Combustível', icon: '⛽' },
  { value: 'LIMPEZA', label: 'Limpeza', icon: '🧽' },
  { value: 'OUTROS', label: 'Outros', icon: '🛠️' }
];

const urgencyLevels = [
  { value: 'LOW', label: 'Baixa', color: 'bg-green-100 text-green-800' },
  { value: 'MEDIUM', label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'HIGH', label: 'Alta', color: 'bg-red-100 text-red-800' }
];

export const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({ 
  trigger = (
    <Button className="gap-2">
      <Plus className="h-4 w-4" />
      Solicitar Serviço
    </Button>
  ),
  // Controlled mode props
  isOpen: controlledOpen,
  onClose: controlledOnClose,
  serviceType: initialServiceType,
  serviceTitle
}) => {
  const { profile } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  
  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnClose !== undefined 
    ? (value: boolean) => !value && controlledOnClose() 
    : setInternalOpen;
  
  // Dados da solicitação
  const [serviceType, setServiceType] = useState(initialServiceType || '');
  const [problemDescription, setProblemDescription] = useState('');
  const [vehicleInfo, setVehicleInfo] = useState('');
  const [urgency, setUrgency] = useState('MEDIUM');
  const [contactPhone, setContactPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isEmergency, setIsEmergency] = useState(false);

  // Reset service type when initialServiceType changes
  useEffect(() => {
    if (initialServiceType) {
      setServiceType(initialServiceType);
    }
  }, [initialServiceType]);

  const resetForm = () => {
    setServiceType('');
    setProblemDescription('');
    setVehicleInfo('');
    setUrgency('MEDIUM');
    setContactPhone('');
    setContactName('');
    setAdditionalInfo('');
    setIsEmergency(false);
  };

  const handleLocationChange = (location: UserLocation | null) => {
    setUserLocation(location);
  };

  const handleSubmit = async () => {
    if (!profile?.id) {
      toast.error('Você precisa estar logado para solicitar serviços');
      return;
    }

    if (!userLocation) {
      toast.error('Defina sua localização antes de continuar');
      return;
    }

    if (!serviceType || !problemDescription) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('service_requests')
        .insert({
          client_id: profile.id,
          service_type: serviceType,
          location_address: `${userLocation.city}, ${userLocation.state}`,
          location_lat: userLocation.lat,
          location_lng: userLocation.lng,
          location_city: userLocation.city,
          location_state: userLocation.state,
          city_name: userLocation.city,
          state: userLocation.state,
          problem_description: problemDescription,
          vehicle_info: vehicleInfo || null,
          urgency: urgency,
          contact_phone: contactPhone || profile.phone,
          contact_name: contactName || profile.full_name,
          additional_info: additionalInfo || null,
          is_emergency: isEmergency,
          status: 'OPEN',
          service_radius_km: 50 // Raio padrão de 50km
        });

      if (error) throw error;

      toast.success('Solicitação enviada com sucesso!');
      resetForm();
      setOpen(false);
    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      toast.error('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const selectedServiceType = serviceTypes.find(st => st.value === serviceType);
  const selectedUrgency = urgencyLevels.find(ul => ul.value === urgency);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Only render DialogTrigger if we have a trigger and not in controlled mode */}
      {trigger && controlledOpen === undefined && (
        <DialogTrigger asChild>
          {trigger}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Solicitar Serviço
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Localização do Usuário */}
          <UserLocationSelector onLocationChange={handleLocationChange} />

          {/* Formulário de Solicitação */}
          {userLocation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Detalhes da Solicitação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Tipo de Serviço */}
                <div className="space-y-2">
                  <Label htmlFor="serviceType">Tipo de Serviço *</Label>
                  <Select value={serviceType} onValueChange={setServiceType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo de serviço" />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <span>{type.icon}</span>
                            {type.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Descrição do Problema */}
                <div className="space-y-2">
                  <Label htmlFor="problemDescription">Descrição do Problema *</Label>
                  <Textarea
                    id="problemDescription"
                    placeholder="Descreva detalhadamente qual é o problema..."
                    value={problemDescription}
                    onChange={(e) => setProblemDescription(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Informações do Veículo */}
                <div className="space-y-2">
                  <Label htmlFor="vehicleInfo">Informações do Veículo</Label>
                  <Input
                    id="vehicleInfo"
                    placeholder="Ex: Volvo FH 460, Placa ABC-1234"
                    value={vehicleInfo}
                    onChange={(e) => setVehicleInfo(e.target.value)}
                  />
                </div>

                {/* Urgência */}
                <div className="space-y-2">
                  <Label htmlFor="urgency">Nível de Urgência</Label>
                  <Select value={urgency} onValueChange={setUrgency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {urgencyLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          <Badge className={level.color}>
                            {level.label}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Contato */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Nome para Contato</Label>
                    <Input
                      id="contactName"
                      placeholder={profile?.full_name || "Seu nome"}
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contactPhone">Telefone para Contato</Label>
                    <Input
                      id="contactPhone"
                      placeholder={profile?.phone || "Seu telefone"}
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Informações Adicionais */}
                <div className="space-y-2">
                  <Label htmlFor="additionalInfo">Informações Adicionais</Label>
                  <Textarea
                    id="additionalInfo"
                    placeholder="Qualquer informação adicional que possa ajudar..."
                    value={additionalInfo}
                    onChange={(e) => setAdditionalInfo(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Resumo da Solicitação */}
                {serviceType && userLocation && (
                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Resumo da Solicitação</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <span>{selectedServiceType?.icon}</span>
                        <strong>{selectedServiceType?.label}</strong>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3 w-3" />
                        {userLocation.city}, {userLocation.state}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={selectedUrgency?.color}>
                          {selectedUrgency?.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}

                {/* Botões de Ação */}
                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={loading || !serviceType || !problemDescription || !userLocation}
                  >
                    {loading ? 'Enviando...' : 'Solicitar Serviço'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};