import React, { useState, useEffect, useTransition, useMemo, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  getAllowedServiceTypesFromProfile,
  type CanonicalServiceType,
} from "@/lib/service-type-normalization";
import { subscriptionWithRetry } from "@/lib/query-utils";
import { debounce } from "@/lib/utils";
import { normalizeCity, normalizeCityState } from "@/utils/city-normalization";

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
}

interface SmartFreightMatcherProps {
  onFreightAction?: (freightId: string, action: string) => void;
  onCountsChange?: (counts: { total: number; highUrgency: number }) => void;
}

const SERVICE_TYPES_REQUESTS = ["GUINCHO", "MUDANCA", "FRETE_MOTO"] as const;
const AVAILABLE_SERVICE_REQUEST_STATUSES = ["OPEN", "AVAILABLE"] as const;

// ✅ compat ES2019/2020 (sem replaceAll)
const safeReplaceAll = (input: string, search: string, replacement: string) => {
  if (!input) return input;
  return input.split(search).join(replacement);
};

export const SmartFreightMatcher: React.FC<SmartFreightMatcherProps> = ({ onFreightAction, onCountsChange }) => {
  const { profile, user } = useAuth();
  const { isAffiliated, companyId } = useCompanyDriver();
  const { canAcceptFreights, companyId: permissionCompanyId } = useDriverPermissions();

  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCargoType, setSelectedCargoType] = useState<string>("all");

  const [matchingStats, setMatchingStats] = useState({ exactMatches: 0, fallbackMatches: 0, totalChecked: 0 });
  const [hasActiveCities, setHasActiveCities] = useState<boolean | null>(null);

  const [isUpdating, setIsUpdating] = useState(false);
  const [, startTransition] = useTransition();

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);
  const updateLockRef = useRef(false);
  const fetchIdRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const allowedTypesFromProfile = useMemo(() => {
    return getAllowedServiceTypesFromProfile(profile);
  }, [profile?.role, profile?.service_types]);

  const fetchCompatibleFreights = useCallback(async () => {
    if (!profile?.id || !user?.id) return;

    if (updateLockRef.current) return;
    const currentFetchId = ++fetchIdRef.current;
    updateLockRef.current = true;

    const activeMode = profile?.active_mode || profile?.role;
    const isCompany = activeMode === "TRANSPORTADORA";

    setLoading(true);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();

    try {
      let effectiveTypes = allowedTypesFromProfile;
      if (!isCompany && (!effectiveTypes || effectiveTypes.length === 0)) {
        effectiveTypes = ["CARGA", "GUINCHO", "MUDANCA", "FRETE_MOTO"] as CanonicalServiceType[];
      }

      // TRANSPORTADORA
      if (isCompany) {
        const { data: directFreights, error: directError } = await supabase
          .from("freights")
          .select("*")
          .in("status", ["OPEN", "IN_NEGOTIATION"])
          .is("driver_id", null)
          .order("created_at", { ascending: false })
          .limit(100);

        if (directError) throw directError;

        const mapped: CompatibleFreight[] = (directFreights || []).map((f: any) => ({
          freight_id: f.id,
          cargo_type: f.cargo_type,
          weight: f.weight || 0,
          origin_address: f.origin_address || `${f.origin_city || ""}, ${f.origin_state || ""}`,
          destination_address: f.destination_address || `${f.destination_city || ""}, ${f.destination_state || ""}`,
          origin_city: f.origin_city,
          origin_state: f.origin_state,
          destination_city: f.destination_city,
          destination_state: f.destination_state,
          pickup_date: String(f.pickup_date || ""),
          delivery_date: String(f.delivery_date || ""),
          price: f.price || 0,
          urgency: String(f.urgency || "LOW"),
          status: f.status,
          service_type: normalizeServiceType(f.service_type),
          distance_km: 0,
          minimum_antt_price: f.minimum_antt_price || 0,
          required_trucks: f.required_trucks || 1,
          accepted_trucks: f.accepted_trucks || 0,
          created_at: f.created_at,
        }));

        if (
          currentFetchId === fetchIdRef.current &&
          isMountedRef.current &&
          !abortControllerRef.current?.signal.aborted
        ) {
          setCompatibleFreights(mapped);
          setServiceRequests([]);
          const highUrgency = mapped.filter((f) => f.urgency === "HIGH").length;
          onCountsChange?.({ total: mapped.length, highUrgency });
        }
        return;
      }

      // MOTORISTA: matching espacial
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data: spatialData, error: spatialError } = await supabase.functions.invoke("driver-spatial-matching", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: session?.access_token ? `Bearer ${session.access_token}` : "",
        },
      });

      if (spatialError) console.warn("[SmartFreightMatcher] spatialError:", spatialError);

      // FREIGHTS do matching
      let spatialFreights: CompatibleFreight[] = [];
      if (spatialData?.freights && Array.isArray(spatialData.freights)) {
        spatialFreights = spatialData.freights
          .filter((f: any) => effectiveTypes.includes(normalizeServiceType(f.service_type)))
          .map((f: any) => ({
            freight_id: f.id || f.freight_id,
            cargo_type: f.cargo_type,
            weight: f.weight || 0,
            origin_address: f.origin_address || `${f.origin_city || ""}, ${f.origin_state || ""}`,
            destination_address: f.destination_address || `${f.destination_city || ""}, ${f.destination_state || ""}`,
            origin_city: f.origin_city,
            origin_state: f.origin_state,
            destination_city: f.destination_city,
            destination_state: f.destination_state,
            pickup_date: String(f.pickup_date || ""),
            delivery_date: String(f.delivery_date || ""),
            price: f.price || 0,
            urgency: String(f.urgency || "LOW"),
            status: f.status,
            service_type: normalizeServiceType(f.service_type),
            distance_km: f.distance_km || 0,
            minimum_antt_price: f.minimum_antt_price || 0,
            required_trucks: f.required_trucks || 1,
            accepted_trucks: f.accepted_trucks || 0,
            created_at: f.created_at,
          }));
      }

      // SERVICE REQUESTS: pegar IDs do matching e validar no banco
      const matchedRequestIds: string[] = (() => {
        if (Array.isArray(spatialData?.service_request_ids)) {
          return spatialData.service_request_ids.map((x: any) => String(x)).filter(Boolean);
        }
        if (Array.isArray(spatialData?.service_requests)) {
          return spatialData.service_requests
            .map((r: any) => r?.id)
            .map((x: any) => String(x))
            .filter(Boolean);
        }
        return [];
      })();

      let verifiedRequests: any[] = [];

      if (matchedRequestIds.length > 0) {
        const { data: dbReqs, error: reqErr } = await supabase
          .from("service_requests")
          .select("*")
          .in("id", matchedRequestIds)
          .in("service_type", [...SERVICE_TYPES_REQUESTS])
          .in("status", [...AVAILABLE_SERVICE_REQUEST_STATUSES])
          .is("provider_id", null)
          .order("created_at", { ascending: true });

        if (reqErr) {
          console.warn("[SmartFreightMatcher] erro validando service_requests no banco:", reqErr);
          verifiedRequests = [];
        } else {
          verifiedRequests = dbReqs || [];
        }
      } else {
        // ✅ FALLBACK: se o matching não retornar ids, busca por cidades ativas do motorista
        const { data: uc } = await supabase
          .from("user_cities")
          .select("cities(name, state)")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .in("type", ["MOTORISTA_ORIGEM", "MOTORISTA_DESTINO"]);

        const activeCities = (uc || []).length > 0;
        setHasActiveCities(activeCities);

        if (activeCities) {
          const pairs = (uc || [])
            .map((u: any) => ({
              city: String(u.cities?.name || "").trim(),
              state: String(u.cities?.state || "").trim(),
            }))
            .filter((p: any) => p.city && p.state);

          if (pairs.length > 0) {
            // monta OR por cidade/estado em location_address (fallback)
            // (não depende de city_id/city_name existir na tabela)
            const orParts: string[] = [];
            for (const p of pairs) {
              const city = safeReplaceAll(p.city, ",", "");
              const state = p.state.toUpperCase();
              // location_address costuma conter "Cidade - UF" ou "... Cidade - UF"
              orParts.push(`location_address.ilike.%${city}%`);
              orParts.push(`location_address.ilike.%${state}%`);
            }

            // Observação: supabase .or precisa de string, aqui é um fallback fraco (mas melhor que sumir tudo)
            // Vamos filtrar melhor no client abaixo.
            const { data: sr } = await supabase
              .from("service_requests")
              .select("*")
              .in("service_type", [...SERVICE_TYPES_REQUESTS])
              .in("status", [...AVAILABLE_SERVICE_REQUEST_STATUSES])
              .is("provider_id", null)
              .order("created_at", { ascending: true })
              .limit(200);

            const allowedCities = new Set(pairs.map((p: any) => `${normalizeCity(p.city)}|${p.state.toUpperCase()}`));

            verifiedRequests = (sr || []).filter((r: any) => {
              const addr = String(r.location_address || "");
              // tenta extrair cidade/UF do final
              const m = addr.match(/([^,\-]+)[\,\-]?\s*([A-Z]{2})\s*$/i);
              if (!m) return false;
              const c = normalizeCity(m[1].trim());
              const s = m[2].trim().toUpperCase();
              return allowedCities.has(`${c}|${s}`);
            });
          }
        } else {
          verifiedRequests = [];
        }
      }

      if (
        currentFetchId === fetchIdRef.current &&
        isMountedRef.current &&
        !abortControllerRef.current?.signal.aborted
      ) {
        setCompatibleFreights(spatialFreights);
        setServiceRequests(verifiedRequests);

        const highUrgency = spatialFreights.filter((f) => f.urgency === "HIGH").length;
        onCountsChange?.({ total: spatialFreights.length + verifiedRequests.length, highUrgency });
      }
    } catch (error: any) {
      console.error("[SmartFreightMatcher] erro geral:", error);
      toast.error("Erro ao carregar fretes. Tente novamente.");
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsUpdating(false);
      }
      updateLockRef.current = false;
    }
  }, [profile?.id, profile?.role, profile?.active_mode, user?.id, allowedTypesFromProfile, onCountsChange]);

  const handleFreightAction = async (freightId: string, action: string) => {
    if (onFreightAction) {
      onFreightAction(freightId, action);
      return;
    }

    if ((action === "propose" || action === "accept") && profile?.id) {
      try {
        const freight = compatibleFreights.find((f) => f.freight_id === freightId);
        if (!freight) return;

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

        const { error } = await supabase.from("freight_proposals").insert({
          freight_id: freightId,
          driver_id: driverProfileId,
          proposed_price: freight.price,
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

  useEffect(() => {
    if (!profile?.id || !user?.id) return;
    fetchCompatibleFreights();
  }, [profile?.id, user?.id, fetchCompatibleFreights]);

  useEffect(() => {
    let isMountedLocal = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    if (!profile?.id || !user?.id) return;

    const debouncedFetch = debounce(() => {
      if (isMountedLocal && isMountedRef.current && !isUpdating) fetchCompatibleFreights();
    }, 500);

    const { cleanup } = subscriptionWithRetry(
      "user-cities-changes",
      (ch) =>
        ch.on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_cities", filter: `user_id=eq.${user.id}` },
          () => {
            if (!isMountedLocal || !isMountedRef.current) return;
            toast.info("Suas cidades de atendimento foram atualizadas. Recarregando fretes...");
            debouncedFetch();
          },
        ),
      {
        maxRetries: 5,
        retryDelayMs: 3000,
        onError: (error) => {
          console.error("[SmartFreightMatcher] Realtime error:", error);
          if (!pollInterval) {
            pollInterval = setInterval(() => {
              if (isMountedLocal && isMountedRef.current) fetchCompatibleFreights();
            }, 30000);
          }
        },
      },
    );

    return () => {
      isMountedLocal = false;
      cleanup();
      debouncedFetch.cancel();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [profile?.id, user?.id, isUpdating, fetchCompatibleFreights]);

  const filteredFreights = useMemo(() => {
    return compatibleFreights.filter((freight) => {
      const matchesSearch =
        !searchTerm ||
        (freight.cargo_type || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (freight.origin_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (freight.destination_address || "").toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCargoType = selectedCargoType === "all" || freight.cargo_type === selectedCargoType;
      return matchesSearch && matchesCargoType;
    });
  }, [compatibleFreights, searchTerm, selectedCargoType]);

  const filteredRequests = useMemo(() => {
    return (serviceRequests || []).filter((r: any) => {
      const matchesSearch =
        !searchTerm ||
        (r.location_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.problem_description || "").toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [serviceRequests, searchTerm]);

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
          </CardTitle>
          <CardDescription>
            Fretes selecionados automaticamente com base nas suas áreas e tipos de serviço.
          </CardDescription>
        </CardHeader>

        <CardContent>
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

              <Button
                variant="outline"
                onClick={fetchCompatibleFreights}
                disabled={loading}
                className="flex items-center gap-2 whitespace-nowrap"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            <div className="w-full md:w-80">
              <Select value={selectedCargoType} onValueChange={setSelectedCargoType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de carga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>

                  <SelectGroup>
                    <SelectLabel className="text-primary font-medium">Carga (Agrícola)</SelectLabel>
                    {getCargoTypesByCategory("rural").map((cargo) => (
                      <SelectItem key={cargo.value} value={cargo.value}>
                        {cargo.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>

                  <SelectGroup>
                    <SelectLabel className="text-blue-600 font-medium">Carga Viva</SelectLabel>
                    {getCargoTypesByCategory("carga_viva").map((cargo) => (
                      <SelectItem key={cargo.value} value={cargo.value}>
                        {cargo.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>

                  <SelectGroup>
                    <SelectLabel className="text-gray-600 font-medium">Outros</SelectLabel>
                    {getCargoTypesByCategory("outros").map((cargo) => (
                      <SelectItem key={cargo.value} value={cargo.value}>
                        {cargo.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredFreights.length > 0 && (
            <SafeListWrapper>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFreights.map((freight) => (
                  <div key={freight.freight_id} className="relative h-full">
                    <FreightCard
                      freight={{
                        id: freight.freight_id,
                        cargo_type: freight.cargo_type,
                        weight: freight.weight ? freight.weight / 1000 : 0,
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
                      }}
                      onAction={(action) => handleFreightAction(freight.freight_id, action)}
                      showActions
                      canAcceptFreights={canAcceptFreights}
                      isAffiliatedDriver={isAffiliated}
                      driverCompanyId={companyId || permissionCompanyId}
                    />
                  </div>
                ))}
              </div>
            </SafeListWrapper>
          )}

          {filteredRequests.length > 0 && (
            <SafeListWrapper>
              <div className="space-y-3">
                <h4 className="font-semibold text-lg flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-primary" />
                  Chamados de Serviço (Guincho / Mudança / Moto)
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
                                      : "Serviço"}
                              </h3>
                              <p className="text-xs text-muted-foreground">Solicitação #{String(r.id).slice(0, 8)}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                            Disponível
                          </Badge>
                        </div>
                      </div>

                      <CardContent className="p-4 space-y-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-primary" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              Local
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground pl-6 line-clamp-2">
                            {r.location_address || "Endereço não informado"}
                          </p>
                        </div>

                        {r.problem_description && (
                          <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                                <p className="text-sm text-foreground line-clamp-3">{r.problem_description}</p>
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
                            <span>
                              Solicitado há{" "}
                              {Math.max(1, Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60)))}{" "}
                              min
                            </span>
                          </div>
                        </div>

                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3"
                          size="lg"
                          onClick={async () => {
                            try {
                              if (!profile?.id) return;

                              const { data: updatedRows, error } = await supabase
                                .from("service_requests")
                                .update({
                                  provider_id: profile.id,
                                  status: "ACCEPTED",
                                  accepted_at: new Date().toISOString(),
                                })
                                .eq("id", r.id)
                                .in("status", ["OPEN", "AVAILABLE"])
                                .is("provider_id", null)
                                .select("id");

                              if (error) throw error;

                              if (!updatedRows || updatedRows.length === 0) {
                                toast.error("Não foi possível aceitar: este chamado não está mais disponível.");
                                await fetchCompatibleFreights();
                                return;
                              }

                              toast.success("Chamado aceito! Indo para Em Andamento.");
                              setServiceRequests((prev) => prev.filter((x: any) => x.id !== r.id));
                              window.dispatchEvent(new CustomEvent("navigate-to-tab", { detail: "ongoing" }));
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
        </CardContent>
      </Card>
    </div>
  );
};
