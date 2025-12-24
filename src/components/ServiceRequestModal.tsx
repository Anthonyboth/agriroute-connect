import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ServiceWizard } from './service-wizard/ServiceWizard';
import { ServiceType } from './service-wizard/types';

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceLabel: string;
  serviceDescription: string;
  category: 'freight' | 'technical' | 'agricultural' | 'logistics' | 'urban';
}

// Mapear categorias para ServiceType
const categoryToServiceType: Record<string, ServiceType> = {
  freight: 'FRETE_URBANO',
  technical: 'SERVICO_TECNICO',
  agricultural: 'SERVICO_AGRICOLA',
  logistics: 'FRETE_URBANO',
  urban: 'FRETE_URBANO'
};

const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  serviceLabel,
  serviceDescription,
  category
}) => {
  // Determinar o tipo de serviço baseado na categoria
  const serviceType = categoryToServiceType[category] || 'SERVICO_TECNICO';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-6">
        <ServiceWizard
          serviceType={serviceType}
          onClose={onClose}
          catalogServiceId={serviceId}
          catalogServiceLabel={serviceLabel}
          catalogServiceDescription={serviceDescription}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ServiceRequestModal;
