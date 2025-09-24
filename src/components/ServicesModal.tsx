import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Settings,
  Wrench,
  Zap,
  Shield,
  Key,
  Users,
  Stethoscope,
  TestTube,
  Droplets,
  Plane,
  Wheat,
  Leaf,
  Package,
  Fuel,
  MoreHorizontal,
  Hammer
} from 'lucide-react';
import { ServiceProviderRegistrationForm } from './ServiceProviderRegistrationForm';
import GuestServiceModal from './GuestServiceModal';

interface ServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ServiceType {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  category: 'technical' | 'agricultural' | 'logistics';
}

const SERVICE_TYPES: ServiceType[] = [
  // Serviços Técnicos
  {
    id: 'ASSISTENCIA_TECNICA',
    label: 'Assistência Técnica Agrícola',
    description: 'Suporte técnico especializado para produção agrícola',
    icon: Settings,
    color: 'text-primary',
    category: 'technical'
  },
  {
    id: 'MANUTENCAO_EQUIPAMENTOS',
    label: 'Manutenção de Equipamentos',
    description: 'Manutenção e reparo de tratores e implementos agrícolas',
    icon: Wrench,
    color: 'text-orange-600',
    category: 'technical'
  },
  {
    id: 'MECANICO',
    label: 'Mecânico',
    description: 'Reparos mecânicos em geral de veículos e equipamentos',
    icon: Wrench,
    color: 'text-gray-600',
    category: 'technical'
  },
  {
    id: 'ELETRICISTA_AUTOMOTIVO',
    label: 'Eletricista Automotivo',
    description: 'Sistema elétrico completo de veículos',
    icon: Zap,
    color: 'text-yellow-600',
    category: 'technical'
  },
  {
    id: 'BORRACHEIRO',
    label: 'Borracheiro',
    description: 'Troca e reparo de pneus',
    icon: Shield,
    color: 'text-slate-600',
    category: 'technical'
  },
  {
    id: 'CHAVEIRO',
    label: 'Chaveiro',
    description: 'Abertura de veículos travados',
    icon: Key,
    color: 'text-amber-600',
    category: 'technical'
  },
  {
    id: 'CONSULTORIA_RURAL',
    label: 'Consultoria Rural',
    description: 'Consultoria especializada em gestão rural e produtividade',
    icon: Users,
    color: 'text-blue-600',
    category: 'technical'
  },
  {
    id: 'SERVICOS_VETERINARIOS',
    label: 'Serviços Veterinários',
    description: 'Atendimento veterinário e cuidados com o rebanho',
    icon: Stethoscope,
    color: 'text-green-600',
    category: 'technical'
  },
  {
    id: 'OUTROS',
    label: 'Outros',
    description: 'Outros tipos de serviços especializados',
    icon: MoreHorizontal,
    color: 'text-neutral-600',
    category: 'technical'
  },
  // Serviços Agrícolas
  {
    id: 'ANALISE_SOLO',
    label: 'Análise de Solo',
    description: 'Coleta e análise de amostras de solo para correção',
    icon: TestTube,
    color: 'text-purple-600',
    category: 'agricultural'
  },
  {
    id: 'PULVERIZACAO',
    label: 'Pulverização',
    description: 'Aplicação de defensivos e fertilizantes foliares',
    icon: Droplets,
    color: 'text-cyan-600',
    category: 'agricultural'
  },
  {
    id: 'PULVERIZACAO_DRONE',
    label: 'Pulverização por Drone',
    description: 'Aplicação de defensivos e fertilizantes via drone',
    icon: Plane,
    color: 'text-teal-600',
    category: 'agricultural'
  },
  {
    id: 'COLHEITA_PLANTIO',
    label: 'Colheita e Plantio',
    description: 'Serviços de colheita mecanizada e plantio especializado',
    icon: Wheat,
    color: 'text-yellow-600',
    category: 'agricultural'
  },
  {
    id: 'ADUBACAO_CALCARIO',
    label: 'Adubação e Calagem',
    description: 'Aplicação de fertilizantes e correção do pH do solo',
    icon: Leaf,
    color: 'text-emerald-600',
    category: 'agricultural'
  },
  // Serviços de Logística
  {
    id: 'GUINDASTE',
    label: 'Guindaste',
    description: 'Elevação e movimentação de cargas pesadas',
    icon: Package,
    color: 'text-orange-600',
    category: 'logistics'
  },
  {
    id: 'COMBUSTIVEL',
    label: 'Combustível',
    description: 'Entrega de combustível',
    icon: Fuel,
    color: 'text-green-600',
    category: 'logistics'
  },
  {
    id: 'ARMAZENAGEM',
    label: 'Armazenagem',
    description: 'Serviços de armazenamento de grãos e insumos',
    icon: Package,
    color: 'text-rose-600',
    category: 'logistics'
  }
];

const CATEGORY_LABELS = {
  technical: 'Serviços Técnicos',
  agricultural: 'Serviços Agrícolas',
  logistics: 'Logística e Armazenagem'
};

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
              
              {/* Agrupar serviços por categoria */}
              {Object.entries(CATEGORY_LABELS).map(([category, categoryLabel]) => {
                const categoryServices = SERVICE_TYPES.filter(service => service.category === category);
                const selectedCount = categoryServices.length;
                const totalCount = categoryServices.length;
                
                return (
                  <div key={category} className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-base font-medium text-foreground">{categoryLabel}</h4>
                      <Badge variant="secondary">{selectedCount}/{totalCount}</Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {categoryServices.map((service) => {
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
                              <CardTitle className="text-lg group-hover:text-primary transition-colors">{service.label}</CardTitle>
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
                );
              })}
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