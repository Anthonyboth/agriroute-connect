import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Settings, Wrench, Zap, Shield, Key } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Service {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: 'technical' | 'agricultural' | 'logistics';
  color: string;
}

interface ServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onServiceSelect: (service: Service) => void;
}

const ServicesModal: React.FC<ServicesModalProps> = ({
  isOpen,
  onClose,
  onServiceSelect
}) => {
  const [selectedService, setSelectedService] = useState<Service | null>(null);

  const technicalServices: Service[] = [
    {
      id: 'assistencia-tecnica-agricola',
      title: 'Assistência Técnica Agrícola',
      description: 'Suporte técnico especializado para produção agrícola',
      icon: <Settings className="h-8 w-8 text-green-600" />,
      category: 'agricultural',
      color: 'border-green-500 bg-green-50'
    },
    {
      id: 'manutencao-equipamentos',
      title: 'Manutenção de Equipamentos',
      description: 'Manutenção e reparo de tratores e implementos agrícolas',
      icon: <Wrench className="h-8 w-8 text-orange-600" />,
      category: 'technical',
      color: 'border-orange-500 bg-orange-50'
    },
    {
      id: 'mecanico',
      title: 'Mecânico',
      description: 'Reparos mecânicos em geral de veículos e equipamentos',
      icon: <Wrench className="h-8 w-8 text-blue-600" />,
      category: 'technical',
      color: 'border-blue-500 bg-blue-50'
    },
    {
      id: 'eletricista-automotivo',
      title: 'Eletricista Automotivo',
      description: 'Sistema elétrico completo de veículos',
      icon: <Zap className="h-8 w-8 text-yellow-600" />,
      category: 'technical',
      color: 'border-yellow-500 bg-yellow-50'
    },
    {
      id: 'borracheiro',
      title: 'Borracheiro',
      description: 'Troca e reparo de pneus',
      icon: <Shield className="h-8 w-8 text-gray-600" />,
      category: 'technical',
      color: 'border-gray-500 bg-gray-50'
    },
    {
      id: 'chaveiro',
      title: 'Chaveiro',
      description: 'Abertura de veículos travados',
      icon: <Key className="h-8 w-8 text-purple-600" />,
      category: 'technical',
      color: 'border-purple-500 bg-purple-50'
    }
  ];

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service);
  };

  const handleContinue = () => {
    if (selectedService) {
      onServiceSelect(selectedService);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-2xl font-bold text-center flex-1">
            Serviços Disponíveis
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-2">Preciso de um Serviço</h2>
            
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-700">Serviços Técnicos</h3>
              <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                {technicalServices.length}/{technicalServices.length}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {technicalServices.map((service) => (
                <Card 
                  key={service.id}
                  className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                    selectedService?.id === service.id 
                      ? 'border-2 border-green-500 bg-green-50' 
                      : 'border border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => handleServiceSelect(service)}
                >
                  <CardContent className="p-6 text-center">
                    <div className="flex justify-center mb-4">
                      <div className={`p-4 rounded-full ${service.color.split(' ')[1]}`}>
                        {service.icon}
                      </div>
                    </div>
                    <h4 className="font-semibold text-lg mb-2 text-gray-800">
                      {service.title}
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {service.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {selectedService && (
            <div className="flex justify-center pt-4 border-t">
              <Button 
                onClick={handleContinue}
                size="lg"
                className="px-8"
              >
                Continuar com {selectedService.title}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServicesModal;