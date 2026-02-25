import React, { useState, useCallback, memo } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceProposalModal } from "./ServiceProposalModal";
import { ShareFreightToCompany } from "./ShareFreightToCompany";
import { Separator } from "@/components/ui/separator";
import { getFreightStatusLabel, getFreightStatusVariant } from "@/lib/freight-status";
import { MapPin, Package, Truck, Calendar, DollarSign, ArrowRight, Wrench, Home, Edit, X, Clock } from "lucide-react";
import { getCargoTypeLabel } from "@/lib/cargo-types";
// ✅ PERF: Removed per-card supabase query and useAuth (N+1 elimination)
import { formatTons, formatKm, formatBRL, formatDate, formatSolicitadoHa, getPricePerTruck } from "@/lib/formatters";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface FreightCardProps {
  freight: {
    id: string;
    cargo_type: string;
    weight: number;
    origin_address: string;
    destination_address: string;
    origin_city?: string;
    origin_state?: string;
    destination_city?: string;
    destination_state?: string;
    pickup_date: string;
    delivery_date: string;
    price: number;
    urgency: "LOW" | "MEDIUM" | "HIGH";
    status: "OPEN" | "IN_TRANSIT" | "DELIVERED" | "IN_NEGOTIATION" | "ACCEPTED" | "CANCELLED";
    distance_km: number;
    minimum_antt_price: number;
    service_type?: "CARGA" | "GUINCHO" | "MUDANCA" | "FRETE_MOTO" | "ENTREGA_PACOTES" | "TRANSPORTE_PET";
    required_trucks?: number;
    accepted_trucks?: number;
    pricing_type?: "FIXED" | "PER_KM" | "PER_TON";
    price_per_km?: number;

    // ✅ necessário para "Solicitado há X dias"
    created_at?: string;
  };
  onAction?: (action: "propose" | "accept" | "complete" | "edit" | "cancel" | "proposal_sent") => void;
  showActions?: boolean;
  showProducerActions?: boolean;
  isAffiliatedDriver?: boolean;
  driverCompanyId?: string;
  driverProfile?: any;
}

const OptimizedFreightCard = memo<FreightCardProps>(
  ({
    freight,
    onAction,
    showActions = false,
    showProducerActions = false,
    isAffiliatedDriver = false,
    driverCompanyId,
    driverProfile,
  }) => {
    const [proposalModalOpen, setProposalModalOpen] = useState(false);
    // ✅ PERF: Removida query per-card para freight_assignments.
    // Cada card fazia SELECT em freight_assignments, causando N+1 queries.
    // hasCompletedBefore agora é derivado de props (se necessário, o parent deve fornecer).
    const hasCompletedBefore = false;

    // Memoized calculations
    const isFullyBooked = React.useMemo(
      () => (freight.required_trucks || 1) <= (freight.accepted_trucks || 0),
      [freight.required_trucks, freight.accepted_trucks],
    );

    const availableSlots = React.useMemo(
      () => (freight.required_trucks || 1) - (freight.accepted_trucks || 0),
      [freight.required_trucks, freight.accepted_trucks],
    );

    // ✅ Label do tipo (corrige "Serviço" -> "Mudança/Guincho/Frete Moto")
    const serviceLabel = React.useMemo(() => {
      switch (freight.service_type) {
        case "GUINCHO":
          return "Guincho";
        case "MUDANCA":
          return "Mudança";
        case "FRETE_MOTO":
          return "Frete Moto";
        case "CARGA":
        default:
          return "Carga";
      }
    }, [freight.service_type]);

    // ✅ Ícone do tipo (inclui FRETE_MOTO)
    const serviceIcon = React.useMemo(() => {
      switch (freight.service_type) {
        case "GUINCHO":
          return <Wrench className="h-6 w-6 text-warning" />;
        case "MUDANCA":
          return <Home className="h-6 w-6 text-accent" />;
        case "FRETE_MOTO":
          return <Truck className="h-6 w-6 text-blue-500" />;
        default:
          return <Package className="h-6 w-6 text-primary" />;
      }
    }, [freight.service_type]);

    // ✅ Título do card: para fretes urbanos, mostrar o tipo; para carga, mostrar o cargo_type
    const cardTitle = React.useMemo(() => {
      if (freight.service_type && freight.service_type !== "CARGA") {
        return serviceLabel; // Mudança / Guincho / Frete Moto
      }
      return getCargoTypeLabel(freight.cargo_type); // Ex.: Soja, Milho...
    }, [freight.service_type, freight.cargo_type, serviceLabel]);

    // Memoized style functions
    const getUrgencyVariant = useCallback((urgency: string) => {
      switch (urgency) {
        case "HIGH":
          return "destructive";
        case "LOW":
          return "secondary";
        default:
          return "default";
      }
    }, []);

    const getUrgencyLabel = useCallback((urgency: string) => {
      switch (urgency) {
        case "HIGH":
          return "Alta";
        case "LOW":
          return "Baixa";
        default:
          return "Normal";
      }
    }, []);

    // ✅ "Solicitado há X dias" usando função padronizada
    const requestedTimeInfo = React.useMemo(() => {
      const base = freight.created_at || freight.pickup_date;
      if (!base) return null;

      try {
        const label = formatSolicitadoHa(base);
        const exactDate = new Date(base).toLocaleString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        return { label, exactDate };
      } catch {
        return null;
      }
    }, [freight.created_at, freight.pickup_date]);

    // Memoized handlers
    const handleProposalModalOpen = useCallback(() => setProposalModalOpen(true), []);
    const handleProposalModalClose = useCallback(() => setProposalModalOpen(false), []);
    const handleAccept = useCallback(() => onAction?.("accept"), [onAction]);
    const handleEdit = useCallback(() => onAction?.("edit"), [onAction]);
    const handleCancel = useCallback(() => onAction?.("cancel"), [onAction]);
    const handleProposalSuccess = useCallback(() => {
      setProposalModalOpen(false);
      onAction?.("proposal_sent");
    }, [onAction]);

    // GPS precision indicator
    const precisionInfo = React.useMemo(() => {
      const originLat = (freight as any).origin_lat;
      const originLng = (freight as any).origin_lng;
      const destLat = (freight as any).destination_lat;
      const destLng = (freight as any).destination_lng;

      const originReal = originLat !== null && originLat !== undefined && originLng !== null && originLng !== undefined;
      const destReal = destLat !== null && destLat !== undefined && destLng !== null && destLng !== undefined;

      if (originReal && destReal) {
        return { isAccurate: true, icon: "📍", tooltip: "Distância calculada com GPS preciso" };
      }

      return { isAccurate: false, icon: "📌", tooltip: "Distância estimada por endereço" };
    }, [freight]);

    const urgencyVariant = getUrgencyVariant(freight.urgency);
    const urgencyLabel = getUrgencyLabel(freight.urgency);

    return (
      <Card className="freight-card-standard card-accessible hover:scale-[1.02] border-2 border-border/60 hover:border-primary/30">
        <CardHeader className="pb-6 flex-shrink-0">
          <div className="flex flex-col spacing-accessible">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                {serviceIcon}
                <h3 className="font-bold text-foreground truncate text-xl">{cardTitle}</h3>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0 flex-wrap">
                <Badge variant={urgencyVariant} className="text-sm font-semibold px-3 py-1">
                  {urgencyLabel}
                </Badge>
                <Badge variant={getFreightStatusVariant(freight.status)} className="text-sm font-semibold px-3 py-1">
                  {getFreightStatusLabel(freight.status)}
                </Badge>
                {hasCompletedBefore && (
                  <Badge
                    variant="outline"
                    className="bg-green-50 dark:bg-green-900/30 border-green-500 text-green-700 dark:text-green-400 text-sm font-semibold px-3 py-1"
                  >
                    ✅ Você já completou uma carreta
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-sm bg-secondary/30 px-3 py-1">
                {serviceLabel}
              </Badge>

              {/* ✅ Tempo com tooltip da data exata */}
              {requestedTimeInfo && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="text-sm px-3 py-1 flex items-center gap-2 cursor-help">
                        <Clock className="h-4 w-4" />
                        {requestedTimeInfo.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Criado em {requestedTimeInfo.exactDate}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {/* Badge de capacidade máxima para moto */}
              {freight.service_type === "FRETE_MOTO" && (
                <Badge variant="outline" className="text-sm bg-yellow-50 text-yellow-700 border-yellow-300 px-3 py-1">
                  <Truck className="h-3.5 w-3.5 mr-1" />
                  Máx. 500kg
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="spacing-accessible flex-1 overflow-y-auto">
          {/* Carretas Info - Enhanced visibility */}
          {freight.required_trucks && freight.required_trucks > 1 && (
            <div className="flex items-center justify-between p-4 bg-secondary/30 rounded-xl border-2 border-border/50">
              <div className="flex items-center space-x-3 text-muted-foreground">
                <Truck className="h-5 w-5" />
                <span className="text-base font-semibold">Carretas:</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className={`font-bold text-lg ${isFullyBooked ? "text-success" : "text-primary"}`}>
                  {freight.accepted_trucks || 0}/{freight.required_trucks}
                </span>
                {isFullyBooked ? (
                  <Badge variant="default" className="text-sm bg-success text-success-foreground px-3 py-1">
                    Completo
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {availableSlots} vaga{availableSlots > 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Peso/Info e Distância */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
            <div className="flex items-center space-x-3 text-muted-foreground">
              {freight.service_type === "GUINCHO" ? (
                <>
                  <Wrench className="h-5 w-5" />
                  <span className="text-base font-semibold">Reboque</span>
                </>
              ) : freight.service_type === "MUDANCA" ? (
                <>
                  <Home className="h-5 w-5" />
                  <span className="text-base font-semibold">Residencial</span>
                </>
              ) : freight.service_type === "FRETE_MOTO" ? (
                <>
                  <Truck className="h-5 w-5 text-blue-500" />
                  <span className="text-base font-semibold">Moto</span>
                </>
              ) : (
                <>
                  <Package className="h-5 w-5" />
                  <span className="text-base font-semibold">{formatTons(freight.weight)}</span>
                </>
              )}
            </div>

            <div className="flex items-center space-x-3 text-muted-foreground">
              <MapPin className="h-5 w-5" />
              <span className="text-base font-semibold">{formatKm(freight.distance_km)}</span>
              <span className="text-xs" title={precisionInfo.tooltip}>
                {precisionInfo.icon}
              </span>
            </div>
          </div>

          {/* Origem e Destino */}
          <div className="spacing-accessible">
            <div className="space-y-2">
              <p className="text-large-accessible font-bold text-foreground flex items-center gap-3">
                <MapPin className="h-4 w-4 text-primary" />
                Origem
              </p>
              {freight.origin_city && freight.origin_state && (
                <p className="text-lg font-bold text-primary pl-7">
                  {freight.origin_city.toUpperCase()} - {freight.origin_state.toUpperCase()}
                </p>
              )}
              <p className="text-accessible text-foreground/80 pl-7 leading-relaxed">{freight.origin_address}</p>
            </div>

            <div className="space-y-2">
              <p className="text-large-accessible font-bold text-foreground flex items-center gap-3">
                <ArrowRight className="h-4 w-4 text-accent" />
                Destino
              </p>
              {freight.destination_city && freight.destination_state && (
                <p className="text-lg font-bold text-primary pl-7">
                  {freight.destination_city.toUpperCase()} - {freight.destination_state.toUpperCase()}
                </p>
              )}
              <p className="text-accessible text-foreground/80 pl-7 leading-relaxed">{freight.destination_address}</p>
            </div>
          </div>

          <Separator className="bg-border my-6" />

          {/* Datas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3 p-4 bg-gradient-to-br from-secondary/40 to-secondary/20 rounded-xl border-2 border-border/50">
              <div className="flex items-center space-x-3 text-muted-foreground">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">Coleta</span>
              </div>
              <p className="font-bold text-foreground text-lg">{formatDate(freight.pickup_date)}</p>
            </div>

            <div className="space-y-3 p-4 bg-gradient-to-br from-accent/30 to-accent/10 rounded-xl border-2 border-border/50">
              <div className="flex items-center space-x-3 text-muted-foreground">
                <Calendar className="h-5 w-5 text-accent" />
                <span className="text-sm font-semibold">Entrega</span>
              </div>
              <p className="font-bold text-foreground text-lg">{formatDate(freight.delivery_date)}</p>
            </div>
          </div>
        </CardContent>

        <CardFooter className="pt-6 pb-6 flex-shrink-0 mt-auto">
          <div className="flex items-center justify-between w-full p-5 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl border-2 border-border/60">
            <div className="text-left">
              {(() => {
                const requiredTrucks = freight.required_trucks || 1;
                const pricePerTruck = getPricePerTruck(freight.price, requiredTrucks);
                const hasMultipleTrucks = requiredTrucks > 1;
                const pricingType = freight.pricing_type;
                const unitRate = freight.price_per_km;

                return (
                  <>
                    {pricingType === "PER_KM" && unitRate ? (
                      <p className="font-bold text-3xl text-primary">
                        {formatBRL(unitRate, true)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/km</span>
                      </p>
                    ) : pricingType === "PER_TON" && unitRate ? (
                      <p className="font-bold text-3xl text-primary">
                        {formatBRL(unitRate, true)}
                        <span className="text-sm font-normal text-muted-foreground ml-1">/ton</span>
                      </p>
                    ) : (
                      <p className="font-bold text-3xl text-primary">
                        {formatBRL(hasMultipleTrucks ? pricePerTruck : freight.price, true)}
                        {hasMultipleTrucks && (
                          <span className="text-sm font-normal text-muted-foreground ml-1">/carreta</span>
                        )}
                        {!hasMultipleTrucks && (
                          <span className="text-sm font-normal text-muted-foreground ml-1">fixo</span>
                        )}
                      </p>
                    )}
                  </>
                );
              })()}
              {freight.service_type === "FRETE_MOTO" ? (
                <p className="text-base text-blue-600 dark:text-blue-400 mt-2 font-semibold">Mínimo: R$ 10,00</p>
              ) : (
                freight.service_type === "CARGA" &&
                (freight.minimum_antt_price && freight.minimum_antt_price > 0 ? (
                  <Badge variant="outline" className="text-sm">
                    Mín. ANTT: {formatBRL(freight.minimum_antt_price, true)}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-sm">
                    ⚠️ ANTT não calculado
                  </Badge>
                ))
              )}
            </div>
            <div className="text-right">
              <DollarSign className="h-10 w-10 text-accent ml-auto" />
            </div>
          </div>
        </CardFooter>

        {/* Actions */}
        {showActions && onAction && freight.status === "OPEN" && !isFullyBooked && (
          <div className="px-6 pb-6">
            {isAffiliatedDriver ? (
              <ShareFreightToCompany freight={freight} companyId={driverCompanyId} driverProfile={driverProfile} />
            ) : freight.service_type === "GUINCHO" ? (
              <Button
                onClick={handleAccept}
                className="w-full btn-accessible gradient-primary text-lg font-semibold"
                size="lg"
              >
                <Wrench className="mr-2 h-5 w-5" />
                Aceitar Chamado
              </Button>
            ) : freight.service_type === "MUDANCA" ? (
              <Button
                onClick={handleAccept}
                className="w-full btn-accessible gradient-primary text-lg font-semibold"
                size="lg"
              >
                <Home className="mr-2 h-5 w-5" />
                Aceitar Mudança
              </Button>
            ) : freight.service_type === "FRETE_MOTO" ? (
              <Button
                onClick={handleAccept}
                className="w-full btn-accessible gradient-primary text-lg font-semibold"
                size="lg"
              >
                <Truck className="mr-2 h-5 w-5" />
                Aceitar Frete por Moto
              </Button>
            ) : (
              <div className="grid grid-cols-[0.85fr_1.15fr] gap-2">
                <Button
                  onClick={handleAccept}
                  className="w-full min-w-0 btn-accessible gradient-primary text-sm sm:text-base font-semibold truncate"
                  size="lg"
                >
                  Aceitar
                </Button>
                <Button
                  onClick={handleProposalModalOpen}
                  className="w-full min-w-0 btn-accessible border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/10 text-sm sm:text-base font-semibold truncate"
                  size="lg"
                  variant="outline"
                >
                  Contraproposta
                </Button>
              </div>
            )}
          </div>
        )}

        {showActions && isFullyBooked && (
          <div className="px-6 pb-6">
            <Button disabled className="w-full btn-accessible text-lg font-semibold" size="lg" variant="secondary">
              Frete Completo - Sem Vagas
            </Button>
          </div>
        )}

        {/* Producer Actions */}
        {showProducerActions && onAction && freight.status !== "CANCELLED" && (
          <div className="px-6 pb-6">
            <div className="flex gap-4">
              <Button
                onClick={handleEdit}
                className="flex-1 btn-accessible text-lg font-semibold"
                size="lg"
                variant="outline"
              >
                <Edit className="h-5 w-5 mr-2" />
                Editar
              </Button>
              {["OPEN", "ACCEPTED", "LOADING", "IN_NEGOTIATION"].includes(freight.status) && (
                <Button
                  onClick={handleCancel}
                  className="flex-1 btn-accessible text-lg font-semibold"
                  size="lg"
                  variant="destructive"
                >
                  <X className="h-5 w-5 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Mensagem para fretes cancelados */}
        {showProducerActions && freight.status === "CANCELLED" && (
          <div className="px-6 pb-6">
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800">
              <p className="text-base text-red-600 dark:text-red-400 font-medium">
                Fretes cancelados não podem ser editados
              </p>
            </div>
          </div>
        )}

        {/* Service Proposal Modal */}
        <ServiceProposalModal
          isOpen={proposalModalOpen}
          onClose={handleProposalModalClose}
          freight={freight}
          originalProposal={
            freight.service_type === "CARGA" || !freight.service_type
              ? {
                  id: freight.id,
                  proposed_price: freight.price,
                  message: "Proposta do produtor",
                  driver_name: "Produtor",
                }
              : undefined
          }
          onSuccess={handleProposalSuccess}
        />
      </Card>
    );
  },
);

OptimizedFreightCard.displayName = "OptimizedFreightCard";

export default OptimizedFreightCard;
