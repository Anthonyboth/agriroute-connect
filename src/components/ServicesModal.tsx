import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ServiceRequestModal from './ServiceRequestModal';
import { ServiceCatalogGrid } from './ServiceCatalogGrid';
import { getServiceById } from '@/lib/service-types';

interface ServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (service: any) => void;
  mode?: 'client' | 'driver' | 'provider';
}


export const ServicesModal: React.FC<ServicesModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  mode = 'client'
}) => {
  const [serviceRequestModal, setServiceRequestModal] = useState<{
    isOpen: boolean;
    serviceId?: string;
    serviceLabel?: string;
    serviceDescription?: string;
    category?: 'technical' | 'agricultural' | 'logistics' | 'urban' | 'freight';
  }>({ isOpen: false });

  const handleServiceRequest = (service: any) => {
    if (onSelect) {
      onSelect(service);
      onClose();
      return;
    }
    setServiceRequestModal({
      isOpen: true,
      serviceId: service.id,
      serviceLabel: service.label,
      serviceDescription: service.description,
      category: service.category
    });
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
            <DialogDescription className="sr-only">Selecione um serviço</DialogDescription>
          </DialogHeader>

          <ServiceCatalogGrid 
            mode={mode}
            onServiceRequest={handleServiceRequest}
            showCheckboxes={false}
            title=""
            description="Selecione o serviço que você precisa"
          />
        </DialogContent>
      </Dialog>

      {/* Modal de solicitação de serviços */}
      {!onSelect && serviceRequestModal.serviceId && (
        <ServiceRequestModal
          isOpen={serviceRequestModal.isOpen}
          serviceId={serviceRequestModal.serviceId}
          serviceLabel={serviceRequestModal.serviceLabel || ''}
          serviceDescription={serviceRequestModal.serviceDescription || ''}
          category={serviceRequestModal.category || 'technical'}
          onClose={() => setServiceRequestModal({ isOpen: false })}
        />
      )}

    </>
  );
};