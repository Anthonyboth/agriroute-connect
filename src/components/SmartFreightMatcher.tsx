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

export const SmartFreightMatcher: React.FC<SmartFreightMatcherProps> = ({ onFreightAction, onCountsChange }) => {
  const { profile, user } = useAuth();
  const { isAffiliated, companyId } = useCompanyDriver();
  const { canAcceptFreights, companyId: permissionCompanyId } = useDriverPermissions();

  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [towingRequests, setTowingRequests] = useState<any[]>([]);
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

    if (updateLockRef.current) {
      console.log("[SmartFreightMatcher] Fetch já em andamento, ignorando...");
      return;
    }

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
        toast.info("Seus tipos de serviço não estão configurados. Mostrando todos por enquanto.", { duration: 3500 });
      }

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
          setTowingRequests([]);
          const highUrgency = mapped.filter((f) => f.urgency === "HIGH").length;
          onCountsChange?.({ total: mapped.length, highUrgency });
        }
        return;
      }

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

      let matchedServiceRequests: any[] = [];
      if (spatialData?.service_requests && Array.isArray(spatialData.service_requests)) {
        matchedServiceRequests = spatialData.service_requests;
      }

      const { data: rpcData, error: rpcError } = await supabase.rpc("get_freights_for_driver", {
        p_driver_id: profile.id,
      });

      let rpcFreights: CompatibleFreight[] = [];

      if (!rpcError && Array.isArray(rpcData)) {
        const { data: ucActive } = await supabase
          .from("user_cities")
          .select("cities(name, state)")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .in("type", ["MOTORISTA_ORIGEM", "MOTORISTA_DESTINO"]);

        const activeCities = (ucActive || []).length > 0;
        setHasActiveCities(activeCities);

        const extractCityStateFromAddress = (address: string): { city: string; state: string } => {
          if (!address) return { city: "", state: "" };
          const match = address.match(/([^,\-]+)[\,\-]?\s*([A-Z]{2})\s*$/i);
          if (match) return { city: normalizeCity(match[1].trim()), state: match[2].trim().toUpperCase() };
          const parts = address.split(",").map((p) => p.trim());
          const cityPart = parts[parts.length - 1] || parts[0];
          return { city: normalizeCity(cityPart), state: "" };
        };

        let filtered = rpcData.map((f: any) => ({
          ...f,
          freight_id: f.freight_id ?? f.id,
          service_type: normalizeServiceType(f.service_type),
          pickup_date: String(f.pickup_date || ""),
          delivery_date: String(f.delivery_date || ""),
          required_trucks: f.required_trucks || 1,
          accepted_trucks: f.accepted_trucks || 0,
        }));

        filtered = filtered.filter((f: any) => effectiveTypes.includes(f.service_type));

        setMatchingStats({ exactMatches: 0, fallbackMatches: 0, totalChecked: 0 });

        if (activeCities) {
          const allowedCities = new Set(
            (ucActive || []).map((u: any) => {
              const cityName = String(u.cities?.name || "")
                .trim()
                .toLowerCase();
              const state = String(u.cities?.state || "")
                .trim()
                .toUpperCase();
              return `${cityName}|${state}`;
            }),
          );

          const allowedStates = new Set(
            Array.from(allowedCities)
              .map((key) => key.split("|")[1])
              .filter(Boolean),
          );

          let exactMatches = 0;
          let stateMatches = 0;
          let fallbackMatches = 0;

          filtered = filtered.filter((f: any) => {
            let oKey = normalizeCityState(f.origin_city || "", f.origin_state || "");
            let dKey = normalizeCityState(f.destination_city || "", f.destination_state || "");

            if (!f.origin_city || !f.origin_state) {
              const extracted = extractCityStateFromAddress(f.origin_address);
              if (extracted.city) oKey = normalizeCityState(extracted.city, extracted.state);
            }

            if (!f.destination_city || !f.destination_state) {
              const extracted = extractCityStateFromAddress(f.destination_address);
              if (extracted.city) dKey = normalizeCityState(extracted.city, extracted.state);
            }

            let included = allowedCities.has(oKey) || allowedCities.has(dKey);
            let matchType: "exact" | "state" | "fallback" | "none" = included ? "exact" : "none";

            if (!included) {
              const originState = oKey.split("|")[1];
              const destState = dKey.split("|")[1];
              const stateMatch = allowedStates.has(originState) || allowedStates.has(destState);
              if (stateMatch) {
                included = true;
                matchType = "state";
              }
            }

            if (!included) {
              const allowedCityNames = new Set(Array.from(allowedCities).map((key) => key.split("|")[0]));
              const originCityOnly = oKey.split("|")[0];
              const destCityOnly = dKey.split("|")[0];
              const fallbackMatch = allowedCityNames.has(originCityOnly) || allowedCityNames.has(destCityOnly);
              if (fallbackMatch) {
                included = true;
                matchType = "fallback";
              }
            }

            if (matchType === "exact") exactMatches++;
            else if (matchType === "state") stateMatches++;
            else if (matchType === "fallback") fallbackMatches++;

            return included;
          });

          setMatchingStats({
            exactMatches,
            fallbackMatches: stateMatches + fallbackMatches,
            totalChecked: exactMatches + stateMatches + fallbackMatches,
          });
        } else {
          setHasActiveCities(false);
        }

        rpcFreights = filtered.map((f: any) => ({
          freight_id: f.freight_id,
          cargo_type: f.cargo_type,
          weight: f.weight || 0,
          origin_address: f.origin_address || `${f.origin_city || ""}, ${f.origin_state || ""}`,
          destination_address: f.destination_address || `${f.destination_city || ""}, ${f.destination_state || ""}`,
          origin_city: f.origin_city,
          origin_state: f.origin_state,
          destination_city: f.destination_city,
          destination_state: f.destination_state,
          pickup_date: f.pickup_date,
          delivery_date: f.delivery_date,
          price: f.price || 0,
          urgency: String(f.urgency || "LOW"),
          status: f.status,
          service_type: f.service_type,
          distance_km: f.distance_km || 0,
          minimum_antt_price: f.minimum_antt_price || 0,
          required_trucks: f.required_trucks,
          accepted_trucks: f.accepted_trucks,
          created_at: f.created_at,
        }));
      } else {
        console.warn("[SmartFreightMatcher] RPC falhou (não bloqueante):", rpcError);
      }

      const combined = [...spatialFreights, ...rpcFreights];
      const uniqueMap = new Map<string, CompatibleFreight>();
      combined.forEach((f) => {
        if (!uniqueMap.has(f.freight_id)) uniqueMap.set(f.freight_id, f);
      });
      const finalFreights = Array.from(uniqueMap.values());

      if (
        currentFetchId === fetchIdRef.current &&
        isMountedRef.current &&
        !abortControllerRef.current?.signal.aborted
      ) {
        setCompatibleFreights(finalFreights);
        setTowingRequests(matchedServiceRequests);

        const highUrgency = finalFreights.filter((f) => f.urgency === "HIGH").length;
        onCountsChange?.({ total: finalFreights.length + matchedServiceRequests.length, highUrgency });
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
    return towingRequests.filter((r: any) => {
      const matchesSearch =
        !searchTerm ||
        (r.location_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.problem_description || "").toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [towingRequests, searchTerm]);

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
            {matchingStats.totalChecked > 0 && (
              <Badge variant="outline" className="ml-auto text-xs">
                🎯 {matchingStats.exactMatches} | 🗺️ {matchingStats.fallbackMatches}
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Fretes selecionados automaticamente com base nas suas áreas e tipos de serviço.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {profile?.service_types && (
            <div className="bg-secondary/30 p-4 rounded-lg mb-6">
              <h4 className="font-semibold mb-2">Seus Tipos de Serviço Ativos:</h4>
              <div className="flex flex-wrap gap-2">
                {Array.from(
                  new Set((profile.service_types as unknown as string[]).map((t) => normalizeServiceType(String(t)))),
                ).map((serviceType: string) => (
                  <div key={serviceType}>{getServiceTypeBadge(serviceType)}</div>
                ))}
              </div>
            </div>
          )}

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

              <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                <Button
                  variant="outline"
                  onClick={fetchCompatibleFreights}
                  disabled={loading}
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Atualizar</span>
                </Button>
              </div>
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
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Carregando...</p>
          </div>
        ) : filteredFreights.length + filteredRequests.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Nada disponível</h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveCities === false
                  ? "Configure suas cidades de atendimento."
                  : "Não há fretes/solicitações no momento."}
              </p>
              <Button variant="outline" onClick={fetchCompatibleFreights}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Verificar Novamente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {filteredFreights.length > 0 && (
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

            {filteredRequests.length > 0 && (
              <SafeListWrapper
                fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando...</div>}
              >
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
                            {r.city_name && (
                              <p className="text-lg font-bold text-primary pl-6">
                                {String(r.city_name).toUpperCase()} {r.state ? `- ${r.state}` : ""}
                              </p>
                            )}
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
                                if (!profile?.id) return;

                                const { data: updatedRows, error } = await supabase
                                  .from("service_requests")
                                  .update({
                                    provider_id: profile.id,
                                    status: "ACCEPTED",
                                    accepted_at: new Date().toISOString(),
                                  })
                                  .eq("id", r.id)
                                  .eq("status", "OPEN")
                                  .is("provider_id", null)
                                  .select("id, status, provider_id, accepted_at, service_type");

                                if (error) throw error;

                                // Se não atualizou nenhuma linha: já foi aceito/fechado ou RLS bloqueou
                                if (!updatedRows || updatedRows.length === 0) {
                                  toast.error("Não foi possível aceitar: este chamado não está mais disponível.");
                                  await fetchCompatibleFreights();
                                  return;
                                }

                                // Garantia de integridade
                                const updated = updatedRows[0];
                                if (!updated?.id || updated.provider_id !== profile.id) {
                                  toast.error("Não foi possível aceitar: este chamado não está mais disponível.");
                                  await fetchCompatibleFreights();
                                  return;
                                }

                                toast.success("Chamado aceito! Indo para Em Andamento.");

                                // remove da lista disponível (local) 
                                setTowingRequests((prev) => prev.filter((x: any) => x.id !== r.id));

                                // Disparar evento para navegação automática e refresh
                                window.dispatchEvent(new CustomEvent("freight:accepted", { 
                                  detail: { 
                                    freightId: r.id, 
                                    source: 'service_request', 
                                    serviceType: updated.service_type || r.service_type 
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
          </>
        )}
      </div>
    </div>
  );
};
