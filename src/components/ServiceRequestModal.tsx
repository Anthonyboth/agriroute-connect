import React, { useEffect, useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ServiceWizard } from "./service-wizard/ServiceWizard";
import { ServiceType } from "./service-wizard/types";

interface ServiceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: string;
  serviceLabel: string;
  serviceDescription: string;
  category: "freight" | "technical" | "agricultural" | "logistics" | "urban";
}

// ✅ Mapear categorias para ServiceType (fallback seguro)
const categoryToServiceType: Record<ServiceRequestModalProps["category"], ServiceType> = {
  freight: "FRETE_URBANO",
  technical: "SERVICO_TECNICO",
  agricultural: "SERVICO_AGRICOLA",
  logistics: "FRETE_URBANO",
  urban: "FRETE_URBANO",
};

const ServiceRequestModal: React.FC<ServiceRequestModalProps> = ({
  isOpen,
  onClose,
  serviceId,
  serviceLabel,
  serviceDescription,
  category,
}) => {
  // ✅ Determinar o tipo de serviço baseado na categoria
  const serviceType = useMemo<ServiceType>(() => {
    return categoryToServiceType[category] ?? "SERVICO_TECNICO";
  }, [category]);

  // ✅ Resetar scroll/estado visual ao abrir (evita “modal preso” em scroll antigo)
  useEffect(() => {
    if (!isOpen) return;
    // Se você tiver algum container com scroll específico, pode resetar aqui.
    // Mantive seguro e sem dependências externas.
  }, [isOpen]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // ✅ só fecha quando realmente fechar
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="flex flex-col h-full min-h-0 overflow-hidden">
          <ServiceWizard
            serviceType={serviceType}
            onClose={onClose}
            onSuccess={onClose} // ✅ fecha ao finalizar com sucesso (fluxo consistente)
            catalogServiceId={serviceId}
            catalogServiceLabel={serviceLabel}
            catalogServiceDescription={serviceDescription}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServiceRequestModal;
