import React, { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Truck, Leaf, Package, Wrench, Building2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  BottomSheet, 
  BottomSheetContent, 
  BottomSheetHeader, 
  BottomSheetBody 
} from "@/components/ui/bottom-sheet";
import { ServiceCategoryCard } from "./ServiceCategoryCard";
import ServiceRequestModal from "./ServiceRequestModal";
import { ServiceCatalogGrid } from "./ServiceCatalogGrid";
import { FreightTransportModal } from "./FreightTransportModal";
import { ALL_SERVICE_TYPES } from "@/lib/service-types";

interface ServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (service: any) => void;
  mode?: "client" | "driver" | "provider";
}

type ServiceCategory = "technical" | "agricultural" | "logistics" | "urban" | "freight";
type ViewMode = "categories" | "services";

// Mapeamento de ícones profissionais para cada categoria
const categoryIcons: Record<string, React.ElementType> = {
  freight: Truck,
  agricultural: Leaf,
  logistics: Package,
  technical: Wrench,
  urban: Building2,
  all: ListChecks,
};

// Cores profissionais para ícones
const iconColors: Record<string, string> = {
  freight: "text-orange-600",
  agricultural: "text-green-600",
  logistics: "text-blue-600",
  technical: "text-purple-600",
  urban: "text-cyan-600",
  all: "text-primary",
};

export const ServicesModal: React.FC<ServicesModalProps> = ({ isOpen, onClose, onSelect, mode = "client" }) => {
  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [freightTransportModal, setFreightTransportModal] = useState(false);

  const [serviceRequestModal, setServiceRequestModal] = useState<{
    isOpen: boolean;
    serviceId?: string;
    serviceLabel?: string;
    serviceDescription?: string;
    category?: ServiceCategory;
  }>({ isOpen: false });

  // Base list conforme modo
  const baseServices = useMemo(() => {
    if (mode === "driver") return ALL_SERVICE_TYPES.filter((s: any) => s.category === "freight");
    if (mode === "provider") return ALL_SERVICE_TYPES.filter((s: any) => s.category !== "freight" && s.providerVisible);
    return ALL_SERVICE_TYPES;
  }, [mode]);

  // Contar serviços por categoria
  const countByCategory = (cat: ServiceCategory) => {
    return baseServices.filter((s: any) => s.category === cat && !s.showOnlyInAllTab).length;
  };

  const allTabCount = useMemo(() => {
    if (mode === "driver") return baseServices.length;
    return baseServices.filter((s: any) => !s.hideFromAllTab).length;
  }, [mode, baseServices]);

  const categoryCards = useMemo(
    () => [
      {
        id: "freight",
        title: "Fretes e Transportes",
        description: "Guincho, mudanças, frete urbano e rural",
        count: countByCategory("freight"),
      },
      {
        id: "agricultural",
        title: "Serviços Agrícolas",
        description: "Plantio, colheita, pulverização e outros",
        count: countByCategory("agricultural"),
      },
      {
        id: "logistics",
        title: "Serviços Logísticos",
        description: "Armazenamento, distribuição e transporte",
        count: countByCategory("logistics"),
      },
      {
        id: "technical",
        title: "Serviços Técnicos",
        description: "Manutenção, reparos e assistência especializada",
        count: countByCategory("technical"),
      },
      {
        id: "urban",
        title: "Serviços Urbanos",
        description: "Entregas, mensageiro e serviços na cidade",
        count: countByCategory("urban"),
      },
      {
        id: "all",
        title: "Todas as Categorias",
        description: "Visualize a lista completa de serviços disponíveis",
        count: allTabCount,
      },
    ],
    [allTabCount, baseServices], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Resetar estado ao abrir
  useEffect(() => {
    if (!isOpen) return;
    setViewMode("categories");
    setSelectedCategory(null);
  }, [isOpen]);

  const handleCategoryClick = (categoryId: string) => {
    if (categoryId === "freight") {
      setFreightTransportModal(true);
      onClose();
      return;
    }

    setSelectedCategory(categoryId);
    setViewMode("services");
  };

  const handleBack = () => {
    setViewMode("categories");
    setSelectedCategory(null);
  };

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
      category: service.category as ServiceCategory,
    });

    onClose();
  };

  // Título e descrição
  const titleText =
    viewMode === "categories"
      ? "Categorias de Serviços"
      : selectedCategory === "all"
        ? "Todos os Serviços"
        : categoryCards.find((c) => c.id === selectedCategory)?.title ?? "Serviços";

  const subtitleText =
    viewMode === "categories"
      ? "Selecione uma categoria para visualizar os serviços disponíveis"
      : selectedCategory === "all"
        ? "Lista completa de serviços disponíveis na plataforma"
        : "Selecione o serviço desejado";

  return (
    <>
      <BottomSheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <BottomSheetContent>
          <BottomSheetHeader 
            title={titleText} 
            subtitle={subtitleText}
          />

          <BottomSheetBody>
            {/* Botão Voltar quando estiver visualizando serviços */}
            {viewMode === "services" && (
              <Button 
                variant="ghost" 
                onClick={handleBack} 
                className="mb-4 hover:bg-muted w-fit -ml-2"
                size="sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Categorias
              </Button>
            )}

            {/* VIEW 1: Categorias - Cards estilo Facebook */}
            {viewMode === "categories" && (
              <div className="flex flex-col gap-3">
                {categoryCards.map((category) => (
                  <ServiceCategoryCard
                    key={category.id}
                    id={category.id}
                    title={category.title}
                    description={category.description}
                    count={category.count}
                    icon={categoryIcons[category.id] || ListChecks}
                    iconColor={iconColors[category.id] || "text-primary"}
                    onClick={handleCategoryClick}
                  />
                ))}
              </div>
            )}

            {/* VIEW 2: Serviços */}
            {viewMode === "services" && selectedCategory && (
              <ServiceCatalogGrid
                mode={mode}
                onServiceRequest={handleServiceRequest}
                showCheckboxes={false}
                title=""
                description=""
                initialCategory={selectedCategory}
                hideCategoryFilter={selectedCategory !== "all"}
              />
            )}
          </BottomSheetBody>
        </BottomSheetContent>
      </BottomSheet>

      {/* Modal de Fretes e Transportes */}
      <FreightTransportModal
        isOpen={freightTransportModal}
        onClose={() => {
          setFreightTransportModal(false);
          onClose();
        }}
        onBack={() => {
          setFreightTransportModal(false);
        }}
      />

      {/* Modal de solicitação de serviços */}
      {!onSelect && serviceRequestModal.serviceId && (
        <ServiceRequestModal
          isOpen={serviceRequestModal.isOpen}
          serviceId={serviceRequestModal.serviceId}
          serviceLabel={serviceRequestModal.serviceLabel || ""}
          serviceDescription={serviceRequestModal.serviceDescription || ""}
          category={serviceRequestModal.category || "technical"}
          onClose={() => setServiceRequestModal({ isOpen: false })}
        />
      )}
    </>
  );
};
