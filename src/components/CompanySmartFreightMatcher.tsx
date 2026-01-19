import React, { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { FreightCard } from "@/components/FreightCard";
import { Brain, RefreshCw, Search, Zap, Package, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getCargoTypesByCategory } from "@/lib/cargo-types";
import { useTransportCompany } from "@/hooks/useTransportCompany";
import { useLastUpdate } from "@/hooks/useLastUpdate";
import { normalizeFreightStatus, isOpenStatus } from "@/lib/freight-status";

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
  created_at: string;
}

interface CompanySmartFreightMatcherProps {
  onTabChange?: (tab: string) => void;
}

export const CompanySmartFreightMatcher: React.FC<CompanySmartFreightMatcherProps> = ({ onTabChange }) => {
  const { drivers, company } = useTransportCompany();

  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCargoType, setSelectedCargoType] = useState<string>("all");

  const [matchingStats, setMatchingStats] = useState({ total: 0, matched: 0, assigned: 0 });
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const timeAgo = useLastUpdate(lastUpdateTime);

  const [selectedDriverId, setSelectedDriverId] = useState<string>("");

  const fetchingRef = React.useRef(false);

  const fetchCompatibleFreights = useCallback(async () => {
    if (!company?.id) return;

    if (fetchingRef.current) {
      console.log("⏳ [FRETES I.A] Fetch já em andamento, ignorando...");
      return;
    }

    fetchingRef.current = true;
    setLoading(true);

    try {
      console.log("🔍 [FRETES I.A] Buscando fretes para company:", company.id);

      // ✅ ABERTOS = OPEN + IN_NEGOTIATION (mantém compatibilidade com seu sistema)
      const OPEN_STATUSES = ["OPEN", "IN_NEGOTIATION"];

      const { data: freightsData, error: freightsError } = await supabase
        .from("freights")
        .select(
          `
          id, cargo_type, weight, origin_address, destination_address, origin_city, origin_state,
          destination_city, destination_state, pickup_date, delivery_date, price, urgency, status,
          distance_km, minimum_antt_price, service_type, required_trucks, accepted_trucks, created_at, driver_id
        `,
        )
        .in("status", OPEN_STATUSES)
        .is("driver_id", null) // ✅ só o que está realmente disponível
        .order("created_at", { ascending: false })
        .limit(80);

      if (freightsError) throw freightsError;

      console.log("📦 [FRETES I.A] " + (freightsData?.length || 0) + " fretes retornados");

      const normalizedFreights: CompatibleFreight[] = [];
      let discardedByStatus = 0;
      let discardedNoSlots = 0;

      for (const freight of freightsData || []) {
        const idSafe = typeof freight.id === "string" ? freight.id : "";

        const normalizedStatus = normalizeFreightStatus(freight.status);
        const open = isOpenStatus(normalizedStatus);

        if (!open) {
          discardedByStatus++;
          continue;
        }

        const requiredTrucks = Number(freight.required_trucks ?? 1);
        const acceptedTrucks = Number(freight.accepted_trucks ?? 0);
        const hasAvailableSlots = acceptedTrucks < requiredTrucks;

        if (!hasAvailableSlots) {
          discardedNoSlots++;
          continue;
        }

        normalizedFreights.push({
          freight_id: freight.id,
          cargo_type: freight.cargo_type,
          weight: Number(freight.weight ?? 0), // ✅ evita NaN
          origin_address: freight.origin_address || "",
          destination_address: freight.destination_address || "",
          origin_city: freight.origin_city || undefined,
          origin_state: freight.origin_state || undefined,
          destination_city: freight.destination_city || undefined,
          destination_state: freight.destination_state || undefined,
          pickup_date: String(freight.pickup_date || ""),
          delivery_date: String(freight.delivery_date || ""),
          price: Number(freight.price ?? 0),
          urgency: String(freight.urgency || "LOW"),
          status: String(freight.status || "OPEN"),
          service_type: String(freight.service_type || "CARGA"),
          distance_km: Number(freight.distance_km ?? 0),
          minimum_antt_price: Number(freight.minimum_antt_price ?? 0),
          required_trucks: requiredTrucks,
          accepted_trucks: acceptedTrucks,
          created_at: String(freight.created_at || ""),
        });
      }

      console.log(`✅ [FRETES I.A] ${normalizedFreights.length} compatíveis`);
      console.log(`📊 [FRETES I.A] Descartados: ${discardedByStatus} status, ${discardedNoSlots} sem vagas`);

      setCompatibleFreights(normalizedFreights);
      setMatchingStats({
        total: freightsData?.length || 0,
        matched: normalizedFreights.length,
        assigned: drivers?.length || 0,
      });
      setLastUpdateTime(new Date());
    } catch (error: any) {
      console.error("[CompanySmartFreightMatcher] erro:", error);
      toast.error(error?.message || "Erro ao carregar fretes");
      setCompatibleFreights([]);
      setMatchingStats({ total: 0, matched: 0, assigned: 0 });
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [company?.id, drivers?.length]);

  React.useEffect(() => {
    if (company?.id) fetchCompatibleFreights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company?.id]);

  const handleAssignFreight = async (freightId: string) => {
    if (!selectedDriverId) {
      toast.info("Selecione um motorista para atribuir.");
      return;
    }

    try {
      const freight = compatibleFreights.find((f) => f.freight_id === freightId);
      if (!freight) return;

      const { error } = await supabase.from("freight_proposals").insert({
        freight_id: freightId,
        driver_id: selectedDriverId,
        proposed_price: freight.price,
        status: "PENDING",
        message: "Proposta enviada pela transportadora",
      });

      if (error) throw error;

      toast.success("Proposta enviada ao motorista!", {
        description: "Acompanhe em “Em andamento”.",
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
      toast.error("Erro ao atribuir frete ao motorista");
    }
  };

  const filteredFreights = compatibleFreights.filter((freight) => {
    const matchesSearch =
      !searchTerm ||
      (freight.cargo_type || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (freight.origin_address || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (freight.destination_address || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCargoType = selectedCargoType === "all" || freight.cargo_type === selectedCargoType;
    return matchesSearch && matchesCargoType;
  });

  const activeDrivers = (drivers || []).filter((d) => d.status === "ACTIVE");

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

              {/* ✅ seletor de motorista */}
              <div className="w-full sm:w-[320px]">
                <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar motorista para atribuir" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDrivers.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        Nenhum motorista ativo
                      </SelectItem>
                    ) : (
                      activeDrivers.map((d: any) => (
                        <SelectItem key={d.driver_id || d.id} value={String(d.driver_id || d.id)}>
                          {d.name || d.full_name || d.email || String(d.driver_id || d.id).slice(0, 8)}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-primary/5 rounded-lg">
                <div className="text-2xl font-bold text-primary">{matchingStats.total}</div>
                <div className="text-sm text-muted-foreground">Fretes consultados</div>
              </div>
              <div className="text-center p-4 bg-green-500/5 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{filteredFreights.length}</div>
                <div className="text-sm text-muted-foreground">Disponíveis</div>
              </div>
              <div className="text-center p-4 bg-blue-500/5 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{activeDrivers.length}</div>
                <div className="text-sm text-muted-foreground">Motoristas ativos</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Buscando fretes...</p>
          </div>
        ) : filteredFreights.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Nenhum frete disponível</h3>
              <p className="text-muted-foreground mb-4">Não há fretes abertos com vagas no momento.</p>
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
                    weight: Number(freight.weight ?? 0) / 1000 || 0,
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
                  showActions
                  canAcceptFreights={true}
                  isAffiliatedDriver={false}
                  onAction={() => fetchCompatibleFreights()}
                />

                <div className="mt-2 flex gap-2 flex-wrap items-center">
                  <Button
                    className="flex-1"
                    onClick={() => handleAssignFreight(freight.freight_id)}
                    disabled={!selectedDriverId || selectedDriverId === "__none"}
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
      </div>
    </div>
  );
};
