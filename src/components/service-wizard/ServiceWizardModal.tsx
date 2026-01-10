import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { ServiceWizard } from './ServiceWizard';
import { ServiceType } from './types';

interface ServiceWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceType: ServiceType;
  onSuccess?: () => void;
  // Para serviços do catálogo
  catalogServiceId?: string;
  catalogServiceLabel?: string;
  catalogServiceDescription?: string;
}

export const ServiceWizardModal: React.FC<ServiceWizardModalProps> = ({
  isOpen,
  onClose,
  serviceType,
  onSuccess,
  catalogServiceId,
  catalogServiceLabel,
  catalogServiceDescription
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ServiceWizard
            serviceType={serviceType}
            onClose={onClose}
            onSuccess={onSuccess}
            catalogServiceId={catalogServiceId}
            catalogServiceLabel={catalogServiceLabel}
            catalogServiceDescription={catalogServiceDescription}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
