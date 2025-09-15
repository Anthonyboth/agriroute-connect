import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { User, MessageCircle, Mail, Truck, Home, Package } from 'lucide-react';


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
  const [loading, setLoading] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [selectedSubService, setSelectedSubService] = useState<string>('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    origin: '',
    destination: '',
    description: '',
    urgency: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH',
    preferredTime: ''
  });

  const serviceInfo = {
    GUINCHO: {
      title: 'Solicitar Guincho',
      description: 'Precisa de guincho? Conectamos você com os melhores profissionais da sua região',
      icon: '🚛',
      subServices: [
        { id: 'GUINCHO_LEVE', name: 'Guincho Leve', description: 'Para carros e motos', price: 'A partir de R$ 80' },
        { id: 'GUINCHO_PESADO', name: 'Guincho Pesado', description: 'Para caminhões', price: 'A partir de R$ 150' }
      ],
      features: ['Atendimento 24h', 'Profissionais qualificados', 'Preços transparentes']
    },
    MUDANCA: {
      title: 'Solicitar Mudança',
      description: 'Mudança residencial ou comercial com segurança',
      icon: '📦',
      subServices: [
        { id: 'MUDANCA_RESIDENCIAL', name: 'Mudança Residencial', description: 'Casa ou apartamento', price: 'A partir de R$ 200' },
        { id: 'MUDANCA_COMERCIAL', name: 'Mudança Comercial', description: 'Escritórios e lojas', price: 'A partir de R$ 300' }
      ],
      features: ['Embalagem inclusa', 'Seguro opcional', 'Montagem/desmontagem']
    },
    FRETE_URBANO: {
      title: 'Solicitar Frete Urbano',
      description: 'Transporte rápido dentro da cidade',
      icon: '🚚',
      subServices: [
        { id: 'FRETE_MOTO', name: 'Frete de Moto', description: 'Entregas até 20kg', price: 'A partir de R$ 15' },
        { id: 'FRETE_VAN', name: 'Frete de Van', description: 'Cargas até 1 tonelada', price: 'A partir de R$ 45' }
      ],
      features: ['Entrega rápida', 'Rastreamento', 'Carga protegida']
    }
  };

  const info = serviceInfo[serviceType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success('Solicitação enviada! Entraremos em contato em breve.');
      onClose();
    } catch (error) {
      toast.error('Erro ao enviar solicitação.');
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
                        onClick={() => setSelectedSubService(service.id)}
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

                  {serviceType !== 'GUINCHO' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="origin">Origem *</Label>
                        <Input
                          id="origin"
                          value={formData.origin}
                          onChange={(e) => handleInputChange('origin', e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="destination">Destino *</Label>
                        <Input
                          id="destination"
                          value={formData.destination}
                          onChange={(e) => handleInputChange('destination', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="description">Descrição *</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      required
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
                <Button onClick={() => window.location.href = '/auth'} className="w-full">
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