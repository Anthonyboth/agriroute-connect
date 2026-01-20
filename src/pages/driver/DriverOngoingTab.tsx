import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Truck, Wrench, Bike, MapPin, Clock, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type FreightRow = {
  id: string;
  created_at: string;
  status: string;
  cargo_type: string | null;
  price: number | null;
  origin_address: string | null;
  destination_address: string | null;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  service_type: string | null;
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
  if (["IN_TRANSIT", "LOADING", "IN_PROGRESS", "ACCEPTED"].includes(status)) return "secondary";
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

export const DriverOngoingTab: React.FC = () => {
  const { profile } = useAuth();

  const driverProfileId = profile?.id;

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["driver-ongoing-all", driverProfileId],
    enabled: Boolean(driverProfileId),
    queryFn: async () => {
      if (!driverProfileId) return { freights: [] as FreightRow[], serviceRequests: [] as ServiceRequestRow[] };

      // 1) FRETES (rurais)
      const freightOngoingStatuses = ["ACCEPTED", "LOADING", "LOADED", "IN_TRANSIT", "DELIVERED_PENDING_CONFIRMATION"];

      const { data: freights, error: freErr } = await supabase
        .from("freights")
        .select(
          `
          id,
          created_at,
          status,
          cargo_type,
          price,
          origin_address,
          destination_address,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          service_type
        `,
        )
        .eq("driver_id", driverProfileId)
        .in("status", freightOngoingStatuses)
        .order("created_at", { ascending: false });

      if (freErr) throw freErr;

      // 2) SERVICE REQUESTS (urbano: moto/guincho/mudança)
      // IMPORTANTÍSSIMO: Aqui é o motivo de não aparecer.
      // A aba "Em Andamento" precisa listar os serviços aceitos do motorista.
      const srOngoingStatuses = ["ACCEPTED", "IN_PROGRESS"];

      const { data: serviceRequests, error: srErr } = await supabase
        .from("service_requests")
        .select(
          `
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
        `,
        )
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
          <Skeleton key={i} className="h-32 w-full" />
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
          {/* Service Requests (Moto/Guincho/Mudança) */}
          {serviceRequests.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold">Chamados Urbanos</h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {serviceRequests.map((r) => (
                  <Card key={r.id} className="overflow-hidden">
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

                      {/* Botão opcional: marcar como IN_PROGRESS (se você quiser fluxo) */}
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
                              toast.success("Chamado movido para Em Andamento.");
                              refetch();
                            } catch (e: any) {
                              console.error(e);
                              toast.error("Falha ao atualizar status do chamado.");
                            }
                          }}
                        >
                          Iniciar atendimento
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Freights (Rural) */}
          {freights.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold">Fretes Rurais</h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {freights.map((f) => (
                  <Card key={f.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{f.cargo_type || "Frete"}</CardTitle>
                        <Badge variant={statusVariant(f.status)}>{statusLabel(f.status)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="text-sm">
                        <p className="font-medium">
                          {(f.origin_city || "Origem").toString()}, {(f.origin_state || "").toString()}
                        </p>
                        <p className="text-muted-foreground">↓</p>
                        <p className="font-medium">
                          {(f.destination_city || "Destino").toString()}, {(f.destination_state || "").toString()}
                        </p>
                      </div>

                      {typeof f.price === "number" && (
                        <div className="text-sm">
                          <span className="text-muted-foreground">Valor: </span>
                          <span className="font-semibold text-primary">
                            R$ {Number(f.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Criado em {new Date(f.created_at).toLocaleString("pt-BR")}</span>
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
