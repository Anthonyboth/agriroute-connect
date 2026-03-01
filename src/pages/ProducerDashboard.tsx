import React, { useState, useEffect, useMemo, useCallback } from "react";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { AppSpinner } from "@/components/ui/AppSpinner";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats-card";
import { Badge } from "@/components/ui/badge";
import { TabBadge } from "@/components/ui/TabBadge";
import { Button } from "@/components/ui/button";
import { HeroActionButton } from "@/components/ui/hero-action-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FreightCard } from "@/components/FreightCard";
import { CreateFreightWizardModal } from "@/components/freight-wizard";
import { EditFreightModal } from "@/components/EditFreightModal";
import { ScheduledFreightsManager } from "@/components/ScheduledFreightsManager";
import { SubscriptionExpiryNotification } from "@/components/SubscriptionExpiryNotification";
import { ProposalCounterModal } from "@/components/ProposalCounterModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FreightDetails } from "@/components/FreightDetails";
import { DeliveryConfirmationModal } from "@/components/DeliveryConfirmationModal";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { formatBRL, formatDate } from "@/lib/formatters";
import { isInProgressFreight } from "@/utils/freightDateHelpers";
import { FreightInProgressCard } from "@/components/FreightInProgressCard";
import { toast } from "sonner";
import {
  MapPin,
  Truck,
  Clock,
  CheckCircle,
  Play,
  DollarSign,
  Package,
  Calendar,
  Eye,
  Users,
  Phone,
  CreditCard,
  Star,
  MessageCircle,
  BarChart,
  Loader2,
  Bike,
  FileText,
  Wrench,
  MessageSquare,
} from "lucide-react";
import { UrbanFreightCard } from "@/components/freights/UrbanFreightCard";
import { UnifiedServiceCard } from "@/components/UnifiedServiceCard";
import { FreightFilters } from "@/components/AdvancedFreightFilters";
import { useFreightReportData } from "@/hooks/useFreightReportData";
import { ProducerReportsTab } from "@/pages/producer/ProducerReportsTab";
import { ProducerPaymentsTab } from "@/pages/producer/ProducerPaymentsTab";
import { PendingRatingsPanel } from "@/components/PendingRatingsPanel";
import { ServicesModal } from "@/components/ServicesModal";
import { ServiceChatDialog } from "@/components/ServiceChatDialog";
import { ServiceEditModal } from "@/components/service-wizard/ServiceEditModal";
import { ProducerHistoryTab } from "@/pages/producer/ProducerHistoryTab";
import { showErrorToast } from "@/lib/error-handler";
import { SystemAnnouncementsBoard } from "@/components/SystemAnnouncementsBoard";
import { AutoRatingModal } from "@/components/AutoRatingModal";
import { UnifiedProposalsWrapper } from "@/components/proposal/UnifiedProposalsWrapper";
import { UnifiedChatHub } from "@/components/UnifiedChatHub";
import { useUnreadChatsCount } from "@/hooks/useUnifiedChats";
import { FiscalTab } from "@/components/fiscal/tabs/FiscalTab";
import { useHeroBackground } from '@/hooks/useHeroBackground';
import { usePendingDeliveryConfirmations } from "@/hooks/usePendingDeliveryConfirmations";
import { usePendingRatingsCount } from "@/hooks/usePendingRatingsCount";
import { PendingDeliveryConfirmationCard } from "@/components/PendingDeliveryConfirmationCard";

// ✅ PHASE 2: Lazy load chart-heavy components with auto-retry on ChunkLoadError
const FreightAnalyticsDashboard = lazyWithRetry(() =>
  import("@/components/FreightAnalyticsDashboard").then((m) => ({ default: m.FreightAnalyticsDashboard })),
);
const DriverPerformanceDashboard = lazyWithRetry(() =>
  import("@/components/dashboards/DriverPerformanceDashboard").then((m) => ({ default: m.DriverPerformanceDashboard })),
);
const PeriodComparisonDashboard = lazyWithRetry(() =>
  import("@/components/PeriodComparisonDashboard").then((m) => ({ default: m.PeriodComparisonDashboard })),
);
const RouteRentabilityReport = lazyWithRetry(() =>
  import("@/components/RouteRentabilityReport").then((m) => ({ default: m.RouteRentabilityReport })),
);

// Loading fallback for chart components - SEM TEXTO (padrão global)
const ChartLoader = () => (
  <div className="flex items-center justify-center p-12 min-h-[300px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const ProducerDashboard = () => {
  const { profile, signOut, user } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [freights, setFreights] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const { desktopUrl: heroDesktop, mobileUrl: heroMobile } = useHeroBackground();
  const [activeTab, setActiveTab] = useState("freights-open");
  const [loading, setLoading] = useState(true);

  const [counterProposalModalOpen, setCounterProposalModalOpen] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);

  const [editFreightModalOpen, setEditFreightModalOpen] = useState(false);
  const [selectedFreight, setSelectedFreight] = useState<any>(null);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [freightToCancel, setFreightToCancel] = useState<any>(null);

  const [selectedFreightDetails, setSelectedFreightDetails] = useState<any>(null);

  const [isMuralOpen, setIsMuralOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  const [deliveryConfirmationModal, setDeliveryConfirmationModal] = useState(false);
  const [freightToConfirm, setFreightToConfirm] = useState<any>(null);

  const [externalPayments, setExternalPayments] = useState<any[]>([]);
  // REMOVIDO: freightPayments - produtores não têm permissão RLS para freight_payments
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [ongoingServiceRequests, setOngoingServiceRequests] = useState<any[]>([]);
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "critical" | "urgent">("all");

  // ✅ P0: Service Edit Modal state
  const [serviceEditModalOpen, setServiceEditModalOpen] = useState(false);
  const [selectedServiceToEdit, setSelectedServiceToEdit] = useState<any>(null);

  // ✅ Service Chat Dialog state
  const [serviceChatOpen, setServiceChatOpen] = useState(false);
  const [selectedChatServiceRequest, setSelectedChatServiceRequest] = useState<any>(null);

  // ============================================
  // P0: CLASSIFICADOR CENTRAL (única fonte de verdade)
  // ============================================
  // Tipos que representam TRANSPORTE/FRETE (mesmo em service_requests)
  const FREIGHT_SERVICE_TYPES = useMemo(() => new Set([
    'FRETE_MOTO',
    'FRETE_GUINCHO',
    'GUINCHO',
    'FRETE_MUDANCA',
    'MUDANCA',
    'MUDANCA_RESIDENCIAL',
    'MUDANCA_COMERCIAL',
    'FRETE_URBANO',
    'FRETE_PICAPE',
    'FRETE_UTILITARIO',
  ]), []);

  // Tipos urbanos que podem existir na tabela freights
  const URBAN_FREIGHT_TABLE_TYPES = useMemo(() => new Set([
    'GUINCHO', 'FRETE_MOTO', 'MUDANCA', 'MUDANCA_RESIDENCIAL', 'MUDANCA_COMERCIAL',
    'FRETE_GUINCHO', 'FRETE_MUDANCA', 'FRETE_URBANO', 'FRETE_PICAPE', 'FRETE_UTILITARIO',
    'ENTREGA_PACOTES', 'TRANSPORTE_PET',
  ]), []);

  // Classificação central: única função para todo o dashboard
  const classifiedOpenItems = useMemo(() => {
    const allFreightsOpen = freights.filter((f) => f.status === "OPEN");
    
    // Separar freights da tabela freights em rural vs urbano pelo service_type
    const freightsRuralOpen = allFreightsOpen.filter(
      (f) => !URBAN_FREIGHT_TABLE_TYPES.has(f.service_type || 'CARGA')
    );
    const freightsUrbanFromTable = allFreightsOpen.filter(
      (f) => URBAN_FREIGHT_TABLE_TYPES.has(f.service_type || 'CARGA')
    );
    
    // Fretes urbanos/especiais: service_requests classificados como transporte
    const freightsUrbanFromServices = serviceRequests.filter(
      (sr) => FREIGHT_SERVICE_TYPES.has(sr.service_type) && (sr.status === "OPEN" || sr.status === "ABERTO")
    );
    
    // Combinar urbanos de ambas as fontes
    const freightsUrbanOpen = [...freightsUrbanFromTable, ...freightsUrbanFromServices];
    
    // Serviços: service_requests que NÃO são transporte
    const servicesOpen = serviceRequests.filter(
      (sr) => !FREIGHT_SERVICE_TYPES.has(sr.service_type) && (sr.status === "OPEN" || sr.status === "ABERTO")
    );

    const freightsCount = freightsRuralOpen.length + freightsUrbanOpen.length;
    const servicesCount = servicesOpen.length;
    const openTotal = freightsCount + servicesCount;

    // Guard rail: detectar classificação errada
    const wronglyClassified = servicesOpen.filter(sr => FREIGHT_SERVICE_TYPES.has(sr.service_type));
    if (wronglyClassified.length > 0) {
      console.error('[CRITICAL] FREIGHT_ITEM_WRONG_TAB', {
        items: wronglyClassified.map(s => ({ id: s.id, type: s.service_type })),
        route: window.location.pathname,
      });
    }

    if (import.meta.env.DEV) {
      console.debug('[COUNTS_DEBUG]', {
        ruralCount: freightsRuralOpen.length,
        urbanCount: freightsUrbanOpen.length,
        openFretesCount: freightsCount,
        openServicesCount: servicesCount,
        openTotal,
      });
    }

    return {
      freightsRuralOpen,
      freightsUrbanOpen,
      freightsUrbanFromTable,
      servicesOpen,
      counts: {
        freights: freightsCount,
        services: servicesCount,
        openTotal,
      },
    };
  }, [freights, serviceRequests, FREIGHT_SERVICE_TYPES, URBAN_FREIGHT_TABLE_TYPES]);

  // Estado para controlar avaliações automáticas
  const [activeFreightForRating, setActiveFreightForRating] = useState<any>(null);

  // Estados para aba de relatórios
  const [filters] = useState<FreightFilters>({
    sortBy: "date",
    sortOrder: "desc",
  });

  // Contador de mensagens não lidas
  const { unreadCount: chatUnreadCount } = useUnreadChatsCount(profile?.id || "", "PRODUTOR");

  // ✅ P0 FIX: Hook para confirmações de entrega INDIVIDUAIS (suporte multi-carreta)
  const {
    items: pendingDeliveryItems,
    loading: pendingDeliveryLoading,
    totalCount: pendingDeliveryCount,
    criticalCount: pendingDeliveryCritical,
    urgentCount: pendingDeliveryUrgent,
    refetch: refetchPendingDeliveries,
  } = usePendingDeliveryConfirmations(profile?.id);

  const { pendingRatingsCount } = usePendingRatingsCount(profile?.id);

  // ✅ Abrir aba específica quando vindo de notificação
  useEffect(() => {
    const state = location.state as any;
    if (state?.openTab) {
      setActiveTab(state.openTab);

      if (state.freightData) {
        setFreights((prev) => {
          const existingIndex = prev.findIndex((f) => f.id === state.freightData.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = state.freightData;
            return updated;
          }
          return [state.freightData, ...prev];
        });
      }

      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  // ✅ Redirect non-producers to their correct dashboard
  useEffect(() => {
    if (profile?.role === "MOTORISTA") {
      navigate("/dashboard/driver", { replace: true });
      return;
    }
    if (profile?.role === "PRESTADOR_SERVICOS") {
      navigate("/dashboard/service-provider", { replace: true });
      return;
    }
    if (profile?.role && profile.role !== "PRODUTOR") {
      const correctRoute = profile.role === "ADMIN" ? "/admin" : "/";
      navigate(correctRoute, { replace: true });
      return;
    }
  }, [profile?.role, navigate]);

  // ✅ Mural: auto-reopen 07:00
  useEffect(() => {
    const dismissedAt = localStorage.getItem("mural_dismissed_at");
    const now = new Date();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (dismissedAt) {
      const dismissed = new Date(dismissedAt);
      const nextShow = new Date(dismissed);
      nextShow.setDate(nextShow.getDate() + 1);
      nextShow.setHours(7, 0, 0, 0);

      if (now < nextShow) {
        setIsMuralOpen(false);
        timeoutId = setTimeout(() => {
          localStorage.removeItem("mural_dismissed_at");
          setManualOpen(false);
          setIsMuralOpen(true);
        }, nextShow.getTime() - now.getTime());
      } else {
        localStorage.removeItem("mural_dismissed_at");
        setManualOpen(false);
        setIsMuralOpen(true);
      }
    } else {
      setManualOpen(false);
      setIsMuralOpen(true);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  // ✅ Lógica de filtragem para relatórios
  const filteredFreights = useMemo(() => {
    let result = [...freights];

    if (filters.status?.length) {
      result = result.filter((f) => filters.status!.includes(f.status));
    }
    if (filters.dateRange) {
      result = result.filter((f) => {
        const date = new Date(f.pickup_date);
        return date >= filters.dateRange!.start && date <= filters.dateRange!.end;
      });
    }
    if (filters.priceRange) {
      result = result.filter((f) => f.price >= filters.priceRange!.min && f.price <= filters.priceRange!.max);
    }
    if (filters.distanceRange) {
      result = result.filter(
        (f) => f.distance_km >= filters.distanceRange!.min && f.distance_km <= filters.distanceRange!.max,
      );
    }
    if (filters.cargoType?.length) {
      result = result.filter((f) => filters.cargoType!.includes(f.cargo_type));
    }
    if (filters.urgency?.length) {
      result = result.filter((f) => filters.urgency!.includes(f.urgency));
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case "date":
          comparison = new Date(a.pickup_date).getTime() - new Date(b.pickup_date).getTime();
          break;
        case "price":
          comparison = a.price - b.price;
          break;
        case "distance":
          comparison = a.distance_km - b.distance_km;
          break;
        case "status":
          comparison = String(a.status || "").localeCompare(String(b.status || ""));
          break;
      }
      return filters.sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [freights, filters]);

  // Preparar dados para relatório (mantido)
  useFreightReportData(filteredFreights);

  // ✅ Buscar fretes
  const fetchFreights = useCallback(async () => {
    if (!profile?.id || profile.role !== "PRODUTOR") return;

    try {
      // ✅ FIX CRÍTICO: evitar JOIN direto em `profiles` (pode falhar por RLS/segurança e “sumir” cards).
      // Buscamos fretes e resolvemos os perfis via `profiles_secure` (view) em uma segunda etapa.
      // ✅ PERF: Select only needed fields instead of * (reduces payload ~60%)
      const { data, error } = await (supabase as any)
        .from("freights")
        .select(`
          id, cargo_type, weight, origin_address, destination_address,
          origin_city, origin_state, destination_city, destination_state,
          origin_neighborhood, origin_street, origin_number, origin_complement, origin_zip_code,
          destination_neighborhood, destination_street, destination_number, destination_complement, destination_zip_code,
          pickup_date, delivery_date, price, urgency, status, distance_km,
          minimum_antt_price, service_type, required_trucks, accepted_trucks,
          driver_id, drivers_assigned, producer_id, company_id,
          created_at, updated_at, metadata, pricing_type, price_per_km
        `)
        .eq("producer_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) {
        // ✅ CORREÇÃO: Falha silenciosa no login - sem toast automático
        console.error("[fetchFreights] Erro ao carregar fretes:", error.message);
        setFreights([]);
        return;
      }

      if (!data || data.length === 0) {
        setFreights([]);
        return;
      }

      // Fallback para não “sumir” DELIVERED_PENDING_CONFIRMATION (mantido, sem JOIN)
      let rows: any[] = data || [];

      if (rows.every((f: any) => f.status !== "DELIVERED_PENDING_CONFIRMATION")) {
        const { data: dpcData, error: dpcError } = await (supabase as any)
          .from("freights")
          .select("*")
          .eq("producer_id", profile.id)
          .eq("status", "DELIVERED_PENDING_CONFIRMATION")
          .order("updated_at", { ascending: false })
          .limit(50);

        if (!dpcError && dpcData?.length) {
          const existingIds = new Set(rows.map((f: any) => f.id));
          rows = [...rows, ...dpcData.filter((f: any) => !existingIds.has(f.id))];
        }
      }

      // ✅ FIX: Resolver perfis de motoristas via view segura
      // Incluir tanto driver_id quanto drivers_assigned (array de IDs para multi-carreta)
      // ✅ FIX EXTRA: Quando drivers_assigned não está preenchido (edge case), usar freight_assignments como fonte
      // de verdade para descobrir motoristas já contratados.
      const freightIdsForAssignments = rows.map((f: any) => f.id).filter(Boolean);
      let assignmentDriversByFreight = new Map<string, string[]>();

      if (freightIdsForAssignments.length > 0) {
        try {
          const { data: assignmentRows, error: assignmentErr } = await supabase
            .from('freight_assignments')
            .select('freight_id, driver_id')
            .in('freight_id', freightIdsForAssignments)
            .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION']);

          if (assignmentErr) {
            console.warn('[fetchFreights] Falha ao carregar freight_assignments (fallback drivers):', assignmentErr.message);
          } else if (assignmentRows?.length) {
            for (const row of assignmentRows as any[]) {
              if (!row?.freight_id || !row?.driver_id) continue;
              const existing = assignmentDriversByFreight.get(row.freight_id) ?? [];
              // Dedup mantendo ordem de chegada
              if (!existing.includes(row.driver_id)) existing.push(row.driver_id);
              assignmentDriversByFreight.set(row.freight_id, existing);
            }
          }
        } catch (e) {
          console.warn('[fetchFreights] Erro inesperado ao carregar freight_assignments (fallback drivers):', e);
        }
      }

      const allDriverIds: string[] = [];
      
      rows.forEach((f: any) => {
        // driver_id único (fretes simples)
        if (typeof f.driver_id === "string" && f.driver_id.length > 0) {
          allDriverIds.push(f.driver_id);
        }
        // drivers_assigned (array para multi-carreta)
        const driverIdsFromArray = Array.isArray(f.drivers_assigned)
          ? (f.drivers_assigned as any[]).filter((id) => typeof id === 'string' && id.length > 0)
          : [];
        const driverIdsFromAssignments = assignmentDriversByFreight.get(f.id) ?? [];

        // Preferir drivers_assigned quando existir; senão, usar fallback via freight_assignments
        const driverIdsForUi = driverIdsFromArray.length > 0 ? driverIdsFromArray : driverIdsFromAssignments;

        driverIdsForUi.forEach((id: any) => allDriverIds.push(id));
      });

      const driverIds = Array.from(new Set(allDriverIds));

      let driverMap = new Map<string, any>();
      if (driverIds.length > 0) {
        const { data: drivers, error: driversError } = await (supabase as any)
          .from("profiles_secure")
          // profiles_secure mascara PII (ex: telefones). Buscar apenas campos garantidos.
          .select("id, full_name, profile_photo_url, rating, total_ratings")
          .in("id", driverIds);

        if (driversError) {
          console.warn(
            "[fetchFreights] Falha ao carregar perfis de motoristas (profiles_secure):",
            driversError.message,
          );
        } else if (drivers?.length) {
          driverMap = new Map((drivers || []).map((d: any) => [d.id, d]));
        }
      }

      const finalData = rows.map((freight: any) => {
        const driversFromArray = Array.isArray(freight.drivers_assigned)
          ? (freight.drivers_assigned as any[]).filter((id) => typeof id === 'string' && id.length > 0)
          : [];
        const driversFromAssignments = assignmentDriversByFreight.get(freight.id) ?? [];
        const driverIdsForUi: string[] = (driversFromArray.length > 0 ? driversFromArray : driversFromAssignments) as string[];

        // Para fretes simples: usar driver_id
        // Para fretes multi-carreta (driver_id null): usar primeiro motorista de drivers_assigned
        let driverProfile = null;
        
        if (freight.driver_id && driverMap.has(freight.driver_id)) {
          driverProfile = driverMap.get(freight.driver_id);
        } else if (driverIdsForUi.length > 0) {
          // Multi-carreta: usar primeiro motorista (drivers_assigned OU fallback via assignments) para exibição no card
          const firstDriverId = driverIdsForUi[0];
          if (firstDriverId && driverMap.has(firstDriverId)) driverProfile = driverMap.get(firstDriverId);
        }
        
        // Mapear todos os motoristas atribuídos (para detalhes)
        const allAssignedDrivers = driverIdsForUi
          .map((id: string) => driverMap.get(id))
          .filter(Boolean);

        const mappedFreight: any = {
          ...freight,
          // Compatibilidade com FreightInProgressCard
          driver_profiles: driverProfile,
          // Compatibilidade retroativa: partes do ProducerDashboard ainda usam `freight.profiles`
          profiles: driverProfile,
          // Novo: todos os motoristas (para tela de detalhes)
          all_assigned_drivers: allAssignedDrivers,
          // ✅ Garantir consistência de UI mesmo quando trigger não preencheu `drivers_assigned`
          drivers_assigned: driverIdsForUi,
        };

        if (mappedFreight.status === "DELIVERED_PENDING_CONFIRMATION") {
          const deliveredDate = mappedFreight.updated_at || mappedFreight.created_at;
          const deadline = new Date(new Date(deliveredDate).getTime() + 72 * 60 * 60 * 1000);
          const now = new Date();
          const hoursRemaining = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)));

          const isUrgent = hoursRemaining < 24;
          const isCritical = hoursRemaining < 6;

          let displayText = "";
          if (hoursRemaining === 0) displayText = "PRAZO EXPIRADO";
          else if (hoursRemaining < 24) displayText = `${hoursRemaining}h restantes`;
          else {
            const days = Math.floor(hoursRemaining / 24);
            const hours = hoursRemaining % 24;
            displayText = `${days}d ${hours}h restantes`;
          }

          return { ...mappedFreight, deliveryDeadline: { hoursRemaining, isUrgent, isCritical, displayText } };
        }

        return mappedFreight;
      });

      setFreights(finalData);
    } catch (err) {
      // ✅ CORREÇÃO: Falha silenciosa no login - sem toast automático
      console.error("[fetchFreights] Exception:", err);
      setFreights([]);
    }
  }, [profile?.id, profile?.role]);

  // ✅ Buscar propostas
  const fetchProposals = useCallback(async () => {
    if (!profile?.id || profile.role !== "PRODUTOR") return;

    try {
      const { data: producerFreights, error: freightError } = await supabase
        .from("freights")
        .select("id")
        .eq("producer_id", profile.id);

      if (freightError) throw freightError;

      if (!producerFreights?.length) {
        setProposals([]);
        return;
      }

      const freightIds = producerFreights.map((f: any) => f.id);

      const { data, error } = await supabase
        .from("freight_proposals")
        .select(
          `
          *,
          freight:freights(*),
          driver:profiles_secure!freight_proposals_driver_id_fkey(*)
        `,
        )
        .in("freight_id", freightIds)
        .in("status", ["PENDING", "COUNTER_PROPOSED"])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setProposals(data || []);
    } catch {
      // ✅ CORREÇÃO: Falha silenciosa no login - sem toast automático
      console.error("[fetchProposals] Erro ao carregar propostas");
      setProposals([]);
    }
  }, [profile?.id, profile?.role]);

  // ✅ Buscar pagamentos externos
  // ✅ Buscar pagamentos externos com mapeamento de status
  // ✅ SEGURANÇA: NÃO fazer JOIN direto em `profiles` (tabela com PII). Resolver via `profiles_secure`.
  const fetchExternalPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== "PRODUTOR") return;

    try {
      if (import.meta.env.DEV) console.info("[fetchExternalPayments] Buscando pagamentos para produtor:", profile.id);

      const { data, error } = await supabase
        .from("external_payments")
        .select(
          `
          *,
          freight:freights!external_payments_freight_id_fkey(
            id,
            cargo_type,
            origin_city,
            origin_state,
            destination_city,
            destination_state,
            pickup_date,
            status,
            price,
            distance_km
          )
        `,
        )
        .eq("producer_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        // ✅ P0 FIX: NUNCA mostrar toast no carregamento automático
        // Erros são silenciosos - log apenas para debugging
        console.warn("[fetchExternalPayments] Erro silencioso (sem toast):", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        });

        // Estado vazio válido - sem toast, sem erro visível
        setExternalPayments([]);
        return;
      }

      const payments = data || [];
      if (import.meta.env.DEV) console.info("[fetchExternalPayments] Pagamentos encontrados:", payments.length);

      // Resolver dados do motorista via view segura
      const uniqueDriverIds = [...new Set(payments.map((p: any) => p.driver_id).filter(Boolean))] as string[];
      const driverMap = new Map<string, any>();

      if (uniqueDriverIds.length > 0) {
        const { data: driversData, error: driversErr } = await supabase
          .from('profiles_secure')
          .select('id, full_name, profile_photo_url, rating, total_ratings')
          .in('id', uniqueDriverIds);

        if (driversErr) {
          console.warn('[fetchExternalPayments] Erro ao buscar motoristas (profiles_secure):', driversErr);
        }

        (driversData || []).forEach((d: any) => driverMap.set(d.id, d));
      }

      // ✅ Mapear status do banco para UI
      // Banco: proposed, paid_by_producer, confirmed, rejected, cancelled
      // UI: proposed, paid_by_producer, completed (confirmed mapeado)
      const mappedData = payments.map((payment: any) => ({
        ...payment,
        driver: driverMap.get(payment.driver_id)
          ? {
              id: payment.driver_id,
              full_name: driverMap.get(payment.driver_id).full_name,
              profile_photo_url: driverMap.get(payment.driver_id).profile_photo_url,
              // Deliberadamente NÃO incluir telefone aqui (PII)
            }
          : undefined,
        // Mapear 'confirmed' do banco para 'completed' na UI
        status: payment.status === 'confirmed' ? 'completed' : payment.status,
      }));

      setExternalPayments(mappedData);
    } catch (e) {
      console.error("[fetchExternalPayments] Erro inesperado:", e);
      setExternalPayments([]);
    }
  }, [profile?.id, profile?.role]);

  // ✅ REMOVIDO: fetchFreightPayments
  // Produtores NÃO têm permissão para acessar freight_payments via RLS.
  // Esta funcionalidade foi removida para evitar erros de permissão no login.
  // Se necessário no futuro, implementar via edge function com validação de role.

  // ✅ Buscar service_requests ABERTAS (inclui FRETE_MOTO)
  // ✅ SEGURANÇA: Usar service_requests_secure para proteção de PII
  const fetchServiceRequests = useCallback(async () => {
    if (!profile?.id || profile.role !== "PRODUTOR") return;

    // ✅ PERF: Debug log only in dev
    if (import.meta.env.DEV) {
      console.info('[fetchServiceRequests] Iniciando query', { profileId: profile.id });
    }

    try {
      const { data, error } = await supabase
        .from("service_requests_secure")
        .select("*")
        .eq("client_id", profile.id)
        .eq("status", "OPEN")
        .order("created_at", { ascending: false })
        .limit(200);

      // ✅ CORREÇÃO CRÍTICA: Diferenciar lista vazia vs erro real
      // Lista vazia ou null = estado OK, não é erro
      if (error) {
        console.error("[fetchServiceRequests] Erro real:", error);
        // NÃO exibir toast - falha silenciosa no login
        setServiceRequests([]);
        return;
      }
      
      // ✅ PERF: Debug log only in dev
      if (import.meta.env.DEV) {
        const motoCount = (data || []).filter((sr: any) => sr.service_type === 'FRETE_MOTO').length;
        console.info('[fetchServiceRequests] Resultado', { total: data?.length || 0, motoCount });
      }
      
      // Sucesso - pode ser lista vazia, é normal
      setServiceRequests(data || []);
    } catch (e) {
      // ✅ NÃO exibir toast automático no login
      console.error("[fetchServiceRequests] Exception:", e);
      setServiceRequests([]);
    }
  }, [profile?.id, profile?.role]);

  // ✅ Buscar service_requests EM ANDAMENTO (usando view segura)
  const fetchOngoingServiceRequests = useCallback(async () => {
    if (!profile?.id || profile.role !== "PRODUTOR") return;

    try {
      const { data, error } = await supabase
        .from("service_requests_secure")
        .select("*, provider:provider_id(id, full_name, phone, rating)")
        .eq("client_id", profile.id)
        .in("status", ["ACCEPTED", "ON_THE_WAY", "IN_PROGRESS"])
        .order("accepted_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setOngoingServiceRequests(data || []);
    } catch (e) {
      console.error("Erro ao carregar serviços em andamento:", e);
    }
  }, [profile?.id, profile?.role]);

  /**
   * ✅ CORREÇÃO CRÍTICA DO “FRETE POR MOTO NÃO APARECE”
   * - Ao fechar o ServicesModal, forçamos refetch imediato + retries curtos.
   * - Isso evita o “buraco” entre: edge function inserir -> realtime -> UI.
   * - Também joga o produtor para a aba “Abertos” pra ele ver o card.
   */
  const closeServicesModalAndRefresh = useCallback(() => {
    setServicesModalOpen(false);

    const refetch = () => {
      fetchServiceRequests();
      fetchOngoingServiceRequests();
    };

    setActiveTab("freights-open");

    // ✅ PERF: Single delayed refetch instead of 3 sequential setTimeout calls
    refetch();
    setTimeout(refetch, 1500);
  }, [fetchServiceRequests, fetchOngoingServiceRequests]);

  // ✅ Carregar dados (deps completas — isso evita “fetch não roda”)
  useEffect(() => {
    const loadData = async () => {
      if (!profile?.id || profile.role !== "PRODUTOR") return;

      setLoading(true);
      try {
        await Promise.all([
          fetchFreights(),
          fetchProposals(),
          fetchExternalPayments(),
          fetchServiceRequests(),
          fetchOngoingServiceRequests(),
        ]);
      } finally {
        setLoading(false);
      }
    };

    if (profile?.id && profile?.role === "PRODUTOR") loadData();
  }, [
    profile?.id,
    profile?.role,
    fetchFreights,
    fetchProposals,
    fetchExternalPayments,
    fetchServiceRequests,
    fetchOngoingServiceRequests,
  ]);

  // ✅ Abrir frete automaticamente quando vem de notificação
  useEffect(() => {
    const state = location.state as any;
    if (!state || !profile?.id || !freights.length) return;

    const freightId = state.openFreightId || state.openChatFreightId;
    if (freightId) {
      const freight = freights.find((f) => f.id === freightId);
      if (freight) setSelectedFreightDetails(freight);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, profile?.id, freights, navigate, location.pathname]);

  // ✅ Debounce helper
  const makeDebounced = useCallback((fn: () => void, wait = 300) => {
    let t: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (t) clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }, []);

  const debouncedFetchFreights = useMemo(() => makeDebounced(fetchFreights, 300), [makeDebounced, fetchFreights]);
  const debouncedFetchProposals = useMemo(() => makeDebounced(fetchProposals, 300), [makeDebounced, fetchProposals]);
  const debouncedFetchExternalPayments = useMemo(
    () => makeDebounced(fetchExternalPayments, 300),
    [makeDebounced, fetchExternalPayments],
  );
  // REMOVIDO: debouncedFetchFreightPayments - produtores não têm permissão RLS
  const debouncedFetchServiceRequests = useMemo(
    () => makeDebounced(fetchServiceRequests, 250),
    [makeDebounced, fetchServiceRequests],
  );
  const debouncedFetchOngoingServiceRequests = useMemo(
    () => makeDebounced(fetchOngoingServiceRequests, 250),
    [makeDebounced, fetchOngoingServiceRequests],
  );

  // ✅ Realtime (inclui service_requests)
  useEffect(() => {
    if (!profile?.id) return;

    const ratingChannel = supabase
      .channel("producer-rating-trigger")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "freights", filter: `producer_id=eq.${profile.id}` },
        async (payload: any) => {
          const newStatus = payload.new?.status;
          const oldStatus = payload.old?.status;

          // ✅ CORREÇÃO: Avaliação SOMENTE após COMPLETED (pagamento confirmado)
          // Anteriormente disparava em DELIVERED, antes do pagamento ser feito
          if (newStatus === "COMPLETED" && oldStatus !== "COMPLETED") {
            // Verificar se pagamento foi confirmado
            const { data: confirmedPayment } = await supabase
              .from("external_payments")
              .select("id")
              .eq("freight_id", payload.new.id)
              .eq("status", "confirmed")
              .maybeSingle();

            if (!confirmedPayment) return;

            const { data: freightData } = await supabase
              .from("freights")
              .select(
                `
              *,
              driver:profiles!freights_driver_id_fkey(id, full_name, role)
            `,
              )
              .eq("id", payload.new.id)
              .single();

            if ((freightData as any)?.driver) {
              const { data: existingRating } = await supabase
                .from("freight_ratings")
                .select("id")
                .eq("freight_id", (freightData as any).id)
                .eq("rater_id", profile.id)
                .maybeSingle();

              if (!existingRating) setActiveFreightForRating(freightData);
            }
          }
        },
      )
      .subscribe();

    const channel = supabase
      .channel("realtime-producer-dashboard")
      // ✅ PERF: Filter realtime to only this producer's freights
      .on("postgres_changes", { event: "*", schema: "public", table: "freights", filter: `producer_id=eq.${profile.id}` }, () => debouncedFetchFreights())
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_proposals" }, () =>
        debouncedFetchProposals(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "external_payments" }, () =>
        debouncedFetchExternalPayments(),
      )
      // REMOVIDO: freight_payments - produtores não têm permissão RLS
      .on("postgres_changes", { event: "*", schema: "public", table: "service_requests" }, () => {
        // ✅ atualiza as duas listas (abertos e em andamento)
        debouncedFetchServiceRequests();
        debouncedFetchOngoingServiceRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ratingChannel);
      supabase.removeChannel(channel);
    };
  }, [
    profile?.id,
    debouncedFetchFreights,
    debouncedFetchProposals,
    debouncedFetchExternalPayments,
    debouncedFetchServiceRequests,
    debouncedFetchOngoingServiceRequests,
  ]);

  // ✅ Estatísticas (usa classificador central)
  const statistics = useMemo(() => {
    const pendingExternalPayments = externalPayments.filter((p) => p.status === "proposed").length;
    const totalPendingPayments = pendingExternalPayments;

    const totalPendingAmount =
      externalPayments.filter((p) => p.status === "proposed").reduce((sum, p) => sum + (p.amount || 0), 0);

    // ✅ Multi-carretas: status pode continuar OPEN enquanto accepted_trucks < required_trucks.
    // Nesses casos, o produtor ainda precisa ver o frete como “em andamento” (já existe motorista/veículo alocado).
    const ongoingFreights = freights.filter((f) =>
      isInProgressFreight(f.pickup_date, f.status) ||
      (f.status === 'OPEN' && (f.required_trucks ?? 1) > 1 && (f.accepted_trucks ?? 0) > 0)
    );

    return {
      // ✅ Usa classificador central para contadores corretos
      openFreights: classifiedOpenItems.counts.freights,
      openServices: classifiedOpenItems.counts.services,
      openTotal: classifiedOpenItems.counts.openTotal,
      activeFreights: ongoingFreights.length + ongoingServiceRequests.length,
      // ✅ P0 FIX: Usar contagem do hook de atribuições individuais (suporte multi-carreta)
      pendingConfirmation: pendingDeliveryCount,
      totalValue: freights.reduce((sum, f) => sum + (f.price || 0), 0),
      pendingProposals: proposals.filter((p: any) => {
        const f = p.freight;
        if (!f) return false;
        const status = (f.status || '').toUpperCase();
        const available = (f.required_trucks ?? 1) - (f.accepted_trucks ?? 0);
        return status === 'OPEN' && available > 0;
      }).length,
      pendingPayments: totalPendingPayments,
      totalPendingAmount,
    };
  }, [freights, proposals, externalPayments, ongoingServiceRequests, classifiedOpenItems, pendingDeliveryCount]);

  // ✅ Ações
  const handleLogout = async () => {
    // ✅ Logout silencioso - sem toasts, redirect via listener
    await signOut();
  };

  const handleFreightAction = async (action: "edit" | "cancel" | "request-cancel", freight: any) => {
    if (action === "edit") {
      setSelectedFreight(freight);
      setEditFreightModalOpen(true);
    } else if (action === "cancel") {
      setFreightToCancel(freight);
      setConfirmDialogOpen(true);
    } else if (action === "request-cancel") {
      setSelectedFreightDetails(freight);
      toast.info("Entre em contato com o motorista via chat para solicitar o cancelamento", { duration: 5000 });
    }
  };

  // ✅ P0 FIX: Handler para ações em FRETE_MOTO (service_requests)
  const handleMotoFreightAction = async (action: "edit" | "cancel", motoFreight: any) => {
    if (action === "cancel") {
      // ✅ P0 OBRIGATÓRIO: Log antes do cancelamento
      if (import.meta.env.DEV) console.log('[P0_CANCEL] BEFORE_CANCEL_MOTO', {
        service_request_id: motoFreight.id,
        service_type: motoFreight.service_type,
      });

      try {
        const { data, error } = await supabase.rpc('cancel_producer_service_request', {
          p_request_id: motoFreight.id,
          p_cancellation_reason: 'Cancelado pelo produtor'
        });

        if (error) throw error;
        
        const result = data as { success: boolean; error?: string; message?: string; debug_info?: any };
        
        // ✅ P0 OBRIGATÓRIO: Log do resultado
        if (import.meta.env.DEV) console.log('[P0_CANCEL] RPC_RESULT_MOTO', {
          service_request_id: motoFreight.id,
          success: result.success,
        });

        if (!result.success) {
          throw new Error(result.error || 'Erro ao cancelar');
        }

        toast.success('Frete por moto cancelado com sucesso!');
        
        // Refetch imediato
        await Promise.all([fetchServiceRequests(), fetchFreights()]);
      } catch (e: any) {
        console.error('[P0_CANCEL] ERROR_MOTO', {
          service_request_id: motoFreight.id,
          error_message: e?.message,
          timestamp: new Date().toISOString()
        });
        toast.error(e?.message || 'Erro ao cancelar frete por moto');
      }
    } else if (action === "edit") {
      // ✅ P0: Open edit modal for urban freights
      if (import.meta.env.DEV) console.log('[P0_EDIT_URBAN_FREIGHT] OPEN_MODAL', {
        service_request_id: motoFreight.id,
        service_type: motoFreight.service_type,
      });
      setSelectedServiceToEdit(motoFreight);
      setServiceEditModalOpen(true);
    }
  };

  // ============================================
  // P0: Handler para ações de serviços (não-frete)
  // ============================================
  const handleServiceAction = async (action: "edit" | "cancel", service: any) => {
    if (action === "cancel") {
      // ✅ P0 OBRIGATÓRIO: Log antes do cancelamento
      console.log('[P0_CANCEL] BEFORE_CANCEL_SERVICE', {
        service_request_id: service.id,
        service_type: service.service_type,
        client_id: service.client_id,
        profile_id: profile?.id,
        auth_uid: user?.id,
        timestamp: new Date().toISOString()
      });

      try {
        const { data, error } = await supabase.rpc('cancel_producer_service_request', {
          p_request_id: service.id,
          p_cancellation_reason: 'Cancelado pelo produtor'
        });

        if (error) throw error;
        
        const result = data as { success: boolean; error?: string; message?: string; debug_info?: any };
        
        // ✅ P0 OBRIGATÓRIO: Log do resultado
        console.log('[P0_CANCEL] RPC_RESULT_SERVICE', {
          service_request_id: service.id,
          success: result.success,
          error: result.error,
          debug_info: result.debug_info,
          timestamp: new Date().toISOString()
        });

        if (!result.success) {
          throw new Error(result.error || 'Erro ao cancelar serviço');
        }

        toast.success('Serviço cancelado com sucesso!');
        
        // Refetch para atualizar contadores e listas
        await Promise.all([fetchServiceRequests(), fetchFreights()]);
      } catch (error: any) {
        console.error('[P0_CANCEL] ERROR_SERVICE', {
          service_request_id: service.id,
          error_message: error?.message,
          timestamp: new Date().toISOString()
        });
        toast.error(error.message || 'Erro ao cancelar serviço');
      }
    } else if (action === "edit") {
      // ✅ P0: Open edit modal with service data
      console.log('[P0_EDIT_SERVICE] OPEN_MODAL', {
        service_request_id: service.id,
        service_type: service.service_type,
        timestamp: new Date().toISOString()
      });
      setSelectedServiceToEdit(service);
      setServiceEditModalOpen(true);
    }
  };

  const confirmCancelFreight = async () => {
    if (!freightToCancel) return;

    const status = String(freightToCancel.status || '').toUpperCase().trim();
    const canCancelDirectly = ["OPEN", "ACCEPTED", "LOADING", "IN_NEGOTIATION"].includes(status);
    if (!canCancelDirectly) {
      toast.error("Este frete está em andamento. Solicite o cancelamento via chat com o motorista.");
      setConfirmDialogOpen(false);
      return;
    }

    // Cancelar via edge function (cuida de assignments, trip progress e proposals)
    try {
      const { data, error } = await supabase.functions.invoke("cancel-freight-safe", {
        body: { freight_id: freightToCancel.id, reason: "Cancelado pelo produtor" },
      });

      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Erro ao processar ação");

      toast.success("Frete cancelado com sucesso!");
      setConfirmDialogOpen(false);
      setFreightToCancel(null);
      fetchFreights();
    } catch (e: any) {
      console.error("[CANCEL-FREIGHT] Error:", e);
      toast.error(e?.message || "Erro ao cancelar frete. Tente novamente.");
    }
  };

  const openDeliveryConfirmationModal = (freight: any) => {
    setFreightToConfirm(freight);
    setDeliveryConfirmationModal(true);
  };

  const closeDeliveryConfirmationModal = () => {
    setFreightToConfirm(null);
    setDeliveryConfirmationModal(false);
  };

  const ensureExternalPaymentRequest = useCallback(
    async (args: { freightId: string; driverId: string; amount: number; notes?: string }) => {
      if (!profile?.id) return;

      const { freightId, driverId, amount } = args;
      const notes = args.notes || 'Pagamento completo do frete após entrega confirmada';

      try {
        // Evitar duplicar solicitações
        const { data: existing, error: existingErr } = await supabase
          .from('external_payments')
          .select('id, status')
          .eq('freight_id', freightId)
          .eq('producer_id', profile.id)
          .eq('driver_id', driverId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (existingErr) {
          console.warn('[ensureExternalPaymentRequest] Falha ao checar existente:', existingErr.message);
        }

        if (existing && existing.length > 0) {
          // Já existe um registro, não criar outro
          return;
        }

        const { error: insertError } = await supabase
          .from('external_payments')
          .insert({
            freight_id: freightId,
            producer_id: profile.id,
            driver_id: driverId,
            amount,
            status: 'proposed',
            notes,
            proposed_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error('[ensureExternalPaymentRequest] Erro ao criar external_payment:', insertError);
          return;
        }

        // Atualizar UI
        fetchExternalPayments();
      } catch (e) {
        console.error('[ensureExternalPaymentRequest] Erro inesperado:', e);
      }
    },
    [profile?.id, fetchExternalPayments],
  );

  const handleDeliveryConfirmed = () => {
    // ✅ Fluxo correto: Entrega confirmada → abrir Pagamentos → produtor marca como pago → motorista confirma recebimento → avaliações liberadas
    if (freightToConfirm) {
      const driverId = freightToConfirm.driver_id || freightToConfirm.profiles?.id;
      const amount = freightToConfirm.price;

      if (freightToConfirm.id && driverId && typeof amount === 'number' && Number.isFinite(amount) && amount > 0) {
        void ensureExternalPaymentRequest({
          freightId: freightToConfirm.id,
          driverId,
          amount,
        });
      }

      // Levar o produtor diretamente para a aba de pagamentos
      setActiveTab('payments');
      toast.info('Entrega confirmada. Vá em “Pagamentos” para confirmar o pagamento ao motorista.');
    }

    fetchFreights();
    fetchExternalPayments();
    // ✅ P0 FIX: Também atualizar confirmações individuais pendentes
    refetchPendingDeliveries();
  };

  // ✅ Confirmar pagamento externo - criar solicitação de pagamento
  const handleConfirmExternalPayment = async (freightId: string, amount: number) => {
    if (!profile?.id) {
      toast.error("Você precisa estar autenticado para confirmar pagamentos.");
      return;
    }

    setPaymentLoading(true);
    try {
      // Buscar motorista do frete
      const { data: freight, error: freightError } = await supabase
        .from("freights")
        .select("driver_id")
        .eq("id", freightId)
        .single();

      if (freightError || !freight?.driver_id) {
        console.error("[handleConfirmExternalPayment] Erro ao buscar frete:", freightError);
        toast.error("Não foi possível encontrar o motorista deste frete.");
        return;
      }

      // Criar registro de pagamento externo
      const { error: insertError } = await supabase
        .from("external_payments")
        .insert({
          freight_id: freightId,
          producer_id: profile.id,
          driver_id: freight.driver_id,
          amount: amount,
          status: "proposed",
          notes: "Pagamento completo do frete após entrega confirmada",
          proposed_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("[handleConfirmExternalPayment] Erro ao criar pagamento:", insertError);
        toast.error(`Erro ao registrar pagamento: ${insertError.message}`);
        return;
      }

      toast.success("Solicitação de pagamento registrada! O motorista será notificado.");
      fetchExternalPayments();
      fetchFreights();
    } catch (error) {
      console.error("[handleConfirmExternalPayment] Erro inesperado:", error);
      toast.error("Erro inesperado ao processar pagamento. Tente novamente.");
    } finally {
      setPaymentLoading(false);
    }
  };

  // ✅ Produtor confirma que fez o pagamento - atualiza status para "paid_by_producer"
  const confirmPaymentMade = async (paymentId: string) => {
    if (!profile?.id) {
      toast.error("Você precisa estar autenticado.");
      return;
    }

    setPaymentLoading(true);
    try {
      // Buscar dados do pagamento ANTES de atualizar (para notificar)
      const { data: paymentData } = await supabase
        .from("external_payments")
        .select("id, driver_id, freight_id, amount")
        .eq("id", paymentId)
        .eq("producer_id", profile.id)
        .single();

      const { data: updatedRows, error } = await supabase
        .from("external_payments")
        .update({ 
          status: "paid_by_producer",
          updated_at: new Date().toISOString()
        })
        .eq("id", paymentId)
        .eq("producer_id", profile.id)
        .select("id");

      if (error) {
        console.error("[confirmPaymentMade] Erro ao confirmar pagamento:", error);
        if (error.code === "42501" || error.message?.includes("permission")) {
          toast.error("Você não tem permissão para confirmar este pagamento.");
        } else {
          toast.error(`Erro ao confirmar pagamento: ${error.message}`);
        }
        return;
      }

      // ✅ Verificar se realmente atualizou (evita falha silenciosa por RLS)
      if (!updatedRows || updatedRows.length === 0) {
        console.error("[confirmPaymentMade] Update afetou 0 linhas - possível problema de RLS ou status");
        toast.error("Não foi possível confirmar o pagamento.", {
          description: "Verifique se o pagamento ainda está pendente e tente novamente."
        });
        return;
      }

      console.log("[confirmPaymentMade] ✅ Pagamento atualizado:", updatedRows);

      // ✅ Notificação do motorista é feita pelo trigger notify_external_payment() no banco
      // NÃO inserir notificação manual aqui para evitar duplicação

      // ✅ Notificar transportadora (se motorista afiliado) - trigger não cobre isso
      if (paymentData?.driver_id) {
        const amountStr = paymentData.amount 
          ? `R$ ${Number(paymentData.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : '';

        const { data: affiliation } = await supabase
          .from('company_drivers')
          .select('company_id, transport_companies:transport_companies!company_drivers_company_id_fkey(profile_id)')
          .eq('driver_profile_id', paymentData.driver_id)
          .eq('status', 'active')
          .maybeSingle();

        if (affiliation?.transport_companies) {
          const companyOwnerProfileId = (affiliation.transport_companies as any)?.profile_id;
          if (companyOwnerProfileId) {
            await supabase.from('notifications').insert({
              user_id: companyOwnerProfileId,
              title: '💰 Pagamento de Motorista Afiliado',
              message: `O produtor informou pagamento de ${amountStr} para seu motorista. Acompanhe na aba Pagamentos.`,
              type: 'payment_paid_by_producer',
              read: false,
              data: {
                freight_id: paymentData.freight_id,
                payment_id: paymentId,
                amount: paymentData.amount,
                driver_id: paymentData.driver_id,
              },
            });
          }
        }
      }

      toast.success("Pagamento confirmado! Aguardando confirmação do motorista.");
      fetchExternalPayments();
    } catch (error) {
      console.error("[confirmPaymentMade] Erro inesperado:", error);
      toast.error("Erro inesperado. Tente novamente.");
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loading) {
    return <AppSpinner fullscreen />;
  }

  // ✅ Ongoing freights list (reuso)
  // ✅ Multi-carretas: status pode continuar OPEN enquanto accepted_trucks < required_trucks.
  // Nesses casos, o produtor ainda precisa ver o frete como “em andamento” (já existe motorista/veículo alocado).
  const ongoingFreights = freights.filter((f) =>
    isInProgressFreight(f.pickup_date, f.status) ||
    (f.status === 'OPEN' && (f.required_trucks ?? 1) > 1 && (f.accepted_trucks ?? 0) > 0)
  );

  return (
    <div data-dashboard-ready="true" className="h-screen bg-gradient-to-br from-background via-secondary/5 to-background overflow-x-hidden overflow-y-auto">
      <Header
        user={{
          name: profile?.full_name || "Usuário",
          role: (profile?.role as "PRODUTOR" | "MOTORISTA") || "PRODUTOR",
        }}
        onLogout={handleLogout}
        onMenuClick={() => {}}
        userProfile={profile}
        notifications={unreadCount}
      />

      {/* Hero Section */}
      <section className="relative min-h-[280px] flex items-center justify-center overflow-hidden">
        <picture className="absolute inset-0">
          <source media="(max-width: 640px)" srcSet={heroMobile} type="image/webp" />
          <img 
            src={heroDesktop}
            alt="Imagem de fundo"
            className="w-full h-full object-cover animate-fade-in"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/20 to-primary/40" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <CreateFreightWizardModal 
                onFreightCreated={fetchFreights} 
                userProfile={profile}
                trigger={
                  <HeroActionButton icon={<Package className="h-4 w-4" />}>
                    Criar Frete
                  </HeroActionButton>
                }
              />
              <HeroActionButton
                onClick={() => setActiveTab("proposals")}
                icon={<Users className="h-4 w-4" />}
              >
                Ver Propostas
              </HeroActionButton>
              <HeroActionButton
                onClick={() => setServicesModalOpen(true)}
                icon={<Wrench className="h-4 w-4" />}
              >
                Solicitar Serviços
              </HeroActionButton>
              <HeroActionButton
                onClick={() => setActiveTab("ratings")}
                icon={<Star className="h-4 w-4" />}
              >
                Avaliações
              </HeroActionButton>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-4 px-4 pb-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          {/* ✅ P0 FIX: Card "Abertos" shows ONLY freights (rural + urban), NOT services */}
          <StatsCard
            size="sm"
            icon={<Package className="h-5 w-5" />}
            iconColor="text-blue-500"
            label="Abertos"
            value={statistics.openFreights}
            onClick={() => setActiveTab("freights-open")}
          />
          <StatsCard
            size="sm"
            icon={<Play className="h-5 w-5" />}
            iconColor="text-orange-500"
            label="Andamento"
            value={statistics.activeFreights}
            onClick={() => setActiveTab("ongoing")}
          />
          <StatsCard
            size="sm"
            icon={<Clock className="h-5 w-5" />}
            iconColor="text-amber-500"
            label="P/ Confirmar"
            value={statistics.pendingConfirmation}
            onClick={() => setActiveTab("confirm-delivery")}
          />
          <StatsCard
            size="sm"
            icon={<Users className="h-5 w-5" />}
            iconColor="text-purple-500"
            label="Propostas"
            value={statistics.pendingProposals}
            onClick={() => setActiveTab("proposals")}
          />
          <StatsCard
            size="sm"
            icon={<CreditCard className="h-5 w-5" />}
            iconColor="text-green-500"
            label="Pagamentos"
            value={statistics.pendingPayments}
            onClick={() => setActiveTab("payments")}
          />
          <StatsCard
            size="sm"
            icon={<Wrench className="h-5 w-5" />}
            iconColor="text-teal-500"
            label="Serviços"
            value={statistics.openServices || 0}
            onClick={() => setActiveTab("services-open")}
          />
        </div>

        {/* Mural */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => {
              const newState = !isMuralOpen;
              setIsMuralOpen(newState);
              setManualOpen(newState);
            }}
            className="mb-3 flex items-center gap-2"
          >
            <span>📢</span> Mural de Avisos
          </Button>
          <SystemAnnouncementsBoard
            isOpen={isMuralOpen}
            onClose={() => {
              setIsMuralOpen(false);
              setManualOpen(false);
            }}
            ignoreDismissals={manualOpen}
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="w-full overflow-x-auto pb-2">
            <TabsList className="inline-flex h-11 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              <TabsTrigger
                value="freights-open"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-freights-open"
              >
                <Truck className="h-3.5 w-3.5 mr-1" />
                Fretes
                <TabBadge count={statistics.openFreights} />
              </TabsTrigger>

              <TabsTrigger
                value="services-open"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-services-open"
              >
                <Wrench className="h-3.5 w-3.5 mr-1" />
                Serviços
                <TabBadge count={statistics.openServices} />
              </TabsTrigger>

              <TabsTrigger
                value="ongoing"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-ongoing"
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                Em Andamento
                <TabBadge count={statistics.activeFreights} />
              </TabsTrigger>

              <TabsTrigger
                value="confirm-delivery"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-confirm-delivery"
              >
                <Clock className="h-3.5 w-3.5 mr-1" />
                Confirmar Entrega
                <TabBadge count={statistics.pendingConfirmation} />
              </TabsTrigger>

              <TabsTrigger
                value="proposals"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-proposals"
              >
                <Users className="h-3.5 w-3.5 mr-1" />
                Propostas
                <TabBadge count={statistics.pendingProposals} />
              </TabsTrigger>

              <TabsTrigger
                value="scheduled"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Calendar className="h-3.5 w-3.5 mr-1" />
                Agendados
              </TabsTrigger>

              <TabsTrigger
                value="history"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-history"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Histórico
              </TabsTrigger>

              <TabsTrigger
                value="payments"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-payments"
              >
                <CreditCard className="h-3.5 w-3.5 mr-1" />
                Pagamentos
                <TabBadge count={statistics.pendingPayments} />
              </TabsTrigger>

              <TabsTrigger
                value="ratings"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Star className="h-3.5 w-3.5 mr-1" />
                Avaliações
                <TabBadge count={pendingRatingsCount} />
              </TabsTrigger>

              <TabsTrigger
                value="chat"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-chat"
              >
                <MessageCircle className="h-3.5 w-3.5 mr-1" />
                Chat
                <TabBadge count={chatUnreadCount} />
              </TabsTrigger>

              <TabsTrigger
                value="fiscal"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <FileText className="h-3.5 w-3.5 mr-1" />
                Fiscal
              </TabsTrigger>

              <TabsTrigger
                value="reports"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-2 text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                data-tutorial="tab-reports"
              >
                <BarChart className="h-3.5 w-3.5 mr-1" />
                Relatórios
              </TabsTrigger>
            </TabsList>
          </div>

          <SubscriptionExpiryNotification />

          {/* ✅ ABA FRETES ABERTOS - Rural + Urbanos/Especiais com sub-abas */}
          <TabsContent value="freights-open" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Fretes Abertos ({classifiedOpenItems.counts.freights})
              </h3>
            </div>

            {classifiedOpenItems.counts.freights === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Truck className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhum frete aberto</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Você não possui fretes abertos no momento. Crie um novo frete para começar.
                  </p>
                  <CreateFreightWizardModal onFreightCreated={fetchFreights} userProfile={profile} />
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="rural" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="rural" className="flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Fretes Rurais
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {classifiedOpenItems.freightsRuralOpen.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="urban" className="flex items-center gap-2">
                    <Bike className="h-4 w-4" />
                    Fretes Urbanos
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                      {classifiedOpenItems.freightsUrbanOpen.length}
                    </Badge>
                  </TabsTrigger>
                </TabsList>

                {/* SUB-ABA: FRETES RURAIS */}
                <TabsContent value="rural">
                  {classifiedOpenItems.freightsRuralOpen.length === 0 ? (
                    <div className="text-center py-8">
                      <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-semibold mb-2">Nenhum frete rural aberto</p>
                      <p className="text-sm text-muted-foreground">
                        Seus fretes de carga agrícola aparecerão aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[70vh] overflow-y-auto pr-2">
                      <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                        {classifiedOpenItems.freightsRuralOpen.map((freight) => (
                          <FreightCard
                            key={freight.id}
                            freight={{
                              id: freight.id,
                              cargo_type: freight.cargo_type,
                              weight: freight.weight || 0,
                              distance_km: freight.distance_km,
                              origin_address: freight.origin_address,
                              destination_address: freight.destination_address,
                              origin_city: freight.origin_city,
                              origin_state: freight.origin_state,
                              destination_city: freight.destination_city,
                              destination_state: freight.destination_state,
                              price: freight.price,
                              status: freight.status,
                              pickup_date: freight.pickup_date,
                              delivery_date: freight.delivery_date,
                              urgency: freight.urgency,
                              minimum_antt_price: freight.minimum_antt_price || 0,
                              required_trucks: freight.required_trucks || 1,
                              accepted_trucks: freight.accepted_trucks || 0,
                              service_type: freight.service_type || "CARGA",
                              pricing_type: freight.pricing_type,
                              price_per_km: freight.price_per_km,
                            }}
                            showProducerActions
                            onAction={(action) => handleFreightAction(action as any, freight)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* SUB-ABA: FRETES URBANOS */}
                <TabsContent value="urban">
                  {classifiedOpenItems.freightsUrbanOpen.length === 0 ? (
                    <div className="text-center py-8">
                      <Bike className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-semibold mb-2">Nenhum frete urbano aberto</p>
                      <p className="text-sm text-muted-foreground">
                        Fretes de Moto, Guincho e Mudança aparecerão aqui.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[70vh] overflow-y-auto pr-2">
                      <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                        {/* Fretes urbanos da tabela freights → FreightCard */}
                        {classifiedOpenItems.freightsUrbanFromTable.map((freight) => (
                          <FreightCard
                            key={freight.id}
                            freight={{
                              id: freight.id,
                              cargo_type: freight.cargo_type,
                              weight: freight.weight || 0,
                              distance_km: freight.distance_km,
                              origin_address: freight.origin_address,
                              destination_address: freight.destination_address,
                              origin_city: freight.origin_city,
                              origin_state: freight.origin_state,
                              destination_city: freight.destination_city,
                              destination_state: freight.destination_state,
                              price: freight.price,
                              status: freight.status,
                              pickup_date: freight.pickup_date,
                              delivery_date: freight.delivery_date,
                              urgency: freight.urgency,
                              minimum_antt_price: freight.minimum_antt_price || 0,
                              required_trucks: freight.required_trucks || 1,
                              accepted_trucks: freight.accepted_trucks || 0,
                              service_type: freight.service_type,
                              pricing_type: freight.pricing_type,
                              price_per_km: freight.price_per_km,
                            }}
                            showProducerActions
                            onAction={(action) => handleFreightAction(action as any, freight)}
                          />
                        ))}
                        {/* Fretes urbanos de service_requests → UrbanFreightCard */}
                        {classifiedOpenItems.freightsUrbanOpen
                          .filter((uf) => !classifiedOpenItems.freightsUrbanFromTable.some((ft) => ft.id === uf.id))
                          .map((urbanFreight) => (
                          <UrbanFreightCard
                            key={`urban-${urbanFreight.id}`}
                            serviceRequest={{
                              id: urbanFreight.id,
                              service_type: urbanFreight.service_type,
                              status: urbanFreight.status,
                              problem_description: urbanFreight.problem_description,
                              location_address: urbanFreight.location_address,
                              city_name: urbanFreight.city_name,
                              state: urbanFreight.state,
                              additional_info: urbanFreight.additional_info,
                              estimated_price: urbanFreight.estimated_price,
                              final_price: urbanFreight.final_price,
                              preferred_datetime: urbanFreight.preferred_datetime,
                              created_at: urbanFreight.created_at,
                              urgency: urbanFreight.urgency,
                            }}
                            onEdit={() => handleMotoFreightAction("edit", urbanFreight)}
                            onCancel={() => handleMotoFreightAction("cancel", urbanFreight)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </TabsContent>

          {/* ✅ ABA SERVIÇOS ABERTOS - Somente não-transporte */}
          <TabsContent value="services-open" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">
                Serviços Abertos ({classifiedOpenItems.counts.services})
              </h3>
            </div>

            {classifiedOpenItems.servicesOpen.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Wrench className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhum serviço aberto</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Você não possui solicitações de serviço em aberto no momento.
                    Serviços incluem: Agrícola, Técnico, etc. (Moto/Guincho/Mudança são fretes).
                  </p>
                  <Button onClick={() => setServicesModalOpen(true)}>
                    <Wrench className="h-4 w-4 mr-2" />
                    Solicitar Serviço
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                  {classifiedOpenItems.servicesOpen.map((service) => (
                    <UnifiedServiceCard
                      key={service.id}
                      serviceRequest={service}
                      viewerRole="CLIENT"
                      onEdit={() => handleServiceAction("edit", service)}
                      onCancel={() => handleServiceAction("cancel", service)}
                    />
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ✅ ABA EM ANDAMENTO */}
          <TabsContent value="ongoing" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Em Andamento</h3>
            </div>

            {ongoingFreights.length === 0 && ongoingServiceRequests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Play className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhum frete ou serviço em andamento</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Você não possui fretes ou serviços em andamento no momento.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto pr-2 space-y-6">
                {ongoingServiceRequests.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Serviços em Andamento ({ongoingServiceRequests.length})
                    </h4>

                    <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                      {ongoingServiceRequests.map((sr: any) => {
                        // Extrair destino do additional_info
                        let additionalInfo: any = null;
                        try {
                          additionalInfo = typeof sr.additional_info === 'string'
                            ? JSON.parse(sr.additional_info)
                            : (typeof sr.additional_info === 'object' ? sr.additional_info : null);
                        } catch { /* ignore */ }
                        const destination = additionalInfo?.destination || null;

                        const originLat = sr.location_lat || sr.city_lat || null;
                        const originLng = sr.location_lng || sr.city_lng || null;
                        const destLat = destination?.lat || null;
                        const destLng = destination?.lng || null;
                        const originCity = sr.city_name || sr.location_city || '';
                        const originState = sr.state || sr.location_state || '';
                        const destCity = destination?.city || originCity;
                        const destState = destination?.state || originState;

                        // Mapear status de service para status de frete
                        const statusMap: Record<string, string> = {
                          ACCEPTED: 'ACCEPTED',
                          ON_THE_WAY: 'LOADING',
                          IN_PROGRESS: 'IN_TRANSIT',
                        };
                        const mappedStatus = statusMap[sr.status] || sr.status;

                        return (
                          <FreightInProgressCard
                            key={sr.id}
                            freight={{
                              id: sr.id,
                              origin_city: originCity,
                              origin_state: originState,
                              destination_city: destCity,
                              destination_state: destState,
                              origin_lat: originLat,
                              origin_lng: originLng,
                              destination_lat: destLat,
                              destination_lng: destLng,
                              weight: null,
                              distance_km: null,
                              pickup_date: sr.accepted_at || sr.created_at,
                              price: sr.estimated_price,
                              required_trucks: 1,
                              status: mappedStatus,
                              service_type: sr.service_type,
                              driver_profiles: sr.provider ? {
                                full_name: sr.provider.full_name,
                              } : null,
                              driver_id: sr.provider_id,
                            }}
                            serviceWorkflowActions={
                              <div className="space-y-2">
                                {sr.problem_description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    📝 {sr.problem_description}
                                  </p>
                                )}
                                {sr.provider && (
                                  <div className="bg-secondary/50 rounded-lg p-2 flex items-center gap-2">
                                    <Users className="h-4 w-4 text-primary" />
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm truncate">{sr.provider.full_name}</p>
                                      {sr.provider.phone && (
                                        <a
                                          href={`tel:${sr.provider.phone}`}
                                          className="text-xs text-primary hover:underline flex items-center gap-1"
                                        >
                                          <Phone className="h-3 w-3" />
                                          {sr.provider.phone}
                                        </a>
                                      )}
                                    </div>
                                    {sr.provider.rating && (
                                      <div className="flex items-center gap-1">
                                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                        <span className="text-sm font-medium">{Number(sr.provider.rating).toFixed(1)}</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {sr.provider_id && sr.client_id && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={() => {
                                      setSelectedChatServiceRequest(sr);
                                      setServiceChatOpen(true);
                                    }}
                                  >
                                    <MessageSquare className="h-4 w-4 mr-2" />
                                    Abrir Chat
                                  </Button>
                                )}
                              </div>
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                )}

                {ongoingFreights.length > 0 && (
                  <div className="space-y-3">
                    {ongoingServiceRequests.length > 0 && (
                      <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                        <Truck className="h-4 w-4" />
                        Fretes em Andamento ({ongoingFreights.length})
                      </h4>
                    )}

                    <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                      {ongoingFreights.map((freight) => (
                        <FreightInProgressCard
                          key={freight.id}
                          freight={freight}
                          onViewDetails={() => setSelectedFreightDetails(freight)}
                          onRequestCancel={() => {
                            setFreightToCancel(freight);
                            setConfirmDialogOpen(true);
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ✅ CONFIRMAR ENTREGA - Agora com suporte a atribuições individuais (multi-carreta) */}
          <TabsContent value="confirm-delivery" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Confirmar Entregas</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={urgencyFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter("all")}
                >
                  Todos ({pendingDeliveryCount})
                </Button>
                <Button
                  variant={urgencyFilter === "critical" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter("critical")}
                >
                  🚨 Críticos ({pendingDeliveryCritical})
                </Button>
                <Button
                  variant={urgencyFilter === "urgent" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter("urgent")}
                  className={urgencyFilter === "urgent" ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                  ⚠️ Urgentes ({pendingDeliveryUrgent})
                </Button>
              </div>
            </div>

            {pendingDeliveryLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : pendingDeliveryItems.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhuma entrega aguardando confirmação</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Não há entregas reportadas pelos motoristas aguardando sua confirmação.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="max-h-[70vh] overflow-y-auto pr-2">
                <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                  {pendingDeliveryItems
                    .filter((item) => {
                      const hours = item.deliveryDeadline.hoursRemaining;
                      if (urgencyFilter === "all") return true;
                      if (urgencyFilter === "critical") return hours < 6;
                      if (urgencyFilter === "urgent") return hours < 24 && hours >= 6;
                      return true;
                    })
                    .map((item) => (
                      <PendingDeliveryConfirmationCard
                        key={item.id}
                        item={item}
                        onDispute={() => {
                          // TODO: Implementar disputa de entrega
                          toast.info('Disputa de entrega em breve');
                        }}
                        onConfirmDelivery={() => {
                          // ✅ Montar objeto compatível com DeliveryConfirmationModal
                          // incluindo dados do motorista específico
                          const reportedAt =
                            item.deliveryDeadline?.reportedAt ||
                            item.delivered_at ||
                            (item.freight as any)?.updated_at ||
                            new Date().toISOString();

                          const confirmationDeadline = new Date(
                            new Date(reportedAt).getTime() + 72 * 60 * 60 * 1000,
                          ).toISOString();

                          const confirmationData = {
                            id: item.freight_id,
                            assignment_id: item.id, // ID da atribuição para confirmação individual
                            driver_id: item.driver_id,
                            cargo_type: item.freight.cargo_type,
                            origin_address: item.freight.origin_address,
                            destination_address: item.freight.destination_address,
                            price: item.agreed_price || (item.freight.price / item.freight.required_trucks),
                            // ✅ Evita crash/reload: DeliveryConfirmationModal usa updated_at para render
                            updated_at: reportedAt,
                            status: 'DELIVERED_PENDING_CONFIRMATION',
                            metadata: {
                              ...(item.freight as any).metadata,
                              confirmation_deadline: confirmationDeadline,
                            },
                            profiles: {
                              id: item.driver.id,
                              full_name: item.driver.full_name,
                              contact_phone: item.driver.contact_phone,
                            },
                            // Metadata para identificar que é confirmação individual
                            _isIndividualConfirmation: true,
                            _assignmentId: item.id,
                          };
                          openDeliveryConfirmationModal(confirmationData);
                        }}
                      />
                    ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="proposals" className="space-y-4">
            <UnifiedProposalsWrapper
              userId={profile?.id || ""}
              onProposalAccepted={() => {
                fetchFreights();
                fetchProposals();
              }}
            />
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledFreightsManager />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <ProducerHistoryTab />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <PendingRatingsPanel userRole="PRODUTOR" userProfileId={profile?.id || ""} />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <UnifiedChatHub userProfileId={profile?.id || ''} userRole="PRODUTOR" />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ProducerReportsTab />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <ProducerPaymentsTab
              externalPayments={externalPayments}
              freightPayments={[]} // REMOVIDO: produtores não têm permissão RLS
              paymentLoading={paymentLoading}
              onConfirmExternalPayment={handleConfirmExternalPayment}
              onConfirmPaymentMade={confirmPaymentMade}
              onProcessStripePayment={() => toast.info("Pagamento via Stripe em desenvolvimento")}
              currentUserProfile={profile}
              onRefresh={fetchExternalPayments}
            />
          </TabsContent>

          <TabsContent value="fiscal" className="space-y-4">
            <FiscalTab userRole="PRODUTOR" />
          </TabsContent>
        </Tabs>
      </div>

      <EditFreightModal
        isOpen={editFreightModalOpen}
        onClose={() => setEditFreightModalOpen(false)}
        freight={selectedFreight}
        onSuccess={() => {
          fetchFreights();
          setEditFreightModalOpen(false);
        }}
      />

      <ProposalCounterModal
        isOpen={counterProposalModalOpen}
        onClose={() => setCounterProposalModalOpen(false)}
        originalProposal={selectedProposal}
        freightPrice={selectedProposal?.freight_price || 0}
        freightDistance={selectedProposal?.freight_distance || 0}
        freightWeight={selectedProposal?.freight_weight || 0}
        requiredTrucks={selectedProposal?.required_trucks || 1}
        freightPricingType={selectedProposal?.freight_pricing_type}
        freightPricePerKm={selectedProposal?.freight_price_per_km}
        onSuccess={() => {
          fetchProposals();
          setCounterProposalModalOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        onConfirm={confirmCancelFreight}
        title="Cancelar Frete"
        description="Tem certeza que deseja cancelar este frete? Todos os motoristas atribuídos serão liberados. Esta ação não pode ser desfeita."
        confirmText="Sim, cancelar"
        cancelText="Não, manter"
        variant="destructive"
      />

      <Dialog open={!!selectedFreightDetails} onOpenChange={(open) => !open && setSelectedFreightDetails(null)}>
        {/* ✅ Padrão do FreightDetails: botão de fechar único (X interno) e esconder o close padrão do Radix */}
        <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto [&>button.absolute]:hidden">
          <DialogTitle className="sr-only">Detalhes do Frete</DialogTitle>
          <DialogDescription className="sr-only">Detalhes completos do frete</DialogDescription>
          {selectedFreightDetails && (
            <FreightDetails
              freightId={selectedFreightDetails.id}
              currentUserProfile={profile}
              initialTab={(location.state as any)?.openChatFreightId ? "chat" : "status"}
              onClose={() => setSelectedFreightDetails(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {freightToConfirm && (
        <DeliveryConfirmationModal
          freight={{
            id: freightToConfirm.id,
            cargo_type: freightToConfirm.cargo_type,
            origin_address: freightToConfirm.origin_address,
            destination_address: freightToConfirm.destination_address,
            status: freightToConfirm.status,
            updated_at: freightToConfirm.updated_at,
            metadata: freightToConfirm.metadata,
            driver: freightToConfirm.profiles
              ? {
                  full_name: freightToConfirm.profiles.full_name,
                  contact_phone: freightToConfirm.profiles.contact_phone || freightToConfirm.profiles.phone,
                }
              : undefined,
            // ✅ P0 FIX: Passar campos de confirmação individual
            profiles: freightToConfirm.profiles,
            _isIndividualConfirmation: freightToConfirm._isIndividualConfirmation,
            _assignmentId: freightToConfirm._assignmentId,
            driver_id: freightToConfirm.driver_id,
            price: freightToConfirm.price,
          }}
          isOpen={deliveryConfirmationModal}
          onClose={closeDeliveryConfirmationModal}
          onConfirm={handleDeliveryConfirmed}
        />
      )}

      {/* ✅ CORREÇÃO: onClose do ServicesModal agora faz REFRESH forte (inclui FRETE_MOTO) */}
      <ServicesModal isOpen={servicesModalOpen} onClose={closeServicesModalAndRefresh} />

      {activeFreightForRating && (
        <AutoRatingModal
          isOpen
          onClose={() => setActiveFreightForRating(null)}
          freightId={activeFreightForRating.id}
          userToRate={
            activeFreightForRating.driver
              ? {
                  id: activeFreightForRating.driver.id,
                  full_name: activeFreightForRating.driver.full_name,
                  role: "MOTORISTA" as const,
                }
              : null
          }
          currentUserProfile={profile}
        />
      )}

      {/* ✅ P0: Service Edit Modal */}
      {selectedServiceToEdit && (
        <ServiceEditModal
          isOpen={serviceEditModalOpen}
          onClose={() => {
            setServiceEditModalOpen(false);
            setSelectedServiceToEdit(null);
          }}
          onSuccess={async () => {
            await Promise.all([fetchServiceRequests(), fetchFreights()]);
          }}
          serviceRequest={selectedServiceToEdit}
        />
      )}

      {/* ✅ Service Chat Dialog */}
      {serviceChatOpen && selectedChatServiceRequest && (
        <ServiceChatDialog
          isOpen={serviceChatOpen}
          onClose={() => {
            setServiceChatOpen(false);
            setSelectedChatServiceRequest(null);
          }}
          serviceRequest={selectedChatServiceRequest}
          currentUserProfile={profile}
        />
      )}
    </div>
  );
};

export default ProducerDashboard;
