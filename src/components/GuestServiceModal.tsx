import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { ServiceWizard } from './service-wizard/ServiceWizard';
import { ServiceType } from './service-wizard/types';

interface SubService {
  id: ServiceType;
  name: string;
  description: string;
  price: string;
  details?: string;
}

interface GuestServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
  serviceType: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO';
  initialSubService?: string;
}

const GuestServiceModal: React.FC<GuestServiceModalProps> = ({
  isOpen,
  onClose,
  onBack,
  serviceType,
  initialSubService
}) => {
  const [selectedSubService, setSelectedSubService] = useState<ServiceType | null>(
    (initialSubService as ServiceType) || null
  );

  const serviceInfo = {
    GUINCHO: {
      title: 'Solicitar Guincho ou Fretes Urbanos',
      description: 'Precisa de guincho, frete urbano ou mudança? Conectamos você com os melhores profissionais da sua região',
      icon: '🚛',
      subServices: [
        { 
          id: 'GUINCHO' as ServiceType, 
          name: 'Guincho', 
          description: 'Para carros, motos e caminhões', 
          price: 'A partir de R$ 200',
          details: 'Reboque e socorro 24h para qualquer tipo de veículo'
        },
        { 
          id: 'FRETE_MOTO' as ServiceType, 
          name: 'Frete por Moto', 
          description: 'Moto com carretinha - Capacidade até 150kg', 
          price: 'A partir de R$ 15',
          details: 'Moto equipada com carretinha para cargas de até 150kg. Ideal para entregas rápidas e econômicas.'
        },
        { 
          id: 'FRETE_URBANO' as ServiceType, 
          name: 'Frete Urbano', 
          description: 'Transporte de objetos', 
          price: 'A partir de R$ 50',
          details: 'Cargas até 1.5 tonelada'
        },
        { 
          id: 'MUDANCA_RESIDENCIAL' as ServiceType, 
          name: 'Mudança Residencial', 
          description: 'Casa ou apartamento', 
          price: 'A partir de R$ 200',
          details: 'Embalagem, desmontagem e montagem inclusos'
        },
        { 
          id: 'MUDANCA_COMERCIAL' as ServiceType, 
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
      icon: '🏠',
      subServices: [
        { id: 'MUDANCA_RESIDENCIAL' as ServiceType, name: 'Mudança Residencial', description: 'Casa ou apartamento', price: 'A partir de R$ 200' },
        { id: 'MUDANCA_COMERCIAL' as ServiceType, name: 'Mudança Comercial', description: 'Escritórios e lojas', price: 'A partir de R$ 300' }
      ],
      features: ['Embalagem inclusa', 'Seguro opcional', 'Montagem/desmontagem', 'Entrega rápida']
    },
    FRETE_URBANO: {
      title: 'Solicitar Frete Urbano',
      description: 'Transporte rápido dentro da cidade',
      icon: '📦',
      subServices: [
        { id: 'FRETE_MOTO' as ServiceType, name: 'Frete por Moto', description: 'Moto com carretinha - até 150kg', price: 'A partir de R$ 15' },
        { id: 'FRETE_URBANO' as ServiceType, name: 'Frete de Van/Picape', description: 'Cargas até 1.5 toneladas', price: 'A partir de R$ 45' }
      ],
      features: ['Entrega rápida', 'Rastreamento', 'Carga protegida']
    }
  };

  const info = serviceInfo[serviceType];

  const handleBack = () => {
    if (selectedSubService && !initialSubService) {
      setSelectedSubService(null);
    } else if (onBack) {
      onBack();
    } else {
      onClose();
    }
  };

  const handleSelectService = (service: SubService) => {
    setSelectedSubService(service.id);
  };

  // Se já tem um sub-serviço selecionado, mostrar o wizard
  if (selectedSubService) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-6">
          <ServiceWizard
            serviceType={selectedSubService}
            onClose={onClose}
            onSuccess={() => {
              setSelectedSubService(null);
            }}
          />
        </DialogContent>
      </Dialog>
    );
  }

  // Senão, mostrar a lista de serviços
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="absolute left-0 top-0 flex items-center gap-1 z-10"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <DialogTitle className="flex items-center gap-2 text-2xl pt-8">
            <span className="text-2xl">{info.icon}</span>
            {info.title}
          </DialogTitle>
          <DialogDescription>{info.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <h3 className="text-lg font-semibold">Escolha o tipo de serviço:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {info.subServices.map((service) => (
              <Card 
                key={service.id} 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-primary"
                onClick={() => handleSelectService(service)}
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

          {info.features && (
            <div className="flex flex-wrap gap-2 mt-4">
              {info.features.map((feature, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  ✓ {feature}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuestServiceModal;
