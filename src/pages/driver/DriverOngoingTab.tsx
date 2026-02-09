import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import { 
  Truck, Wrench, Bike, MapPin, Clock, RefreshCw, 
  Play, CheckCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDriverTransportCompanyLink } from "@/hooks/useDriverTransportCompanyLink";
import { toast } from "sonner";
import { formatBRL } from "@/lib/formatters";
import { LABELS } from "@/lib/labels";
import { normalizeFreightStatus } from "@/lib/freight-status";
import { cn } from "@/lib/utils";
import { FreightDetails } from "@/components/FreightDetails";
import { FreightInProgressCard } from "@/components/FreightInProgressCard";
import { useDriverOngoingCards } from "@/hooks/useDriverOngoingCards";
import { useDashboardIntegrityGuard } from "@/hooks/useDashboardIntegrityGuard";
import { calculateVisiblePrice } from '@/hooks/useFreightCalculator';

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    OPEN: "Aberto",
    IN_NEGOTIATION: "Em Negociação",
    ACCEPTED: "Aceito",
    LOADING: "A Caminho da Coleta",
    LOADED: "Carregado",
    IN_TRANSIT: "Em Transporte",
    ON_THE_WAY: "A Caminho",
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
  if (["IN_TRANSIT", "LOADING", "IN_PROGRESS", "ACCEPTED", "LOADED", "ON_THE_WAY"].includes(status)) return "secondary";
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
  const queryClient = useQueryClient();
  const driverProfileId = profile?.id;
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);

  // ✅ GUARD: Valida integridade do componente - evita regressões
  useDashboardIntegrityGuard('driver_ongoing', 'DriverOngoingTab');

  const { data, isLoading, refetch, isFetching } = useDriverOngoingCards(driverProfileId);

  const freights = data?.freights ?? [];
  const assignments = data?.assignments ?? [];
  const serviceRequests = data?.serviceRequests ?? [];

  // ✅ USAR HOOK DEDICADO para verificar vínculos com transportadora
  const { hasActiveLink, activeLinks } = useDriverTransportCompanyLink();
  
  // ✅ LÓGICA CORRIGIDA: Usar o hook dedicado ao invés de verificações locais
  const hasTransportCompanyLink = useMemo(() => {
    // Verificar se algum assignment veio de uma transportadora específica
    const anyAssignmentHasCompany = assignments.some((a: any) => {
      if (!a?.company_id) return false;
      // Verificar se o motorista realmente está vinculado a esta transportadora
      return activeLinks.some(link => link.companyId === a.company_id);
    });
    return anyAssignmentHasCompany || hasActiveLink;
  }, [assignments, activeLinks, hasActiveLink]);

  const totalCount = freights.length + assignments.length + serviceRequests.length;

  const handleStatusUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["driver-ongoing-cards"] });
    refetch();
  }, [queryClient, refetch]);

  const handleOpenDetails = useCallback((freightId: string) => {
    setSelectedFreightId(freightId);
  }, []);

  const handleTransitionService = useCallback(async (serviceId: string, targetStatus: string, successMsg: string) => {
    try {
      const { data, error } = await supabase.rpc('transition_service_request_status', {
        p_request_id: serviceId,
        p_next_status: targetStatus,
      });

      if (error) throw error;
      toast.success(successMsg);
      refetch();
    } catch (e: any) {
      console.error(e);
      toast.error("Falha ao atualizar status do chamado.");
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
                  <FreightInProgressCard
                    key={a.id}
                    freight={
                      a.freight
                        ? {
                            // ⚠️ Segurança: no painel do motorista, nunca exibir valor total.
                            // O valor mostrado deve ser apenas a porção do motorista (por carreta).
                            ...(() => {
                              const requiredTrucks = (a.freight as any).required_trucks ?? 1;
                              const visible = calculateVisiblePrice(
                                'MOTORISTA',
                                {
                                  id: (a.freight as any).id || '',
                                  price: (a.freight as any).price || 0,
                                  required_trucks: requiredTrucks,
                                },
                                {
                                  id: a.id || '',
                                  driver_id: driverProfileId || '',
                                  agreed_price: a.agreed_price || 0,
                                  pricing_type: 'FIXED' as const,
                                  status: a.status || 'ACCEPTED',
                                },
                              );

                              return {
                                // Preserve o frete base
                                ...a.freight,
                                status: normalizeFreightStatus(String(a.status || a.freight.status || "")),
                                price: visible.displayPrice,
                                required_trucks: 1,
                                original_required_trucks: visible.truckCount,
                                price_display_mode: visible.displayMode === 'PER_TRUCK' ? 'PER_TRUCK' : undefined,
                              };
                            })(),
                          }
                        : ({} as any)
                    }
                    onViewDetails={() => {
                      if (a.freight?.id) handleOpenDetails(a.freight.id);
                      handleStatusUpdate();
                    }}
                    // No painel do motorista, o fluxo de cancelamento/adiantamento/NF-e é feito na tela de detalhes.
                    // Então aqui o botão de cancelamento abre os detalhes também.
                    onRequestCancel={() => {
                      if (a.freight?.id) handleOpenDetails(a.freight.id);
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
                {freights.map((f) => {
                  const normalizedStatus = normalizeFreightStatus(String(f.status || ""));
                  const requiredTrucks = f.required_trucks ?? 1;

                  const visible = calculateVisiblePrice(
                    'MOTORISTA',
                    {
                      id: f.id || '',
                      price: f.price || 0,
                      required_trucks: requiredTrucks,
                    },
                    (f as any).driver_unit_price ? {
                      id: '',
                      driver_id: '',
                      agreed_price: (f as any).driver_unit_price,
                      pricing_type: 'FIXED' as const,
                      status: 'ACCEPTED',
                    } : null,
                  );

                  return (
                    <FreightInProgressCard
                      key={f.id}
                      freight={{
                        ...f,
                        status: normalizedStatus,
                        price: visible.displayPrice,
                        required_trucks: 1,
                        original_required_trucks: visible.truckCount,
                        price_display_mode: visible.displayMode === 'PER_TRUCK' ? 'PER_TRUCK' : undefined,
                      }}
                      onViewDetails={() => {
                        handleOpenDetails(f.id);
                        handleStatusUpdate();
                      }}
                      onRequestCancel={() => {
                        handleOpenDetails(f.id);
                      }}
                    />
                  );
                })}
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
                            onClick={() => handleTransitionService(r.id, "ON_THE_WAY", "A caminho do local!")}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            A Caminho
                          </Button>
                        )}
                        {r.status === "ON_THE_WAY" && (
                          <Button
                            className="w-full"
                            variant="secondary"
                            onClick={() => handleTransitionService(r.id, "IN_PROGRESS", "Atendimento iniciado!")}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Iniciar Atendimento
                          </Button>
                        )}
                        {r.status === "IN_PROGRESS" && (
                          <Button
                            className="w-full"
                            onClick={() => handleTransitionService(r.id, "COMPLETED", "Chamado finalizado com sucesso!")}
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
