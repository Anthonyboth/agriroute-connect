import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, MapPin, Clock, AlertCircle } from 'lucide-react';
import { UserLocationSelector } from './UserLocationSelector';
import { supabase } from '@/integrations/supabase/client';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceLabel: string;
  serviceDescription: string;
  category: 'technical' | 'agricultural' | 'logistics';
}

const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  serviceLabel,
  serviceDescription,
  category
}) => {
  const [loading, setLoading] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    location_address: '',
    location_lat: undefined as number | undefined,
    location_lng: undefined as number | undefined,
    city: '',
    state: '',
    description: '',
    urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    preferred_time: '',
    additional_info: ''
  });

  const categoryInfo = {
    technical: {
      title: 'Serviço Técnico',
      icon: '🔧',
      color: 'bg-blue-50 border-blue-200',
      features: ['Profissionais qualificados', 'Atendimento especializado', 'Orçamento gratuito']
    },
    agricultural: {
      title: 'Serviço Agrícola',
      icon: '🚜',
      color: 'bg-green-50 border-green-200', 
      features: ['Especialistas rurais', 'Equipamentos modernos', 'Consultoria técnica']
    },
    logistics: {
      title: 'Logística',
      icon: '🚛',
      color: 'bg-orange-50 border-orange-200',
      features: ['Transporte seguro', 'Rastreamento', 'Pontualidade garantida']
    }
  };

  const info = categoryInfo[category];

  const urgencyLabels = {
    LOW: { label: 'Baixa', description: 'Pode aguardar alguns dias', color: 'bg-green-100 text-green-800' },
    MEDIUM: { label: 'Média', description: 'Prefiro em 24-48h', color: 'bg-yellow-100 text-yellow-800' },
    HIGH: { label: 'Alta', description: 'Preciso hoje/urgente', color: 'bg-red-100 text-red-800' }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validações básicas
      if (!formData.name || !formData.phone || !formData.location_address || !formData.description) {
        toast.error('Por favor, preencha todos os campos obrigatórios.');
        return;
      }

      if (!formData.location_lat || !formData.location_lng) {
        toast.error('Por favor, selecione a localização no mapa.');
        return;
      }

      // Criar solicitação de serviço na tabela service_requests
      const { data, error } = await supabase.from('service_requests').insert({
        client_id: '00000000-0000-0000-0000-000000000000', // UUID null para guests
        service_type: serviceId,
        contact_name: formData.name,
        contact_phone: formData.phone,
        location_address: formData.location_address,
        location_lat: formData.location_lat,
        location_lng: formData.location_lng,
        location_city: formData.city || null,
        location_state: formData.state || null,
        problem_description: formData.description,
        urgency: formData.urgency,
        preferred_datetime: formData.preferred_time ? new Date().toISOString() : null,
        additional_info: formData.additional_info || null,
        status: 'PENDING'
      });

      if (error) {
        console.error('Erro ao criar solicitação:', error);
        toast.error('Erro ao enviar solicitação. Tente novamente.');
        return;
      }

      toast.success('Solicitação enviada com sucesso! Entraremos em contato em breve.');
      onClose();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="text-2xl">{info.icon}</span>
            Solicitar {serviceLabel}
          </DialogTitle>
          <DialogDescription>{serviceDescription}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!showRegisterForm ? (
            <>
              {/* Informações do Serviço */}
              <Card className={`${info.color} border-2`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>{info.icon}</span>
                    {info.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {info.features.map((feature, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Dados Pessoais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      Nome Completo *
                    </Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Seu nome completo"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">WhatsApp *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="(11) 99999-9999"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail (opcional)</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>

                {/* Localização */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Localização do Atendimento *
                  </Label>
                  <UserLocationSelector 
                    onLocationChange={(location) => {
                      if (location) {
                        setFormData(prev => ({
                          ...prev,
                          location_address: `${location.city}, ${location.state}`.trim(),
                          location_lat: location.lat,
                          location_lng: location.lng,
                          city: location.city,
                          state: location.state
                        }));
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Selecione no mapa o local onde o serviço será realizado
                  </p>
                </div>

                {/* Urgência */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Urgência do Serviço *
                  </Label>
                  <Select value={formData.urgency} onValueChange={(value) => handleInputChange('urgency', value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(urgencyLabels).map(([key, data]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Badge className={`${data.color} text-xs`}>{data.label}</Badge>
                            <span className="text-sm">{data.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Horário Preferencial */}
                <div className="space-y-2">
                  <Label htmlFor="preferred_time" className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    Horário Preferencial (opcional)
                  </Label>
                  <Input
                    id="preferred_time"
                    value={formData.preferred_time}
                    onChange={(e) => handleInputChange('preferred_time', e.target.value)}
                    placeholder="Ex: Manhã, tarde, fim de semana..."
                  />
                </div>

                {/* Descrição */}
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição do Problema/Serviço *</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Descreva detalhadamente o que precisa ser feito..."
                    rows={4}
                    required
                  />
                </div>

                {/* Informações Adicionais */}
                <div className="space-y-2">
                  <Label htmlFor="additional_info">Informações Adicionais (opcional)</Label>
                  <Textarea
                    id="additional_info"
                    value={formData.additional_info}
                    onChange={(e) => handleInputChange('additional_info', e.target.value)}
                    placeholder="Alguma informação extra que considera importante..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button type="submit" disabled={loading} className="flex-1">
                    {loading ? 'Enviando...' : 'Solicitar Serviço'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setShowRegisterForm(true)}
                  >
                    <User className="mr-2 h-4 w-4" />
                    Criar Conta
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Crie sua conta rapidamente</h3>
                <p className="text-muted-foreground text-sm">
                  Cadastre-se para ter acesso a descontos exclusivos e acompanhar seus pedidos
                </p>
              </div>

              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Para criar uma conta e ter acesso a todas as funcionalidades,
                </p>
                <Button onClick={() => window.location.href = '/auth'} className="w-full">
                  Ir para Cadastro/Login
                </Button>
              </div>
              
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">
                  🎉 Vantagens de ter uma conta:
                </h4>
                <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
                  <li>• Histórico completo de solicitações</li>
                  <li>• Acompanhe o status em tempo real</li>
                  <li>• Avalie prestadores de serviço</li>
                  <li>• Atendimento prioritário</li>
                  <li>• Propostas exclusivas</li>
                </ul>
              </div>

              <Button 
                variant="outline" 
                onClick={() => setShowRegisterForm(false)}
                className="w-full"
              >
                Voltar
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceRequestModal;