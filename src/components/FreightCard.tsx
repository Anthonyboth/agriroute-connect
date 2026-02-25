import React, { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ServiceProposalModal } from "./ServiceProposalModal";
import { CompanyBulkFreightAcceptor } from "./CompanyBulkFreightAcceptor";
import { ShareFreightToCompany } from "./ShareFreightToCompany";
import { CompanyDriverSelectModal } from "./CompanyDriverSelectModal";
import { Separator } from "@/components/ui/separator";
import { getFreightStatusLabel, getFreightStatusVariant } from "@/lib/freight-status";
import {
  MapPin,
  Package,
  Truck,
  Calendar,
  DollarSign,
  Clock,
  Eye,
  FileText,
  ArrowRight,
  Wrench,
  Home,
  Edit,
  X,
  MessageCircle,
} from "lucide-react";
import { getCargoTypeLabel } from "@/lib/cargo-types";
import { getUrgencyLabel, getUrgencyVariant } from "@/lib/urgency-labels";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTransportCompany } from "@/hooks/useTransportCompany";
import { toast } from "sonner";
import { formatTons, formatKm, formatBRL, formatDate, getPricePerTruck } from "@/lib/formatters";
import { LABELS } from "@/lib/labels";
import { getPickupDateBadge } from "@/utils/freightDateHelpers";
import { resolveDriverUnitPrice } from '@/hooks/useFreightCalculator';
import { AlertTriangle } from "lucide-react";
import { getVehicleTypeLabel } from "@/lib/vehicle-types";

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
    status: "OPEN" | "IN_TRANSIT" | "DELIVERED" | "IN_NEGOTIATION" | "ACCEPTED" | "CANCELLED" | "LOADING" | "LOADED";
    distance_km: number;
    minimum_antt_price: number;
    service_type?: "CARGA" | "GUINCHO" | "MUDANCA" | "FRETE_MOTO" | "ENTREGA_PACOTES" | "TRANSPORTE_PET";
    required_trucks?: number;
    accepted_trucks?: number;
    vehicle_type_required?: string;
    vehicle_axles_required?: number;
    pricing_type?: "FIXED" | "PER_KM" | "PER_TON";
    price_per_km?: number;
  };
  onAction?: (action: "propose" | "accept" | "complete" | "edit" | "cancel" | "request-cancel" | "proposal_sent") => void;
  showActions?: boolean;
  showProducerActions?: boolean;
  hidePrice?: boolean;
  /** @deprecated Não mais utilizado - todos motoristas podem aceitar fretes */
  canAcceptFreights?: boolean;
  isAffiliatedDriver?: boolean;
  driverCompanyId?: string;
  onUnavailable?: () => void;
  showAvailableSlots?: boolean;
}

export const FreightCard: React.FC<FreightCardProps> = ({
  freight,
  onAction,
  showActions = false,
  showProducerActions = false,
  hidePrice = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  canAcceptFreights = true, // ✅ Mantido por compatibilidade, mas não é mais usado
  isAffiliatedDriver = false,
  driverCompanyId,
  onUnavailable,
  showAvailableSlots = false,
}) => {
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [bulkAcceptorOpen, setBulkAcceptorOpen] = useState(false);
  const [driverSelectModalOpen, setDriverSelectModalOpen] = useState(false);
  const { profile } = useAuth();
  const { company, drivers } = useTransportCompany();

  // Verificar se o frete está com vagas completas
  const isFullyBooked = (freight.required_trucks || 1) <= (freight.accepted_trucks || 0);
  const availableSlots = (freight.required_trucks || 1) - (freight.accepted_trucks || 0);

  const urgencyVariant = getUrgencyVariant(freight.urgency);
  const urgencyLabel = getUrgencyLabel(freight.urgency);

  const isTransportCompany = profile?.role === "TRANSPORTADORA";

  const handleAcceptFreight = async (numTrucks = 1) => {
    // ✅ Se é transportadora E não tem driverId pré-definido, abrir modal de seleção
    if (isTransportCompany && !driverCompanyId) {
      if (!drivers || drivers.length === 0) {
        toast.error("Cadastre um motorista para aceitar fretes como transportadora");
        return;
      }
      setDriverSelectModalOpen(true);
      return;
    }

    try {
      // Primeiro: verificar se o solicitante tem cadastro
      const { data: checkData, error: checkError } = await supabase.functions.invoke("check-freight-requester", {
        body: { freight_id: freight.id },
      });

      if (checkError) {
        console.error("Error checking requester:", checkError);
        toast.error("Erro ao verificar solicitante");
        return;
      }

      // Se solicitante não tem cadastro, mostrar mensagem e não aceitar
      if (checkData?.has_registration === false) {
        toast.error("O solicitante não possui cadastro. Este frete foi movido para o histórico.");
        // Aguardar um pouco e recarregar para refletir mudança
        setTimeout(() => {
          onAction?.("accept"); // Trigger refresh/tab change
        }, 1500);
        return;
      }

      // Se tem cadastro, proceder com aceite normal
      // ✅ CORREÇÃO: Verificar TODOS os status de assignment (incluindo DELIVERED_PENDING_CONFIRMATION)
      const activeStatuses = ["ACCEPTED", "IN_TRANSIT", "LOADING", "LOADED", "DELIVERED_PENDING_CONFIRMATION"] as const;

      // 1) Verificar se já existe atribuição ativa para ESTE frete
      if (!isTransportCompany && profile?.id) {
        const { data: existingAssignment } = await supabase
          .from("freight_assignments")
          .select("id,status")
          .eq("freight_id", freight.id)
          .eq("driver_id", profile.id)
          .in("status", activeStatuses)
          .maybeSingle();

        if (existingAssignment) {
          const statusMsg = existingAssignment.status === 'DELIVERED_PENDING_CONFIRMATION' 
            ? "Sua entrega está aguardando confirmação do produtor."
            : "Esse frete já está em andamento na sua conta.";
          toast.info("Você já aceitou este frete", {
            description: statusMsg,
          });
          onAction?.("accept");
          return;
        }

        // 2) Motorista autônomo: verificar se já tem QUALQUER frete EM ANDAMENTO (não agendado)
        const today = new Date().toISOString().split("T")[0];

        const { data: activeFreights } = await supabase
          .from("freights")
          .select("id, cargo_type, pickup_date")
          .eq("driver_id", profile.id)
          .in("status", activeStatuses);

        const { data: activeAssignments } = await supabase
          .from("freight_assignments")
          .select("id, freight:freights(pickup_date)")
          .eq("driver_id", profile.id)
          .in("status", activeStatuses);

        // Filtrar apenas fretes com data de coleta <= hoje (em andamento, não agendados)
        const inProgressFreights = (activeFreights || []).filter((f) => {
          const pickupDate = f.pickup_date?.split("T")[0];
          return pickupDate && pickupDate <= today;
        });

        const inProgressAssignments = (activeAssignments || []).filter((a) => {
          const pickupDate = (a.freight as any)?.pickup_date?.split("T")[0];
          return pickupDate && pickupDate <= today;
        });

        // Regra atualizada: motoristas podem ter múltiplos fretes ativos
        // (ex: frete rural + pacotes + PET simultaneamente)
        // A verificação de limite foi removida para permitir concorrência
      }

      const { data: acceptData, error: acceptError } = await supabase.functions.invoke("accept-freight-multiple", {
        body: {
          freight_id: freight.id,
          num_trucks: numTrucks,
        },
      });

      if (acceptError) {
        // Supabase JS v2: o body do erro pode vir em `acceptData` ou `error.context.body`
        let errorBody: any = acceptData;
        if (!errorBody && (acceptError as any)?.context?.body) {
          errorBody = (acceptError as any).context.body;
        }
        if (typeof errorBody === "string") {
          try {
            errorBody = JSON.parse(errorBody);
          } catch {
            // ignore
          }
        }

        let title = errorBody?.error || acceptError.message || "Não foi possível aceitar o frete";
        let description = errorBody?.details;
        const errorCode = errorBody?.code;

        // ✅ Tratamento robusto de erros conhecidos
        const alreadyAccepted =
          errorCode === "ALREADY_ACCEPTED" ||
          errorCode === "PENDING_CONFIRMATION" ||
          (typeof title === "string" &&
            (title.includes("active assignment") || 
             title.includes("already have an active assignment") ||
             title.includes("Você já aceitou")));

        if (alreadyAccepted || errorCode === "ALREADY_ACCEPTED") {
          toast.info("Você já aceitou este frete", {
            description: description || "Esse frete já está em andamento na sua conta.",
          });
          onAction?.("accept");
          return;
        }

        if (errorCode === "PENDING_CONFIRMATION") {
          toast.info("Entrega aguardando confirmação", {
            description: description || "Aguarde a confirmação do produtor.",
          });
          onAction?.("accept");
          return;
        }

        // ✅ PT-BR fallback (evitar inglês na UI)
        if (typeof title === "string" && (title.includes("Edge function returned") || /\d{3}/.test(title))) {
          title = "Não foi possível aceitar o frete";
        }

        toast.error(title, description ? { description } : undefined);
        return;
      }

      const label = freight.service_type === "FRETE_MOTO" ? "frete" : "carreta";
      toast.success(`${numTrucks} ${label}${numTrucks > 1 ? "s" : ""} aceita${numTrucks > 1 ? "s" : ""} com sucesso!`);

      // ✅ Disparar evento para navegação automática para aba "Em Andamento"
      window.dispatchEvent(
        new CustomEvent("freight:accepted", {
          detail: { freightId: freight.id },
        }),
      );

      onAction?.("accept");
    } catch (error: any) {
      console.error("Error accepting freight:", error);

      // fallback: nunca quebrar a tela por erro de edge function
      toast.error("Não foi possível aceitar o frete", {
        description: "Tente novamente em alguns instantes.",
      });
    }
  };

  // ✅ Handler para aceite via transportadora (com driver selecionado)
  const handleCompanyAcceptWithDriver = async (selectedDriverId: string) => {
    if (!company?.id) {
      toast.error("Informações da empresa não encontradas");
      return;
    }

    try {
      // Buscar dados do frete para garantir valores corretos
      const { data: freightData, error: freightError } = await supabase
        .from("freights")
        .select("*")
        .eq("id", freight.id)
        .single();

      if (freightError || !freightData) {
        toast.error("Erro ao buscar dados do frete");
        return;
      }

      // Verificar se frete ainda está disponível
      if (freightData.status !== "OPEN") {
        toast.error("Este frete não está mais disponível");
        return;
      }

      // ✅ CRÍTICO: impedir oversubscription (principalmente em required_trucks=1)
      const requiredTrucks = Math.max((freightData.required_trucks || 1) as number, 1);
      const activeStatuses = ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'] as const;

      const [{ data: existingAssignment }, { count: realAcceptedCount, error: realAcceptedError }] = await Promise.all([
        supabase
          .from('freight_assignments')
          .select('id')
          .eq('freight_id', freight.id)
          .eq('driver_id', selectedDriverId)
          .maybeSingle(),
        supabase
          .from('freight_assignments')
          .select('id', { count: 'exact', head: true })
          .eq('freight_id', freight.id)
          .in('status', [...activeStatuses]),
      ]);

      if (realAcceptedError) throw realAcceptedError;
      const realAccepted = realAcceptedCount ?? 0;
      const isNewAcceptance = !existingAssignment;

      if (isNewAcceptance && realAccepted >= requiredTrucks) {
        toast.error(requiredTrucks === 1
          ? 'Este frete já está atribuído a um motorista'
          : 'Este frete já está com todas as vagas preenchidas'
        );
        return;
      }

      // ✅ Hook centralizado: resolveDriverUnitPrice para agreed_price unitário
      const agreedPerTruck = resolveDriverUnitPrice(0, freightData.price || 0, requiredTrucks);

      const { error: assignmentError } = await supabase.from("freight_assignments").upsert(
        {
          freight_id: freight.id,
          driver_id: selectedDriverId,
          company_id: company.id, // ✅ ESSENCIAL
          status: "ACCEPTED",
          accepted_at: new Date().toISOString(),
          // ✅ CRÍTICO: agreed_price deve ser unitário (/carreta) em fretes multi-carreta
          agreed_price: agreedPerTruck,
          pricing_type: "FIXED",
          minimum_antt_price: freightData.minimum_antt_price || 0,
        },
        {
          onConflict: "freight_id,driver_id",
        },
      );

      if (assignmentError) throw assignmentError;

      // Atualizar status do frete
      const { error: updateError } = await supabase
        .from("freights")
        .update({
          status: "ACCEPTED",
          driver_id: selectedDriverId,
          company_id: company.id, // ✅ ESSENCIAL
          // Evita drift: só incrementa se for um aceite novo; caso contrário, apenas sincroniza.
          accepted_trucks: isNewAcceptance ? Math.min(requiredTrucks, realAccepted + 1) : Math.max((freightData.accepted_trucks || 0), realAccepted),
        })
        .eq("id", freight.id);

      if (updateError) throw updateError;

      // Criar chat automaticamente
      await supabase.from("company_driver_chats").insert({
        company_id: company.id,
        driver_profile_id: selectedDriverId,
        sender_type: "COMPANY",
        message: `🚚 Frete aceito! Olá, este chat foi criado automaticamente para acompanharmos a entrega de: ${freight.cargo_type}. Qualquer dúvida estou à disposição.`,
        created_at: new Date().toISOString(),
      });

      toast.success("✅ Frete aceito com sucesso!", {
        description: 'O frete aparecerá na aba "Em Andamento"',
      });

      // ✅ Disparar evento para navegação automática para aba "Em Andamento"
      window.dispatchEvent(
        new CustomEvent("freight:accepted", {
          detail: { freightId: freight.id },
        }),
      );

      onAction?.("accept");
    } catch (error: any) {
      console.error("Error accepting freight:", error);

      // Extract detailed error information
      const errorResponse = (error as any)?.context?.response;
      const errorMessage = errorResponse?.error || error?.message || "Erro ao aceitar frete";
      const errorDetails = errorResponse?.details;

      // Show detailed message if available
      if (errorDetails) {
        toast.error(errorMessage, { description: errorDetails });
      } else {
        toast.error(errorMessage);
      }
    }
  };

  // Icon based on service type
  const getServiceIcon = () => {
    switch (freight.service_type) {
      case "GUINCHO":
        return <Wrench className="h-5 w-5 text-warning" />;
      case "MUDANCA":
        return <Home className="h-5 w-5 text-accent" />;
      case "FRETE_MOTO":
        return <Truck className="h-5 w-5 text-blue-500" />;
      default:
        return <Package className="h-5 w-5 text-primary" />;
    }
  };

  // Service type label
  const getServiceLabel = () => {
    switch (freight.service_type) {
      case "GUINCHO":
        return "Guincho";
      case "MUDANCA":
        return "Mudança";
      case "FRETE_MOTO":
        return "Frete Moto (Carretinha 500kg)";
      default:
        return "Carga";
    }
  };

  // ✅ TÍTULO PRINCIPAL DO CARD (corrige "Serviço" aparecendo em Mudança/Guincho/Moto)
  const getCardTitle = () => {
    if (freight.service_type && freight.service_type !== "CARGA") return getServiceLabel();
    return getCargoTypeLabel(freight.cargo_type);
  };

  return (
    <Card
      data-testid="freight-card"
      className="freight-card-standard hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 border-border/60 overflow-hidden"
    >
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="min-w-fit space-y-2">
          {/* LINHA 1: Ícone + Título */}
          <div className="flex items-center gap-2">
            {getServiceIcon()}
            <h3 className="font-semibold text-foreground text-base whitespace-nowrap">{getCardTitle()}</h3>
          </div>

          {/* LINHA 2: Badges de Status (permite quebra se necessário) */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={urgencyVariant} className="text-xs font-medium shrink-0">
              {urgencyLabel}
            </Badge>
            <Badge
              data-testid="freight-status-badge"
              variant={getFreightStatusVariant(freight.status)}
              className="text-xs font-medium shrink-0"
            >
              {getFreightStatusLabel(freight.status)}
            </Badge>

            {/* Badge de data de coleta */}
            {(() => {
              const badgeInfo = getPickupDateBadge(freight.pickup_date);
              if (!badgeInfo) return null;

              const iconMap = { AlertTriangle, Clock, Calendar };
              const IconComponent = iconMap[badgeInfo.icon];

              return (
                <Badge variant={badgeInfo.variant} className="flex items-center gap-1 text-xs shrink-0">
                  <IconComponent className="h-3 w-3" />
                  {badgeInfo.text}
                </Badge>
              );
            })()}

            {/* Badge de vagas disponíveis */}
            {showAvailableSlots && freight.required_trucks && freight.required_trucks > 1 && (
              <Badge
                variant={isFullyBooked ? "default" : "outline"}
                className={`text-xs font-medium shrink-0 ${
                  isFullyBooked ? "bg-green-600 hover:bg-green-700" : "border-primary text-primary"
                }`}
              >
                <Truck className="h-3 w-3 mr-1" />
                {freight.accepted_trucks || 0}/{freight.required_trucks}
              </Badge>
            )}

            {/* Badge de Tipo de Veículo Preferencial - PROBLEMA 6 */}
            {freight.vehicle_type_required && (
              <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30 shrink-0">
                🚛 {getVehicleTypeLabel(freight.vehicle_type_required)}
                {freight.vehicle_axles_required && freight.vehicle_axles_required > 0 && (
                  <span className="ml-1">({freight.vehicle_axles_required} eixos)</span>
                )}
              </Badge>
            )}
          </div>

          {/* LINHA 3: Tipo de Serviço + Peso/Distância (com scroll horizontal) */}
          <div className="flex justify-between items-center gap-3 min-w-fit">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs bg-secondary/30 shrink-0">
                {getServiceLabel()}
              </Badge>
              {/* Badge de capacidade máxima para moto */}
              {freight.service_type === "FRETE_MOTO" && (
                <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300 shrink-0">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Máx. 500kg
                </Badge>
              )}
            </div>
            <div className="flex items-center space-x-3 text-xs whitespace-nowrap">
              {freight.service_type === "GUINCHO" ? (
                <span className="text-muted-foreground">Reboque</span>
              ) : freight.service_type === "MUDANCA" ? (
                <span className="text-muted-foreground">Residencial</span>
              ) : (
                <span className="text-muted-foreground">
                  {formatTons(freight.weight)}
                  {freight.vehicle_type_required && (
                    <span className="ml-1">• {getVehicleTypeLabel(freight.vehicle_type_required)}</span>
                  )}
                  {freight.vehicle_axles_required && freight.vehicle_axles_required > 0 && (
                    <span className="ml-1">({freight.vehicle_axles_required} eixos)</span>
                  )}
                </span>
              )}
              <span
                className="text-muted-foreground"
                title={
                  (freight as any).origin_lat &&
                  (freight as any).origin_lng &&
                  (freight as any).destination_lat &&
                  (freight as any).destination_lng
                    ? "Distância calculada com GPS preciso"
                    : "Distância estimada por endereço"
                }
              >
                {formatKm(parseFloat(String(freight.distance_km).replace(/[^\d.]/g, "")) || 0)}
                <span className="text-[10px] ml-1">
                  {(freight as any).origin_lat &&
                  (freight as any).origin_lng &&
                  (freight as any).destination_lat &&
                  (freight as any).destination_lng
                    ? "📍"
                    : "📌"}
                </span>
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 flex-1 overflow-y-auto">
        {/* Carretas Info */}
        {freight.required_trucks && freight.required_trucks > 1 && (
          <div className="flex flex-col gap-2 p-2 bg-secondary/20 rounded-lg border border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Truck className="h-3 w-3" />
                <span className="text-xs font-medium">Carretas:</span>
              </div>
              <span className={`font-semibold text-sm ${isFullyBooked ? "text-success" : "text-primary"}`}>
                {freight.accepted_trucks || 0}/{freight.required_trucks}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {availableSlots > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-600 animate-pulse text-xs">
                  {availableSlots} {availableSlots === 1 ? "vaga disponível" : "vagas disponíveis"}!
                </Badge>
              )}

              {isFullyBooked && (
                <Badge variant="default" className="text-xs bg-success text-success-foreground">
                  Completo
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Origem e Destino */}
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              Origem
            </p>
            {freight.origin_city && freight.origin_state && (
              <p className="text-sm font-bold text-primary pl-4">
                {freight.origin_city.toUpperCase()} - {freight.origin_state.toUpperCase()}
                {(freight as any).origin_zip_code && (
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    (CEP: {(freight as any).origin_zip_code.replace(/^(\d{5})(\d{3})$/, "$1-$2")})
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground pl-4 line-clamp-1">{freight.origin_address}</p>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1">
              <ArrowRight className="h-3 w-3 text-accent" />
              Destino
            </p>
            {freight.destination_city && freight.destination_state && (
              <p className="text-sm font-bold text-primary pl-4">
                {freight.destination_city.toUpperCase()} - {freight.destination_state.toUpperCase()}
                {(freight as any).destination_zip_code && (
                  <span className="text-xs text-muted-foreground font-normal ml-2">
                    (CEP: {(freight as any).destination_zip_code.replace(/^(\d{5})(\d{3})$/, "$1-$2")})
                  </span>
                )}
              </p>
            )}
            <p className="text-xs text-muted-foreground pl-4 line-clamp-1">{freight.destination_address}</p>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 p-2 bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-lg border border-border/40">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium">Coleta</span>
            </div>
            <p className="font-semibold text-foreground text-xs">{formatDate(freight.pickup_date)}</p>
          </div>
          <div className="space-y-1 p-2 bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg border border-border/40">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-3 w-3 text-accent" />
              <span className="text-xs font-medium">Entrega</span>
            </div>
            <p className="font-semibold text-foreground text-xs">{formatDate(freight.delivery_date)}</p>
          </div>
        </div>
      </CardContent>

      {!hidePrice && (
        <CardFooter className="pt-3 pb-3 flex-shrink-0 mt-auto sticky bottom-0 bg-card/95 backdrop-blur-sm border-t">
          <div className="flex items-center justify-between w-full p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-border/50 min-w-fit">
            <div className="text-left">
              {/* P2 CORRIGIDO: Mostrar apenas valor unitário para motoristas/transportadoras */}
              {(() => {
                const requiredTrucks = freight.required_trucks || 1;
                const hasMultipleTrucks = requiredTrucks > 1;
                const isProducer = profile?.role === "PRODUTOR";

                // Determinar tipo de pagamento
                const pricingType = freight.pricing_type || (freight as any).payment_type;
                const unitRate = freight.price_per_km || (freight as any).value_per_km;

                return (
                  <>
                    {/* Exibir valor EXATO informado pelo produtor */}
                    {pricingType === "PER_KM" && unitRate ? (
                      <p className="font-bold text-xl text-primary whitespace-nowrap">
                        {formatBRL(unitRate, true)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/km</span>
                      </p>
                    ) : pricingType === "PER_TON" && unitRate ? (
                      <p className="font-bold text-xl text-primary whitespace-nowrap">
                        {formatBRL(unitRate, true)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/ton</span>
                      </p>
                    ) : (
                      <p className="font-bold text-xl text-primary whitespace-nowrap">
                        {formatBRL(hasMultipleTrucks ? getPricePerTruck(freight.price, requiredTrucks) : freight.price, true)}
                        {hasMultipleTrucks && (
                          <span className="text-xs font-normal text-muted-foreground ml-1">/carreta</span>
                        )}
                        {!hasMultipleTrucks && (
                          <span className="text-xs font-normal text-muted-foreground ml-1">fixo</span>
                        )}
                      </p>
                    )}
                    {/* Total só aparece para PRODUTOR em multi-carreta */}
                    {hasMultipleTrucks && isProducer && (
                      <p className="text-xs text-muted-foreground">
                        Total ({requiredTrucks} carretas): {formatBRL(freight.price, true)}
                      </p>
                    )}
                  </>
                );
              })()}
              {freight.service_type === "FRETE_MOTO" ? (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Mínimo: R$ 10,00</p>
              ) : (
                freight.service_type === "CARGA" && (
                  <>
                    {freight.minimum_antt_price && freight.minimum_antt_price > 0 ? (
                      <Badge variant="outline" className="text-xs">
                        Mín. ANTT: {formatBRL(freight.minimum_antt_price, true)}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs">
                        ⚠️ ANTT não calculado
                      </Badge>
                    )}
                  </>
                )
              )}
            </div>
            <div className="text-right">
              <DollarSign className="h-6 w-6 text-accent ml-auto" />
            </div>
          </div>
        </CardFooter>
      )}

      {showActions && onAction && freight.status === "OPEN" && !isFullyBooked && (
        <div className="px-6 pb-6">
          {/* ✅ REGRA SIMPLIFICADA: TODOS os motoristas podem aceitar/propor */}
          <div className="space-y-3">
            {/* Botões de aceitar e contraproposta (para TODOS os motoristas) */}
            {freight.service_type === "GUINCHO" ? (
              <Button
                onClick={() => handleAcceptFreight(1)}
                className="w-full gradient-primary hover:shadow-lg transition-all duration-300"
                size="sm"
              >
                <Wrench className="mr-2 h-4 w-4" />
                Aceitar Chamado
              </Button>
            ) : freight.service_type === "MUDANCA" ? (
              <Button
                onClick={() => handleAcceptFreight(1)}
                className="w-full gradient-primary hover:shadow-lg transition-all duration-300"
                size="sm"
              >
                <Home className="mr-2 h-4 w-4" />
                Aceitar Mudança
              </Button>
            ) : freight.service_type === "FRETE_MOTO" ? (
              <Button
                onClick={() => handleAcceptFreight(1)}
                className="w-full gradient-primary hover:shadow-lg transition-all duration-300"
                size="sm"
              >
                <Truck className="mr-2 h-4 w-4" />
                Aceitar Frete por Moto
              </Button>
            ) : isTransportCompany && freight.required_trucks && freight.required_trucks > 1 ? (
              <div className="grid grid-cols-1 xs:grid-cols-[0.85fr_1.15fr] gap-2">
                <Button
                  onClick={() => setBulkAcceptorOpen(true)}
                  className="w-full min-w-0 gradient-primary hover:shadow-lg transition-all duration-300 text-xs sm:text-sm truncate"
                >
                  Aceitar ({availableSlots})
                </Button>
                <Button
                  onClick={() => setProposalModalOpen(true)}
                  className="w-full min-w-0 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-xs sm:text-sm truncate"
                  variant="outline"
                >
                  Contraproposta
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xs:grid-cols-[0.85fr_1.15fr] gap-2">
                <Button
                  onClick={() => handleAcceptFreight(1)}
                  className="w-full min-w-0 gradient-primary hover:shadow-lg transition-all duration-300 text-xs sm:text-sm truncate"
                  size="sm"
                >
                  Aceitar
                </Button>
                <Button
                  onClick={() => setProposalModalOpen(true)}
                  className="w-full min-w-0 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-xs sm:text-sm truncate"
                  size="sm"
                  variant="outline"
                >
                  Contraproposta
                </Button>
              </div>
            )}

            {/* Botão de compartilhar - sempre aparece para motoristas afiliados */}
            {isAffiliatedDriver && driverCompanyId && (
              <ShareFreightToCompany freight={freight} companyId={driverCompanyId} driverProfile={profile} />
            )}
          </div>
        </div>
      )}

      {showActions && isFullyBooked && (
        <div className="px-6 pb-6">
          <Button disabled className="w-full" size="sm" variant="secondary">
            Frete Completo - Sem Vagas
          </Button>
        </div>
      )}

      {/* Producer Actions */}
      {showProducerActions && onAction && freight.status !== "CANCELLED" && (
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => onAction("edit")} size="sm" variant="outline">
              <Edit className="h-4 w-4 mr-1" />
              Editar
            </Button>

            {/* Cancelamento direto para OPEN, ACCEPTED, LOADING, IN_NEGOTIATION, LOADED, IN_TRANSIT, DELIVERED_PENDING_CONFIRMATION */}
            {["OPEN", "ACCEPTED", "LOADING", "IN_NEGOTIATION", "LOADED", "IN_TRANSIT", "DELIVERED_PENDING_CONFIRMATION"].includes(freight.status) && (
              <Button onClick={() => onAction("cancel")} size="sm" variant="destructive">
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mensagem para fretes cancelados */}
      {showProducerActions && freight.status === "CANCELLED" && (
        <div className="px-6 pb-6">
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">Fretes cancelados não podem ser editados</p>
          </div>
        </div>
      )}

      {/* Service Proposal Modal */}
      <ServiceProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
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
        onSuccess={() => {
          setProposalModalOpen(false);
          if (onAction) onAction("proposal_sent");
        }}
      />

      {/* Company Bulk Freight Acceptor Modal */}
      <CompanyBulkFreightAcceptor
        open={bulkAcceptorOpen}
        onOpenChange={setBulkAcceptorOpen}
        freight={freight}
        onAccept={handleAcceptFreight}
      />

      {/* Driver Selection Modal for Transport Companies */}
      <CompanyDriverSelectModal
        isOpen={driverSelectModalOpen}
        onClose={() => setDriverSelectModalOpen(false)}
        drivers={(drivers || [])
          .filter((d) => d.status === "ACTIVE" || d.status === "APPROVED")
          .map((d) => ({
            id: d.driver.id,
            full_name: d.driver.full_name,
            status: d.status,
          }))}
        onSelectDriver={handleCompanyAcceptWithDriver}
        freight={{
          cargo_type: getCargoTypeLabel(freight.cargo_type),
          origin_address: freight.origin_address,
          destination_address: freight.destination_address,
          price: freight.price,
        }}
      />
    </Card>
  );
};

export default FreightCard;
