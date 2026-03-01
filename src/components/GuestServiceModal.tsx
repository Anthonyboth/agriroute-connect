import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { ServiceWizard } from './service-wizard/ServiceWizard';
import { ServiceType } from './service-wizard/types';
import { ERP } from '@/styles/agri-erp';

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
  serviceType: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO' | 'ENTREGA_PACOTES' | 'TRANSPORTE_PET';
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

  const serviceInfo: Record<string, {
    title: string;
    description: string;
    icon: string;
    subServices: SubService[];
    features: string[];
  }> = {
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
          details: 'Transporte de cargas diversas'
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
      ],
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
        { id: 'FRETE_URBANO' as ServiceType, name: 'Frete de Van/Picape', description: 'Transporte de cargas diversas', price: 'A partir de R$ 45' }
      ],
      features: ['Entrega rápida', 'Rastreamento', 'Carga protegida']
    },
    ENTREGA_PACOTES: {
      title: 'Entrega de Pacotes',
      description: 'Entrega rápida e segura de encomendas',
      icon: '📬',
      subServices: [
        { 
          id: 'ENTREGA_PACOTES' as ServiceType, 
          name: 'Entrega de Pacotes', 
          description: 'Documentos, caixas, encomendas até 30kg', 
          price: 'A partir de R$ 15',
          details: 'Entrega rápida com cuidado especial para itens frágeis'
        },
      ],
      features: ['Entrega rápida', 'Cuidado com frágeis', 'Rastreamento', 'Até 30kg']
    },
    TRANSPORTE_PET: {
      title: 'Transporte de Pet 🐾',
      description: 'Seu pet vai com segurança e conforto',
      icon: '🐾',
      subServices: [
        { 
          id: 'TRANSPORTE_PET' as ServiceType, 
          name: 'Transporte de Pet', 
          description: 'Viagem segura para cães, gatos e outros', 
          price: 'Sob consulta',
          details: 'Motoristas preparados para transportar seu pet com segurança e carinho'
        },
      ],
      features: ['Segurança garantida', 'Conforto para o pet', 'Motorista preparado', 'Paradas quando necessário']
    },
  };

  const info = serviceInfo[serviceType];

  if (!info) {
    return null;
  }

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
        <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
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
                className={`cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${ERP.cardSoftGreen}`}
                onClick={() => handleSelectService(service)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className={ERP.title}>{service.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`${ERP.subtitle} mb-3`}>{service.description}</p>
                  <span className={ERP.chipVerified}>{service.price}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          {info.features && (
            <div className="flex flex-wrap gap-2 mt-4">
              {info.features.map((feature, idx) => (
                <span key={idx} className={ERP.chipNeutral}>
                  ✓ {feature}
                </span>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GuestServiceModal;
