import React, { useMemo, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Truck, Wrench, Bike, MapPin, Clock, RefreshCw, ArrowRight, 
  Phone, MessageSquare, Navigation, CheckCircle, Loader2, Map, FileText,
  Play, Package, User, AlertTriangle, Calendar
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatBRL, formatKm, formatTons, formatDate } from "@/lib/formatters";
import { getFreightStatusLabel, getFreightStatusVariant, normalizeFreightStatus } from "@/lib/freight-status";
import { getDaysUntilPickup, getPickupDateBadge } from "@/utils/freightDateHelpers";
import { cn } from "@/lib/utils";
import { lazy, Suspense } from "react";

// Lazy load do mapa
const FreightRealtimeMap = lazy(() => 
  import('@/components/freight/FreightRealtimeMapMapLibre').then(module => ({ 
    default: module.FreightRealtimeMapMapLibre 
  }))
);

type FreightRow = {
  id: string;
  created_at: string;
  status: string;
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
  // Dados do produtor (via join)
  producer?: {
    id: string;
    full_name: string;
    contact_phone: string | null;
  } | null;
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

// Mapeamento de status para próximo status
const getNextStatus = (currentStatus: string): { next: string; label: string; icon: React.ReactNode } | null => {
  const normalized = normalizeFreightStatus(currentStatus);
  const statusFlow: Record<string, { next: string; label: string; icon: React.ReactNode }> = {
    'ACCEPTED': { next: 'LOADING', label: 'Iniciar Viagem', icon: <Play className="h-4 w-4" /> },
    'LOADING': { next: 'LOADED', label: 'Confirmar Carregamento', icon: <Package className="h-4 w-4" /> },
    'LOADED': { next: 'IN_TRANSIT', label: 'Iniciar Transporte', icon: <Navigation className="h-4 w-4" /> },
    'IN_TRANSIT': { next: 'DELIVERED_PENDING_CONFIRMATION', label: 'Reportar Entrega', icon: <CheckCircle className="h-4 w-4" /> },
  };
  return statusFlow[normalized] || null;
};

// Componente de Card de Frete Completo para Motorista
const DriverFreightCard: React.FC<{
  freight: FreightRow;
  onStatusUpdate: () => void;
  onOpenDetails: () => void;
}> = ({ freight, onStatusUpdate, onOpenDetails }) => {
  const [activeTab, setActiveTab] = useState<string>('details');
  const [mapMounted, setMapMounted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const { profile } = useAuth();

  const normalizedStatus = normalizeFreightStatus(freight.status ?? '');
  const canShowMap = ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'].includes(normalizedStatus);
  const nextAction = getNextStatus(freight.status);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (value === 'map' && !mapMounted) {
      setMapMounted(true);
    }
  };

  const handleStatusUpdate = async () => {
    if (!nextAction || isUpdating) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('freights')
        .update({ status: nextAction.next as any })
        .eq('id', freight.id)
        .eq('driver_id', profile?.id);

      if (error) throw error;
      
      toast.success(`Status atualizado para: ${statusLabel(nextAction.next)}`);
      onStatusUpdate();
    } catch (err: any) {
      console.error('Erro ao atualizar status:', err);
      toast.error('Falha ao atualizar status do frete');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleWhatsApp = () => {
    const phone = freight.producer?.contact_phone;
    if (!phone) {
      toast.error('Telefone do produtor não disponível');
      return;
    }
    const cleaned = phone.replace(/\D/g, '');
    const formatted = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
    window.open(`https://wa.me/${formatted}`, '_blank');
  };

  const handleCall = () => {
    const phone = freight.producer?.contact_phone;
    if (!phone) {
      toast.error('Telefone do produtor não disponível');
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  // Badge de dias até coleta
  const pickupBadge = freight.pickup_date ? getPickupDateBadge(freight.pickup_date) : null;

  return (
    <Card className="h-full flex flex-col border-l-4 border-l-primary hover:shadow-lg transition-all overflow-hidden">
      <CardHeader className="pb-2">
        {/* Cargo Type e Status */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">{freight.cargo_type || "Carga"}</CardTitle>
          </div>
          <Badge variant={statusVariant(freight.status)}>
            {statusLabel(freight.status)}
          </Badge>
        </div>

        {/* Rota: Origem → Destino */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold truncate">
            {freight.origin_city || "Origem"}, {freight.origin_state || ""}
          </span>
          <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="font-semibold truncate">
            {freight.destination_city || "Destino"}, {freight.destination_state || ""}
          </span>
        </div>

        {/* Pílulas de informação */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {typeof freight.weight === 'number' && freight.weight > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium">
              <Package className="h-3.5 w-3.5 text-primary" />
              <span>{formatTons(freight.weight)}</span>
            </div>
          )}
          {typeof freight.distance_km === 'number' && freight.distance_km > 0 && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium">
              <MapPin className="h-3.5 w-3.5 text-primary" />
              <span>{formatKm(freight.distance_km)}</span>
            </div>
          )}
          {freight.pickup_date && (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-muted/40 rounded text-xs font-medium">
              <Calendar className="h-3.5 w-3.5 text-warning" />
              <span>{formatDate(freight.pickup_date)}</span>
            </div>
          )}
          {pickupBadge && (
            <Badge variant={pickupBadge.variant} className="text-xs flex items-center gap-1">
              {pickupBadge.icon === 'AlertTriangle' && <AlertTriangle className="h-3 w-3" />}
              {pickupBadge.icon === 'Clock' && <Clock className="h-3 w-3" />}
              {pickupBadge.icon === 'Calendar' && <Calendar className="h-3 w-3" />}
              {pickupBadge.text}
            </Badge>
          )}
        </div>

        {/* Valor do Frete */}
        {typeof freight.price === 'number' && (
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm text-muted-foreground">Valor:</span>
            <span className="font-bold text-lg text-primary">{formatBRL(freight.price, true)}</span>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-2 flex-1 pt-0">
        {/* Abas: Detalhes e Mapa */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="details" className="text-xs flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Detalhes
            </TabsTrigger>
            <TabsTrigger 
              value="map" 
              className="text-xs flex items-center gap-1.5"
              disabled={!canShowMap}
            >
              <Map className="h-3.5 w-3.5" />
              Mapa
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 flex flex-col mt-2 space-y-3">
            {/* Informações do Produtor */}
            <div className="p-3 bg-muted/30 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Produtor</span>
              </div>
              <p className="text-sm">{freight.producer?.full_name || "Não informado"}</p>
              
              {/* Botões de contato */}
              {freight.producer?.contact_phone && (
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8"
                    onClick={handleWhatsApp}
                  >
                    <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8"
                    onClick={handleCall}
                  >
                    <Phone className="h-3.5 w-3.5 mr-1.5" />
                    Ligar
                  </Button>
                </div>
              )}
            </div>

            {/* Ação Principal de Progressão de Status */}
            {nextAction && (
              <Button
                className="w-full"
                onClick={handleStatusUpdate}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  nextAction.icon
                )}
                <span className="ml-2">{nextAction.label}</span>
              </Button>
            )}

            {/* Botão Ver Detalhes Completos */}
            <Button
              variant="outline"
              className="w-full"
              onClick={onOpenDetails}
            >
              Ver Detalhes Completos
            </Button>
          </TabsContent>

          <TabsContent value="map" className="flex-1 mt-2">
            {mapMounted ? (
              <Suspense fallback={
                <div className="flex items-center justify-center h-[280px] bg-muted/30 rounded-lg">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span className="text-sm">Carregando mapa...</span>
                  </div>
                </div>
              }>
                <FreightRealtimeMap
                  freightId={freight.id}
                  originLat={freight.origin_lat ?? undefined}
                  originLng={freight.origin_lng ?? undefined}
                  destinationLat={freight.destination_lat ?? undefined}
                  destinationLng={freight.destination_lng ?? undefined}
                  originCity={freight.origin_city ?? undefined}
                  originState={freight.origin_state ?? undefined}
                  destinationCity={freight.destination_city ?? undefined}
                  destinationState={freight.destination_state ?? undefined}
                />
              </Suspense>
            ) : (
              <div className="flex items-center justify-center h-[280px] bg-muted/30 rounded-lg">
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Map className="h-8 w-8 opacity-50" />
                  <span className="text-sm">Clique para carregar o mapa</span>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export const DriverOngoingTab: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const driverProfileId = profile?.id;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["driver-ongoing-all", driverProfileId],
    enabled: Boolean(driverProfileId),
    staleTime: 30000, // 30 segundos
    queryFn: async () => {
      if (!driverProfileId) return { freights: [] as FreightRow[], serviceRequests: [] as ServiceRequestRow[] };

      // 1) FRETES (rurais) com JOIN no produtor
      const freightOngoingStatuses = ["ACCEPTED", "LOADING", "LOADED", "IN_TRANSIT", "DELIVERED_PENDING_CONFIRMATION"] as const;

      const { data: freights, error: freErr } = await supabase
        .from("freights")
        .select(`
          id,
          created_at,
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

      // 2) SERVICE REQUESTS (urbano: moto/guincho/mudança)
      const srOngoingStatuses = ["ACCEPTED", "IN_PROGRESS"];

      const { data: serviceRequests, error: srErr } = await supabase
        .from("service_requests_secure")
        .select(`
          id,
          created_at,
          status,
          service_type,
          location_address,
          city_name,
          state,
          problem_description,
          estimated_price,
          urgency,
          is_emergency,
          accepted_at
        `)
        .eq("provider_id", driverProfileId)
        .in("status", srOngoingStatuses)
        .order("accepted_at", { ascending: false })
        .order("created_at", { ascending: false });

      if (srErr) throw srErr;

      return {
        freights: (freights || []) as FreightRow[],
        serviceRequests: (serviceRequests || []) as ServiceRequestRow[],
      };
    },
  });

  const freights = data?.freights || [];
  const serviceRequests = data?.serviceRequests || [];

  const totalOngoing = useMemo(
    () => freights.length + serviceRequests.length,
    [freights.length, serviceRequests.length],
  );

  const handleStatusUpdate = useCallback(() => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['driver-ongoing'] });
  }, [refetch, queryClient]);

  const handleOpenDetails = useCallback((freightId: string) => {
    // TODO: Navegar para tela de detalhes ou abrir modal
    console.log('Open details for freight:', freightId);
    toast.info('Detalhes do frete em desenvolvimento');
  }, []);

  const handleCompleteService = async (serviceId: string) => {
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({ status: "COMPLETED", completed_at: new Date().toISOString() })
        .eq("id", serviceId)
        .eq("provider_id", driverProfileId)
        .in("status", ["ACCEPTED", "IN_PROGRESS"]);
      
      if (error) throw error;
      
      toast.success("Chamado finalizado com sucesso!");
      refetch();
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao finalizar chamado.");
    }
  };

  if (!driverProfileId) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          Perfil do motorista não encontrado.
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Em Andamento</h3>
          <p className="text-sm text-muted-foreground">Fretes rurais + chamados urbanos aceitos</p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="secondary">{totalOngoing}</Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Empty */}
      {totalOngoing === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-3 h-10 w-10 text-muted-foreground flex items-center justify-center">
              <Truck className="h-10 w-10" />
            </div>
            <p className="font-medium">Nenhum frete em andamento</p>
            <p className="text-sm text-muted-foreground mt-1">
              Quando você aceitar um frete rural ou um chamado (moto/guincho/mudança), ele aparecerá aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Freights (Rural) - Com Card Completo */}
          {freights.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Fretes Rurais ({freights.length})
              </h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {freights.map((f) => (
                  <DriverFreightCard
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
                            R$ {Number(r.estimated_price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Aceito em {new Date(r.accepted_at || r.created_at).toLocaleString("pt-BR")}</span>
                      </div>

                      {/* Botões de Ação */}
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
    </div>
  );
};
