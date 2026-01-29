import React, { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import { 
  Truck, Wrench, Bike, MapPin, Clock, RefreshCw, 
  Phone, MessageSquare, Navigation, CheckCircle, Loader2,
  Play, Package, AlertTriangle, ArrowRight
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatters";
import { LABELS } from "@/lib/labels";
import { normalizeFreightStatus } from "@/lib/freight-status";
import { cn } from "@/lib/utils";
import { FreightDetails } from "@/components/FreightDetails";
import { driverUpdateFreightStatus, FINAL_STATUSES } from "@/lib/freight-status-helpers";
import { MyAssignmentCard } from "@/components/MyAssignmentCard";
import { FreightInProgressCard } from "@/components/FreightInProgressCard";

type FreightRow = {
  id: string;
  created_at: string;
  status: string;
  updated_at?: string | null;
  cargo_type: string | null;
  price: number | null;
  weight: number | null;
  distance_km: number | null;
  origin_address: string | null;
  destination_address: string | null;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  origin_lat: number | null;
  origin_lng: number | null;
  destination_lat: number | null;
  destination_lng: number | null;
  pickup_date: string | null;
  delivery_date: string | null;
  service_type: string | null;
  urgency: string | null;
  producer_id: string | null;
  required_trucks: number | null;
  accepted_trucks?: number | null;
  drivers_assigned?: string[] | null;
  current_lat?: number | null;
  current_lng?: number | null;
  last_location_update?: string | null;
  tracking_status?: string | null;
  producer?: {
    id: string;
    full_name: string;
    contact_phone: string | null;
  } | null;
};

type AssignmentRow = {
  id: string;
  status: string;
  agreed_price: number | null;
  accepted_at: string | null;
  company_id?: string | null;
  freight: FreightRow | null;
};

type ServiceRequestRow = {
  id: string;
  created_at: string;
  status: string;
  service_type: string | null;
  location_address: string | null;
  city_name: string | null;
  state: string | null;
  problem_description: string | null;
  estimated_price: number | null;
  urgency: string | null;
  is_emergency: boolean | null;
  accepted_at: string | null;
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    OPEN: "Aberto",
    IN_NEGOTIATION: "Em Negociação",
    ACCEPTED: "Aceito",
    LOADING: "A Caminho da Coleta",
    LOADED: "Carregado",
    IN_TRANSIT: "Em Transporte",
    DELIVERED: "Entregue",
    DELIVERED_PENDING_CONFIRMATION: "Entrega Reportada",
    COMPLETED: "Concluído",
    CANCELLED: "Cancelado",
    REJECTED: "Rejeitado",
    PENDING: "Pendente",
    IN_PROGRESS: "Em Andamento",
  };
  return map[status] || status;
};

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (["COMPLETED", "DELIVERED"].includes(status)) return "default";
  if (["IN_TRANSIT", "LOADING", "IN_PROGRESS", "ACCEPTED", "LOADED"].includes(status)) return "secondary";
  if (["CANCELLED", "REJECTED"].includes(status)) return "destructive";
  return "outline";
};

const serviceIcon = (serviceType?: string | null) => {
  const t = String(serviceType || "").toUpperCase();
  if (t.includes("GUINCHO")) return <Wrench className="h-5 w-5" />;
  if (t.includes("MOTO")) return <Bike className="h-5 w-5" />;
  return <Truck className="h-5 w-5" />;
};

const serviceTitle = (serviceType?: string | null) => {
  const t = String(serviceType || "").toUpperCase();
  if (t.includes("GUINCHO")) return "Guincho";
  if (t.includes("MOTO")) return "Frete Moto";
  if (t.includes("MUDANCA")) return "Mudança";
  return "Serviço";
};

// ============ Card de Frete com Botões de Ação para Motorista ============
// Para motoristas com fretes multi-carreta: calcula o valor POR CARRETA que o motorista receberá
const DriverFreightCardWithActions: React.FC<{
  freight: FreightRow;
  onStatusUpdate: () => void;
  onOpenDetails: () => void;
}> = ({ freight, onStatusUpdate, onOpenDetails }) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { profile } = useAuth();

  const normalizedStatus = normalizeFreightStatus(freight.status ?? '');
  const isFinal = FINAL_STATUSES.includes(normalizedStatus as any);

  const handleSetStatus = async (newStatus: string) => {
    if (!profile?.id || isUpdating || isFinal) return;

    setIsUpdating(true);
    try {
      const ok = await driverUpdateFreightStatus({
        freightId: freight.id,
        newStatus,
        currentUserProfile: profile,
      });

      if (ok) {
        onStatusUpdate();
      }
    } finally {
      setIsUpdating(false);
    }
  };

  // CORREÇÃO CRÍTICA: Para motoristas, calcular o valor que ELE vai receber (1 carreta)
  // Se o frete tem múltiplas carretas (required_trucks > 1), dividir o valor total
  const requiredTrucks = freight.required_trucks ?? 1;
  const driverPrice = requiredTrucks > 1 
    ? Math.round((freight.price ?? 0) / requiredTrucks) 
    : (freight.price ?? 0);

  // Mapeamento para FreightInProgressCard
  // IMPORTANTE: Passar required_trucks = 1 para que o card NÃO divida novamente
  const mappedFreight = {
    ...freight,
    weight: freight.weight ?? 0,
    distance_km: freight.distance_km ?? 0,
    pickup_date: freight.pickup_date ?? new Date().toISOString(),
    // O preço já é o valor do motorista (já dividido se multi-carreta)
    price: driverPrice,
    // FORÇAR 1 para não dividir de novo dentro do FreightInProgressCard
    required_trucks: 1,
    status: freight.status ?? 'OPEN',
    service_type: freight.service_type as 'CARGA' | 'GUINCHO' | 'MUDANCA' | 'FRETE_MOTO' | undefined,
    driver_profiles: freight.producer ? { full_name: freight.producer.full_name } : null,
  };

  // Botão de ação baseado no status
  const getActionButton = () => {
    if (isUpdating) {
      return (
        <Button className="w-full" disabled>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Atualizando...
        </Button>
      );
    }

    switch (normalizedStatus) {
      case 'ACCEPTED':
        return (
          <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleSetStatus('LOADING')}>
            <Truck className="h-4 w-4 mr-2" /> Marcar como "A caminho"
          </Button>
        );
      case 'LOADING':
        return (
          <Button className="w-full bg-amber-600 hover:bg-amber-700" onClick={() => handleSetStatus('LOADED')}>
            <Package className="h-4 w-4 mr-2" /> Confirmar Carregamento
          </Button>
        );
      case 'LOADED':
        return (
          <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleSetStatus('IN_TRANSIT')}>
            <Navigation className="h-4 w-4 mr-2" /> Iniciar Trânsito
          </Button>
        );
      case 'IN_TRANSIT':
        return (
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => handleSetStatus('DELIVERED_PENDING_CONFIRMATION')}>
            <CheckCircle className="h-4 w-4 mr-2" /> Reportar Entrega
          </Button>
        );
      default:
        return null;
    }
  };

  return (
    <Card className={cn(
      "overflow-hidden border-l-4 hover:shadow-lg transition-all",
      normalizedStatus === 'IN_TRANSIT' ? "border-l-green-500" : "border-l-primary"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          {/* Origem → Destino */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm truncate">
                {freight.origin_city && freight.origin_state
                  ? `${freight.origin_city} — ${freight.origin_state.length > 2 ? freight.origin_state.substring(0, 2).toUpperCase() : freight.origin_state}`
                  : 'Origem'}
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-semibold text-sm truncate">
                {freight.destination_city && freight.destination_state
                  ? `${freight.destination_city} — ${freight.destination_state.length > 2 ? freight.destination_state.substring(0, 2).toUpperCase() : freight.destination_state}`
                  : 'Destino'}
              </span>
            </div>
          </div>

          {/* Status badge */}
          <Badge variant={statusVariant(normalizedStatus)} className="shrink-0">
            {statusLabel(normalizedStatus)}
          </Badge>
        </div>

        {/* Preço e info de multi-carreta */}
        <div className="flex items-end justify-between mt-2">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" />
              {freight.weight ? `${(freight.weight / 1000).toFixed(0)}t` : '-'}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {freight.distance_km ? `${freight.distance_km.toLocaleString('pt-BR')} km` : '-'}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {freight.pickup_date ? new Date(freight.pickup_date).toLocaleDateString('pt-BR') : '-'}
            </span>
          </div>

          <div className="text-right">
            <p className="font-bold text-lg text-primary">
              {formatBRL(driverPrice, true)}
            </p>
            {requiredTrucks > 1 && (
              <p className="text-[10px] text-muted-foreground">
                Sua carreta (1 de {requiredTrucks})
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Produtor */}
        {freight.producer && (
          <div className="flex items-center justify-between text-sm bg-muted/30 p-2 rounded">
            <span className="text-muted-foreground">Produtor:</span>
            <span className="font-medium">{freight.producer.full_name}</span>
          </div>
        )}

        {/* Cargo type */}
        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="capitalize">
            {LABELS[freight.cargo_type?.toUpperCase() as keyof typeof LABELS] || freight.cargo_type || 'Carga'}
          </Badge>
          {freight.service_type && (
            <Badge variant="secondary" className="capitalize">
              {freight.service_type === 'CARGA' ? 'Frete Rural' : freight.service_type}
            </Badge>
          )}
        </div>

        {/* Botão de ação principal */}
        {!isFinal && getActionButton()}

        {/* Botão ver detalhes */}
        <Button variant="outline" className="w-full" onClick={onOpenDetails}>
          Ver Detalhes Completos
        </Button>
      </CardContent>
    </Card>
  );
};

export const DriverOngoingTab: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const driverProfileId = profile?.id;
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["driver-ongoing-all", driverProfileId],
    enabled: Boolean(driverProfileId),
    staleTime: 30000,
    queryFn: async () => {
      if (!driverProfileId) return { freights: [] as FreightRow[], assignments: [] as AssignmentRow[], serviceRequests: [] as ServiceRequestRow[] };

      const freightOngoingStatuses = ["ACCEPTED", "LOADING", "LOADED", "IN_TRANSIT", "DELIVERED_PENDING_CONFIRMATION"] as const;

      // 1) FRETES (rurais) com JOIN no produtor
      const { data: directFreights, error: freErr } = await supabase
        .from("freights")
        .select(`
          id,
          created_at,
          updated_at,
          status,
          cargo_type,
          price,
          weight,
          distance_km,
          origin_address,
          destination_address,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          origin_lat,
          origin_lng,
          destination_lat,
          destination_lng,
          pickup_date,
          delivery_date,
          service_type,
          urgency,
          producer_id,
          required_trucks,
          accepted_trucks,
          drivers_assigned,
          current_lat,
          current_lng,
          last_location_update,
          tracking_status,
          producer:profiles!freights_producer_id_fkey(
            id,
            full_name,
            contact_phone
          )
        `)
        .eq("driver_id", driverProfileId)
        .in("status", freightOngoingStatuses)
        .order("created_at", { ascending: false });

      if (freErr) throw freErr;

      // Multi-carretas (drivers_assigned)
      const { data: multiTruckFreights, error: multiTruckError } = await supabase
        .from("freights")
        .select(`
          id,
          created_at,
          updated_at,
          status,
          cargo_type,
          price,
          weight,
          distance_km,
          origin_address,
          destination_address,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          origin_lat,
          origin_lng,
          destination_lat,
          destination_lng,
          pickup_date,
          delivery_date,
          service_type,
          urgency,
          producer_id,
          required_trucks,
          accepted_trucks,
          drivers_assigned,
          current_lat,
          current_lng,
          last_location_update,
          tracking_status,
          producer:profiles!freights_producer_id_fkey(
            id,
            full_name,
            contact_phone
          )
        `)
        .contains('drivers_assigned', [driverProfileId])
        .eq('status', 'OPEN')
        .gt('accepted_trucks', 0)
        .order('updated_at', { ascending: false });

      if (multiTruckError) {
        console.warn('[DriverOngoingTab] Falha ao buscar multi-carretas:', multiTruckError);
      }

      // ASSIGNMENTS (freight_assignments)
      const { data: assignments, error: asgErr } = await supabase
        .from('freight_assignments')
        .select(`
          id,
          status,
          agreed_price,
          accepted_at,
          company_id,
          freight:freights(
            id,
            created_at,
            updated_at,
            status,
            cargo_type,
            price,
            weight,
            distance_km,
            origin_address,
            destination_address,
            origin_city,
            origin_state,
            destination_city,
            destination_state,
            origin_lat,
            origin_lng,
            destination_lat,
            destination_lng,
            pickup_date,
            delivery_date,
            service_type,
            urgency,
            producer_id,
            required_trucks,
            accepted_trucks,
            drivers_assigned,
            current_lat,
            current_lng,
            last_location_update,
            tracking_status,
            producer:profiles!freights_producer_id_fkey(
              id,
              full_name,
              contact_phone
            )
          )
        `)
        .eq('driver_id', driverProfileId)
        .in('status', freightOngoingStatuses)
        .order('accepted_at', { ascending: false });

      if (asgErr) {
        console.warn('[DriverOngoingTab] Falha ao buscar assignments:', asgErr);
      }

      // SERVICE REQUESTS (GUINCHO/MUDANCA)
      const { data: svcReqs, error: svcErr } = await supabase
        .from("service_requests_secure")
        .select("*")
        .eq("provider_id", driverProfileId)
        .in("service_type", ["GUINCHO", "MUDANCA", "FRETE_URBANO", "FRETE_MOTO"])
        .in("status", ["ACCEPTED", "ON_THE_WAY", "IN_PROGRESS"])
        .order("accepted_at", { ascending: false })
        .limit(50);

      if (svcErr) {
        console.warn("[DriverOngoingTab] Falha ao buscar service_requests:", svcErr);
      }

      // Combina fretes diretos + multi-carretas
      const combinedFreights = [...(directFreights || []), ...(multiTruckFreights || [])];
      const uniqueFreights = combinedFreights.reduce((acc, f) => {
        if (!acc.find(x => x.id === f.id)) acc.push(f);
        return acc;
      }, [] as FreightRow[]);

      // ✅ EVITAR DUPLICIDADE: se o frete já estiver em freight_assignments, não mostrar também em "Fretes Rurais"
      const assignmentFreightIds = new Set(
        (assignments || []).map((a: any) => a?.freight?.id).filter(Boolean)
      );
      const freightsWithoutAssignmentDuplicates = uniqueFreights.filter(
        (f) => !assignmentFreightIds.has(f.id)
      );

      return {
        freights: freightsWithoutAssignmentDuplicates,
        assignments: (assignments || []).filter(a => a.freight) as AssignmentRow[],
        serviceRequests: (svcReqs || []) as ServiceRequestRow[],
      };
    },
  });

  const freights = data?.freights ?? [];
  const assignments = data?.assignments ?? [];
  const serviceRequests = data?.serviceRequests ?? [];

  const hasTransportCompanyLink = useMemo(() => {
    const anyAssignmentHasCompany = assignments.some((a: any) => !!a?.company_id);
    const roleSuggestsAffiliation = profile?.role === 'MOTORISTA_AFILIADO';
    const profileHasCompany = Boolean((profile as any)?.company_id);
    return anyAssignmentHasCompany || roleSuggestsAffiliation || profileHasCompany;
  }, [assignments, profile]);

  const totalCount = freights.length + assignments.length + serviceRequests.length;

  const handleStatusUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["driver-ongoing-all"] });
    refetch();
  }, [queryClient, refetch]);

  const handleOpenDetails = useCallback((freightId: string) => {
    setSelectedFreightId(freightId);
  }, []);

  const handleCompleteService = useCallback(async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: "COMPLETED" })
        .eq("id", serviceId)
        .eq("provider_id", driverProfileId);

      if (error) throw error;
      toast.success("Chamado finalizado com sucesso!");
      refetch();
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao finalizar o chamado.");
    }
  }, [driverProfileId, refetch]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Play className="h-5 w-5 text-primary" />
          Fretes Em Andamento ({totalCount})
        </h3>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </div>

      {/* Empty state */}
      {totalCount === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-lg mb-2">
              Nenhum frete em andamento
            </p>
            <p className="text-sm text-muted-foreground">
              Aceite um frete disponível para começar
            </p>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {totalCount > 0 && (
        <>
          {/* Assignments da Transportadora */}
          {assignments.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                {hasTransportCompanyLink
                  ? `Fretes via Transportadora (${assignments.length})`
                  : `Fretes Aceitos (${assignments.length})`}
              </h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {assignments.map((a) => (
                  <MyAssignmentCard
                    key={a.id}
                    assignment={{
                      ...a,
                      freight: a.freight
                        ? {
                            ...a.freight,
                            // Para motorista: exibir valor do acordo (não o total do frete)
                            price: a.agreed_price ?? a.freight.price,
                            // Evita que o FreightInProgressCard divida de novo o valor por carreta
                            required_trucks: a.agreed_price ? 1 : (a.freight as any).required_trucks,
                          }
                        : null,
                    }}
                    onAction={() => {
                      if (a.freight?.id) handleOpenDetails(a.freight.id);
                      handleStatusUpdate();
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Freights Rurais - Com Card Padrão + Botões de Ação */}
          {freights.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Fretes Rurais ({freights.length})
              </h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {freights.map((f) => (
                  <DriverFreightCardWithActions
                    key={f.id}
                    freight={f}
                    onStatusUpdate={handleStatusUpdate}
                    onOpenDetails={() => handleOpenDetails(f.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Service Requests (Moto/Guincho/Mudança) */}
          {serviceRequests.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Bike className="h-4 w-4" />
                Chamados Urbanos ({serviceRequests.length})
              </h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {serviceRequests.map((r) => (
                  <Card key={r.id} className="overflow-hidden border-l-4 border-l-orange-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          {serviceIcon(r.service_type)}
                          <CardTitle className="text-base">{serviceTitle(r.service_type)}</CardTitle>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={statusVariant(r.status)}>{statusLabel(r.status)}</Badge>
                          {r.is_emergency && <Badge variant="destructive">🚨 Emergência</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium">
                            {(r.city_name || "Cidade não informada").toUpperCase()} {r.state ? `- ${r.state}` : ""}
                          </p>
                          <p className="text-muted-foreground line-clamp-2">
                            {r.location_address || "Endereço não informado"}
                          </p>
                        </div>
                      </div>
                      {r.problem_description && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Descrição: </span>
                          <span className="line-clamp-2">{r.problem_description}</span>
                        </div>
                      )}
                      {typeof r.estimated_price === "number" && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Valor: </span>
                          <span className="font-semibold text-primary">
                            {formatBRL(r.estimated_price, true)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Aceito em {new Date(r.accepted_at || r.created_at).toLocaleString("pt-BR")}</span>
                      </div>
                      <div className="space-y-2 pt-2">
                        {r.status === "ACCEPTED" && (
                          <Button
                            className="w-full"
                            variant="secondary"
                            onClick={async () => {
                              try {
                                const { error } = await supabase
                                  .from("service_requests")
                                  .update({ status: "IN_PROGRESS" })
                                  .eq("id", r.id)
                                  .eq("provider_id", driverProfileId)
                                  .in("status", ["ACCEPTED"]);
                                if (error) throw error;
                                toast.success("Atendimento iniciado!");
                                refetch();
                              } catch (e: any) {
                                console.error(e);
                                toast.error("Falha ao atualizar status do chamado.");
                              }
                            }}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Iniciar Atendimento
                          </Button>
                        )}
                        {r.status === "IN_PROGRESS" && (
                          <Button
                            className="w-full"
                            onClick={() => handleCompleteService(r.id)}
                          >
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Finalizar Chamado
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de detalhes */}
      <Dialog
        open={!!selectedFreightId}
        onOpenChange={(open) => {
          if (!open) setSelectedFreightId(null);
        }}
      >
        <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto [&>button.absolute]:hidden">
          <DialogDescription className="sr-only">Detalhes completos do frete</DialogDescription>
          {selectedFreightId && profile && (
            <FreightDetails
              freightId={selectedFreightId}
              currentUserProfile={profile}
              initialTab="status"
              onClose={() => setSelectedFreightId(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
