import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { User, MessageCircle, Mail, Truck, Home, Package, Info, AlertCircle } from 'lucide-react';
import { showErrorToast } from '@/lib/error-handler';
import { LocationFillButton } from './LocationFillButton';
import { UserLocationSelector } from './UserLocationSelector';
import { supabase } from '@/integrations/supabase/client';

interface SubService {
  id: string;
  name: string;
  description: string;
  price: string;
  details?: string;
}

interface GuestServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceType: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO';
}

const GuestServiceModal: React.FC<GuestServiceModalProps> = ({
  isOpen,
  onClose,
  serviceType
}) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [selectedSubService, setSelectedSubService] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    document: '',
    origin: '',
    destination: '',
    description: '',
    urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    preferredTime: '',
    origin_lat: undefined as number | undefined,
    origin_lng: undefined as number | undefined,
    destination_lat: undefined as number | undefined,
    destination_lng: undefined as number | undefined,
    cargoType: '',
    cargoWeight: '',
    cargoWeightUnit: 'kg' as 'kg' | 'ton',
    cargoDimensions: {
      length: '',
      width: '',
      height: ''
    },
    needsPackaging: false
  });

  const [validationResult, setValidationResult] = useState<any>(null);
  const [showUserExistsWarning, setShowUserExistsWarning] = useState(false);

  const serviceInfo = {
    GUINCHO: {
      title: 'Solicitar Guincho ou Fretes Urbanos',
      description: 'Precisa de guincho, frete urbano ou mudança? Conectamos você com os melhores profissionais da sua região',
      icon: '🚛',
      subServices: [
        { 
          id: 'GUINCHO', 
          name: 'Guincho', 
          description: 'Para carros, motos e caminhões', 
          price: 'A partir de R$ 200',
          details: 'Reboque e socorro 24h para qualquer tipo de veículo'
        },
        { 
          id: 'FRETE_MOTO', 
          name: 'Frete por Moto', 
          description: 'Entregas rápidas com motos e carretinhas', 
          price: 'A partir de R$ 15',
          details: 'Ideal para pequenas cargas até 150kg. Motos equipadas com carretinhas para maior capacidade.'
        },
        { 
          id: 'FRETE_URBANO', 
          name: 'Frete Urbano', 
          description: 'Transporte de objetos', 
          price: 'A partir de R$ 50',
          details: 'Cargas até 1 tonelada'
        },
        { 
          id: 'MUDANCA_RESIDENCIAL', 
          name: 'Mudança Residencial', 
          description: 'Casa ou apartamento', 
          price: 'A partir de R$ 200',
          details: 'Embalagem, desmontagem e montagem inclusos'
        },
        { 
          id: 'MUDANCA_COMERCIAL', 
          name: 'Mudança Comercial', 
          description: 'Escritórios e lojas', 
          price: 'A partir de R$ 300',
          details: 'Profissionais especializados'
        }
      ] as SubService[],
      features: ['Atendimento 24h', 'Profissionais qualificados', 'Preços transparentes', 'Embalagem inclusa']
    },
    MUDANCA: {
      title: 'Solicitar Mudança',
      description: 'Mudança residencial e comercial',
      icon: '',
      subServices: [
        { id: 'MUDANCA_RESIDENCIAL', name: 'Mudança Residencial', description: 'Casa ou apartamento', price: 'A partir de R$ 200' },
        { id: 'MUDANCA_COMERCIAL', name: 'Mudança Comercial', description: 'Escritórios e lojas', price: 'A partir de R$ 300' }
      ],
      features: ['Embalagem inclusa', 'Seguro opcional', 'Montagem/desmontagem', 'Entrega rápida']
    },
    FRETE_URBANO: {
      title: 'Solicitar Frete Urbano',
      description: 'Transporte rápido dentro da cidade',
      icon: '',
      subServices: [
        { id: 'FRETE_MOTO', name: 'Frete de Moto', description: 'Entregas até 0.02t', price: 'A partir de R$ 15' },
        { id: 'FRETE_VAN', name: 'Frete de Van', description: 'Cargas até 1 tonelada', price: 'A partir de R$ 45' }
      ],
      features: ['Entrega rápida', 'Rastreamento', 'Carga protegida']
    }
  };

  const info = serviceInfo[serviceType];

  const validateGuestUser = async () => {
    if (!formData.document) {
      toast.error('CPF/CNPJ é obrigatório');
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('validate-guest-user', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          document: formData.document
        }
      });

      if (error) throw error;

      if (data.user_exists) {
        setValidationResult(data);
        setShowUserExistsWarning(true);
        toast.error(data.message);
        return false;
      }

      setValidationResult(data);
      return data.prospect_id;
    } catch (error) {
      console.error('Erro na validação:', error);
      toast.error('Erro ao validar informações');
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // VALIDAR GUEST
    const prospectId = await validateGuestUser();
    if (!prospectId) return;
    
    // Validar campos de carga se não for guincho
    if (selectedSubService !== 'GUINCHO') {
      if (!formData.cargoType) {
        toast.error('Por favor, selecione o tipo de carga');
        return;
      }
      if (!formData.cargoWeight) {
        toast.error('Por favor, informe o peso aproximado da carga');
        return;
      }
      
      // Validar peso máximo para moto
      if (selectedSubService === 'FRETE_MOTO') {
        const weight = parseFloat(formData.cargoWeight);
        const weightInKg = formData.cargoWeightUnit === 'ton' ? weight * 1000 : weight;
        if (weightInKg > 150) {
          toast.error('Frete por moto suporta cargas até 150kg. Escolha outro tipo de serviço.');
          return;
        }
      }
    }
    
    setLoading(true);
    
    try {
      // Validar campos obrigatórios
      if (!formData.name || !formData.phone || !formData.origin) {
        toast.error('Preencha todos os campos obrigatórios');
        setLoading(false);
        return;
      }

      // Preparar dados detalhados da carga
      const cargoDetails = selectedSubService !== 'GUINCHO' ? {
        type: formData.cargoType,
        weight: `${formData.cargoWeight}${formData.cargoWeightUnit}`,
        dimensions: formData.cargoDimensions,
        needsPackaging: formData.needsPackaging
      } : null;

      // Inserir na tabela service_requests com client_id NULL (guest)
      const { data, error } = await supabase
        .from('service_requests')
        .insert([{
          client_id: null, // NULL = solicitação de convidado
          prospect_user_id: prospectId,
          service_type: selectedSubService,
          contact_name: formData.name,
          contact_phone: formData.phone,
          contact_email: formData.email,
          contact_document: formData.document.replace(/\D/g, ''),
          location_address: formData.origin,
          location_lat: formData.origin_lat,
          location_lng: formData.origin_lng,
          problem_description: formData.description,
          urgency: formData.urgency,
          status: 'OPEN',
          city_name: formData.origin.split(',')[0]?.trim(),
          state: formData.origin.split(',')[1]?.trim(),
          additional_info: JSON.stringify({
            destination: formData.destination || null,
            destination_lat: formData.destination_lat,
            destination_lng: formData.destination_lng,
            preferredTime: formData.preferredTime || null,
            cargoDetails: cargoDetails
          })
        } as any])
        .select()
        .single();

      if (error) throw error;

      // Executar matching espacial automático
      if (data?.id) {
        try {
          const matchingPayload = {
            service_request_id: data.id,
            request_lat: formData.origin_lat,
            request_lng: formData.origin_lng,
            service_type: selectedSubService,
            notify_providers: true
          };

          console.log('Executando matching espacial com:', matchingPayload);

          const { data: matchData, error: matchError } = await supabase.functions.invoke('service-provider-spatial-matching', {
            body: matchingPayload
          });

          if (matchError) {
            console.error('Erro no matching:', matchError);
          } else {
            console.log('Matching executado com sucesso:', matchData);
          }
        } catch (matchError) {
          console.error('Exceção no matching:', matchError);
        }
      }

      toast.success('Solicitação enviada com sucesso! Prestadores próximos foram notificados.');
      onClose();
      
    } catch (error) {
      console.error('Erro ao salvar solicitação:', error);
      showErrorToast(toast, 'Erro ao enviar solicitação', error);
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
            <span className="text-2xl">{info.icon}</span>
            {info.title}
          </DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {!showRegisterForm ? (
            <>
              {!selectedSubService ? (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Escolha o tipo de serviço:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {info.subServices.map((service) => (
                      <Card 
                        key={service.id} 
                        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary"
                        onClick={() => {
                          setSelectedSubService(service.id);
                          if (service.details) {
                            toast.info(service.details, { duration: 3000 });
                          }
                        }}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg">{service.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">{service.description}</p>
                          <Badge variant="secondary">{service.price}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome Completo *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email (opcional)</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        placeholder="seu@email.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="document">CPF ou CNPJ *</Label>
                      <Input
                        id="document"
                        value={formData.document}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          if (value.length <= 14) {
                            handleInputChange('document', value);
                          }
                        }}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        required
                        maxLength={18}
                      />
                      <p className="text-xs text-muted-foreground">
                        Necessário para identificação e controle de solicitações
                      </p>
                    </div>
                  </div>

                  {showUserExistsWarning && validationResult?.user_exists && (
                    <Alert variant="destructive">
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Conta Encontrada!</strong><br/>
                        {validationResult.message}
                        <div className="mt-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              onClose();
                              window.location.href = '/auth';
                            }}
                          >
                            Ir para Login
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>Localização do Atendimento *</Label>
                      <UserLocationSelector 
                        onLocationChange={(location) => {
                          if (location) {
                            setFormData(prev => ({
                              ...prev,
                              origin: `${location.city}, ${location.state}`,
                              origin_lat: location.lat,
                              origin_lng: location.lng
                            }));
                          }
                        }}
                      />
                    </div>
                    {serviceType !== 'GUINCHO' && (
                      <div className="space-y-2">
                        <Label htmlFor="destination">Destino *</Label>
                        <div className="flex gap-2">
                          <Input
                            id="destination"
                            value={formData.destination}
                            onChange={(e) => handleInputChange('destination', e.target.value)}
                            required
                            className="flex-1"
                            placeholder="Local de entrega"
                          />
                          <LocationFillButton
                            onLocationFilled={(address, lat, lng) => {
                              handleInputChange('destination', address);
                              setFormData(prev => ({
                                ...prev,
                                destination_lat: lat,
                                destination_lng: lng
                              }));
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Campos de Informações da Carga */}
                  {selectedSubService && selectedSubService !== 'GUINCHO' && (
                    <>
                      <Separator className="my-4" />
                      <div className="space-y-4">
                        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                          Informações da Carga
                        </h4>
                        
                        {/* Tipo de Carga */}
                        <div className="space-y-2">
                          <Label htmlFor="cargoType">Tipo de Carga *</Label>
                          <Select
                            value={formData.cargoType}
                            onValueChange={(value) => handleInputChange('cargoType', value)}
                            required
                          >
                            <SelectTrigger id="cargoType">
                              <SelectValue placeholder="Selecione o tipo de carga" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="DOCUMENTOS">Documentos e Papéis</SelectItem>
                              <SelectItem value="ELETRONICOS">Eletrônicos</SelectItem>
                              <SelectItem value="MOVEIS">Móveis</SelectItem>
                              <SelectItem value="ELETRODOMESTICOS">Eletrodomésticos</SelectItem>
                              <SelectItem value="ALIMENTOS">Alimentos</SelectItem>
                              <SelectItem value="ROUPAS">Roupas e Tecidos</SelectItem>
                              <SelectItem value="MATERIAIS_CONSTRUCAO">Materiais de Construção</SelectItem>
                              <SelectItem value="PRODUTOS_LIMPEZA">Produtos de Limpeza</SelectItem>
                              <SelectItem value="MEDICAMENTOS">Medicamentos</SelectItem>
                              <SelectItem value="OUTROS">Outros</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Peso da Carga */}
                        <div className="space-y-2">
                          <Label htmlFor="cargoWeight">Peso Aproximado *</Label>
                          <div className="flex gap-2">
                            <Input
                              id="cargoWeight"
                              type="number"
                              value={formData.cargoWeight}
                              onChange={(e) => handleInputChange('cargoWeight', e.target.value)}
                              placeholder="Ex: 50"
                              required
                              className="flex-1"
                              min="0"
                              step="0.1"
                            />
                            <Select
                              value={formData.cargoWeightUnit}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, cargoWeightUnit: value as 'kg' | 'ton' }))}
                            >
                              <SelectTrigger className="w-24">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="kg">kg</SelectItem>
                                <SelectItem value="ton">ton</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {selectedSubService === 'FRETE_MOTO' && formData.cargoWeight && (
                            <p className="text-xs text-muted-foreground">
                              Motos com carretinha suportam até 150kg
                            </p>
                          )}
                        </div>

                        {/* Dimensões (opcional) */}
                        <div className="space-y-2">
                          <Label>Dimensões (opcional)</Label>
                          <div className="grid grid-cols-3 gap-2">
                            <div>
                              <Input
                                placeholder="Comp. (cm)"
                                type="number"
                                value={formData.cargoDimensions.length}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  cargoDimensions: { ...prev.cargoDimensions, length: e.target.value }
                                }))}
                                min="0"
                              />
                            </div>
                            <div>
                              <Input
                                placeholder="Larg. (cm)"
                                type="number"
                                value={formData.cargoDimensions.width}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  cargoDimensions: { ...prev.cargoDimensions, width: e.target.value }
                                }))}
                                min="0"
                              />
                            </div>
                            <div>
                              <Input
                                placeholder="Alt. (cm)"
                                type="number"
                                value={formData.cargoDimensions.height}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  cargoDimensions: { ...prev.cargoDimensions, height: e.target.value }
                                }))}
                                min="0"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Ajuda o motorista a saber se a carga cabe no veículo
                          </p>
                        </div>

                        {/* Necessita Embalagem */}
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="needsPackaging"
                            checked={formData.needsPackaging}
                            onChange={(e) => setFormData(prev => ({ ...prev, needsPackaging: e.target.checked }))}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <Label htmlFor="needsPackaging" className="font-normal cursor-pointer">
                            Necessita embalagem especial ou proteção extra
                          </Label>
                        </div>
                      </div>
                      <Separator className="my-4" />
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      required
                      placeholder="Descreva detalhes adicionais sobre a solicitação..."
                    />
                  </div>

                  <div className="flex gap-3">
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
              )}
            </>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Crie sua conta rapidamente</h3>
                <p className="text-muted-foreground text-sm">
                  Cadastre-se para ter acesso a descontos exclusivos
                </p>
              </div>

              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Para criar uma conta e ter acesso a descontos exclusivos,
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
                  <li>• 10% de desconto em serviços</li>
                  <li>• Histórico completo</li>
                  <li>• Atendimento prioritário</li>
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

export default GuestServiceModal;