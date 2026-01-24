import React, { useState, useEffect, useMemo, useCallback, lazy } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/stats-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
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
} from "lucide-react";
import { FreightFilters } from "@/components/AdvancedFreightFilters";
import { useFreightReportData } from "@/hooks/useFreightReportData";
import { ProducerReportsTab } from "@/pages/producer/ProducerReportsTab";
import { ProducerPaymentsTab } from "@/pages/producer/ProducerPaymentsTab";
import { PendingRatingsPanel } from "@/components/PendingRatingsPanel";
import { ServicesModal } from "@/components/ServicesModal";
import { UnifiedHistory } from "@/components/UnifiedHistory";
import { showErrorToast } from "@/lib/error-handler";
import { SystemAnnouncementsBoard } from "@/components/SystemAnnouncementsBoard";
import { AutoRatingModal } from "@/components/AutoRatingModal";
import { FreightProposalsManager } from "@/components/FreightProposalsManager";
import { UnifiedChatHub } from "@/components/UnifiedChatHub";
import { useUnreadChatsCount } from "@/hooks/useUnifiedChats";
import { FiscalTab } from "@/components/fiscal/tabs/FiscalTab";
import { HERO_BG_DESKTOP } from "@/lib/hero-assets";

// ✅ PHASE 2: Lazy load chart-heavy components to reduce initial bundle
const FreightAnalyticsDashboard = lazy(() =>
  import("@/components/FreightAnalyticsDashboard").then((m) => ({ default: m.FreightAnalyticsDashboard })),
);
const DriverPerformanceDashboard = lazy(() =>
  import("@/components/dashboards/DriverPerformanceDashboard").then((m) => ({ default: m.DriverPerformanceDashboard })),
);
const PeriodComparisonDashboard = lazy(() =>
  import("@/components/PeriodComparisonDashboard").then((m) => ({ default: m.PeriodComparisonDashboard })),
);
const RouteRentabilityReport = lazy(() =>
  import("@/components/RouteRentabilityReport").then((m) => ({ default: m.RouteRentabilityReport })),
);

// Loading fallback for chart components
const ChartLoader = () => (
  <div className="flex items-center justify-center p-12 min-h-[300px]">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
    <span className="ml-2 text-muted-foreground">Carregando gráficos...</span>
  </div>
);

const ProducerDashboard = () => {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  const [freights, setFreights] = useState<any[]>([]);
  const [proposals, setProposals] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("open");
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
  const [freightPayments, setFreightPayments] = useState<any[]>([]);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const [servicesModalOpen, setServicesModalOpen] = useState(false);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [ongoingServiceRequests, setOngoingServiceRequests] = useState<any[]>([]);
  const [urgencyFilter, setUrgencyFilter] = useState<"all" | "critical" | "urgent">("all");

  // Estado para controlar avaliações automáticas
  const [activeFreightForRating, setActiveFreightForRating] = useState<any>(null);

  // Estados para aba de relatórios
  const [filters] = useState<FreightFilters>({
    sortBy: "date",
    sortOrder: "desc",
  });

  // Contador de mensagens não lidas
  const { unreadCount: chatUnreadCount } = useUnreadChatsCount(profile?.id || "", "PRODUTOR");

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
      const { data, error } = await (supabase as any)
        .from("freights")
        .select(
          `
          *,
          profiles!driver_id(
            id,
            full_name,
            contact_phone,
            email,
            role
          )
        `,
        )
        .eq("producer_id", profile.id)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) {
        toast.error("Erro ao carregar fretes");
        showErrorToast(toast, "Erro ao carregar fretes", error);
        return;
      }

      if (!data || data.length === 0) {
        setFreights([]);
        return;
      }

      let finalData = (data || []).map((freight: any) => {
        if (freight.status === "DELIVERED_PENDING_CONFIRMATION") {
          const deliveredDate = freight.updated_at || freight.created_at;
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

          return { ...freight, deliveryDeadline: { hoursRemaining, isUrgent, isCritical, displayText } };
        }
        return freight;
      });

      // fallback para não “sumir” pending-confirmation
      if (finalData.every((f: any) => f.status !== "DELIVERED_PENDING_CONFIRMATION")) {
        const { data: dpcData, error: dpcError } = await (supabase as any)
          .from("freights")
          .select(
            `
            *,
            profiles!driver_id(
              id,
              full_name,
              contact_phone,
              email,
              role
            )
          `,
          )
          .eq("producer_id", profile.id)
          .eq("status", "DELIVERED_PENDING_CONFIRMATION")
          .order("updated_at", { ascending: false })
          .limit(50);

        if (!dpcError && dpcData?.length) {
          const existingIds = new Set(finalData.map((f: any) => f.id));
          finalData = [...finalData, ...dpcData.filter((f: any) => !existingIds.has(f.id))];
        }
      }

      setFreights(finalData);
    } catch (err) {
      toast.error("Erro ao carregar fretes");
      showErrorToast(toast, "Erro ao carregar fretes", err);
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
          driver:profiles!freight_proposals_driver_id_fkey(*)
        `,
        )
        .in("freight_id", freightIds)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setProposals(data || []);
    } catch {
      toast.error("Erro ao carregar propostas");
    }
  }, [profile?.id, profile?.role]);

  // ✅ Buscar pagamentos externos
  // ✅ Buscar pagamentos externos com mapeamento de status
  const fetchExternalPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== "PRODUTOR") return;

    try {
      const { data, error } = await supabase
        .from("external_payments")
        .select(
          `
          *,
          freight:freights(
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
          ),
          driver:profiles!external_payments_driver_id_fkey(
            id,
            full_name,
            contact_phone,
            profile_photo_url
          )
        `,
        )
        .eq("producer_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[fetchExternalPayments] Erro Supabase:", {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        
        // Mensagem específica baseada no tipo de erro
        if (error.code === "42501" || error.message?.includes("permission")) {
          toast.error("Você não tem permissão para visualizar pagamentos.");
        } else if (error.code === "PGRST301") {
          toast.error("Sessão expirada. Por favor, faça login novamente.");
        }
        // Outros erros silenciosos - não mostrar toast para evitar spam
        
        setExternalPayments([]);
        return;
      }

      // ✅ Mapear status do banco para UI
      // Banco: proposed, paid_by_producer, confirmed, rejected, cancelled
      // UI: proposed, paid_by_producer, completed (confirmed mapeado)
      const mappedData = (data || []).map((payment: any) => ({
        ...payment,
        // Mapear 'confirmed' do banco para 'completed' na UI
        status: payment.status === 'confirmed' ? 'completed' : payment.status
      }));

      setExternalPayments(mappedData);
    } catch (e) {
      console.error("[fetchExternalPayments] Erro inesperado:", e);
      setExternalPayments([]);
    }
  }, [profile?.id, profile?.role]);

  // ✅ Buscar pagamentos de fretes (Stripe/interno)
  const fetchFreightPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== "PRODUTOR") return;

    try {
      const { data, error } = await supabase
        .from("freight_payments")
        .select("*")
        .eq("payer_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[fetchFreightPayments] Erro Supabase:", {
          code: error.code,
          message: error.message,
          details: error.details
        });
        
        if (error.code === "42501" || error.message?.includes("permission")) {
          toast.error("Você não tem permissão para visualizar pagamentos de fretes.");
        }
        
        setFreightPayments([]);
        return;
      }
      setFreightPayments(data || []);
    } catch (e) {
      console.error("[fetchFreightPayments] Erro inesperado:", e);
      setFreightPayments([]);
    }
  }, [profile?.id, profile?.role]);

  // ✅ Buscar service_requests ABERTAS (inclui FRETE_MOTO)
  const fetchServiceRequests = useCallback(async () => {
    if (!profile?.id || profile.role !== "PRODUTOR") return;

    try {
      const { data, error } = await supabase
        .from("service_requests")
        .select("*")
        .eq("client_id", profile.id)
        .eq("status", "OPEN")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setServiceRequests(data || []);
    } catch {
      toast.error("Erro ao carregar serviços");
    }
  }, [profile?.id, profile?.role]);

  // ✅ Buscar service_requests EM ANDAMENTO
  const fetchOngoingServiceRequests = useCallback(async () => {
    if (!profile?.id || profile.role !== "PRODUTOR") return;

    try {
      const { data, error } = await supabase
        .from("service_requests")
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

    setActiveTab("open");

    refetch();
    setTimeout(refetch, 700);
    setTimeout(refetch, 1800);
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
          fetchFreightPayments(),
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
    fetchFreightPayments,
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
  const debouncedFetchFreightPayments = useMemo(
    () => makeDebounced(fetchFreightPayments, 300),
    [makeDebounced, fetchFreightPayments],
  );
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

          if (newStatus === "DELIVERED" && oldStatus !== "DELIVERED") {
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
                .from("ratings")
                .select("id")
                .eq("freight_id", (freightData as any).id)
                .eq("rater_user_id", profile.id)
                .maybeSingle();

              if (!existingRating) setActiveFreightForRating(freightData);
            }
          }
        },
      )
      .subscribe();

    const channel = supabase
      .channel("realtime-producer-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "freights" }, () => debouncedFetchFreights())
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_proposals" }, () =>
        debouncedFetchProposals(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "external_payments" }, () =>
        debouncedFetchExternalPayments(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "freight_payments" }, () =>
        debouncedFetchFreightPayments(),
      )
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
    debouncedFetchFreightPayments,
    debouncedFetchServiceRequests,
    debouncedFetchOngoingServiceRequests,
  ]);

  // ✅ Estatísticas
  const statistics = useMemo(() => {
    const pendingExternalPayments = externalPayments.filter((p) => p.status === "proposed").length;
    const pendingFreightPayments = freightPayments.filter((p) => p.status === "PENDING").length;
    const totalPendingPayments = pendingExternalPayments + pendingFreightPayments;

    const totalPendingAmount =
      externalPayments.filter((p) => p.status === "proposed").reduce((sum, p) => sum + (p.amount || 0), 0) +
      freightPayments.filter((p) => p.status === "PENDING").reduce((sum, p) => sum + (p.amount || 0), 0);

    const openServices = serviceRequests.length;
    const ongoingFreights = freights.filter((f) => isInProgressFreight(f.pickup_date, f.status));

    return {
      openFreights: freights.filter((f) => f.status === "OPEN").length + openServices,
      activeFreights: ongoingFreights.length + ongoingServiceRequests.length,
      pendingConfirmation: freights.filter((f) => f.status === "DELIVERED_PENDING_CONFIRMATION").length,
      totalValue: freights.reduce((sum, f) => sum + (f.price || 0), 0),
      pendingProposals: proposals.length,
      pendingPayments: totalPendingPayments,
      totalPendingAmount,
      openServices,
    };
  }, [freights, proposals, externalPayments, freightPayments, serviceRequests, ongoingServiceRequests]);

  // ✅ Ações
  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (e) {
      console.error("Erro ao fazer logout:", e);
      toast.error("Erro ao fazer logout");
    }
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

  const confirmCancelFreight = async () => {
    if (!freightToCancel) return;

    const canCancelDirectly = ["OPEN", "ACCEPTED", "LOADING"].includes(freightToCancel.status);
    if (!canCancelDirectly) {
      toast.error("Este frete está em andamento. Solicite o cancelamento via chat com o motorista.");
      setConfirmDialogOpen(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("cancel-freight-safe", {
        body: { freight_id: freightToCancel.id, reason: "Cancelado pelo produtor" },
      });

      if (error) throw error;
      if (!(data as any)?.success) throw new Error((data as any)?.error || "Erro ao cancelar frete");

      toast.success("Frete cancelado com sucesso!");
      setConfirmDialogOpen(false);
      setFreightToCancel(null);
      fetchFreights();
    } catch (e: any) {
      console.error("Error cancelling freight:", e);
      toast.error(e?.message || "Erro ao cancelar frete");
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

  const requestFullPayment = async (_freightId: string, _driverId: string, _amount: number) => {
    // mantido só para não quebrar compilação se você ainda chama em outro ponto
    // (se quiser, eu integro com seu fluxo de payments completo depois)
  };

  const handleDeliveryConfirmed = () => {
    if (freightToConfirm && freightToConfirm.profiles) {
      setTimeout(() => {
        requestFullPayment(freightToConfirm.id, freightToConfirm.profiles.id, freightToConfirm.price);
      }, 1000);

      if (freightToConfirm.profiles?.id) {
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("show-freight-rating", {
              detail: {
                freightId: freightToConfirm.id,
                ratedUserId: freightToConfirm.profiles.id,
                ratedUserName: freightToConfirm.profiles.full_name,
              },
            }),
          );
        }, 500);
      }
    }

    fetchFreights();
    fetchExternalPayments();
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
      const { error } = await supabase
        .from("external_payments")
        .update({ 
          status: "paid_by_producer",
          updated_at: new Date().toISOString()
        })
        .eq("id", paymentId)
        .eq("producer_id", profile.id); // RLS adicional: só o produtor pode atualizar

      if (error) {
        console.error("[confirmPaymentMade] Erro ao confirmar pagamento:", error);
        if (error.code === "42501" || error.message?.includes("permission")) {
          toast.error("Você não tem permissão para confirmar este pagamento.");
        } else {
          toast.error(`Erro ao confirmar pagamento: ${error.message}`);
        }
        return;
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/5 to-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // ✅ Ongoing freights list (reuso)
  const ongoingFreights = freights.filter((f) => isInProgressFreight(f.pickup_date, f.status));

  return (
    <div className="h-screen bg-gradient-to-br from-background via-secondary/5 to-background overflow-x-hidden overflow-y-auto">
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
      <section className="relative min-h-[250px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-fade-in"
          style={{ backgroundImage: `url(${HERO_BG_DESKTOP})` }}
        />
        <div className="absolute inset-0 bg-primary/75" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">Painel de Gerenciamento</h1>
            <p className="text-base opacity-90 max-w-xl mx-auto mb-4">
              Gerencie seus fretes, acompanhe propostas e monitore o desempenho
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <CreateFreightWizardModal onFreightCreated={fetchFreights} userProfile={profile} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("proposals")}
                className="bg-white/20 text-white border-white/50 hover:bg-white/30 font-semibold rounded-full px-4 py-2 w-full sm:w-auto shadow-lg backdrop-blur-sm transition-all duration-200"
              >
                <Users className="mr-1 h-4 w-4" />
                Ver Propostas
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setServicesModalOpen(true)}
                className="bg-white/20 text-white border-white/50 hover:bg-white/30 font-semibold rounded-full px-4 py-2 w-full sm:w-auto shadow-lg backdrop-blur-sm transition-all duration-200"
              >
                <Wrench className="mr-1 h-4 w-4" />
                Solicitar Serviços
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("ratings")}
                className="bg-white/20 text-white border-white/50 hover:bg-white/30 font-semibold rounded-full px-4 py-2 w-full sm:w-auto shadow-lg backdrop-blur-sm transition-all duration-200"
              >
                <Star className="mr-1 h-4 w-4" />
                Avaliações
              </Button>
            </div>
          </div>
        </div>
      </section>

      <div className="container max-w-7xl mx-auto py-4 px-4 pb-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
          <StatsCard
            size="sm"
            icon={<Package className="h-5 w-5" />}
            iconColor="text-blue-500"
            label="Abertos"
            value={statistics.openFreights}
            onClick={() => setActiveTab("open")}
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
            onClick={() => setActiveTab("open")}
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
            <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-card p-1 text-muted-foreground min-w-fit">
              <TabsTrigger
                value="open"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Package className="h-3 w-3 mr-1" />
                Abertos
                {statistics.openFreights > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {statistics.openFreights}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="fiscal"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <FileText className="h-3 w-3 mr-1" />
                Fiscal
              </TabsTrigger>

              <TabsTrigger
                value="ongoing"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Play className="h-3 w-3 mr-1" />
                Em Andamento
              </TabsTrigger>

              <TabsTrigger
                value="confirm-delivery"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Clock className="h-3 w-3 mr-1" />
                Confirmar Entrega
                {statistics.pendingConfirmation > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 w-4 p-0 text-xs">
                    {statistics.pendingConfirmation}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="proposals"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Users className="h-3 w-3 mr-1" />
                Propostas
              </TabsTrigger>

              <TabsTrigger
                value="scheduled"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Calendar className="h-3 w-3 mr-1" />
                Agendados
              </TabsTrigger>

              <TabsTrigger
                value="history"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Histórico
              </TabsTrigger>

              <TabsTrigger
                value="payments"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Pagamentos
              </TabsTrigger>

              <TabsTrigger
                value="ratings"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <Star className="h-3 w-3 mr-1" />
                Avaliações
              </TabsTrigger>

              <TabsTrigger
                value="chat"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <MessageCircle className="h-3 w-3 mr-1" />
                Chat
                {chatUnreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 px-1 text-xs">
                    {chatUnreadCount}
                  </Badge>
                )}
              </TabsTrigger>

              <TabsTrigger
                value="reports"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-sm px-2 py-1.5 text-xs font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                <BarChart className="h-3 w-3 mr-1" />
                Relatórios
              </TabsTrigger>
            </TabsList>
          </div>

          <SubscriptionExpiryNotification />

          {/* ✅ ABA ABERTOS */}
          <TabsContent value="open" className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Fretes e Serviços Abertos</h3>
            </div>

            {freights.filter((f) => f.status === "OPEN").length === 0 && serviceRequests.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Nenhum frete ou serviço aberto</h3>
                  <p className="text-muted-foreground mb-6 max-w-sm">
                    Você não possui fretes ou serviços abertos no momento. Crie um novo frete para começar.
                  </p>
                  <CreateFreightWizardModal onFreightCreated={fetchFreights} userProfile={profile} />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Fretes OPEN */}
                {freights.filter((f) => f.status === "OPEN").length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                      <Truck className="h-4 w-4" />
                      Fretes ({freights.filter((f) => f.status === "OPEN").length})
                    </h4>
                    <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
                      {freights
                        .filter((f) => f.status === "OPEN")
                        .map((freight) => (
                          <FreightCard
                            key={freight.id}
                            freight={{
                              id: freight.id,
                              cargo_type: freight.cargo_type,
                              weight: freight.weight ? freight.weight / 1000 : 0,
                              distance_km: freight.distance_km,
                              origin_address: freight.origin_address,
                              destination_address: freight.destination_address,
                              price: freight.price,
                              status: freight.status,
                              pickup_date: freight.pickup_date,
                              delivery_date: freight.delivery_date,
                              urgency: freight.urgency,
                              minimum_antt_price: freight.minimum_antt_price || 0,
                              required_trucks: freight.required_trucks || 1,
                              accepted_trucks: freight.accepted_trucks || 0,
                              service_type: freight.service_type,
                            }}
                            showProducerActions
                            onAction={(action) => handleFreightAction(action as any, freight)}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {/* ✅ Service Requests OPEN (inclui FRETE_MOTO) */}
                {serviceRequests.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-muted-foreground flex items-center gap-2">
                      <Wrench className="h-4 w-4" />
                      Solicitações de Serviço ({serviceRequests.length})
                    </h4>

                    <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
                      {serviceRequests.map((sr: any) => (
                        <Card
                          key={sr.id}
                          className="hover:shadow-lg transition-all duration-300 border-2 border-border/60 overflow-hidden"
                        >
                          <div
                            className={`p-4 ${
                              sr.service_type === "GUINCHO"
                                ? "bg-gradient-to-r from-orange-500/10 to-orange-600/5"
                                : sr.service_type === "FRETE_MOTO"
                                  ? "bg-gradient-to-r from-purple-500/10 to-purple-600/5"
                                  : "bg-gradient-to-r from-blue-500/10 to-blue-600/5"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`p-2 rounded-full ${
                                    sr.service_type === "GUINCHO"
                                      ? "bg-orange-100 dark:bg-orange-900/30"
                                      : sr.service_type === "FRETE_MOTO"
                                        ? "bg-purple-100 dark:bg-purple-900/30"
                                        : "bg-blue-100 dark:bg-blue-900/30"
                                  }`}
                                >
                                  {sr.service_type === "GUINCHO" ? (
                                    <Wrench className="h-5 w-5 text-orange-600" />
                                  ) : sr.service_type === "FRETE_MOTO" ? (
                                    <Bike className="h-5 w-5 text-purple-600" />
                                  ) : (
                                    <Package className="h-5 w-5 text-blue-600" />
                                  )}
                                </div>
                                <div>
                                  <h3 className="font-bold text-foreground">
                                    {sr.service_type === "GUINCHO"
                                      ? "Guincho"
                                      : sr.service_type === "FRETE_MOTO"
                                        ? "Frete por Moto"
                                        : sr.service_type}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">Solicitação #{sr.id?.slice(0, 8)}</p>
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300"
                              >
                                Aguardando
                              </Badge>
                            </div>
                          </div>

                          <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2 text-sm">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span className="font-medium">
                                {sr.city_name || sr.location_address || "Local não informado"}
                                {sr.state && ` - ${sr.state}`}
                              </span>
                            </div>

                            {sr.problem_description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">{sr.problem_description}</p>
                            )}

                            {sr.estimated_price && (
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-green-600" />
                                <span className="font-bold text-green-600">
                                  R$ {Number(sr.estimated_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground">Criado em: {formatDate(sr.created_at)}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
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
                      {ongoingServiceRequests.map((sr: any) => (
                        <Card key={sr.id} className="border-l-4 border-l-primary">
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {sr.service_type === "GUINCHO" && <Truck className="h-5 w-5 text-orange-500" />}
                                {sr.service_type === "FRETE_MOTO" && <Bike className="h-5 w-5 text-blue-500" />}
                                {sr.service_type !== "GUINCHO" && sr.service_type !== "FRETE_MOTO" && (
                                  <Package className="h-5 w-5 text-purple-500" />
                                )}
                                <span className="font-semibold">
                                  {sr.service_type === "GUINCHO"
                                    ? "Guincho"
                                    : sr.service_type === "FRETE_MOTO"
                                      ? "Frete por Moto"
                                      : sr.service_type}
                                </span>
                              </div>

                              <Badge
                                variant={
                                  sr.status === "ACCEPTED"
                                    ? "default"
                                    : sr.status === "ON_THE_WAY"
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {sr.status === "ACCEPTED"
                                  ? "Aceito"
                                  : sr.status === "ON_THE_WAY"
                                    ? "A caminho"
                                    : sr.status === "IN_PROGRESS"
                                      ? "Em progresso"
                                      : sr.status}
                              </Badge>
                            </div>

                            <div className="text-sm text-muted-foreground space-y-1 mb-3">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate">{sr.location_address || sr.city_name}</span>
                              </div>
                              {sr.accepted_at && (
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  <span>Aceito em {formatDate(sr.accepted_at)}</span>
                                </div>
                              )}
                            </div>

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
                          </CardContent>
                        </Card>
                      ))}
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

          {/* ✅ CONFIRMAR ENTREGA */}
          <TabsContent value="confirm-delivery" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Confirmar Entregas</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={urgencyFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter("all")}
                >
                  Todos ({freights.filter((f) => f.status === "DELIVERED_PENDING_CONFIRMATION").length})
                </Button>
                <Button
                  variant={urgencyFilter === "critical" ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter("critical")}
                >
                  🚨 Críticos (
                  {
                    freights.filter(
                      (f) =>
                        f.status === "DELIVERED_PENDING_CONFIRMATION" && (f.deliveryDeadline?.hoursRemaining ?? 72) < 6,
                    ).length
                  }
                  )
                </Button>
                <Button
                  variant={urgencyFilter === "urgent" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUrgencyFilter("urgent")}
                  className={urgencyFilter === "urgent" ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                  ⚠️ Urgentes (
                  {
                    freights.filter((f) => {
                      const h = f.deliveryDeadline?.hoursRemaining ?? 72;
                      return f.status === "DELIVERED_PENDING_CONFIRMATION" && h < 24 && h >= 6;
                    }).length
                  }
                  )
                </Button>
              </div>
            </div>

            {freights.filter((f) => f.status === "DELIVERED_PENDING_CONFIRMATION").length === 0 ? (
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
                  {freights
                    .filter((f) => {
                      if (f.status !== "DELIVERED_PENDING_CONFIRMATION") return false;
                      const hours = f.deliveryDeadline?.hoursRemaining ?? 72;
                      if (urgencyFilter === "all") return true;
                      if (urgencyFilter === "critical") return hours < 6;
                      if (urgencyFilter === "urgent") return hours < 24 && hours >= 6;
                      return true;
                    })
                    .sort(
                      (a, b) => (a.deliveryDeadline?.hoursRemaining ?? 72) - (b.deliveryDeadline?.hoursRemaining ?? 72),
                    )
                    .map((freight) => (
                      <Card
                        key={freight.id}
                        className="h-full flex flex-col border-amber-200 bg-amber-50/50 border-l-4 border-l-amber-500"
                      >
                        <CardHeader className="pb-4">
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-2 flex-1 min-w-0">
                              <h4 className="font-semibold text-lg line-clamp-1">{freight.cargo_type}</h4>
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {freight.origin_address} → {freight.destination_address}
                              </p>

                              {freight.deliveryDeadline && (
                                <div
                                  className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                                    freight.deliveryDeadline.isCritical
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                      : freight.deliveryDeadline.isUrgent
                                        ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400"
                                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  }`}
                                >
                                  <Clock className="h-3 w-3" />
                                  {freight.deliveryDeadline.displayText}
                                </div>
                              )}

                              <p className="text-xs font-medium text-amber-700 mt-2">
                                ⏰ Entrega reportada - Aguardando confirmação
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0 space-y-2">
                              <Badge
                                variant="secondary"
                                className="bg-amber-100 text-amber-800 border-amber-300 whitespace-nowrap"
                              >
                                Aguardando Confirmação
                              </Badge>
                              <p className="text-lg font-bold text-green-600 whitespace-nowrap">
                                R$ {formatBRL(freight.price)}
                              </p>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="flex flex-col gap-4 h-full pt-0">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="min-w-0">
                              <p className="font-medium text-xs text-muted-foreground">Motorista:</p>
                              <p className="text-foreground truncate">
                                {freight.profiles?.full_name || "Aguardando motorista"}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-xs text-muted-foreground">Telefone:</p>
                              <p className="text-foreground truncate">{freight.profiles?.contact_phone || "-"}</p>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-xs text-muted-foreground">Reportado em:</p>
                              <p className="text-foreground text-xs">
                                {new Date(freight.updated_at).toLocaleString("pt-BR")}
                              </p>
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-xs text-muted-foreground">Prazo confirmação:</p>
                              <p className="text-foreground text-xs">72h após reportado</p>
                            </div>
                          </div>

                          <div className="mt-auto grid grid-cols-2 gap-3">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => setSelectedFreightDetails(freight)}
                            >
                              <Eye className="h-4 w-4 mr-1.5" />
                              Ver Detalhes
                            </Button>
                            <Button
                              size="sm"
                              className="w-full bg-green-600 hover:bg-green-700"
                              onClick={() => openDeliveryConfirmationModal(freight)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1.5" />
                              Confirmar Entrega
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="proposals" className="space-y-4">
            <FreightProposalsManager
              producerId={profile?.id || ""}
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
            <UnifiedHistory userRole="PRODUTOR" />
          </TabsContent>

          <TabsContent value="ratings" className="mt-6">
            <PendingRatingsPanel userRole="PRODUTOR" userProfileId={profile?.id || ""} />
          </TabsContent>

          <TabsContent value="chat" className="space-y-4">
            <UnifiedChatHub userProfileId={profile?.id} userRole="PRODUTOR" />
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            <ProducerReportsTab />
          </TabsContent>

          <TabsContent value="payments" className="space-y-4">
            <ProducerPaymentsTab
              externalPayments={externalPayments}
              freightPayments={freightPayments}
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
        description="Tem certeza que deseja cancelar este frete? Esta ação não pode ser desfeita."
        confirmText="Sim, cancelar"
        cancelText="Não, manter"
        variant="destructive"
      />

      <Dialog open={!!selectedFreightDetails} onOpenChange={(open) => !open && setSelectedFreightDetails(null)}>
        <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto">
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
    </div>
  );
};

export default ProducerDashboard;
