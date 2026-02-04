import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Truck, Leaf, Package, Wrench, Building2, ListChecks, ChevronRight } from "lucide-react";
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

// Cores profissionais para ícones (apenas o ícone, não o fundo)
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

  // ✅ Base list conforme modo
  const baseServices = useMemo(() => {
    if (mode === "driver") return ALL_SERVICE_TYPES.filter((s: any) => s.category === "freight");
    if (mode === "provider") return ALL_SERVICE_TYPES.filter((s: any) => s.category !== "freight" && s.providerVisible);
    return ALL_SERVICE_TYPES;
  }, [mode]);

  // ✅ Contar serviços por categoria (considera flags diferentes para categoria vs "all")
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

  // ✅ Sempre que abrir, resetar estado interno (evita "ficar preso" em sub-tela)
  useEffect(() => {
    if (!isOpen) return;
    setViewMode("categories");
    setSelectedCategory(null);
  }, [isOpen]);

  const closeDialog = () => {
    onClose();
  };

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

  // Título e descrição profissionais (sem emojis)
  const titleText =
    viewMode === "categories"
      ? "Categorias de Serviços"
      : selectedCategory === "all"
        ? "Todos os Serviços"
        : categoryCards.find((c) => c.id === selectedCategory)?.title ?? "Serviços";

  const descriptionText =
    viewMode === "categories"
      ? "Selecione a categoria para visualizar os serviços disponíveis"
      : selectedCategory === "all"
        ? "Lista completa de serviços disponíveis na plataforma"
        : "Selecione o serviço desejado";

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-xl font-semibold text-foreground">{titleText}</DialogTitle>
            <DialogDescription className="text-muted-foreground">{descriptionText}</DialogDescription>
          </DialogHeader>

          {/* Botão Voltar quando estiver visualizando serviços */}
          {viewMode === "services" && (
            <Button variant="ghost" onClick={handleBack} className="mb-4 hover:bg-muted w-fit">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Categorias
            </Button>
          )}

          {/* VIEW 1: Categorias - Design Profissional B2B */}
          {viewMode === "categories" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
              {categoryCards.map((category) => {
                const IconComponent = categoryIcons[category.id] || ListChecks;
                const iconColor = iconColors[category.id] || "text-primary";
                
                return (
                  <button
                    key={category.id}
                    onClick={() => handleCategoryClick(category.id)}
                    className="group flex items-start gap-4 p-4 bg-card hover:bg-muted/50 border border-border hover:border-muted-foreground/30 rounded-lg transition-all duration-150 text-left focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    {/* Ícone */}
                    <div className={`flex-shrink-0 p-2.5 rounded-lg bg-muted/50 ${iconColor}`}>
                      <IconComponent className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    
                    {/* Conteúdo */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {category.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                        {category.description}
                      </p>
                      <span className="inline-block text-xs text-muted-foreground/80 mt-2">
                        • {category.count} {category.count === 1 ? "tipo de serviço disponível" : "tipos de serviço disponíveis"}
                      </span>
                    </div>
                    
                    {/* Indicador de ação */}
                    <div className="flex-shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
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
        </DialogContent>
      </Dialog>

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