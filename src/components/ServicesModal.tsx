import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import ServiceRequestModal from './ServiceRequestModal';
import { ServiceCatalogGrid } from './ServiceCatalogGrid';
import { getServiceById } from '@/lib/service-types';

interface ServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}


export const ServicesModal: React.FC<ServicesModalProps> = ({
  isOpen,
  onClose
}) => {
  const [serviceRequestModal, setServiceRequestModal] = useState<{
    isOpen: boolean;
    serviceId?: string;
    serviceLabel?: string;
    serviceDescription?: string;
    category?: 'technical' | 'agricultural' | 'logistics';
  }>({ isOpen: false });

  const handleServiceRequest = (service: any) => {
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
          </DialogHeader>

          <ServiceCatalogGrid 
            mode="client"
            onServiceRequest={handleServiceRequest}
            showCheckboxes={false}
            title=""
            description="Selecione o serviço que você precisa"
          />
        </DialogContent>
      </Dialog>

      {/* Modal de solicitação de serviços */}
      {serviceRequestModal.serviceId && (
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