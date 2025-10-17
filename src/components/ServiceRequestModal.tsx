import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CitySelector } from './CitySelector';
import { StructuredAddressInput } from './StructuredAddressInput';
import { getCityId } from '@/lib/city-utils';
import { showErrorToast } from '@/lib/error-handler';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceLabel: string;
  serviceDescription: string;
  category: 'freight' | 'technical' | 'agricultural' | 'logistics' | 'urban';
}

const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  serviceLabel,
  serviceDescription,
  category
}) => {
  const { profile } = useAuth();
  const navigate = useNavigate();
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
    city_id: undefined as string | undefined,
    description: '',
    urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    preferred_time: '',
    additional_info: ''
  });

  // Preencher automaticamente dados do usuário se logado
  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        name: profile.full_name || '',
        phone: profile.phone || '',
        city: profile.current_city_name || '',
        state: profile.current_state || '',
      }));
    }
  }, [profile]);

  const categoryInfo = {
    freight: {
      title: 'Frete e Transporte',
      icon: '🚛',
      color: 'bg-blue-50 border-blue-200',
      features: ['Transporte seguro', 'Rastreamento', 'Pontualidade garantida']
    },
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
      icon: '📦',
      color: 'bg-orange-50 border-orange-200',
      features: ['Armazenamento seguro', 'Controle de estoque', 'Distribuição eficiente']
    },
    urban: {
      title: 'Serviços Urbanos',
      icon: '🏘️',
      color: 'bg-purple-50 border-purple-200',
      features: ['Atendimento local', 'Profissionais verificados', 'Agendamento rápido']
    }
  };

  const info = categoryInfo[category] ?? categoryInfo.technical;

  const urgencyLabels = {
    LOW: { label: 'Baixa', description: 'Pode aguardar alguns dias', color: 'bg-green-100 text-green-800' },
    MEDIUM: { label: 'Média', description: 'Prefiro em 24-48h', color: 'bg-yellow-100 text-yellow-800' },
    HIGH: { label: 'Alta', description: 'Preciso hoje/urgente', color: 'bg-red-100 text-red-800' }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validações específicas com feedback detalhado
      const missingFields: string[] = [];
      
      if (!formData.name?.trim()) {
        missingFields.push('Nome');
      }
      if (!formData.phone?.trim()) {
        missingFields.push('Telefone');
      }
      if (!formData.location_address?.trim()) {
        missingFields.push('Endereço');
      }
      if (!formData.description?.trim()) {
        missingFields.push('Descrição do problema');
      }

      if (missingFields.length > 0) {
        const fieldList = missingFields.join(', ');
        const message = missingFields.length === 1 
          ? `Por favor, preencha o campo: ${fieldList}`
          : `Por favor, preencha os campos: ${fieldList}`;
        toast.error(message);
        setLoading(false);
        return;
      }

// Garantir cidade e estado para matching por cidade
      if (!formData.city || !formData.state) {
        toast.error('Por favor, selecione a cidade e o estado do atendimento');
        setLoading(false);
        return;
      }

      // Buscar city_id se não foi fornecido
      const cityId = formData.city_id || await getCityId(formData.city, formData.state);

      if (!cityId) {
        console.warn('⚠️ city_id não encontrado para:', {
          city: formData.city,
          state: formData.state
        });
      }

      // Latitude/longitude não são obrigatórios; cidade e endereço estruturado bastam para o match por cidade.

      // Criar solicitação de serviço na tabela service_requests
      const { data, error } = await supabase.from('service_requests').insert({
        client_id: profile?.id || null, // NULL se não estiver logado
        service_type: serviceId,
        contact_name: formData.name,
        contact_phone: formData.phone,
        location_address: formData.location_address,
        location_lat: formData.location_lat,
        location_lng: formData.location_lng,
        city_name: formData.city || null,
        state: formData.state || null,
        city_id: cityId,
        problem_description: formData.description,
        urgency: formData.urgency,
        preferred_datetime: formData.preferred_time ? new Date().toISOString() : null,
        additional_info: formData.additional_info || null,
        status: 'OPEN'
      })
      .select()
      .single();

      if (error) {
        showErrorToast(toast, 'Erro ao enviar solicitação', error);
        return;
      }

      // Executar matching espacial para notificar prestadores
      if (data?.id) {
        try {
          const matchingPayload = {
            service_request_id: data.id,
            request_lat: formData.location_lat,
            request_lng: formData.location_lng,
            service_type: serviceId,
            notify_providers: true
          };

          console.log('📍 Executando matching espacial para usuário autenticado:', matchingPayload);

          const { data: matchData, error: matchError } = await supabase.functions.invoke('service-provider-spatial-matching', {
            body: matchingPayload
          });

          if (matchError) {
            console.error('❌ Erro no matching:', matchError);
          } else {
            console.log('✅ Matching executado com sucesso:', matchData);
          }
        } catch (matchError) {
          console.error('❌ Exceção no matching:', matchError);
        }
      }

      toast.success('Solicitação enviada com sucesso! Prestadores próximos foram notificados.');
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <span className="text-2xl">{info?.icon}</span>
            Solicitar {serviceLabel}
          </DialogTitle>
          <DialogDescription>{serviceDescription}</DialogDescription>
        </DialogHeader>

        {!profile && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              💡 <strong>Dica:</strong> Crie uma conta para acompanhar suas solicitações e ter acesso ao histórico!
            </p>
          </div>
        )}

        <div className="space-y-6">
          {!showRegisterForm ? (
            <>
              {/* Informações do Serviço */}
              <Card className={`${info?.color} border-2`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <span>{info?.icon}</span>
                    {info?.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {info?.features.map((feature) => (
                      <Badge key={feature} variant="secondary" className="text-xs">
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
                  <Label>Cidade e Estado *</Label>
                  <CitySelector
                    value={formData.city && formData.state ? { city: formData.city, state: formData.state } : undefined}
                    onChange={(city) => {
                      setFormData(prev => ({
                        ...prev,
                        city: city.city,
                        state: city.state,
                        city_id: city.id,
                        location_lat: city.lat,
                        location_lng: city.lng
                      }));
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Selecione a cidade onde o serviço será realizado
                  </p>
                </div>

                {/* Endereço Completo */}
                <div className="space-y-2">
                  <Label htmlFor="location_address">Endereço Completo do Atendimento *</Label>
                  <Input
                    id="location_address"
                    value={formData.location_address}
                    onChange={(e) => handleInputChange('location_address', e.target.value)}
                    placeholder="Rua, número, bairro/fazenda, complemento"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Informe o endereço completo onde o serviço deve ser realizado
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
                <Button onClick={() => navigate('/auth')} className="w-full">
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