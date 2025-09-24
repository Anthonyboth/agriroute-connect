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
  Hammer,
  Construction,
  Grid3X3
} from 'lucide-react';
import { ServiceProviderRegistrationForm } from './ServiceProviderRegistrationForm';
import GuestServiceModal from './GuestServiceModal';

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
    color: 'text-primary'
  },
  {
    id: 'guindaste',
    title: 'Guindaste',
    description: 'Elevação e movimentação de cargas pesadas',
    icon: Construction,
    color: 'text-warning'
  },
  {
    id: 'mecanico',
    title: 'Mecânico',
    description: 'Reparos mecânicos em geral',
    icon: Wrench,
    color: 'text-primary'
  },
  {
    id: 'borracheiro',
    title: 'Borracheiro',
    description: 'Troca e reparo de pneus',
    icon: Car,
    color: 'text-accent'
  },
  {
    id: 'eletricista',
    title: 'Eletricista Automotivo',
    description: 'Sistema elétrico completo de veículos',
    icon: Zap,
    color: 'text-warning'
  },
  {
    id: 'combustivel',
    title: 'Combustível',
    description: 'Entrega de combustível',
    icon: Fuel,
    color: 'text-destructive'
  },
  {
    id: 'chaveiro',
    title: 'Chaveiro',
    description: 'Abertura de veículos travados',
    icon: Shield,
    color: 'text-muted-foreground'
  },
  {
    id: 'pulverizacao-drone',
    title: 'Pulverização por Drone',
    description: 'Aplicação de defensivos e fertilizantes via drone',
    icon: Battery,
    color: 'text-accent'
  },
  {
    id: 'outros',
    title: 'Outros',
    description: 'Outros tipos de serviços',
    icon: Grid3X3,
    color: 'text-primary'
  }
];

export const ServicesModal: React.FC<ServicesModalProps> = ({
  isOpen,
  onClose
}) => {
  const [showRegistration, setShowRegistration] = useState(false);
  const [guestServiceModal, setGuestServiceModal] = useState<{
    isOpen: boolean;
    serviceType?: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO';
  }>({ isOpen: false });

  const handleServiceSelect = (serviceId: string) => {
    // Mapear o serviço para o tipo correto
    let serviceType: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO' = 'GUINCHO';
    
    if (serviceId.includes('guincho') || serviceId.includes('mecanico') || serviceId.includes('borracheiro')) {
      serviceType = 'GUINCHO';
    } else if (serviceId.includes('mudanca')) {
      serviceType = 'MUDANCA';  
    } else {
      serviceType = 'FRETE_URBANO';
    }
    
    setGuestServiceModal({ isOpen: true, serviceType });
    onClose();
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
                      className="cursor-pointer hover:shadow-glow transition-all duration-300 border-2 hover:border-primary hover:scale-105 group"
                      onClick={() => handleServiceSelect(service.id)}
                    >
                      <CardHeader className="text-center pb-2">
                        <div className="flex justify-center mb-3 p-3 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 group-hover:from-primary/20 group-hover:to-secondary/20 transition-all">
                          <IconComponent className={`h-6 w-6 ${service.color} group-hover:scale-110 transition-transform`} />
                        </div>
                        <CardTitle className="text-lg group-hover:text-primary transition-colors">{service.title}</CardTitle>
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
                <Hammer className="mr-2 h-5 w-5 text-primary" />
                Quero ser Prestador de Serviços
              </h3>
              <Card className="gradient-subtle border-primary/20 shadow-card">
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-primary mb-2">
                      <Hammer className="h-8 w-8 text-primary-foreground" />
                    </div>
                    <h4 className="text-lg font-semibold text-foreground">Seja um Prestador</h4>
                    <p className="text-muted-foreground">
                      Cadastre-se como prestador de serviços e comece a receber solicitações na sua região
                    </p>
                    <Button 
                      onClick={handleBecomeProvider} 
                      className="gradient-primary text-primary-foreground shadow-glow hover:scale-105 transition-bounce"
                    >
                      Cadastrar como Prestador
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de cadastro de prestador */}
      <ServiceProviderRegistrationForm 
        isOpen={showRegistration}
        onClose={() => setShowRegistration(false)}
      />

      {/* Modal de solicitação de serviços */}
      {guestServiceModal.serviceType && (
        <GuestServiceModal
          isOpen={guestServiceModal.isOpen}
          serviceType={guestServiceModal.serviceType}
          onClose={() => setGuestServiceModal({ isOpen: false })}
        />
      )}
    </>
  );
};