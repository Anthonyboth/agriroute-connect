import React, { useState, useMemo } from "react";
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
  ArrowDown,
  Wrench,
  Home,
  Edit,
  X,
  MessageCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { getCargoTypeLabel } from "@/lib/cargo-types";
import { getUrgencyLabel } from "@/lib/urgency-labels";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTransportCompany } from "@/hooks/useTransportCompany";
import { toast } from "sonner";
import { formatTons, formatKm, formatBRL, formatDate, getPricePerTruck } from "@/lib/formatters";
import { getFreightPriceDisplay } from "@/hooks/useFreightPriceDisplay";
import { LABELS } from "@/lib/labels";
import { getPickupDateBadge } from "@/utils/freightDateHelpers";
import { resolveDriverUnitPrice } from '@/hooks/useFreightCalculator';
import { AlertTriangle } from "lucide-react";
import { getVehicleTypeLabel } from "@/lib/vehicle-types";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { differenceInDays, differenceInHours } from "date-fns";

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
    /** ID do produtor - se ausente, contraproposta é desabilitada */
    producer_id?: string | null;
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
  /** Extra content rendered inside the card, after the main content */
  renderExtra?: React.ReactNode;
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
  renderExtra,
}) => {
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [bulkAcceptorOpen, setBulkAcceptorOpen] = useState(false);
  const [driverSelectModalOpen, setDriverSelectModalOpen] = useState(false);
  const { profile } = useAuth();
  const { company, drivers } = useTransportCompany();

  // Verificar se o frete está com vagas completas
  const isFullyBooked = (freight.required_trucks || 1) <= (freight.accepted_trucks || 0);
  const availableSlots = (freight.required_trucks || 1) - (freight.accepted_trucks || 0);

  // === Cálculos para o novo layout 60-30-10 ===
  const urgencyLabel = getUrgencyLabel(freight.urgency);
  const urgencyDotColor = freight.urgency === 'HIGH' ? 'bg-destructive' : freight.urgency === 'MEDIUM' ? 'bg-yellow-500' : 'bg-muted-foreground/40';

  // ✅ Hook centralizado de exibição de preço — exibe EXATAMENTE o que o produtor preencheu
  // 🔍 DEBUG: logar pricing_type para detectar campo ausente
  if (import.meta.env.DEV || !freight.pricing_type) {
    console.log(`[FreightCard] id=${freight.id} pricing_type=${freight.pricing_type} price_per_km=${freight.price_per_km} price=${freight.price}`);
  }
  const priceDisplay = useMemo(() => getFreightPriceDisplay(freight), [
    freight.price, freight.pricing_type, freight.price_per_km, freight.required_trucks, freight.distance_km, freight.weight
  ]);

  // Cor semântica de rentabilidade (usa hook centralizado)
  const rpmColor = priceDisplay.unitRateColorClass;
  const rpmIcon = priceDisplay.unitRateValue === null ? null : priceDisplay.unitRateValue >= 6 && priceDisplay.pricingType === 'FIXED' ? <TrendingUp className="h-3 w-3" /> : priceDisplay.unitRateValue < 4 && priceDisplay.pricingType === 'FIXED' ? <TrendingDown className="h-3 w-3" /> : null;

  // Tempo estimado (média 60km/h)
  const distKmNum = parseFloat(String(freight.distance_km).replace(/[^\d.]/g, "")) || 0;
  const estimatedHours = distKmNum > 0 ? Math.round(distKmNum / 60) : null;

  // Prazo restante para coleta
  const pickupRemaining = useMemo(() => {
    if (!freight.pickup_date) return null;
    const now = new Date();
    const pickup = new Date(freight.pickup_date);
    const days = differenceInDays(pickup, now);
    if (days > 1) return `Coleta em ${days} dias`;
    if (days === 1) return 'Coleta amanhã';
    if (days === 0) return 'Coleta hoje';
    const hours = differenceInHours(pickup, now);
    if (hours > 0) return `Coleta em ${hours}h`;
    return 'Coleta atrasada';
  }, [freight.pickup_date]);

  const pickupIsUrgent = useMemo(() => {
    if (!freight.pickup_date) return false;
    const days = differenceInDays(new Date(freight.pickup_date), new Date());
    return days <= 1;
  }, [freight.pickup_date]);

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

        // ✅ Frete já totalmente aceito (409 com current_status ACCEPTED)
        const freightFull =
          errorBody?.current_status === "ACCEPTED" ||
          (typeof title === "string" && title.includes("Freight not available")) ||
          (typeof description === "string" && description.includes("fully accepted"));

        if (freightFull) {
          toast.info("Este frete já foi totalmente aceito", {
            description: "Todas as vagas foram preenchidas. Procure outro frete disponível.",
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
    <TooltipProvider>
      <Card
        data-testid="freight-card"
        className="freight-card-standard hover:shadow-lg transition-all duration-300 hover:scale-[1.01] border-2 border-border rounded-xl overflow-hidden bg-card"
        style={{ boxShadow: '0 2px 8px hsl(var(--foreground) / 0.06)' }}
      >
        {/* ── HEADER: Título + Urgência + Prazo ── (30% zone: structure & text) */}
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {getServiceIcon()}
              <div className="min-w-0">
                <h3 className="font-bold text-foreground text-base truncate">{getCardTitle()}</h3>
                {pickupRemaining && (
                  <p className={`text-xs mt-0.5 ${pickupIsUrgent ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                    {pickupIsUrgent && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                    {pickupRemaining}
                  </p>
                )}
              </div>
            </div>
            {/* Urgency indicator — 10% accent zone */}
            <div className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-full bg-secondary/60">
              <span className={`inline-block h-2 w-2 rounded-full ${urgencyDotColor}`} />
              <span className="text-[11px] font-medium text-secondary-foreground">{urgencyLabel}</span>
            </div>
          </div>

          {/* Vagas (só multi-carreta) */}
          {freight.required_trucks && freight.required_trucks > 1 && (
            <div className="flex items-center gap-2 mt-2 px-2.5 py-1.5 rounded-md bg-secondary/40 border border-border/30">
              <Truck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                {freight.accepted_trucks || 0}/{freight.required_trucks} carretas
              </span>
              {availableSlots > 0 && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary font-semibold ml-auto">
                  {availableSlots} {availableSlots === 1 ? 'vaga' : 'vagas'}
                </Badge>
              )}
              {isFullyBooked && (
                <Badge className="text-[10px] px-1.5 py-0 bg-success text-success-foreground ml-auto">Completo</Badge>
              )}
            </div>
          )}
        </CardHeader>

        {/* ── CONTENT: Rota + Specs + Grid ── (60% zone: clean bg-card) */}
        <CardContent className="px-4 py-3 space-y-3">
          {/* Origem → Destino com dot-line */}
          <div className="flex gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
            {/* Dot line vertical */}
            <div className="flex flex-col items-center pt-1">
              <div className="h-3 w-3 rounded-full border-2 border-primary/60 bg-card" />
              <div className="w-0.5 flex-1 bg-gradient-to-b from-primary/40 to-accent/40 my-0.5 min-h-[14px]" />
              <div className="h-3 w-3 rounded-full bg-accent" />
            </div>
            {/* Cidades */}
            <div className="flex-1 min-w-0 space-y-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm font-semibold text-foreground truncate cursor-default">
                    {freight.origin_city && freight.origin_state
                      ? `${freight.origin_city}/${freight.origin_state}`
                      : freight.origin_address}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <p className="text-xs">{freight.origin_address}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-sm font-semibold text-foreground truncate cursor-default">
                    {freight.destination_city && freight.destination_state
                      ? `${freight.destination_city}/${freight.destination_state}`
                      : freight.destination_address}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs">{freight.destination_address}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Linha de specs compacta */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap px-1">
            <MapPin className="h-3 w-3 text-muted-foreground/60" />
            <span className="font-medium">{formatKm(distKmNum)}</span>
            {estimatedHours !== null && (
              <>
                <span className="text-border">•</span>
                <Clock className="h-3 w-3 text-muted-foreground/60" />
                <span>~{estimatedHours}h</span>
              </>
            )}
            {freight.service_type !== "GUINCHO" && freight.service_type !== "MUDANCA" && (
              <>
                <span className="text-border">•</span>
                <span>{formatTons(freight.weight)}</span>
              </>
            )}
            {freight.vehicle_type_required && (
              <>
                <span className="text-border">•</span>
                <Truck className="h-3 w-3 text-muted-foreground/60" />
                <span>{getVehicleTypeLabel(freight.vehicle_type_required)}</span>
              </>
            )}
            {freight.vehicle_axles_required && freight.vehicle_axles_required > 0 && (
              <span className="text-muted-foreground/60">({freight.vehicle_axles_required}e)</span>
            )}
          </div>

          {/* Grid 3 colunas: Coleta | Entrega | R$/km */}
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2.5 bg-secondary/40 rounded-lg text-center border border-border/20">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Coleta</p>
              </div>
              <p className="text-xs font-bold text-foreground">{formatDate(freight.pickup_date)}</p>
            </div>
            <div className="p-2.5 bg-secondary/40 rounded-lg text-center border border-border/20">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Entrega</p>
              </div>
              <p className="text-xs font-bold text-foreground">{formatDate(freight.delivery_date)}</p>
            </div>
            {/* Valor unitário — usa hook centralizado (R$/km, R$/ton, ou derivado) */}
            <div className={`p-2.5 rounded-lg text-center border ${
              priceDisplay.unitRateValue !== null && priceDisplay.unitRateColorClass.includes('primary')
                ? 'bg-primary/10 border-primary/20'
                : priceDisplay.unitRateValue !== null && priceDisplay.unitRateColorClass.includes('destructive')
                  ? 'bg-destructive/10 border-destructive/20'
                  : 'bg-warning/10 border-warning/20'
            }`}>
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="h-3 w-3 text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{priceDisplay.unitRateLabel}</p>
              </div>
              <p className={`text-xs font-bold flex items-center justify-center gap-0.5 ${rpmColor}`}>
                {rpmIcon}
                {priceDisplay.unitRateFormatted}
              </p>
            </div>
          </div>
        </CardContent>

        {/* ── FOOTER: Preço + ANTT ── (10% accent: preço em primary) */}
        {!hidePrice && (
          <CardFooter className="px-4 py-3 border-t border-border/40 bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center justify-between w-full">
              <div>
                <p className="font-bold text-xl text-primary">
                  {priceDisplay.primaryFormatted}
                  <span className="text-xs font-normal text-muted-foreground ml-1">{priceDisplay.primarySuffix}</span>
                </p>
                {priceDisplay.secondaryLabel && (
                  <p className="text-[10px] text-muted-foreground">
                    {priceDisplay.secondaryLabel}
                  </p>
                )}
              </div>
              {/* ANTT inline */}
              <div className="text-right">
                {freight.service_type === "FRETE_MOTO" ? (
                  <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-border/60">Mín: R$10</Badge>
                ) : freight.service_type === "CARGA" || !freight.service_type ? (
                  freight.minimum_antt_price && freight.minimum_antt_price > 0 ? (
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-border/60">
                      ANTT: {formatBRL(freight.minimum_antt_price, true)}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px] px-2 py-0.5">
                      ⚠ ANTT
                    </Badge>
                  )
                ) : null}
              </div>
            </div>
          </CardFooter>
        )}

        {/* ── CTAs ── (10% accent: primary CTA buttons) */}
        {showActions && onAction && freight.status === "OPEN" && !isFullyBooked && (
          <div className="px-4 pb-3 pt-1">
            <div className="space-y-2">
              {(() => {
                // Determine accept button props based on service type
                const isMultiTruck = isTransportCompany && freight.required_trucks && freight.required_trucks > 1;
                const acceptLabel = freight.service_type === "GUINCHO" 
                  ? "Aceitar Chamado" 
                  : freight.service_type === "MUDANCA" 
                    ? "Aceitar Mudança" 
                    : freight.service_type === "FRETE_MOTO" 
                      ? "Aceitar Frete Moto" 
                      : isMultiTruck 
                        ? `Aceitar (${availableSlots})` 
                        : "Aceitar";
                const AcceptIcon = freight.service_type === "GUINCHO" 
                  ? Wrench 
                  : freight.service_type === "MUDANCA" 
                    ? Home 
                    : Truck;
                const handleAccept = isMultiTruck 
                  ? () => setBulkAcceptorOpen(true) 
                  : () => handleAcceptFreight(1);
                const showIcon = ["GUINCHO", "MUDANCA", "FRETE_MOTO"].includes(freight.service_type || "");

                if (freight.producer_id) {
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Button onClick={handleAccept} className="w-full min-w-0 gradient-primary hover:shadow-lg transition-all duration-300 text-sm" size="sm">
                        {showIcon && <AcceptIcon className="mr-1.5 h-4 w-4 flex-shrink-0" />}
                        <span className="min-w-0 truncate">{acceptLabel}</span>
                      </Button>
                      <Button onClick={() => setProposalModalOpen(true)} variant="outline" className="w-full min-w-0 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 text-sm" size="sm">
                        <span className="min-w-0 truncate">Contraproposta</span>
                      </Button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-1">
                    <Button onClick={handleAccept} className="w-full gradient-primary hover:shadow-lg transition-all duration-300" size="sm">
                      {showIcon && <AcceptIcon className="mr-1.5 h-4 w-4" />}{acceptLabel}
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center leading-tight">
                      Sem cadastro — contraproposta indisponível
                    </p>
                  </div>
                );
              })()}

              {isAffiliatedDriver && driverCompanyId && (
                <ShareFreightToCompany freight={freight} companyId={driverCompanyId} driverProfile={profile} />
              )}
            </div>
          </div>
        )}

        {showActions && isFullyBooked && (
          <div className="px-4 pb-4">
            <Button disabled className="w-full" size="sm" variant="secondary">
              Frete Completo - Sem Vagas
            </Button>
          </div>
        )}

        {/* Producer Actions */}
        {showProducerActions && onAction && freight.status !== "CANCELLED" && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => onAction("edit")} size="sm" variant="outline" className="border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50">
                <Edit className="h-4 w-4 mr-1" />Editar
              </Button>
              {["OPEN", "ACCEPTED", "LOADING", "IN_NEGOTIATION", "LOADED", "IN_TRANSIT", "DELIVERED_PENDING_CONFIRMATION"].includes(freight.status) && (
                <Button onClick={() => onAction("cancel")} size="sm" variant="destructive">
                  <X className="h-4 w-4 mr-1" />Cancelar
                </Button>
              )}
            </div>
          </div>
        )}

        {showProducerActions && freight.status === "CANCELLED" && (
          <div className="px-4 pb-4">
            <div className="text-center p-3 bg-destructive/10 rounded-lg">
              <p className="text-sm text-destructive">Fretes cancelados não podem ser editados</p>
            </div>
          </div>
        )}

        {/* Modals */}
        <ServiceProposalModal
          isOpen={proposalModalOpen}
          onClose={() => setProposalModalOpen(false)}
          freight={freight}
          originalProposal={
            freight.service_type === "CARGA" || !freight.service_type
              ? { id: freight.id, proposed_price: freight.price, message: "Proposta do produtor", driver_name: "Produtor" }
              : undefined
          }
          onSuccess={() => { setProposalModalOpen(false); if (onAction) onAction("proposal_sent"); }}
        />

        <CompanyBulkFreightAcceptor
          open={bulkAcceptorOpen}
          onOpenChange={setBulkAcceptorOpen}
          freight={freight}
          onAccept={handleAcceptFreight}
        />

        <CompanyDriverSelectModal
          isOpen={driverSelectModalOpen}
          onClose={() => setDriverSelectModalOpen(false)}
          drivers={(drivers || [])
            .filter((d) => d.status === "ACTIVE" || d.status === "APPROVED")
            .map((d) => ({ id: d.driver.id, full_name: d.driver.full_name, status: d.status }))}
          onSelectDriver={handleCompanyAcceptWithDriver}
          freight={{
            cargo_type: getCargoTypeLabel(freight.cargo_type),
            origin_address: freight.origin_address,
            destination_address: freight.destination_address,
            price: freight.price,
          }}
        />
        {renderExtra && (
          <div className="px-4 pb-4">
            {renderExtra}
          </div>
        )}
      </Card>
    </TooltipProvider>
  );
};

export default FreightCard;
