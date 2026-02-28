import React, { useState, useEffect, useTransition, useMemo, useRef, useCallback } from "react";
import { devLog } from '@/lib/devLogger';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCargoTypesByCategory } from "@/lib/cargo-types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { FreightCard } from "@/components/FreightCard";
import {
  Brain,
  RefreshCw,
  Search,
  Zap,
  Package,
  Truck,
  Wrench,
  MapPin,
  MessageSquare,
  Clock,
  DollarSign,
  Bike,
  PawPrint,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanyDriver } from "@/hooks/useCompanyDriver";
import { useDriverPermissions } from "@/hooks/useDriverPermissions";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-handler";
import { SafeListWrapper } from "@/components/SafeListWrapper";
import {
  normalizeServiceType,
  type CanonicalServiceType,
} from "@/lib/service-type-normalization";
import { useDriverFreightVisibility } from "@/hooks/useDriverFreightVisibility";
import { subscriptionWithRetry } from "@/lib/query-utils";
import { debounce } from "@/lib/utils";
import { resolveDriverUnitPrice } from '@/hooks/useFreightCalculator';
import { formatSolicitadoHa } from "@/lib/formatters";
import { runFeedIntegrityGuard } from '@/security/feedIntegrityGuard';
import { useGuaranteedMarketplaceFeed } from '@/hooks/useGuaranteedMarketplaceFeed';
import { MarketplaceFilters, ExpiryBadge, DEFAULT_FILTERS, type MarketplaceFiltersState } from '@/components/MarketplaceFilters';
import { useRouteCorridors } from '@/hooks/useRouteCorridors';

interface CompatibleFreight {
  freight_id: string;
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
  urgency: string;
  status: string;
  service_type: CanonicalServiceType;
  distance_km: number;
  minimum_antt_price: number;
  required_trucks: number;
  accepted_trucks: number;
  created_at: string;
  vehicle_type_required?: string;
  vehicle_axles_required?: number;
  pricing_type?: string;
  price_per_km?: number;
  producer_id?: string | null;
}

interface AdvancedSearchFilters {
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  max_distance_km?: number;
  route_corridor?: string;
  scheduled_only?: boolean;
  urgent_only?: boolean;
  cargo_categories?: string[];
  min_weight?: number;
  max_weight?: number;
  hazardous_cargo?: boolean;
  live_cargo?: boolean;
  refrigerated?: boolean;
  min_price?: number;
  max_price?: number;
  advance_payment_available?: boolean;
  vehicle_types?: string[];
  min_axles?: number;
  max_axles?: number;
  trusted_producers_only?: boolean;
  minimum_rating?: number;
  has_insurance?: boolean;
}

interface SmartFreightMatcherProps {
  onFreightAction?: (freightId: string, action: string) => void;
  onCountsChange?: (counts: { total: number; highUrgency: number }) => void;
  advancedFilters?: AdvancedSearchFilters | null;
}

export const SmartFreightMatcher: React.FC<SmartFreightMatcherProps> = ({ onFreightAction, onCountsChange, advancedFilters }) => {
  const { profile, user } = useAuth();
  const { findById: findCorridorById } = useRouteCorridors();
  const { isAffiliated, companyId } = useCompanyDriver();
  const { canAcceptFreights, companyId: permissionCompanyId } = useDriverPermissions();
  const { fetchAvailableMarketplaceItems } = useGuaranteedMarketplaceFeed();

  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [towingRequests, setTowingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCargoType, setSelectedCargoType] = useState<string>("all");
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("all");
  const [marketplaceFilters, setMarketplaceFilters] = useState<MarketplaceFiltersState>(DEFAULT_FILTERS);

  const [matchingStats, setMatchingStats] = useState({ exactMatches: 0, fallbackMatches: 0, totalChecked: 0 });
  const [hasActiveCities, setHasActiveCities] = useState<boolean | null>(null);

  const [isUpdating, setIsUpdating] = useState(false);
  const [, startTransition] = useTransition();

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const updateLockRef = useRef(false);
  const fetchIdRef = useRef(0);
  const lastFetchAtRef = useRef(0);
  // ✅ CRITICAL FIX: Refs para callbacks externos — evita deps instáveis no fetch
  const onCountsChangeRef = useRef(onCountsChange);
  onCountsChangeRef.current = onCountsChange;

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const {
    normalizedServiceTypes: allowedTypesFromProfile,
    hasRuralFreights,
    hasUrbanFreights,
    showTabSelector,
    canSeeFreightByType,
  } = useDriverFreightVisibility({
    serviceTypes: profile?.service_types,
    // Alinhar com backend autoritativo: quando vazio, assumir CARGA (evita ocultar fretes elegíveis)
    defaultToRuralWhenEmpty: true,
  });

  const fetchCompatibleFreights = useCallback(async () => {
    if (!profile?.id || !user?.id) return;

    // ✅ CRITICAL FIX: Guard de frequência — mín 2s entre fetches
    const now = Date.now();
    if (now - lastFetchAtRef.current < 2000) {
      devLog("[SmartFreightMatcher] Fetch throttled (< 2s)");
      return;
    }

    if (updateLockRef.current) {
      devLog("[SmartFreightMatcher] Fetch já em andamento, ignorando...");
      return;
    }
    lastFetchAtRef.current = now;

    const currentFetchId = ++fetchIdRef.current;
    updateLockRef.current = true;

    try {
      setLoading(true);

      if (abortControllerRef.current) abortControllerRef.current.abort();
      abortControllerRef.current = new AbortController();

      const resolvedMode = String(profile?.active_mode || profile?.role || '').toUpperCase();
      const driverPanelRole = resolvedMode === 'MOTORISTA_AFILIADO'
        ? 'MOTORISTA_AFILIADO'
        : 'MOTORISTA';

      // ✅ FONTE ÚNICA: usa hook autoritativo (get_authoritative_feed)
      // Quando busca avançada ativa, pula filtro de cidade para ampliar resultados
      const hasAdvancedFilters = !!advancedFilters && (
        !!advancedFilters.origin_city || !!advancedFilters.destination_city ||
        !!advancedFilters.route_corridor || (advancedFilters.cargo_categories?.length ?? 0) > 0 ||
        (advancedFilters.vehicle_types?.length ?? 0) > 0 || !!advancedFilters.urgent_only ||
        (advancedFilters.min_price ?? 0) > 0 || (advancedFilters.max_price ?? 50000) < 50000
      );

      const result = await fetchAvailableMarketplaceItems({
        profile,
        roleOverride: driverPanelRole,
        debug: import.meta.env.DEV,
        filterTypes: marketplaceFilters.selectedTypes.length > 0 ? marketplaceFilters.selectedTypes : undefined,
        filterExpiryBucket: marketplaceFilters.expiryBucket !== 'ALL' ? marketplaceFilters.expiryBucket : undefined,
        filterSort: marketplaceFilters.sort,
        skipCityFilter: hasAdvancedFilters,
      });

      const unifiedFreights: CompatibleFreight[] = (result.freights || []).map((f: any) => ({
        freight_id: f.id || f.freight_id,
        cargo_type: f.cargo_type || '',
        weight: Number(f.weight || 0),
        origin_address: f.origin_address || `${f.origin_city || ""}, ${f.origin_state || ""}`,
        destination_address: f.destination_address || `${f.destination_city || ""}, ${f.destination_state || ""}`,
        origin_city: f.origin_city,
        origin_state: f.origin_state,
        destination_city: f.destination_city,
        destination_state: f.destination_state,
        pickup_date: String(f.pickup_date || ''),
        delivery_date: String(f.delivery_date || ''),
        price: Number(f.price || 0),
        urgency: String(f.urgency || 'LOW'),
        status: String(f.status || 'OPEN'),
        service_type: normalizeServiceType(f.service_type),
        distance_km: Number(f.distance_km || 0),
        minimum_antt_price: Number(f.minimum_antt_price || 0),
        required_trucks: Number(f.required_trucks || 1),
        accepted_trucks: Number(f.accepted_trucks || 0),
        created_at: String(f.created_at || ''),
        producer_id: f.producer_id || null,
      }));

      const unifiedServices = (result.serviceRequests || []).filter((s: any) => {
        const canonical = normalizeServiceType(String(s.service_type || ''));
        return canSeeFreightByType(canonical) && canonical !== 'CARGA';
      });

      if (
        currentFetchId === fetchIdRef.current &&
        isMountedRef.current &&
        !abortControllerRef.current?.signal.aborted
      ) {
        setCompatibleFreights(unifiedFreights);
        setTowingRequests(unifiedServices);
        setHasActiveCities(unifiedFreights.length > 0 || unifiedServices.length > 0);

        const highUrgency = unifiedFreights.filter((f) => f.urgency === 'HIGH').length;
        onCountsChangeRef.current?.({ total: unifiedFreights.length + unifiedServices.length, highUrgency });

        setMatchingStats({
          exactMatches: result.metrics.feed_total_eligible,
          fallbackMatches: result.metrics.fallback_used ? 1 : 0,
          totalChecked: result.metrics.feed_total_eligible,
        });

        // ✅ INTEGRITY GUARD: verifica discrepâncias
        runFeedIntegrityGuard({
          scope: 'unified',
          backendEligible: result.metrics.feed_total_eligible,
          backendDisplayed: result.metrics.feed_total_displayed,
          renderedDisplayed: unifiedFreights.length + unifiedServices.length,
          fallbackUsed: result.metrics.fallback_used,
          role: result.metrics.role,
        });
      }
    } catch (error: any) {
      console.error("[SmartFreightMatcher] Erro ao buscar feed autoritativo:", error);
      if (isMountedRef.current) {
        showErrorToast(toast, "Erro ao carregar fretes", error);
      }
    } finally {
      updateLockRef.current = false;
      setLoading(false);
    }
  }, [profile?.id, profile?.role, profile?.active_mode, user?.id, allowedTypesFromProfile, canSeeFreightByType, fetchAvailableMarketplaceItems, marketplaceFilters, advancedFilters]);

  const handleFreightAction = async (freightId: string, action: string) => {
    if (onFreightAction) {
      onFreightAction(freightId, action);
      return;
    }

    if ((action === "propose" || action === "accept") && profile?.id) {
      try {
        const freight = compatibleFreights.find((f) => f.freight_id === freightId);
        if (!freight) return;

        // ✅ Bloquear proposta em fretes sem produtor cadastrado
        if (!(freight as any).producer_id) {
          toast.error("Este frete foi criado por um solicitante sem cadastro. Não é possível enviar proposta.");
          return;
        }

        const driverProfileId = await (async () => {
          const {
            data: { user: u },
          } = await supabase.auth.getUser();
          if (!u) return null;

          const { data, error } = await supabase
            .from("profiles")
            .select("id, role")
            .eq("user_id", u.id)
            .in("role", ["MOTORISTA", "MOTORISTA_AFILIADO"])
            .limit(1);

          if (error) throw error;
          return data?.[0]?.id ?? profile.id;
        })();

        if (!driverProfileId) {
          toast.error("Você precisa de um perfil de Motorista para enviar propostas.");
          return;
        }

        const { data: existing, error: existingError } = await supabase
          .from("freight_proposals")
          .select("status")
          .eq("freight_id", freightId)
          .eq("driver_id", driverProfileId)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing && (existing.status === "PENDING" || existing.status === "ACCEPTED")) {
          toast.info(
            existing.status === "PENDING"
              ? "Você já enviou uma proposta para este frete. Aguarde a resposta do produtor."
              : "Sua proposta já foi aceita pelo produtor.",
          );
          return;
        }

        // ✅ Hook centralizado: resolveDriverUnitPrice para proposta unitária
        const requiredTrucks = Math.max(freight.required_trucks || 1, 1);
        const pricePerTruck = resolveDriverUnitPrice(0, freight.price || 0, requiredTrucks);

        const { error } = await supabase.from("freight_proposals").insert({
          freight_id: freightId,
          driver_id: driverProfileId,
          proposed_price: pricePerTruck, // ✅ Valor unitário por carreta
          status: "PENDING",
          message: action === "accept" ? "Aceito o frete pelo valor anunciado." : null,
        });

        if (error) throw error;

        toast.success(
          action === "accept" ? "Solicitação para aceitar o frete enviada!" : "Proposta enviada com sucesso!",
        );
        fetchCompatibleFreights();
      } catch (error: any) {
        showErrorToast(toast, "Erro ao processar ação", error);
      }
    }
  };

  // ✅ ATUALIZAÇÃO CONTROLADA: refresh no mount e a cada 10 minutos
  // Removido polling de segundos que causava spam de requests
  const AUTO_REFRESH_MS = 10 * 60 * 1000; // 10 minutos
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const autoRefreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // ✅ CRITICAL FIX: Ref para fetchCompatibleFreights — evita loop de deps no useEffect
  const fetchRef = useRef(fetchCompatibleFreights);
  fetchRef.current = fetchCompatibleFreights;

  // Refresh inicial — deps estáveis apenas (IDs primitivos)
  useEffect(() => {
    if (!profile?.id || !user?.id) return;
    fetchRef.current();
    setLastRefreshAt(new Date());
  }, [profile?.id, user?.id]);

  // ✅ Re-fetch quando busca avançada muda (skipCityFilter depende de advancedFilters)
  const advancedFiltersRef = useRef(advancedFilters);
  useEffect(() => {
    if (!profile?.id || !user?.id) return;
    // Só re-fetch se advancedFilters realmente mudou
    if (advancedFiltersRef.current !== advancedFilters) {
      advancedFiltersRef.current = advancedFilters;
      fetchRef.current();
    }
  }, [advancedFilters, profile?.id, user?.id]);
  
  // Auto-refresh a cada 10 minutos (sem dep em fetchCompatibleFreights)
  useEffect(() => {
    if (!profile?.id || !user?.id) return;
    
    const intervalId = setInterval(() => {
      if (isMountedRef.current && !updateLockRef.current) {
        devLog('[SmartFreightMatcher] Auto-refresh (10min)');
        fetchRef.current();
        setLastRefreshAt(new Date());
      }
    }, AUTO_REFRESH_MS);
    
    return () => clearInterval(intervalId);
  }, [profile?.id, user?.id]);
  
  // Realtime para user_cities (sem dep em fetchCompatibleFreights)
  useEffect(() => {
    if (!profile?.id || !user?.id) return;
    
    const { cleanup } = subscriptionWithRetry(
      "user-cities-changes",
      (ch) =>
        ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_cities", filter: `user_id=eq.${user.id}` },
          () => {
            if (!isMountedRef.current) return;
            toast.info("Suas cidades de atendimento foram atualizadas. Recarregando fretes...");
            fetchRef.current();
            setLastRefreshAt(new Date());
          },
        ),
      {
        maxRetries: 3,
        retryDelayMs: 5000,
        onError: (error) => {
          console.error("[SmartFreightMatcher] Realtime error (não crítico):", error);
        },
      },
    );

    return () => {
      cleanup();
    };
  }, [profile?.id, user?.id]);

  const filteredFreights = useMemo(() => {
    return compatibleFreights.filter((freight) => {
      const matchesSearch =
        !searchTerm ||
        (freight.cargo_type || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (freight.origin_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (freight.destination_address || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCargoType = selectedCargoType === "all" || freight.cargo_type === selectedCargoType;
      
      // Filtro por tipo de veículo
      const matchesVehicleType = selectedVehicleType === "all" || freight.service_type === selectedVehicleType;

      // ✅ BUSCA AVANÇADA: filtros adicionais quando advancedFilters está ativo
      let matchesAdvanced = true;
      if (advancedFilters) {
        // Filtro por cidade de origem
        if (advancedFilters.origin_city) {
          matchesAdvanced = matchesAdvanced && (freight.origin_city || '').toLowerCase().includes(advancedFilters.origin_city.toLowerCase());
        }
        // Filtro por cidade de destino
        if (advancedFilters.destination_city) {
          matchesAdvanced = matchesAdvanced && (freight.destination_city || '').toLowerCase().includes(advancedFilters.destination_city.toLowerCase());
        }
        // Filtro por corredor rodoviário (match por cidades de origem/destino)
        if (advancedFilters.route_corridor) {
          const corridor = findCorridorById(advancedFilters.route_corridor);
          if (corridor) {
            const originCity = (freight.origin_city || '').toLowerCase();
            const destCity = (freight.destination_city || '').toLowerCase();
            matchesAdvanced = matchesAdvanced && (
              (originCity === corridor.origin.name.toLowerCase() && destCity === corridor.destination.name.toLowerCase()) ||
              (originCity === corridor.destination.name.toLowerCase() && destCity === corridor.origin.name.toLowerCase())
            );
          }
        }
        // Filtro por distância
        if (advancedFilters.max_distance_km && advancedFilters.max_distance_km < 3000) {
          matchesAdvanced = matchesAdvanced && (freight.distance_km <= advancedFilters.max_distance_km);
        }
        // Filtro por urgência
        if (advancedFilters.urgent_only) {
          matchesAdvanced = matchesAdvanced && freight.urgency === 'HIGH';
        }
        // Filtro por categoria de carga
        if (advancedFilters.cargo_categories && advancedFilters.cargo_categories.length > 0) {
          matchesAdvanced = matchesAdvanced && advancedFilters.cargo_categories.some(cat =>
            (freight.cargo_type || '').toLowerCase().includes(cat.toLowerCase())
          );
        }
        // Filtro por preço
        if ((advancedFilters.min_price ?? 0) > 0) {
          matchesAdvanced = matchesAdvanced && freight.price >= (advancedFilters.min_price ?? 0);
        }
        if ((advancedFilters.max_price ?? 50000) < 50000) {
          matchesAdvanced = matchesAdvanced && freight.price <= (advancedFilters.max_price ?? 50000);
        }
        // Filtro por peso
        if ((advancedFilters.min_weight ?? 0) > 0) {
          matchesAdvanced = matchesAdvanced && freight.weight >= (advancedFilters.min_weight ?? 0);
        }
        if ((advancedFilters.max_weight ?? 100) < 100) {
          matchesAdvanced = matchesAdvanced && freight.weight <= (advancedFilters.max_weight ?? 100);
        }
      }
      
      return matchesSearch && matchesCargoType && matchesVehicleType && matchesAdvanced;
    });
  }, [compatibleFreights, searchTerm, selectedCargoType, selectedVehicleType, advancedFilters]);

  const filteredRequests = useMemo(() => {
    return towingRequests.filter((r: any) => {
      const matchesSearch =
        !searchTerm ||
        (r.location_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.problem_description || "").toLowerCase().includes(searchTerm.toLowerCase());
      
      // Filtro por tipo de veículo para service_requests
      const matchesVehicleType = selectedVehicleType === "all" || r.service_type === selectedVehicleType;
      
      return matchesSearch && matchesVehicleType;
    });
  }, [towingRequests, searchTerm, selectedVehicleType]);

  const showFreightTabs = showTabSelector;

  const [activeTab, setActiveTab] = useState<"freights" | "services">(
    hasRuralFreights ? "freights" : "services",
  );

  useEffect(() => {
    if (!hasRuralFreights && hasUrbanFreights && activeTab !== "services") {
      setActiveTab("services");
    }
    if (!hasUrbanFreights && hasRuralFreights && activeTab !== "freights") {
      setActiveTab("freights");
    }
  }, [hasRuralFreights, hasUrbanFreights, activeTab]);

  useEffect(() => {
    if (!onCountsChange) return;
    const total = filteredFreights.length + filteredRequests.length;
    const highUrgency = filteredFreights.filter((f) => f.urgency === "HIGH").length;
    onCountsChange({ total, highUrgency });
  }, [filteredFreights, filteredRequests, onCountsChange]);

  const getServiceTypeBadge = (serviceType: string) => {
    switch (serviceType) {
      case "CARGA":
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <Package className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Carga</span>
          </Badge>
        );
      case "MUDANCA":
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <Truck className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Mudança</span>
          </Badge>
        );
      case "GUINCHO":
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <Wrench className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Guincho</span>
          </Badge>
        );
      case "FRETE_MOTO":
        return (
          <Badge className="bg-teal-100 text-teal-800 border-teal-200 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <Bike className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Moto</span>
          </Badge>
        );
      case "ENTREGA_PACOTES":
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-200 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <Package className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Pacotes 📦</span>
          </Badge>
        );
      case "TRANSPORTE_PET":
        return (
          <Badge className="bg-purple-100 text-purple-800 border-purple-200 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <PawPrint className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Pet 🐾</span>
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="truncate max-w-fit whitespace-nowrap">
            {serviceType}
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Match Inteligente
            <Badge className="bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20">
              <Zap className="mr-1 h-3 w-3" />
              IA
            </Badge>
            {matchingStats.totalChecked > 0 && (
              <Badge variant="outline" className="ml-auto text-xs">
                🎯 {matchingStats.exactMatches} | 🗺️ {matchingStats.fallbackMatches}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Fretes selecionados automaticamente com base nas suas áreas e tipos de frete.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Tipos ativos + Ordenação em linha */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {profile?.service_types && (
              <>
                <span className="text-xs font-medium text-muted-foreground mr-1">Fretes:</span>
                {Array.from(
                  new Set((profile.service_types as unknown as string[]).map((t) => normalizeServiceType(String(t)))),
                ).map((serviceType: string) => (
                  <div key={serviceType}>{getServiceTypeBadge(serviceType)}</div>
                ))}
              </>
            )}
            <div className="ml-auto">
              <MarketplaceFilters
                filters={marketplaceFilters}
                onChange={(newFilters) => {
                  setMarketplaceFilters(newFilters);
                  setTimeout(() => fetchRef.current(), 100);
                }}
                showRpmSort={hasRuralFreights}
                showDistSort={hasRuralFreights}
              />
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por origem, destino ou carga..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="flex gap-2 flex-wrap sm:flex-nowrap items-center">
                <Button
                  variant="outline"
                  onClick={() => {
                    fetchCompatibleFreights();
                    setLastRefreshAt(new Date());
                  }}
                  disabled={loading}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">{loading ? 'Atualizando...' : 'Atualizar'}</span>
                </Button>
                {lastRefreshAt && !loading && (
                  <span className="text-xs text-muted-foreground hidden md:inline">
                    Atualizado às {lastRefreshAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* ✅ TABS DINÂMICAS: exibe conforme tipos de serviço do motorista */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "freights" | "services")}
        className="w-full"
      >
        {showFreightTabs && (
          <TabsList className="grid w-full grid-cols-2 mb-4">
            {hasRuralFreights && (
              <TabsTrigger value="freights" className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Fretes
                {filteredFreights.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {filteredFreights.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
            {hasUrbanFreights && (
              <TabsTrigger value="services" className="flex items-center gap-2">
                <Bike className="h-4 w-4" />
                Fretes Urbanos
                {filteredRequests.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {filteredRequests.length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>
        )}

        {!hasRuralFreights && !hasUrbanFreights && filteredFreights.length === 0 && filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <h3 className="font-semibold mb-2">Nenhum tipo de frete ativo</h3>
              <p className="text-muted-foreground">Ative pelo menos um tipo de frete para visualizar fretes compatíveis.</p>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : (
          <>
            {/* ABA FRETES */}
            <TabsContent value="freights" className="space-y-4">
              {filteredFreights.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-2">Nenhum frete disponível</h3>
                    <p className="text-muted-foreground mb-4">
                      {hasActiveCities === false
                        ? "Configure suas cidades de atendimento."
                        : "Não há fretes disponíveis no momento."}
                    </p>
                    <Button variant="outline" onClick={fetchCompatibleFreights}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Verificar Novamente
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <SafeListWrapper
                  fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando...</div>}
                >
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredFreights.map((freight) => (
                    <div key={freight.freight_id} className="relative h-full">
                      <FreightCard
                        freight={{
                          id: freight.freight_id,
                          cargo_type: freight.cargo_type,
                          weight: freight.weight || 0,
                          origin_address: freight.origin_address,
                          destination_address: freight.destination_address,
                          origin_city: freight.origin_city,
                          origin_state: freight.origin_state,
                          destination_city: freight.destination_city,
                          destination_state: freight.destination_state,
                          pickup_date: freight.pickup_date,
                          delivery_date: freight.delivery_date,
                          price: freight.price,
                          urgency: freight.urgency as "LOW" | "MEDIUM" | "HIGH",
                          status: "OPEN" as const,
                          distance_km: freight.distance_km,
                          minimum_antt_price: freight.minimum_antt_price,
                          required_trucks: freight.required_trucks,
                          accepted_trucks: freight.accepted_trucks,
                          service_type: freight.service_type as any,
                          vehicle_type_required: freight.vehicle_type_required,
                          vehicle_axles_required: freight.vehicle_axles_required,
                          pricing_type: freight.pricing_type as any,
                          price_per_km: freight.price_per_km,
                          producer_id: (freight as any).producer_id || null,
                        }}
                        onAction={(action) => handleFreightAction(freight.freight_id, action)}
                        showActions={true}
                        canAcceptFreights={canAcceptFreights}
                        isAffiliatedDriver={isAffiliated}
                        driverCompanyId={companyId || permissionCompanyId}
                      />
                    </div>
                  ))}
                </div>
              </SafeListWrapper>
            )}
            </TabsContent>

            {/* ABA SERVIÇOS */}
            <TabsContent value="services" className="space-y-4">
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Wrench className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="font-semibold mb-2">Nenhum frete urbano disponível</h3>
                  <p className="text-muted-foreground mb-4">Não há fretes urbanos disponíveis no momento.</p>
                  <Button variant="outline" onClick={fetchCompatibleFreights}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Verificar Novamente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <SafeListWrapper
                fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando...</div>}
              >
                <div className="space-y-3">
                  <h4 className="font-semibold text-lg flex items-center gap-2">
                    <Bike className="h-5 w-5 text-primary" />
                    Fretes Urbanos (Moto / Guincho / Mudança)
                  </h4>

                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredRequests.map((r: any) => (
                      <Card
                        key={r.id}
                        className="hover:shadow-lg transition-all duration-300 border-2 border-border/60 overflow-hidden"
                      >
                        <div className="p-4 bg-gradient-to-r from-blue-500/10 to-blue-600/5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                                {r.service_type === "GUINCHO" ? (
                                  <Wrench className="h-5 w-5 text-orange-600" />
                                ) : r.service_type === "FRETE_MOTO" ? (
                                  <Bike className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <Truck className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-bold text-foreground">
                                  {r.service_type === "GUINCHO"
                                    ? "Guincho"
                                    : r.service_type === "FRETE_MOTO"
                                      ? "Frete Moto"
                                      : r.service_type === "MUDANCA"
                                        ? "Mudança"
                                        : r.service_type === "TRANSPORTE_PET"
                                          ? "Transporte de Pet 🐾"
                                          : r.service_type === "ENTREGA_PACOTES"
                                            ? "Entrega de Pacotes 📦"
                                            : "Frete Urbano"}
                                </h3>
                                <p className="text-xs text-muted-foreground">Frete #{String(r.id).slice(0, 8)}</p>
                              </div>
                            </div>

                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                              Disponível
                            </Badge>
                          </div>
                        </div>

                        <CardContent className="p-4 space-y-4">
                          {/* ORIGEM */}
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500" />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                Origem
                              </span>
                            </div>
                            {(r.origin_city || r.city_name) && (
                              <p className="text-base font-bold text-foreground pl-4">
                                {String(r.origin_city || r.city_name).toUpperCase()} — {r.origin_state || r.state || ""}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground pl-4 line-clamp-2">
                              {r.origin_address || r.location_address || "Endereço não informado"}
                            </p>
                          </div>
                          
                          {/* DESTINO */}
                          {(() => {
                            // Extract destination from DB columns or additional_info fallback
                            const additionalInfo = typeof r.additional_info === 'string' 
                              ? (() => { try { return JSON.parse(r.additional_info); } catch { return null; } })() 
                              : r.additional_info;
                            const destCity = r.destination_city || additionalInfo?.destination?.city;
                            const destState = r.destination_state || additionalInfo?.destination?.state;
                            const destAddress = r.destination_address || additionalInfo?.destination?.full_address;
                            
                            return (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-red-500" />
                                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                    Destino
                                  </span>
                                </div>
                                {(destCity || destAddress) ? (
                                  <>
                                    {destCity && (
                                      <p className="text-base font-bold text-foreground pl-4">
                                        {String(destCity).toUpperCase()} — {destState || ""}
                                      </p>
                                    )}
                                    <p className="text-sm text-muted-foreground pl-4 line-clamp-2">
                                      {destAddress || "Endereço não informado"}
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-sm text-muted-foreground pl-4 italic">
                                    Destino não informado
                                  </p>
                                )}
                              </div>
                            );
                          })()}

                          {r.problem_description && (
                            <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                                  <p className="text-sm text-foreground line-clamp-3">{String(r.problem_description).replace(/\b[Ss]erviço\b/g, 'Frete').replace(/\b[Ss]olicitação de serviço\b/g, 'Solicitação de frete')}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {r.estimated_price && (
                            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-green-600" />
                                <span className="text-sm text-green-700 dark:text-green-300">Valor Estimado</span>
                              </div>
                              <span className="text-xl font-bold text-green-700 dark:text-green-300">
                                R$ {Number(r.estimated_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatSolicitadoHa(r.created_at)}</span>
                            </div>
                            <ExpiryBadge expiresAt={r.expires_at} />

                            {r.urgency && (
                              <Badge
                                variant={
                                  r.urgency === "HIGH"
                                    ? "destructive"
                                    : r.urgency === "MEDIUM"
                                      ? "default"
                                      : "secondary"
                                }
                                className="text-xs"
                              >
                                {r.urgency === "HIGH" ? "Alta" : r.urgency === "MEDIUM" ? "Média" : "Baixa"}
                              </Badge>
                            )}
                          </div>

                          {/* ✅ FIX DEFINITIVO DO ERRO: sem `.single()` (não estoura “Cannot coerce...”) */}
                          <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                            size="lg"
                            onClick={async () => {
                              try {
                                if (!profile?.id) {
                                  toast.error("Perfil não encontrado");
                                  return;
                                }

                                devLog("[SmartFreightMatcher] Tentando aceitar service_request:", {
                                  request_id: r.id,
                                  provider_id: profile.id,
                                  service_type: r.service_type,
                                  status_atual: r.status
                                });

                                // Usar RPC atômico para aceitar (SECURITY DEFINER)
                                const { data: rpcResult, error: rpcError } = await supabase.rpc('accept_service_request', {
                                  p_provider_id: profile.id,
                                  p_request_id: r.id
                                });

                                devLog("[SmartFreightMatcher] Resultado RPC:", { rpcResult, rpcError });

                                if (rpcError) {
                                  console.error("[SmartFreightMatcher] Erro RPC:", rpcError);
                                  if (rpcError.message?.includes('not authenticated')) {
                                    toast.error("Você precisa estar logado para aceitar chamados.");
                                  } else if (rpcError.message?.includes('provider not registered')) {
                                    toast.error("Você não está registrado como motorista/prestador.");
                                  } else {
                                    toast.error(rpcError.message || "Erro ao aceitar chamado");
                                  }
                                  return;
                                }

                                // RPC retorna array - se vazio, não conseguiu aceitar
                                if (!rpcResult || (Array.isArray(rpcResult) && rpcResult.length === 0)) {
                                  toast.error("Não foi possível aceitar: este chamado não está mais disponível.");
                                  await fetchCompatibleFreights();
                                  return;
                                }

                                const accepted = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult;
                                
                                toast.success("Chamado aceito! Indo para Em Andamento.");

                                // Remove da lista local
                                setTowingRequests((prev) => prev.filter((x: any) => x.id !== r.id));

                                // Disparar evento para navegação automática
                                window.dispatchEvent(new CustomEvent("service_request:accepted", { 
                                  detail: { 
                                    requestId: r.id, 
                                    source: 'service_request', 
                                    serviceType: r.service_type,
                                    providerId: accepted.provider_id
                                  } 
                                }));

                                // re-sync
                                await fetchCompatibleFreights();
                              } catch (e: any) {
                                console.error("Erro ao aceitar chamado:", e);
                                toast.error(e?.message || "Erro ao aceitar chamado");
                              }
                            }}
                          >
                            ✅ Aceitar Chamado
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </SafeListWrapper>
            )}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};
