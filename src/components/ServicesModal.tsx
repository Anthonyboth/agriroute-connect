import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
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
        icon: "🚛",
        title: "Fretes e Transportes",
        description: "Guincho, mudanças, frete urbano e rural",
        color: "bg-orange-50 text-orange-600 dark:bg-orange-900/20 border-orange-200",
        count: countByCategory("freight"),
      },
      {
        id: "agricultural",
        icon: "🌾",
        title: "Serviços Agrícolas",
        description: "Plantio, colheita, pulverização e mais",
        color: "bg-green-50 text-green-600 dark:bg-green-900/20 border-green-200",
        count: countByCategory("agricultural"),
      },
      {
        id: "logistics",
        icon: "📦",
        title: "Serviços Logísticos",
        description: "Armazenamento, distribuição e transporte",
        color: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 border-blue-200",
        count: countByCategory("logistics"),
      },
      {
        id: "technical",
        icon: "🔧",
        title: "Serviços Técnicos",
        description: "Manutenção, reparos e assistência",
        color: "bg-purple-50 text-purple-600 dark:bg-purple-900/20 border-purple-200",
        count: countByCategory("technical"),
      },
      {
        id: "urban",
        icon: "🏘️",
        title: "Serviços Urbanos",
        description: "Entregas, mensageiro e serviços na cidade",
        color: "bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 border-cyan-200",
        count: countByCategory("urban"),
      },
      {
        id: "all",
        icon: "📋",
        title: "Todos os Serviços",
        description: "Veja a lista completa de serviços disponíveis",
        color:
          "bg-gradient-to-br from-primary/10 to-accent/10 text-primary dark:from-primary/20 dark:to-accent/20 border-primary/30",
        count: allTabCount,
      },
    ],
    [allTabCount, baseServices], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ✅ Sempre que abrir, resetar estado interno (evita “ficar preso” em sub-tela)
  useEffect(() => {
    if (!isOpen) return;
    setViewMode("categories");
    setSelectedCategory(null);
    // não mexe em freightTransportModal aqui, pois ele é outro modal
    // não fecha serviceRequestModal aqui, pois ele pode abrir após seleção
  }, [isOpen]);

  const closeDialog = () => {
    // ✅ fecha somente o ServicesModal (sem “matar” modais filhos)
    onClose();
  };

  const handleCategoryClick = (categoryId: string) => {
    // ✅ Para fretes/transportes, abrir o modal específico e fechar o ServicesModal
    // (evita dois modais competindo e garante fluxo consistente)
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
    // Se o caller quer interceptar seleção
    if (onSelect) {
      onSelect(service);
      onClose();
      return;
    }

    // Caso padrão: abre ServiceRequestModal e fecha ServicesModal
    setServiceRequestModal({
      isOpen: true,
      serviceId: service.id,
      serviceLabel: service.label,
      serviceDescription: service.description,
      category: service.category as ServiceCategory,
    });

    onClose();
  };

  const titleText =
    viewMode === "categories"
      ? "🎯 Escolha a Categoria de Serviço"
      : selectedCategory === "all"
        ? "📋 Todos os Serviços"
        : `${categoryCards.find((c) => c.id === selectedCategory)?.icon ?? ""} ${
            categoryCards.find((c) => c.id === selectedCategory)?.title ?? "Serviços"
          }`;

  const descriptionText =
    viewMode === "categories"
      ? "Selecione o tipo de serviço que você precisa"
      : selectedCategory === "all"
        ? "Todos os serviços disponíveis na plataforma"
        : "Escolha o serviço específico";

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          // ✅ só fecha quando usuário fecha (X / clique fora / ESC)
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center">{titleText}</DialogTitle>
            <DialogDescription className="text-center text-lg">{descriptionText}</DialogDescription>
          </DialogHeader>

          {/* Botão Voltar quando estiver visualizando serviços */}
          {viewMode === "services" && (
            <Button variant="ghost" onClick={handleBack} className="mb-4 hover:bg-accent">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar para Categorias
            </Button>
          )}

          {/* VIEW 1: Categorias */}
          {viewMode === "categories" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-6">
              {categoryCards.map((category) => (
                <Card
                  key={category.id}
                  className={`hover:shadow-lg transition-all duration-300 cursor-pointer group border-2 ${category.color}`}
                  onClick={() => handleCategoryClick(category.id)}
                >
                  <CardHeader>
                    <div className="flex flex-col items-center text-center space-y-3">
                      <div className="text-5xl">{category.icon}</div>
                      <CardTitle className="text-xl group-hover:text-primary transition-colors">
                        {category.title}
                      </CardTitle>
                      <Badge variant="secondary" className="text-sm">
                        {category.count} {category.count === 1 ? "serviço" : "serviços"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-center text-muted-foreground mb-4">{category.description}</p>
                    <Button className="w-full" variant="outline" type="button">
                      Ver Serviços
                    </Button>
                  </CardContent>
                </Card>
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
        </DialogContent>
      </Dialog>

      {/* Modal de Fretes e Transportes */}
      <FreightTransportModal
        isOpen={freightTransportModal}
        onClose={() => {
          // ✅ Fecha modal de frete e também fecha ServicesModal (fluxo consistente)
          setFreightTransportModal(false);
          onClose();
        }}
        onBack={() => {
          // ✅ Volta para ServicesModal
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
