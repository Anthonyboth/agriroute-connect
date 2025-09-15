import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  MapPin, 
  Clock, 
  Calendar, 
  User,
  Phone,
  Mail,
  AlertCircle,
  Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { LocationFillButton } from './LocationFillButton';

interface ServiceProvider {
  id: string;
  profile_id: string;
  service_type: string;
  base_price?: number;
  hourly_rate?: number;
  emergency_service: boolean;
  work_hours_start: string;
  work_hours_end: string;
  service_area_cities: string[];
  specialties: string[];
  profiles: {
    full_name: string;
    phone?: string;
    profile_photo_url?: string;
    rating?: number;
    total_ratings?: number;
  };
}

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: ServiceProvider;
  serviceType: string;
  serviceTitle: string;
}

export const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({
  isOpen,
  onClose,
  provider,
  serviceType,
  serviceTitle
}) => {
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    location: '',
    locationLat: null as number | null,
    locationLng: null as number | null,
    problemDescription: '',
    urgency: 'MEDIUM',
    preferredDateTime: '',
    contactPhone: '',
    contactName: '',
    additionalInfo: '',
    isEmergency: false,
    vehicleInfo: ''
  });

  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para solicitar um serviço.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.location || !formData.problemDescription || !formData.contactPhone) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Buscar o profile do usuário
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !userProfile) {
        throw new Error('Profile não encontrado');
      }

      // Criar a solicitação de serviço na nova tabela
      const requestData = {
        client_id: userProfile.id,
        service_type: serviceType,
        location_address: formData.location,
        location_lat: formData.locationLat,
        location_lng: formData.locationLng,
        problem_description: formData.problemDescription,
        vehicle_info: formData.vehicleInfo,
        urgency: formData.urgency,
        contact_phone: formData.contactPhone,
        contact_name: formData.contactName,
        preferred_datetime: formData.preferredDateTime ? new Date(formData.preferredDateTime).toISOString() : null,
        additional_info: formData.additionalInfo,
        is_emergency: formData.isEmergency,
        estimated_price: provider.base_price || null,
        status: 'PENDING'
      };

      const { data: serviceRequest, error: requestError } = await supabase
        .from('service_requests')
        .insert(requestData)
        .select()
        .single();

      if (requestError) throw requestError;

      // Enviar notificação para o prestador de serviços
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: provider.profile_id,
          title: `Nova solicitação de ${serviceTitle}`,
          message: `${formData.contactName || 'Cliente'} solicitou seus serviços em ${formData.location}`,
          type: formData.isEmergency ? 'emergency' : 'service_request',
          data: {
            service_request_id: serviceRequest.id,
            service_type: serviceType,
            location: formData.location,
            contact_phone: formData.contactPhone,
            is_emergency: formData.isEmergency
          }
        });

      if (notificationError) {
        console.error('Erro ao enviar notificação:', notificationError);
      }

      toast({
        title: "Solicitação enviada!",
        description: `Sua solicitação foi enviada para ${provider.profiles.full_name}. Você será notificado quando o prestador responder.`,
      });

      onClose();
      
      // Reset form
      setFormData({
        location: '',
        locationLat: null,
        locationLng: null,
        problemDescription: '',
        urgency: 'MEDIUM',
        preferredDateTime: '',
        contactPhone: '',
        contactName: '',
        additionalInfo: '',
        isEmergency: false,
        vehicleInfo: ''
      });

    } catch (error) {
      console.error('Erro ao criar solicitação:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'Sob consulta';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const getCurrentDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            Solicitar {serviceTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Informações do Prestador */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Prestador Selecionado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={provider.profiles.profile_photo_url} />
                  <AvatarFallback>
                    <User className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{provider.profiles.full_name}</p>
                  {provider.profiles.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">
                        {provider.profiles.rating.toFixed(1)} ({provider.profiles.total_ratings})
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{provider.work_hours_start.slice(0, 5)} às {provider.work_hours_end.slice(0, 5)}</span>
                </div>

                {provider.emergency_service && (
                  <Badge variant="destructive" className="text-xs">
                    Atendimento 24h
                  </Badge>
                )}

                <div className="border-t pt-2 mt-3">
                  <p className="text-muted-foreground mb-1">Preços:</p>
                  <p className="text-sm">Base: {formatPrice(provider.base_price)}</p>
                  <p className="text-sm">Por hora: {formatPrice(provider.hourly_rate)}</p>
                </div>

                {provider.specialties.length > 0 && (
                  <div className="border-t pt-2 mt-3">
                    <p className="text-muted-foreground mb-1 text-xs">Especialidades:</p>
                    <div className="flex flex-wrap gap-1">
                      {provider.specialties.slice(0, 3).map(specialty => (
                        <Badge key={specialty} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Formulário de Solicitação */}
          <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detalhes da Solicitação</CardTitle>
                <CardDescription>
                  Preencha os dados para solicitar o serviço
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Informações de Contato */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contactName">Seu nome</Label>
                    <Input
                      id="contactName"
                      value={formData.contactName}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                      placeholder="Como devemos te chamar?"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contactPhone">Telefone para contato *</Label>
                    <Input
                      id="contactPhone"
                      type="tel"
                      required
                      value={formData.contactPhone}
                      onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                      placeholder="(XX) XXXXX-XXXX"
                    />
                  </div>
                </div>

                {/* Localização */}
                <div>
                  <Label htmlFor="location">Local do atendimento *</Label>
                  <div className="flex gap-2">
                    <Input
                      id="location"
                      required
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Endereço completo onde precisa do serviço"
                      className="flex-1"
                    />
                    <LocationFillButton
                      onLocationFilled={(address, lat, lng) => {
                        setFormData(prev => ({
                          ...prev,
                          location: address,
                          locationLat: lat,
                          locationLng: lng
                        }));
                      }}
                    />
                  </div>
                </div>

                {/* Informações do Veículo/Problema */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="vehicleInfo">Informações do veículo</Label>
                    <Input
                      id="vehicleInfo"
                      value={formData.vehicleInfo}
                      onChange={(e) => setFormData(prev => ({ ...prev, vehicleInfo: e.target.value }))}
                      placeholder="Ex: Caminhão Mercedes 1620, Carro Gol 2015"
                    />
                  </div>
                  <div>
                    <Label htmlFor="urgency">Urgência</Label>
                    <Select value={formData.urgency} onValueChange={(value) => setFormData(prev => ({ ...prev, urgency: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LOW">Baixa - Pode aguardar</SelectItem>
                        <SelectItem value="MEDIUM">Média - Dentro de algumas horas</SelectItem>
                        <SelectItem value="HIGH">Alta - Preciso hoje</SelectItem>
                        <SelectItem value="URGENT">Urgente - Preciso agora!</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Descrição do problema */}
                <div>
                  <Label htmlFor="problemDescription">Descrição do problema *</Label>
                  <Textarea
                    id="problemDescription"
                    required
                    value={formData.problemDescription}
                    onChange={(e) => setFormData(prev => ({ ...prev, problemDescription: e.target.value }))}
                    placeholder="Descreva detalhadamente o problema ou serviço necessário"
                    rows={4}
                  />
                </div>

                {/* Data e hora preferida */}
                <div>
                  <Label htmlFor="preferredDateTime">Data e hora preferida</Label>
                  <Input
                    id="preferredDateTime"
                    type="datetime-local"
                    value={formData.preferredDateTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, preferredDateTime: e.target.value }))}
                    min={getCurrentDateTime()}
                  />
                </div>

                {/* Informações adicionais */}
                <div>
                  <Label htmlFor="additionalInfo">Informações adicionais</Label>
                  <Textarea
                    id="additionalInfo"
                    value={formData.additionalInfo}
                    onChange={(e) => setFormData(prev => ({ ...prev, additionalInfo: e.target.value }))}
                    placeholder="Qualquer informação adicional que possa ajudar o prestador"
                    rows={3}
                  />
                </div>

                {/* Emergência */}
                {provider.emergency_service && (
                  <div className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <Checkbox
                      id="isEmergency"
                      checked={formData.isEmergency}
                      onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isEmergency: !!checked }))}
                    />
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-500" />
                      <Label htmlFor="isEmergency" className="text-red-700">
                        Esta é uma emergência (atendimento prioritário 24h)
                      </Label>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-4">
                  <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? 'Enviando...' : 'Solicitar Serviço'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};