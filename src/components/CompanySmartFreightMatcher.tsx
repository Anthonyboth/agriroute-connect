import React, { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FreightCard } from "@/components/FreightCard";
import { Brain, RefreshCw, Search, Zap, Package, Clock, Truck, Bike, Wrench, PawPrint, DollarSign, MessageSquare, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCargoTypesByCategory } from "@/lib/cargo-types";
import { useTransportCompany } from "@/hooks/useTransportCompany";
import { useAuth } from "@/hooks/useAuth";
import { useLastUpdate } from "@/hooks/useLastUpdate";
import { normalizeFreightStatus, isOpenStatus } from "@/lib/freight-status";
import { resolveDriverUnitPrice } from '@/hooks/useFreightCalculator';
import { useMarketplaceAvailabilityGuarantee } from '@/hooks/useMarketplaceAvailabilityGuarantee';
import { useGuaranteedMarketplaceFeed } from '@/hooks/useGuaranteedMarketplaceFeed';
import { runFeedIntegrityGuard } from '@/security/feedIntegrityGuard';

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
  service_type: string;
  distance_km: number;
  minimum_antt_price: number;
  required_trucks: number;
  accepted_trucks: number;
  pricing_type?: string;
  price_per_km?: number;
  created_at: string;
}

interface CompanySmartFreightMatcherProps {
  onTabChange?: (tab: string) => void;
}

export const CompanySmartFreightMatcher: React.FC<CompanySmartFreightMatcherProps> = ({ onTabChange }) => {
  const { profile } = useAuth();
  const { drivers, company } = useTransportCompany();
  const { fetchAvailableMarketplaceItems } = useGuaranteedMarketplaceFeed();
  const queryClient = useQueryClient();

  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [serviceRequests, setServiceRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCargoType, setSelectedCargoType] = useState<string>("all");

  const [matchingStats, setMatchingStats] = useState({ total: 0, matched: 0, assigned: 0 });
  const [emptyFreightHint, setEmptyFreightHint] = useState("Não há fretes abertos com vagas no momento.");
  const [emptyServiceHint, setEmptyServiceHint] = useState("Não há serviços disponíveis no momento.");
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const timeAgo = useLastUpdate(lastUpdateTime);

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignTargetId, setAssignTargetId] = useState<string>("");
  const [assignTargetType, setAssignTargetType] = useState<"freight" | "service">("freight");
  const fetchingRef = React.useRef(false);

  const fetchCompatibleFreights = useCallback(async () => {
    if (!company?.id) return;

    if (fetchingRef.current) {
      if (import.meta.env.DEV) console.log("⏳ [FRETES I.A] Fetch já em andamento, ignorando...");
      return;
    }

    fetchingRef.current = true;
    setLoading(true);

    try {
      if (import.meta.env.DEV) console.log("🔍 [FRETES I.A] Buscando fretes para company:", company.id);

      const result = await fetchAvailableMarketplaceItems({
        profile,
        roleOverride: 'TRANSPORTADORA',
        freightLimit: 80,
        serviceLimit: 40,
        debug: import.meta.env.DEV,
      });

      const freightsData = result.freights;
      const serviceData = result.serviceRequests;
      const allowedTransportTypes = result.allowedTransportTypes;
      const activeDriversCount = (drivers || []).filter((d: any) => d.status === "ACTIVE").length;

      const excludedItems = Array.isArray(result?.debug?.excludedItems) ? result.debug.excludedItems : [];
      const freightCandidates = Number(result?.debug?.freight?.total_candidates || 0);
      const freightCityExcluded = excludedItems.filter((item: any) => item?.item_type === 'FREIGHT' && item?.reason === 'CITY_NOT_MATCH').length;
      const serviceTypeExcluded = excludedItems.filter((item: any) => item?.item_type === 'SERVICE' && item?.reason === 'TYPE_NOT_COMPATIBLE').length;
      const serviceStatusExcluded = excludedItems.filter((item: any) => item?.item_type === 'SERVICE' && item?.reason === 'STATUS_NOT_OPEN').length;

      if ((freightsData?.length || 0) === 0) {
        if (activeDriversCount === 0) {
          setEmptyFreightHint('Não há motoristas ativos na transportadora para receber fretes no matcher.');
        } else if (freightCandidates > 0 && freightCityExcluded > 0) {
          setEmptyFreightHint('Existem fretes OPEN, mas todos foram filtrados por cidade ativa da transportadora neste painel. Revise as cidades marcadas em "Cidades" da transportadora.');
        } else {
          setEmptyFreightHint('Não há fretes abertos com vagas no momento.');
        }
      } else {
        setEmptyFreightHint('Não há fretes abertos com vagas no momento.');
      }

      if ((serviceData?.length || 0) === 0) {
        if (serviceTypeExcluded > 0) {
          setEmptyServiceHint('Há serviços OPEN no sistema, mas os tipos não são compatíveis com os tipos de serviço do perfil da transportadora.');
        } else if (serviceStatusExcluded > 0) {
          setEmptyServiceHint('Existem serviços, porém já não estão mais com status OPEN.');
        } else {
          setEmptyServiceHint('Não há serviços disponíveis no momento.');
        }
      } else {
        setEmptyServiceHint('Não há serviços disponíveis no momento.');
      }

      if (import.meta.env.DEV) {
        console.log("📦 [FRETES I.A] " + (freightsData?.length || 0) + " fretes retornados");
        console.log("📦 [FRETES I.A] " + (serviceData?.length || 0) + " service_requests retornados");
        console.log("🧭 [FRETES I.A] Tipos urbanos permitidos:", allowedTransportTypes);
      }

      const normalizedFreights: CompatibleFreight[] = [];
      let discardedByStatus = 0;
      let discardedNoSlots = 0;

      // Normalizar fretes rurais
      for (const freight of freightsData || []) {
        const normalizedStatus = normalizeFreightStatus(freight.status as any);
        const open = isOpenStatus(normalizedStatus);

        if (!open) {
          discardedByStatus++;
          continue;
        }

        const requiredTrucks = Number((freight as any).required_trucks ?? 1);
        const acceptedTrucks = Number((freight as any).accepted_trucks ?? 0);
        const hasAvailableSlots = acceptedTrucks < requiredTrucks;

        if (!hasAvailableSlots) {
          discardedNoSlots++;
          continue;
        }

        normalizedFreights.push({
          freight_id: String(freight.id),
          cargo_type: String((freight as any).cargo_type || ""),
          weight: Number((freight as any).weight ?? 0),
          origin_address: String((freight as any).origin_address || ""),
          destination_address: String((freight as any).destination_address || ""),
          origin_city: (freight as any).origin_city || undefined,
          origin_state: (freight as any).origin_state || undefined,
          destination_city: (freight as any).destination_city || undefined,
          destination_state: (freight as any).destination_state || undefined,
          pickup_date: String((freight as any).pickup_date || ""),
          delivery_date: String((freight as any).delivery_date || ""),
          price: Number((freight as any).price ?? 0),
          urgency: String((freight as any).urgency || "LOW"),
          status: String((freight as any).status || "OPEN"),
          service_type: String((freight as any).service_type || "CARGA"),
          distance_km: Number((freight as any).distance_km ?? 0),
          minimum_antt_price: Number((freight as any).minimum_antt_price ?? 0),
          required_trucks: requiredTrucks,
          accepted_trucks: acceptedTrucks,
          created_at: String((freight as any).created_at || ""),
        });
      }

      // 3) Armazenar service_requests separadamente (NÃO normalizar como freight)
      setServiceRequests(serviceData || []);

      if (import.meta.env.DEV) console.log(`✅ [FRETES I.A] ${normalizedFreights.length} fretes compatíveis, ${(serviceData || []).length} service_requests, descartados: ${discardedByStatus} status, ${discardedNoSlots} sem vagas`);

      setCompatibleFreights(normalizedFreights);
      setMatchingStats({
        total: (freightsData?.length || 0) + (serviceData?.length || 0),
        matched: normalizedFreights.length + (serviceData?.length || 0),
        assigned: drivers?.length || 0,
      });
      setLastUpdateTime(new Date());

      // ✅ INTEGRITY GUARD: verifica discrepâncias entre backend e frontend
      runFeedIntegrityGuard({
        scope: 'carrier',
        backendEligible: result.metrics?.feed_total_eligible ?? (freightsData?.length || 0) + (serviceData?.length || 0),
        backendDisplayed: result.metrics?.feed_total_displayed ?? normalizedFreights.length + (serviceData?.length || 0),
        renderedDisplayed: normalizedFreights.length + (serviceData?.length || 0),
        fallbackUsed: result.metrics?.fallback_used ?? false,
        role: 'TRANSPORTADORA',
      });
    } catch (error: any) {
      console.error("[CompanySmartFreightMatcher] erro:", error);
      toast.error(error?.message || "Erro ao carregar fretes");
      setCompatibleFreights([]);
      setMatchingStats({ total: 0, matched: 0, assigned: 0 });
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [company?.id, drivers?.length, profile, fetchAvailableMarketplaceItems]);

  useMarketplaceAvailabilityGuarantee({
    enabled: !!company?.id,
    refresh: fetchCompatibleFreights,
    dependencies: [company?.id, drivers?.length, JSON.stringify(profile?.service_types || [])],
    minIntervalMs: 900,
  });

  const handleAssignFreight = async (targetId: string, driverId: string) => {
    if (!driverId) {
      toast.info("Selecione um motorista para atribuir.");
      return;
    }

    try {
      if (assignTargetType === "service") {
        // ✅ Usar RPC SECURITY DEFINER para atribuir serviço urbano
        const { data, error } = await supabase.rpc("assign_service_to_affiliated_driver", {
          p_service_id: targetId,
          p_driver_profile_id: driverId,
        });

        if (error) throw error;

        const result = data as any;
        if (result && result.success === false) {
          toast.error(result.error || "Erro ao atribuir serviço");
          return;
        }

        // ✅ Invalidar cache de serviços em andamento
        queryClient.invalidateQueries({ queryKey: ['freight-driver-manager'] });
        queryClient.invalidateQueries({ queryKey: ['service-requests'] });
        queryClient.invalidateQueries({ queryKey: ['my-service-requests'] });

        toast.success("Serviço atribuído ao motorista!", {
          description: "Acompanhe em \"Em andamento\".",
          duration: 5000,
          action: {
            label: "Ver agora",
            onClick: () => {
              onTabChange?.("active");
              window.dispatchEvent(new CustomEvent("navigate-to-tab", { detail: "active" }));
            },
          },
        });

        await fetchCompatibleFreights();
        return;
      }

      // ✅ Frete rural: usar RPC SECURITY DEFINER
      const freight = compatibleFreights.find((f) => f.freight_id === targetId);
      if (!freight) return;

      const requiredTrucks = Math.max(freight.required_trucks || 1, 1);
      const pricePerTruck = resolveDriverUnitPrice(0, freight.price || 0, requiredTrucks);

      const { data, error } = await supabase.rpc("assign_freight_to_affiliated_driver", {
        p_freight_id: targetId,
        p_driver_profile_id: driverId,
        p_proposed_price: pricePerTruck,
        p_message: "Atribuído pela transportadora",
      });

      if (error) throw error;

      const result = data as any;
      if (result && result.success === false) {
        toast.error(result.error || "Erro ao atribuir frete");
        return;
      }

      // ✅ Invalidar cache de fretes em andamento para atualização imediata
      queryClient.invalidateQueries({ queryKey: ['freight-driver-manager'] });

      toast.success("Motorista atribuído ao frete com sucesso!", {
        description: "O frete já aparece em \"Em andamento\".",
        duration: 5000,
        action: {
          label: "Ver agora",
          onClick: () => {
            onTabChange?.("active");
            window.dispatchEvent(new CustomEvent("navigate-to-tab", { detail: "active" }));
          },
        },
      });

      await fetchCompatibleFreights();
    } catch (e: any) {
      console.error("[CompanySmartFreightMatcher] erro ao atribuir:", e);
      toast.error(e?.message || "Erro ao atribuir frete ao motorista");
    }
  };

  const filteredFreights = useMemo(() => compatibleFreights.filter((freight) => {
    const matchesSearch =
      !searchTerm ||
      (freight.cargo_type || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (freight.origin_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (freight.destination_address || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCargoType = selectedCargoType === "all" || freight.cargo_type === selectedCargoType;
    return matchesSearch && matchesCargoType;
  }), [compatibleFreights, searchTerm, selectedCargoType]);

  const filteredServiceRequests = useMemo(() => serviceRequests.filter((r: any) => {
    const matchesSearch =
      !searchTerm ||
      (r.location_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.destination_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.problem_description || "").toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }), [serviceRequests, searchTerm]);

  const activeDrivers = (drivers || []).filter((d: any) => d.status === "ACTIVE");
  const totalAvailableCount = filteredFreights.length + filteredServiceRequests.length;

  const getServiceTypeTitle = (serviceType: string) => {
    switch (serviceType) {
      case "TRANSPORTE_PET": return "Transporte de Pet 🐾";
      case "ENTREGA_PACOTES": return "Entrega de Pacotes 📦";
      case "GUINCHO": return "Guincho";
      case "FRETE_MOTO": return "Frete Moto";
      case "MUDANCA": return "Mudança";
      case "FRETE_URBANO": return "Frete Urbano";
      default: return "Frete Urbano";
    }
  };

  const getServiceTypeIcon = (serviceType: string) => {
    switch (serviceType) {
      case "TRANSPORTE_PET": return <PawPrint className="h-5 w-5 text-purple-600" />;
      case "ENTREGA_PACOTES": return <Package className="h-5 w-5 text-amber-600" />;
      case "GUINCHO": return <Wrench className="h-5 w-5 text-orange-600" />;
      case "FRETE_MOTO": return <Bike className="h-5 w-5 text-blue-600" />;
      case "MUDANCA": return <Truck className="h-5 w-5 text-blue-600" />;
      default: return <Truck className="h-5 w-5 text-blue-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Match Inteligente de Fretes para Transportadora
            <Badge className="bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20">
              <Zap className="mr-1 h-3 w-3" />
              IA
            </Badge>
          </CardTitle>
          <CardDescription>
            Fretes abertos (OPEN/IN_NEGOTIATION) e ainda não atribuídos, com vagas disponíveis.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="bg-secondary/30 p-4 rounded-lg mb-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h4 className="font-semibold mb-1">{company?.company_name}</h4>
                <p className="text-sm text-muted-foreground">
                  CNPJ:{" "}
                  {company?.company_cnpj?.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") ||
                    "Não informado"}{" "}
                  • {activeDrivers.length} motoristas ativos
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-6">
            <div className="flex gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[220px]">
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
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                {timeAgo ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo}
                  </span>
                ) : (
                  "Atualizar"
                )}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-primary/5 rounded-lg">
                <div className="text-2xl font-bold text-primary">{compatibleFreights.length}</div>
                <div className="text-sm text-muted-foreground">Fretes rurais</div>
              </div>
              <div className="text-center p-4 bg-purple-500/5 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{serviceRequests.length}</div>
                <div className="text-sm text-muted-foreground">Serviços urbanos</div>
              </div>
              <div className="text-center p-4 bg-green-500/5 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{totalAvailableCount}</div>
                <div className="text-sm text-muted-foreground">Total disponível</div>
              </div>
              <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{activeDrivers.length}</div>
                <div className="text-sm text-muted-foreground">Motoristas ativos</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ✅ TABS SEPARADAS: Fretes vs Serviços Urbanos (mesmo padrão do driver) */}
      <Tabs defaultValue="freights" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="freights" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Fretes Rurais
            {filteredFreights.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {filteredFreights.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Bike className="h-4 w-4" />
            Fretes Urbanos
            {filteredServiceRequests.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {filteredServiceRequests.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Buscando fretes...</p>
          </div>
        ) : (
          <>
            {/* ABA FRETES RURAIS */}
            <TabsContent value="freights" className="space-y-4">
              {filteredFreights.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Truck className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-2">Nenhum frete disponível</h3>
                    <p className="text-muted-foreground mb-4">{emptyFreightHint}</p>
                    <Button variant="outline" onClick={fetchCompatibleFreights}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Verificar Novamente
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredFreights.map((freight) => (
                    <div key={freight.freight_id} className="relative overflow-hidden">
                      <FreightCard
                        freight={{
                          id: freight.freight_id,
                          cargo_type: freight.cargo_type,
                          weight: Number(freight.weight ?? 0) || 0,
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
                          pricing_type: freight.pricing_type as any,
                          price_per_km: freight.price_per_km,
                        }}
                        showActions
                        canAcceptFreights={true}
                        isAffiliatedDriver={false}
                        onAction={() => fetchCompatibleFreights()}
                      />

                      <div className="mt-2 flex gap-2 flex-wrap items-center">
                        <Button
                          className="flex-1"
                          onClick={() => {
                            setAssignTargetId(freight.freight_id);
                            setAssignTargetType("freight");
                            setAssignModalOpen(true);
                          }}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Atribuir ao motorista
                        </Button>

                        {freight.required_trucks > 1 && (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">
                            {freight.accepted_trucks}/{freight.required_trucks} caminhões
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ABA SERVIÇOS URBANOS (PET, Pacotes, Guincho, Mudança, Moto) */}
            <TabsContent value="services" className="space-y-4">
              {filteredServiceRequests.length === 0 ? (
                <Card>
                  <CardContent className="text-center py-8">
                    <Bike className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <h3 className="font-semibold mb-2">Nenhum serviço disponível</h3>
                    <p className="text-muted-foreground mb-4">{emptyServiceHint}</p>
                    <Button variant="outline" onClick={fetchCompatibleFreights}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Verificar Novamente
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredServiceRequests.map((r: any) => (
                    <Card key={r.id} className="hover:shadow-lg transition-all duration-300 border-2 border-border/60 overflow-hidden">
                      <div className="p-4 bg-gradient-to-r from-blue-500/10 to-blue-600/5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30">
                              {getServiceTypeIcon(r.service_type)}
                            </div>
                            <div>
                              <h3 className="font-bold text-foreground">
                                {getServiceTypeTitle(r.service_type)}
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
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Origem</span>
                          </div>
                          {(r.location_city) && (
                            <p className="text-base font-bold text-foreground pl-4">
                              {String(r.location_city).toUpperCase()} — {r.location_state || ""}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground pl-4 line-clamp-2">
                            {r.location_address || "Endereço não informado"}
                          </p>
                        </div>

                        {/* DESTINO */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Destino</span>
                          </div>
                          {r.destination_address ? (
                            <>
                              {r.destination_city && (
                                <p className="text-base font-bold text-foreground pl-4">
                                  {String(r.destination_city).toUpperCase()} — {r.destination_state || ""}
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground pl-4 line-clamp-2">
                                {r.destination_address}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground pl-4 italic">Destino não informado</p>
                          )}
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
                              {new Date(r.created_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          {r.urgency && (
                            <Badge
                              variant={r.urgency === "HIGH" ? "destructive" : r.urgency === "MEDIUM" ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {r.urgency === "HIGH" ? "Alta" : r.urgency === "MEDIUM" ? "Média" : "Baixa"}
                            </Badge>
                          )}
                        </div>

                        {/* Botão de atribuir ao motorista */}
                        <Button
                          className="w-full"
                          onClick={() => {
                            setAssignTargetId(r.id);
                            setAssignTargetType("service");
                            setAssignModalOpen(true);
                          }}
                        >
                          <Package className="h-4 w-4 mr-2" />
                          Atribuir ao motorista
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>


      {/* Modal de seleção de motorista para atribuição */}
      <Dialog open={assignModalOpen} onOpenChange={setAssignModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Selecionar Motorista
            </DialogTitle>
            <DialogDescription>
              Escolha o motorista para atribuir este {assignTargetType === "freight" ? "frete" : "serviço"}.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[400px]">
            {activeDrivers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Truck className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">Nenhum motorista ativo</p>
                <p className="text-sm">Cadastre motoristas na sua transportadora primeiro.</p>
              </div>
            ) : (
              <div className="space-y-2 p-1">
                {activeDrivers.map((d: any) => {
                  const driverId = String(d.driver_profile_id || d.id);
                  const driverName = d.driver?.full_name || d.full_name || d.name || d.email || "Motorista sem nome";
                  return (
                    <Button
                      key={driverId}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-4"
                      onClick={async () => {
                        setAssignModalOpen(false);
                        await handleAssignFreight(assignTargetId, driverId);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {driverName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium">{driverName}</span>
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
};
