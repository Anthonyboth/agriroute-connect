import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import GuestServiceModal from './GuestServiceModal';
import CreateFreightModal from './CreateFreightModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Package, Home, Wheat, ArrowLeft } from 'lucide-react';

interface FreightTransportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FreightTransportModal: React.FC<FreightTransportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [guestServiceModal, setGuestServiceModal] = useState<{
    isOpen: boolean;
    serviceType?: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO';
  }>({ isOpen: false });

  const [guestFreightModal, setGuestFreightModal] = useState(false);

  const freightServices = [
    {
      id: 'GUINCHO',
      icon: Truck,
      title: 'Guincho e Socorro 24h',
      description: 'Reboque, socorro e assistência emergencial para veículos',
      color: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
      badge: 'Disponível 24h'
    },
    {
      id: 'FRETE_URBANO',
      icon: Package,
      title: 'Frete Urbano',
      description: 'Transporte rápido de cargas dentro da cidade',
      color: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
      badge: 'Entrega Rápida'
    },
    {
      id: 'MUDANCA',
      icon: Home,
      title: 'Mudança',
      description: 'Mudanças residenciais e comerciais completas',
      color: 'bg-green-50 text-green-600 dark:bg-green-900/20',
      badge: 'Profissional'
    },
    {
      id: 'FRETE_RURAL',
      icon: Wheat,
      title: 'Frete Rural',
      description: 'Transporte de cargas agrícolas e produtos do campo',
      color: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20',
      badge: 'Agronegócio'
    }
  ];

  const handleServiceSelect = (serviceId: string) => {
    if (serviceId === 'FRETE_RURAL') {
      setGuestFreightModal(true);
      onClose();
    } else {
      setGuestServiceModal({ 
        isOpen: true, 
        serviceType: serviceId as 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO' 
      });
      onClose();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="absolute left-4 top-4 flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            <DialogTitle className="text-2xl font-bold text-center">
              🚛 Fretes e Transporte
            </DialogTitle>
            <DialogDescription className="text-center text-lg">
              Escolha o serviço que você precisa
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
            {freightServices.map((service) => {
              const Icon = service.icon;
              return (
                <Card 
                  key={service.id}
                  className="hover:shadow-lg transition-all duration-300 cursor-pointer group"
                  onClick={() => handleServiceSelect(service.id)}
                >
                  <CardHeader>
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className={`p-4 rounded-full ${service.color}`}>
                        <Icon className="h-8 w-8" />
                      </div>
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        {service.title}
                      </CardTitle>
                      <Badge variant="secondary">{service.badge}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center text-muted-foreground mb-4">
                      {service.description}
                    </p>
                    <Button className="w-full" variant="outline">
                      Solicitar Agora
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Guest Service Modal para GUINCHO, FRETE_URBANO, MUDANCA */}
      {guestServiceModal.serviceType && (
        <GuestServiceModal
          isOpen={guestServiceModal.isOpen}
          onClose={() => setGuestServiceModal({ isOpen: false })}
          serviceType={guestServiceModal.serviceType}
        />
      )}

      {/* CreateFreightModal para FRETE_RURAL */}
      <CreateFreightModal
        isOpen={guestFreightModal}
        onClose={() => setGuestFreightModal(false)}
        onFreightCreated={() => {
          setGuestFreightModal(false);
        }}
        userProfile={null}
        guestMode={true}
      />
    </>
  );
};
