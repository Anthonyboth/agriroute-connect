import React, { useCallback, useEffect, useMemo, useState } from "react";
import { devLog } from '@/lib/devLogger';
import { ArrowLeft, Truck, Leaf, Package, Wrench, Building2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { 
  BottomSheet, 
  BottomSheetContent, 
  BottomSheetHeader, 
  BottomSheetBody,
  BottomSheetFooter 
} from "@/components/ui/bottom-sheet";
import { ServiceCategoryCard } from "./ServiceCategoryCard";
import ServiceRequestModal from "./ServiceRequestModal";
import { ServiceCatalogGrid } from "./ServiceCatalogGrid";
import { FreightTransportModal } from "./FreightTransportModal";
import { ALL_SERVICE_TYPES } from "@/lib/service-types";

// ============================================
// ServicesModal - CORREÇÃO COMPLETA
// - Overlay + Content sempre sincronizados
// - Cliques nos cards funcionando
// - Design consistente nas páginas internas
// ============================================

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
  freight: "text-orange-600 dark:text-orange-400",
  agricultural: "text-green-600 dark:text-green-400",
  logistics: "text-blue-600 dark:text-blue-400",
  technical: "text-purple-600 dark:text-purple-400",
  urban: "text-cyan-600 dark:text-cyan-400",
  all: "text-primary",
};

export const ServicesModal: React.FC<ServicesModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  mode = "client" 
}) => {
  // Estado interno para navegação entre steps
  const [viewMode, setViewMode] = useState<ViewMode>("categories");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Modal de Fretes (abre separado)
  const [freightTransportModal, setFreightTransportModal] = useState(false);

  // Modal de solicitação de serviço
  const [serviceRequestModal, setServiceRequestModal] = useState<{
    isOpen: boolean;
    serviceId?: string;
    serviceLabel?: string;
    serviceDescription?: string;
    category?: ServiceCategory;
  }>({ isOpen: false });

  // Base list conforme modo
  const baseServices = useMemo(() => {
    if (mode === "driver") return ALL_SERVICE_TYPES.filter((s: any) => s.categories?.includes("freight"));
    if (mode === "provider") return ALL_SERVICE_TYPES.filter((s: any) => !s.categories?.includes("freight") && s.providerVisible);
    return ALL_SERVICE_TYPES;
  }, [mode]);

  // Contar serviços por categoria
  const countByCategory = useCallback((cat: ServiceCategory) => {
    return baseServices.filter((s: any) => s.categories?.includes(cat)).length;
  }, [baseServices]);

  const allTabCount = useMemo(() => {
    return baseServices.length;
  }, [baseServices]);

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
    [countByCategory, allTabCount]
  );

  // CRÍTICO: Resetar estado ao abrir (não ao fechar para evitar flash)
  useEffect(() => {
    if (isOpen) {
      setViewMode("categories");
      setSelectedCategory(null);
    }
  }, [isOpen]);

  // CRÍTICO: Handler de clique em categoria - navegação interna
  const handleCategoryClick = useCallback((categoryId: string) => {
    devLog('[ServicesModal] Categoria clicada:', categoryId);
    
    if (categoryId === "freight") {
      // Fretes abre modal separado
      setFreightTransportModal(true);
      onClose();
      return;
    }

    // Outras categorias: navegação interna no mesmo sheet
    setSelectedCategory(categoryId);
    setViewMode("services");
  }, [onClose]);

  // Voltar para categorias
  const handleBack = useCallback(() => {
    setViewMode("categories");
    setSelectedCategory(null);
  }, []);

  // Solicitar serviço
  const handleServiceRequest = useCallback((service: any) => {
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
  }, [onSelect, onClose]);

  // Título e descrição dinâmicos
  const titleText = useMemo(() => {
    if (viewMode === "categories") return "Categorias de Serviços";
    if (selectedCategory === "all") return "Todos os Serviços";
    return categoryCards.find((c) => c.id === selectedCategory)?.title ?? "Serviços";
  }, [viewMode, selectedCategory, categoryCards]);

  const subtitleText = useMemo(() => {
    if (viewMode === "categories") return "Selecione uma categoria para visualizar os serviços disponíveis";
    if (selectedCategory === "all") return "Lista completa de serviços disponíveis na plataforma";
    return "Selecione o serviço desejado";
  }, [viewMode, selectedCategory]);

  // Handler para fechar o modal principal
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose();
    }
  }, [onClose]);

  return (
    <>
      {/* MODAL PRINCIPAL - Bottom Sheet */}
      <BottomSheet open={isOpen} onOpenChange={handleOpenChange}>
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

            {/* VIEW 1: Categorias - Cards estilo Facebook Premium */}
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

            {/* VIEW 2: Serviços da categoria selecionada */}
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

          {/* Footer visual passivo - fecha o sheet sem cortes */}
          <BottomSheetFooter />
        </BottomSheetContent>
      </BottomSheet>

      {/* Modal de Fretes e Transportes (separado) */}
      <FreightTransportModal
        isOpen={freightTransportModal}
        onClose={() => {
          setFreightTransportModal(false);
          // Não chama onClose() aqui para permitir o usuário voltar
        }}
        onBack={() => {
          setFreightTransportModal(false);
        }}
      />

      {/* Modal de solicitação de serviços */}
      {!onSelect && (
      <ServiceRequestModal
          isOpen={serviceRequestModal.isOpen}
          serviceId={serviceRequestModal.serviceId || ""}
          serviceLabel={serviceRequestModal.serviceLabel || ""}
          serviceDescription={serviceRequestModal.serviceDescription || ""}
          category={serviceRequestModal.category || "technical"}
          onClose={() => setServiceRequestModal(prev => ({ ...prev, isOpen: false }))}
        />
      )}
    </>
  );
};
