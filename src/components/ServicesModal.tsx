import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Wrench, 
  Car, 
  Truck, 
  Settings, 
  Fuel, 
  Battery, 
  CircuitBoard,
  Zap,
  Shield,
  Hammer
} from 'lucide-react';
import { GuinchoModal } from './GuinchoModal';
import { ServiceProviderRegistrationModal } from './ServiceProviderRegistrationModal';
import { ServiceProvidersListing } from './ServiceProvidersListing';

interface ServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const serviceTypes = [
  {
    id: 'guincho',
    title: 'Guincho',
    description: 'Reboque e transporte de veículos',
    icon: Truck,
    color: 'text-red-500'
  },
  {
    id: 'mecanico',
    title: 'Mecânico',
    description: 'Reparos mecânicos em geral',
    icon: Settings,
    color: 'text-blue-500'
  },
  {
    id: 'borracheiro',
    title: 'Borracheiro',
    description: 'Troca e reparo de pneus',
    icon: Car,
    color: 'text-green-500'
  },
  {
    id: 'eletricista',
    title: 'Eletricista Automotivo',
    description: 'Problemas elétricos e bateria',
    icon: Zap,
    color: 'text-yellow-500'
  },
  {
    id: 'combustivel',
    title: 'Combustível',
    description: 'Entrega de combustível',
    icon: Fuel,
    color: 'text-orange-500'
  },
  {
    id: 'chaveiro',
    title: 'Chaveiro',
    description: 'Abertura de veículos travados',
    icon: Shield,
    color: 'text-purple-500'
  }
];

export const ServicesModal: React.FC<ServicesModalProps> = ({
  isOpen,
  onClose
}) => {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedServiceTitle, setSelectedServiceTitle] = useState<string>('');
  const [showGuincho, setShowGuincho] = useState(false);
  const [showRegistration, setShowRegistration] = useState(false);
  const [showProvidersList, setShowProvidersList] = useState(false);

  const handleServiceSelect = (serviceId: string) => {
    if (serviceId === 'guincho') {
      setShowGuincho(true);
      onClose();
    } else {
      const service = serviceTypes.find(s => s.id === serviceId);
      if (service) {
        setSelectedService(serviceId.toUpperCase());
        setSelectedServiceTitle(service.title);
        setShowProvidersList(true);
        onClose();
      }
    }
  };

  const handleBecomeProvider = () => {
    setShowRegistration(true);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">
              Serviços Disponíveis
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Solicitação de Serviços */}
            <div>
              <h3 className="text-lg font-semibold mb-4">Preciso de um Serviço</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {serviceTypes.map((service) => {
                  const IconComponent = service.icon;
                  return (
                    <Card 
                      key={service.id}
                      className="cursor-pointer hover:shadow-lg transition-shadow duration-200 border-2 hover:border-primary"
                      onClick={() => handleServiceSelect(service.id)}
                    >
                      <CardHeader className="text-center pb-2">
                        <div className="flex justify-center mb-2">
                          <IconComponent className={`h-8 w-8 ${service.color}`} />
                        </div>
                        <CardTitle className="text-lg">{service.title}</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <CardDescription className="text-center text-sm">
                          {service.description}
                        </CardDescription>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* Divisor */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center">
                <Hammer className="mr-2 h-5 w-5" />
                Quero ser Prestador de Serviços
              </h3>
              <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <p className="text-muted-foreground">
                      Cadastre-se como prestador de serviços e comece a receber solicitações na sua região
                    </p>
                    <Button onClick={handleBecomeProvider} className="w-full sm:w-auto">
                      Cadastrar como Prestador
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals específicos */}
      <GuinchoModal 
        isOpen={showGuincho} 
        onClose={() => setShowGuincho(false)} 
      />

      <ServiceProviderRegistrationModal 
        isOpen={showRegistration}
        onClose={() => setShowRegistration(false)}
      />

      {selectedService && (
        <ServiceProvidersListing
          isOpen={showProvidersList}
          onClose={() => {
            setShowProvidersList(false);
            setSelectedService(null);
            setSelectedServiceTitle('');
          }}
          serviceType={selectedService}
          serviceTitle={selectedServiceTitle}
        />
      )}
    </>
  );
};