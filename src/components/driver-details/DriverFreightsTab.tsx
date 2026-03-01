import React, { useMemo } from "react";
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UnifiedServiceCard } from "@/components/UnifiedServiceCard";

import { Truck, MapPin, Calendar, Bike, Wrench, Package, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface DriverFreightsTabProps {
  driverProfileId: string;
  companyId?: string;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const getStatusBadge = (status: string) => {
  const statusLabels: Record<string, string> = {
    // freights
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

    // service_requests
    ON_THE_WAY: "A caminho",
    IN_PROGRESS: "Em progresso",
  };

  const variants: Record<string, BadgeVariant> = {
    COMPLETED: "default",
    DELIVERED: "default",
    IN_TRANSIT: "secondary",
    LOADING: "secondary",
    LOADED: "secondary",
    ACCEPTED: "secondary",
    ON_THE_WAY: "secondary",
    IN_PROGRESS: "secondary",
    CANCELLED: "destructive",
    REJECTED: "destructive",
    PENDING: "outline",
    OPEN: "outline",
  };

  const label = statusLabels[status] || status;
  return <Badge variant={variants[status] || "outline"}>{label}</Badge>;
};

const getServiceIcon = (serviceType: string) => {
  switch (serviceType) {
    case "FRETE_MOTO":
      return <Bike className="h-4 w-4" />;
    case "GUINCHO":
      return <Wrench className="h-4 w-4" />;
    case "MUDANCA_RESIDENCIAL":
    case "MUDANCA_COMERCIAL":
    case "MUDANCA":
      return <Package className="h-4 w-4" />;
    case "FRETE_URBANO":
    default:
      return <Truck className="h-4 w-4" />;
  }
};

const getServiceLabel = (serviceType: string) => {
  switch (serviceType) {
    case "FRETE_MOTO":
      return "Frete por Moto";
    case "FRETE_URBANO":
      return "Frete Urbano";
    case "GUINCHO":
      return "Guincho";
    case "MUDANCA_RESIDENCIAL":
      return "Mudança Residencial";
    case "MUDANCA_COMERCIAL":
      return "Mudança Comercial";
    case "MUDANCA":
      return "Mudança";
    default:
      return serviceType || "Frete Urbano";
  }
};

export const DriverFreightsTab = ({ driverProfileId, companyId }: DriverFreightsTabProps) => {
  const queryClient = useQueryClient();

  // Fretes atribuídos ao motorista (tabela freights + freight_assignments)
  const {
    data: freights,
    isLoading: isLoadingFreights,
    error: freightsError,
  } = useQuery({
    queryKey: ["driver-freights", driverProfileId],
    enabled: !!driverProfileId,
    queryFn: async () => {
      // 1. Fretes diretos (driver_id)
      const { data: directFreights, error: directError } = await supabase
        .from("freights")
        .select(
          `
          id,
          created_at,
          status,
          price,
          cargo_type,
          producer:producer_id(full_name),
          origin_city:origin_city_id(name, state),
          destination_city:destination_city_id(name, state)
        `,
        )
        .eq("driver_id", driverProfileId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (directError) throw directError;

      // 2. Fretes via freight_assignments (multi-truck)
      const assignmentResult: any = await supabase
        .from("freight_assignments" as any)
        .select("freight_id, status")
        .eq("driver_profile_id", driverProfileId)
        .limit(50);
      const assignmentData = assignmentResult?.data;
      const assignError = assignmentResult?.error;

      if (assignError) {
        console.warn('[DriverFreightsTab] Erro ao buscar freight_assignments:', assignError);
      }

      // Fetch freight details for assignments not already in directFreights
      const directIds = new Set((directFreights || []).map((f: any) => f.id));
      const missingIds = (assignmentData || [])
        .map((a: any) => a.freight_id)
        .filter((id: string) => !directIds.has(id));

      let assignmentFreights: any[] = [];
      if (missingIds.length > 0) {
        const { data: extraFreights } = await supabase
          .from("freights")
          .select(`
            id,
            created_at,
            status,
            price,
            cargo_type,
            producer:producer_id(full_name),
            origin_city:origin_city_id(name, state),
            destination_city:destination_city_id(name, state)
          `)
          .in("id", missingIds)
          .order("created_at", { ascending: false });
        assignmentFreights = extraFreights || [];
      }

      return [...(directFreights || []), ...assignmentFreights];
    },
  });

  // ✅ Serviços ABERTOS (service_requests) que o motorista pode aceitar (inclui FRETE_MOTO)
  const {
    data: openServiceRequests,
    isLoading: isLoadingOpenServices,
    error: openServicesError,
  } = useQuery({
    queryKey: ["driver-open-service-requests"],
    queryFn: async () => {
      // ✅ SEGURANÇA: Usar view segura para proteção de PII
      const { data, error } = await supabase
        .from("service_requests_secure")
        .select(
          `
          id,
          created_at,
          status,
          service_type,
          estimated_price,
          city_name,
          state,
          location_address,
          client:client_id(full_name)
        `,
        )
        .eq("status", "OPEN")
        .in("service_type", [
          "FRETE_MOTO",
          "FRETE_URBANO",
          "GUINCHO",
          "MUDANCA",
          "MUDANCA_RESIDENCIAL",
          "MUDANCA_COMERCIAL",
        ])
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  // ✅ Serviços do motorista (aceitos / em andamento / histórico) — service_requests onde provider_id = driverProfileId
  const {
    data: myServiceRequests,
    isLoading: isLoadingMyServices,
    error: myServicesError,
  } = useQuery({
    queryKey: ["driver-my-service-requests", driverProfileId],
    enabled: !!driverProfileId,
    queryFn: async () => {
      // ✅ SEGURANÇA: Usar view segura para proteção de PII
      const { data, error } = await supabase
        .from("service_requests_secure")
        .select(
          `
          id,
          created_at,
          accepted_at,
          status,
          service_type,
          estimated_price,
          city_name,
          state,
          location_address,
          client:client_id(full_name)
        `,
        )
        .eq("provider_id", driverProfileId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const acceptServiceMutation = useMutation({
    mutationFn: async (serviceRequestId: string) => {
      const { data, error } = await supabase.rpc('accept_service_request', {
        p_provider_id: driverProfileId || '',
        p_request_id: serviceRequestId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Serviço aceito! Agora ele aparece em 'Meus Serviços'.");
      queryClient.invalidateQueries({ queryKey: ["driver-open-service-requests"] });
      queryClient.invalidateQueries({ queryKey: ["driver-my-service-requests", driverProfileId] });
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao aceitar serviço");
    },
  });

  const isLoading = isLoadingFreights || isLoadingOpenServices || isLoadingMyServices;

  const safeFreights = freights || [];
  const safeOpenServices = openServiceRequests || [];
  const safeMyServices = myServiceRequests || [];

  const hasAny = safeOpenServices.length > 0 || safeMyServices.length > 0 || safeFreights.length > 0;

  const headerBadges = useMemo(() => {
    const items: { label: string; value: number }[] = [];
    if (safeOpenServices.length) items.push({ label: "Serviços abertos", value: safeOpenServices.length });
    if (safeMyServices.length) items.push({ label: "Meus serviços", value: safeMyServices.length });
    if (safeFreights.length) items.push({ label: "Fretes", value: safeFreights.length });
    return items;
  }, [safeOpenServices.length, safeMyServices.length, safeFreights.length]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!hasAny) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Truck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum frete ou serviço encontrado</p>
          <p className="text-sm text-muted-foreground mt-2 text-center max-w-md">
            Este motorista ainda não possui fretes atribuídos e não há solicitações abertas no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasErrors = !!freightsError || !!openServicesError || !!myServicesError;

  return (
    <div className="space-y-6">
      {/* Header - Fretes */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Truck className="h-5 w-5 text-green-600" />
          Fretes Atribuídos
        </h3>
        <Badge variant="secondary">
          {safeFreights.length}
        </Badge>
      </div>

      {hasErrors && (
        <Card className="border-destructive/40">
          <CardContent className="py-4 text-sm text-destructive">
            Ocorreu um erro ao carregar dados. Recarregue a página ou tente novamente.
          </CardContent>
        </Card>
      )}

      {/* ✅ SERVIÇOS ABERTOS - Seção Separada */}
      <div className="space-y-3 mt-8 pt-6 border-t">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-orange-600" />
            Serviços Disponíveis
          </h3>
          <Badge variant="secondary">{safeOpenServices.length}</Badge>
        </div>

        {safeOpenServices.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma solicitação aberta no momento.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
            {safeOpenServices.map((sr: any) => (
              <UnifiedServiceCard
                key={sr.id}
                serviceRequest={sr}
                client={sr.client || null}
                viewerRole="DRIVER"
                onAccept={() => acceptServiceMutation.mutate(sr.id)}
                accepting={acceptServiceMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* ✅ MEUS SERVIÇOS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-muted-foreground">Meus Serviços</h4>
          <Badge variant="outline">{safeMyServices.length}</Badge>
        </div>

        {safeMyServices.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Você ainda não aceitou nenhuma solicitação.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
            {safeMyServices.map((sr: any) => (
              <UnifiedServiceCard
                key={sr.id}
                serviceRequest={sr}
                client={sr.client || null}
                viewerRole="DRIVER"
              />
            ))}
          </div>
        )}
      </div>

      {/* FRETES (tabela freights) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-muted-foreground">Histórico de Fretes</h4>
          <Badge variant="outline">{safeFreights.length}</Badge>
        </div>

        {safeFreights.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Nenhum frete atribuído a este motorista ainda.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {safeFreights.map((freight: any) => (
              <Card key={freight.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{freight.cargo_type || "Frete"}</CardTitle>
                    {getStatusBadge(freight.status)}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
                    <div className="flex-1 text-sm">
                      <p className="font-medium">
                        {freight.origin_city?.name}, {freight.origin_city?.state}
                      </p>
                      <p className="text-muted-foreground">↓</p>
                      <p className="font-medium">
                        {freight.destination_city?.name}, {freight.destination_city?.state}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Criado em {new Date(freight.created_at).toLocaleDateString("pt-BR")}</span>
                  </div>

                  {freight.id && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Valor: </span>
                      <span className="font-semibold text-primary">
                        {precoPreenchidoDoFrete(freight.id, freight, { unitOnly: true }).primaryText}
                      </span>
                    </div>
                  )}

                  {freight.producer?.full_name && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Produtor: </span>
                      <span className="font-medium">{freight.producer.full_name}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
