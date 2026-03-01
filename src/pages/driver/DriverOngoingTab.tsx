import React, { useMemo, useState, useCallback, useEffect } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { 
  Truck, Wrench, Bike, RefreshCw, 
  Play, CheckCircle, PawPrint, Package,
  Banknote, ShieldCheck, DollarSign
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
import { UnifiedServiceCard } from "@/components/UnifiedServiceCard";
import { ServiceChatDialog } from "@/components/ServiceChatDialog";
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

/**
 * Mapeia status de service_request para status equivalente de frete rural
 * para que o FreightInProgressCard exiba os botões corretos de progressão.
 */
const mapServiceStatusToFreightStatus = (status: string): string => {
  const map: Record<string, string> = {
    ACCEPTED: 'ACCEPTED',
    ON_THE_WAY: 'LOADING',    // "A Caminho" = equivalente a "A Caminho da Coleta"
    IN_PROGRESS: 'IN_TRANSIT', // "Em Andamento" = equivalente a "Em Transporte"
  };
  return map[status] || status;
};

const serviceIcon = (serviceType?: string | null) => {
  const t = String(serviceType || "").toUpperCase();
  if (t.includes("GUINCHO")) return <Wrench className="h-5 w-5" />;
  if (t.includes("MOTO")) return <Bike className="h-5 w-5" />;
  if (t.includes("PET")) return <PawPrint className="h-5 w-5" />;
  if (t.includes("PACOTE")) return <Package className="h-5 w-5" />;
  return <Truck className="h-5 w-5" />;
};

const serviceTitle = (serviceType?: string | null) => {
  const t = String(serviceType || "").toUpperCase();
  if (t.includes("GUINCHO")) return "Guincho";
  if (t.includes("MOTO")) return "Frete Moto";
  if (t.includes("MUDANCA")) return "Mudança";
  if (t.includes("PET")) return "Transporte de Pet";
  if (t.includes("PACOTE")) return "Entrega de Pacotes";
  return "Serviço";
};

export const DriverOngoingTab: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const driverProfileId = profile?.id;
  const [selectedFreightId, setSelectedFreightId] = useState<string | null>(null);
  const [confirmingReceiptId, setConfirmingReceiptId] = useState<string | null>(null);
  const [serviceChatOpen, setServiceChatOpen] = useState(false);
  const [selectedChatServiceRequest, setSelectedChatServiceRequest] = useState<any>(null);

  // ✅ GUARD: Valida integridade do componente - evita regressões
  useDashboardIntegrityGuard('driver_ongoing', 'DriverOngoingTab');

  const { data, isLoading, refetch, isFetching } = useDriverOngoingCards(driverProfileId);

  const freights = data?.freights ?? [];
  const assignments = data?.assignments ?? [];
  const serviceRequests = data?.serviceRequests ?? [];

  // ✅ Buscar serviços PET/Pacote concluídos com pagamento pendente de confirmação pelo motorista
  const { data: pendingServicePayments } = useQuery({
    queryKey: ['driver-pending-service-payments', driverProfileId],
    queryFn: async () => {
      if (!driverProfileId) return [];
      
      const { data: completedServices } = await supabase
        .from('service_requests')
        .select('id, service_type, problem_description, location_city, location_state, estimated_price, final_price, updated_at')
        .eq('provider_id', driverProfileId)
        .eq('status', 'COMPLETED')
        .in('service_type', ['TRANSPORTE_PET', 'ENTREGA_PACOTES']);

      if (!completedServices?.length) return [];

      const serviceIds = completedServices.map(s => s.id);
      const { data: payments } = await supabase
        .from('service_payments')
        .select('service_request_id, status, amount')
        .in('service_request_id', serviceIds)
        .eq('status', 'paid_by_client');

      if (!payments?.length) return [];

      const paymentMap = new Map(payments.map(p => [p.service_request_id, p]));
      return completedServices
        .filter(sr => paymentMap.has(sr.id))
        .map(sr => ({ ...sr, payment: paymentMap.get(sr.id) }));
    },
    enabled: !!driverProfileId,
    staleTime: 30 * 1000,
  });

  // ✅ USAR HOOK DEDICADO para verificar vínculos com transportadora
  const { hasActiveLink, activeLinks } = useDriverTransportCompanyLink();
  
  // ✅ LÓGICA CORRIGIDA: Usar o hook dedicado ao invés de verificações locais
  const hasTransportCompanyLink = useMemo(() => {
    const anyAssignmentHasCompany = assignments.some((a: any) => {
      if (!a?.company_id) return false;
      return activeLinks.some(link => link.companyId === a.company_id);
    });
    return anyAssignmentHasCompany || hasActiveLink;
  }, [assignments, activeLinks, hasActiveLink]);

  const pendingReceipts = pendingServicePayments || [];
  const totalCount = freights.length + assignments.length + serviceRequests.length + pendingReceipts.length;

  const handleConfirmServiceReceipt = useCallback(async (serviceRequestId: string) => {
    setConfirmingReceiptId(serviceRequestId);
    try {
      const { data, error } = await supabase.rpc('confirm_service_payment_receipt', {
        p_service_request_id: serviceRequestId,
      });
      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Erro ao confirmar');
      toast.success(result.message || 'Recebimento confirmado!');
      queryClient.invalidateQueries({ queryKey: ['driver-pending-service-payments'] });
      refetch();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao confirmar recebimento');
    } finally {
      setConfirmingReceiptId(null);
    }
  }, [queryClient, refetch]);

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

          {/* Service Requests (PET/Pacotes/Moto/Guincho/Mudança) - Usa ServiceRequestInProgressCard com dados do cliente */}
          {serviceRequests.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Fretes Urbanos ({serviceRequests.length})
              </h4>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {serviceRequests.map((r) => (
                  <UnifiedServiceCard
                    key={r.id}
                    serviceRequest={r}
                    viewerRole="DRIVER"
                    onMarkOnTheWay={(id) => handleTransitionService(id, "ON_THE_WAY", "A caminho da coleta!")}
                    onStartTransit={(id) => handleTransitionService(id, "IN_PROGRESS", "Em trânsito!")}
                    onFinishService={(id) => handleTransitionService(id, "COMPLETED", "Entrega realizada com sucesso!")}
                    onOpenChat={(req) => { setSelectedChatServiceRequest(req); setServiceChatOpen(true); }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ✅ Confirmação de Recebimento (PET/Pacotes) */}
          {pendingReceipts.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-semibold flex items-center gap-2">
                <Banknote className="h-4 w-4 text-green-600" />
                Confirmar Recebimento ({pendingReceipts.length})
              </h4>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-800 dark:text-green-300">
                <ShieldCheck className="h-4 w-4 inline mr-1" />
                O cliente confirmou a entrega e o pagamento. Confirme que recebeu o valor.
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingReceipts.map((sr: any) => {
                  const isPet = sr.service_type === 'TRANSPORTE_PET';
                  const SrIcon = isPet ? PawPrint : Package;
                  return (
                    <Card key={sr.id} className="border-l-4 border-l-green-500 bg-green-50/30 dark:bg-green-900/10">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <SrIcon className={`h-5 w-5 ${isPet ? 'text-purple-600' : 'text-amber-600'}`} />
                            <div>
                              <h5 className="font-semibold text-sm">
                                {isPet ? 'Transporte de Pet 🐾' : 'Entrega de Pacotes 📦'}
                              </h5>
                              <p className="text-xs text-muted-foreground">
                                Cliente confirmou pagamento
                              </p>
                            </div>
                          </div>
                          {sr.payment?.amount > 0 && (
                            <span className="text-lg font-bold text-green-600">
                              R$ {Number(sr.payment.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          )}
                        </div>

                        {sr.problem_description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {sr.problem_description}
                          </p>
                        )}

                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          size="sm"
                          disabled={confirmingReceiptId === sr.id}
                          onClick={() => handleConfirmServiceReceipt(sr.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {confirmingReceiptId === sr.id ? 'Confirmando...' : 'Confirmar Recebimento'}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ServiceChat Dialog */}
      {serviceChatOpen && selectedChatServiceRequest && (
        <ServiceChatDialog
          isOpen={serviceChatOpen}
          onClose={() => { setServiceChatOpen(false); setSelectedChatServiceRequest(null); }}
          serviceRequest={selectedChatServiceRequest}
          currentUserProfile={profile}
        />
      )}

      {/* Modal de detalhes */}
      <Dialog
        open={!!selectedFreightId}
        onOpenChange={(open) => {
          if (!open) setSelectedFreightId(null);
        }}
      >
        <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto [&>button.absolute]:hidden">
          <DialogTitle className="sr-only">Detalhes do Frete</DialogTitle>
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
