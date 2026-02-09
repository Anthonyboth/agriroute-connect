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

// ✅ IDs de serviço que são diretamente um ServiceType válido
const DIRECT_SERVICE_TYPE_MAP: Record<string, ServiceType> = {
  ENTREGA_PACOTES: "ENTREGA_PACOTES",
  TRANSPORTE_PET: "TRANSPORTE_PET",
  GUINCHO: "GUINCHO",
  FRETE_MOTO: "FRETE_MOTO",
  FRETE_URBANO: "FRETE_URBANO",
  MUDANCA_RESIDENCIAL: "MUDANCA_RESIDENCIAL",
  MUDANCA_COMERCIAL: "MUDANCA_COMERCIAL",
  SERVICO_AGRICOLA: "SERVICO_AGRICOLA",
  SERVICO_TECNICO: "SERVICO_TECNICO",
};

// ✅ Fallback por categoria (quando serviceId não é um ServiceType direto)
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
  // ✅ Determinar o tipo de serviço: priorizar serviceId se for um ServiceType válido
  const serviceType = useMemo<ServiceType>(() => {
    // Se o serviceId é diretamente um ServiceType reconhecido, usar ele
    if (DIRECT_SERVICE_TYPE_MAP[serviceId]) {
      return DIRECT_SERVICE_TYPE_MAP[serviceId];
    }
    // Fallback por categoria
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
      <DialogContent
        className="max-w-2xl h-[90vh] max-h-[90vh] flex flex-col p-0 overflow-hidden"
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
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
