/**
 * MyRequestsTab.tsx
 * 
 * Aba "Solicitações" — exibe fretes e serviços que o usuário solicitou como CLIENTE.
 * Usada nos dashboards de Motorista, Prestador de Serviços e Transportadora.
 * 
 * ✅ Serviços em andamento usam FreightInProgressCard (mapa + chat + rastreamento)
 * ✅ Serviços abertos usam cards simples com edit/cancel
 * ✅ Inclui fluxo de confirmação de entrega para PET e Pacotes.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { EditFreightModal } from '@/components/EditFreightModal';
import { ServiceEditModal } from '@/components/service-wizard/ServiceEditModal';
import { FreightCard } from '@/components/FreightCard';
import { FreightInProgressCard } from '@/components/FreightInProgressCard';
import { ServiceChatDialog } from '@/components/ServiceChatDialog';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Package, Wrench, MapPin, Clock, DollarSign, Truck, PawPrint, 
  AlertTriangle, Edit, X, CheckCircle, ShieldCheck, Banknote,
  MessageSquare, Phone, Star, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { ServiceProposalSection } from '@/components/service-provider/ServiceProposalSection';
import { useServiceProposals } from '@/hooks/useServiceProposals';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  GUINCHO: 'Guincho',
  MECANICO: 'Mecânico',
  BORRACHEIRO: 'Borracheiro',
  ELETRICISTA: 'Eletricista',
  SOCORRO_MECANICO: 'Socorro Mecânico',
  MUDANCA: 'Mudança',
  TRANSPORTE_PET: 'Transporte Pet 🐾',
  ENTREGA_PACOTES: 'Entrega de Pacotes 📦',
  SERVICO_AGRICOLA: 'Serviço Agrícola',
  FRETE_URBANO: 'Frete Urbano',
  MOTO_FRETE: 'Moto Frete',
};

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Aguardando', variant: 'secondary' },
  OPEN: { label: 'Aberto', variant: 'secondary' },
  ACCEPTED: { label: 'Aceito', variant: 'default' },
  ON_THE_WAY: { label: 'A Caminho', variant: 'default' },
  IN_PROGRESS: { label: 'Em Andamento', variant: 'default' },
  LOADING: { label: 'Carregando', variant: 'default' },
  IN_TRANSIT: { label: 'Em Trânsito', variant: 'default' },
  COMPLETED: { label: 'Concluído', variant: 'outline' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
  DELIVERED: { label: 'Entregue', variant: 'outline' },
  EXPIRED: { label: 'Expirado', variant: 'destructive' },
};

const PAYMENT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  proposed: { label: 'Aguardando Confirmação de Entrega', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  paid_by_client: { label: 'Pagamento Confirmado pelo Cliente', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  confirmed_by_provider: { label: 'Pagamento Recebido ✅', color: 'bg-green-100 text-green-800 border-green-300' },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || { label: status, variant: 'secondary' as const };
}

function getServiceLabel(type: string) {
  return SERVICE_TYPE_LABELS[type] || type;
}

// Statuses considered "active" (not finalized)
const ACTIVE_SERVICE_STATUSES = ['PENDING', 'OPEN', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'];
const OPEN_SERVICE_STATUSES = ['PENDING', 'OPEN'];
const ONGOING_SERVICE_STATUSES = ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'];
const ACTIVE_FREIGHT_STATUSES = ['OPEN', 'ACCEPTED', 'IN_NEGOTIATION', 'LOADING', 'IN_TRANSIT'] as const;

// Transport types that require delivery confirmation
const TRANSPORT_TYPES = ['TRANSPORTE_PET', 'ENTREGA_PACOTES'];

// Statuses that allow direct cancellation
const CANCELLABLE_SERVICE_STATUSES = ['PENDING', 'OPEN'];
const CANCELLABLE_FREIGHT_STATUSES = ['OPEN', 'ACCEPTED', 'LOADING', 'IN_NEGOTIATION'];

export const MyRequestsTab: React.FC = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Edit/Cancel state
  const [editFreightModalOpen, setEditFreightModalOpen] = useState(false);
  const [selectedFreight, setSelectedFreight] = useState<any>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [freightToCancel, setFreightToCancel] = useState<any>(null);

  const [serviceEditModalOpen, setServiceEditModalOpen] = useState(false);
  const [selectedServiceToEdit, setSelectedServiceToEdit] = useState<any>(null);
  const [confirmCancelServiceOpen, setConfirmCancelServiceOpen] = useState(false);
  const [serviceToCancel, setServiceToCancel] = useState<any>(null);

  // Delivery confirmation state
  const [confirmDeliveryOpen, setConfirmDeliveryOpen] = useState(false);
  const [serviceToConfirm, setServiceToConfirm] = useState<any>(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [confirming, setConfirming] = useState(false);

  // Chat state
  const [serviceChatOpen, setServiceChatOpen] = useState(false);
  const [selectedChatServiceRequest, setSelectedChatServiceRequest] = useState<any>(null);

  // Fetch OPEN service requests (simple card)
  const { data: myOpenServiceRequests, isLoading: loadingOpenServices } = useQuery({
    queryKey: ['my-client-open-service-requests', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('client_id', profile.id)
        .in('status', OPEN_SERVICE_STATUSES)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch ONGOING service requests with provider info (FreightInProgressCard)
  const { data: myOngoingServiceRequests, isLoading: loadingOngoingServices } = useQuery({
    queryKey: ['my-client-ongoing-service-requests', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('service_requests_secure')
        .select('*, provider:provider_id(id, full_name, phone, rating, profile_photo_url)')
        .eq('client_id', profile.id)
        .in('status', ONGOING_SERVICE_STATUSES)
        .order('accepted_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
    staleTime: 30 * 1000,
  });

  // Fetch COMPLETED PET/Package services that need delivery confirmation
  const { data: pendingDeliveryServices, isLoading: loadingPending } = useQuery({
    queryKey: ['my-pending-delivery-services', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data: completedServices, error: srError } = await supabase
        .from('service_requests')
        .select('*')
        .eq('client_id', profile.id)
        .eq('status', 'COMPLETED')
        .in('service_type', TRANSPORT_TYPES)
        .order('updated_at', { ascending: false });

      if (srError) throw srError;
      if (!completedServices?.length) return [];

      const serviceIds = completedServices.map(s => s.id);
      const { data: payments } = await supabase
        .from('service_payments')
        .select('service_request_id, status, amount')
        .in('service_request_id', serviceIds);

      const paymentMap = new Map(
        (payments || []).map(p => [p.service_request_id, p])
      );

      return completedServices
        .map(sr => ({
          ...sr,
          payment: paymentMap.get(sr.id) || null,
        }))
        .filter(sr => {
          const ps = sr.payment?.status;
          return ps === 'proposed' || ps === 'paid_by_client' || !ps;
        });
    },
    enabled: !!profile?.id,
    staleTime: 30 * 1000,
  });

  // Fetch freights where user is the producer (PET, packages, etc.) - active only
  const { data: myFreights, isLoading: loadingFreights } = useQuery({
    queryKey: ['my-client-freights', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('freights')
        .select('*')
        .eq('producer_id', profile.id)
        .in('status', [...ACTIVE_FREIGHT_STATUSES])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
    staleTime: 2 * 60 * 1000,
  });

  // All service request IDs for proposals
  const allClientServiceIds = useMemo(() => {
    const ids = new Set<string>();
    (myOpenServiceRequests || []).forEach((r: any) => ids.add(r.id));
    (myOngoingServiceRequests || []).forEach((r: any) => ids.add(r.id));
    return Array.from(ids);
  }, [myOpenServiceRequests, myOngoingServiceRequests]);

  const {
    submitProposal: submitClientProposal,
    acceptProposal: acceptClientProposal,
    rejectProposal: rejectClientProposal,
    getProposalsForRequest: getClientProposals,
    submitting: clientProposalSubmitting,
  } = useServiceProposals({
    serviceRequestIds: allClientServiceIds,
    enabled: !!profile?.id && allClientServiceIds.length > 0,
  });

  const refetchAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-client-open-service-requests', profile?.id] }),
      queryClient.invalidateQueries({ queryKey: ['my-client-ongoing-service-requests', profile?.id] }),
      queryClient.invalidateQueries({ queryKey: ['my-client-freights', profile?.id] }),
      queryClient.invalidateQueries({ queryKey: ['my-pending-delivery-services', profile?.id] }),
    ]);
  };

  // === Freight Actions (same pattern as ProducerDashboard) ===
  const handleFreightAction = (action: string, freight: any) => {
    if (action === 'edit') {
      setSelectedFreight(freight);
      setEditFreightModalOpen(true);
    } else if (action === 'cancel') {
      setFreightToCancel(freight);
      setConfirmCancelOpen(true);
    } else if (action === 'request-cancel') {
      toast.info('Entre em contato com o motorista via chat para solicitar o cancelamento', { duration: 5000 });
    }
  };

  const confirmCancelFreight = async () => {
    if (!freightToCancel) return;
    
    const canCancelDirectly = CANCELLABLE_FREIGHT_STATUSES.includes(freightToCancel.status);
    if (!canCancelDirectly) {
      toast.error('Este frete está em andamento. Solicite o cancelamento via chat com o motorista.');
      setConfirmCancelOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('freights')
        .update({ status: 'CANCELLED' })
        .eq('id', freightToCancel.id)
        .eq('producer_id', profile?.id);

      if (error) throw error;

      toast.success('Frete cancelado com sucesso!');
      setConfirmCancelOpen(false);
      setFreightToCancel(null);
      await refetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao cancelar frete');
    }
  };

  // === Service Request Actions ===
  const handleServiceAction = (action: 'edit' | 'cancel', service: any) => {
    if (action === 'edit') {
      setSelectedServiceToEdit(service);
      setServiceEditModalOpen(true);
    } else if (action === 'cancel') {
      setServiceToCancel(service);
      setConfirmCancelServiceOpen(true);
    }
  };

  const confirmCancelService = async () => {
    if (!serviceToCancel) return;

    try {
      const { data, error } = await supabase.rpc('cancel_producer_service_request', {
        p_request_id: serviceToCancel.id,
        p_cancellation_reason: 'Cancelado pelo solicitante'
      });

      if (error) throw error;

      const result = data as { success: boolean; error?: string };
      if (!result.success) {
        throw new Error(result.error || 'Erro ao cancelar');
      }

      toast.success('Solicitação cancelada com sucesso!');
      setConfirmCancelServiceOpen(false);
      setServiceToCancel(null);
      await refetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao cancelar solicitação');
    }
  };

  // === Delivery Confirmation (PET/Package) ===
  const handleConfirmDelivery = async () => {
    if (!serviceToConfirm) return;
    setConfirming(true);

    try {
      const { data, error } = await supabase.rpc('confirm_service_delivery', {
        p_service_request_id: serviceToConfirm.id,
        p_notes: confirmNotes || null,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao confirmar entrega');
      }

      toast.success(result.message || 'Entrega confirmada com sucesso!');
      setConfirmDeliveryOpen(false);
      setServiceToConfirm(null);
      setConfirmNotes('');
      await refetchAll();
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao confirmar entrega');
    } finally {
      setConfirming(false);
    }
  };

  const isLoading = loadingOpenServices || loadingOngoingServices || loadingFreights || loadingPending;
  const openServiceRequests = myOpenServiceRequests || [];
  const ongoingServiceRequests = myOngoingServiceRequests || [];
  const freights = myFreights || [];
  const pendingDeliveries = pendingDeliveryServices || [];
  const totalCount = openServiceRequests.length + ongoingServiceRequests.length + freights.length + pendingDeliveries.length;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <AppSpinner />
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Nenhuma solicitação ativa</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Quando você solicitar um serviço ou transporte como cliente, suas solicitações aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <SafeListWrapper>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Minhas Solicitações</h3>
          <Badge variant="secondary">{totalCount} item{totalCount !== 1 ? 's' : ''}</Badge>
        </div>

        {/* ============================================================ */}
        {/* SEÇÃO: CONFIRMAR ENTREGAS (PET/Pacotes com entrega pendente) */}
        {/* ============================================================ */}
        {pendingDeliveries.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
              <h4 className="font-semibold text-amber-800 dark:text-amber-400">
                Confirmar Entregas ({pendingDeliveries.length})
              </h4>
            </div>
            
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4 inline mr-1" />
              O motorista reportou a entrega. Confirme que recebeu seu pet ou pacote em segurança.
            </div>

            {pendingDeliveries.map((request) => {
              const isTransportPet = request.service_type === 'TRANSPORTE_PET';
              const Icon = isTransportPet ? PawPrint : Package;
              const paymentStatus = request.payment?.status || 'proposed';
              const paymentInfo = PAYMENT_STATUS_LABELS[paymentStatus] || PAYMENT_STATUS_LABELS.proposed;

              return (
                <Card key={request.id} className="overflow-hidden border-l-4 border-l-amber-500">
                  <CardContent className="p-0">
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${isTransportPet ? 'bg-purple-100 dark:bg-purple-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                            <Icon className={`h-5 w-5 ${isTransportPet ? 'text-purple-600' : 'text-amber-600'}`} />
                          </div>
                          <div>
                            <h4 className="font-semibold text-sm">
                              {getServiceLabel(request.service_type)}
                            </h4>
                            <p className="text-xs text-muted-foreground">
                              Entrega reportada pelo motorista
                            </p>
                          </div>
                        </div>
                        <Badge className={paymentInfo.color}>
                          {paymentInfo.label}
                        </Badge>
                      </div>

                      {request.problem_description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {request.problem_description}
                        </p>
                      )}

                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {request.location_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {request.location_city}/{request.location_state}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Concluído em {new Date(request.updated_at).toLocaleDateString('pt-BR')}
                        </span>
                        {(request.final_price || request.estimated_price) > 0 && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <DollarSign className="h-3 w-3" />
                            R$ {Number(request.final_price || request.estimated_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      {paymentStatus === 'proposed' && (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          size="sm"
                          onClick={() => {
                            setServiceToConfirm(request);
                            setConfirmDeliveryOpen(true);
                          }}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Confirmar Entrega e Pagamento
                        </Button>
                      )}
                      {paymentStatus === 'paid_by_client' && (
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <Banknote className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                          <p className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                            Aguardando confirmação de recebimento pelo motorista
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* ============================================================ */}
        {/* SEÇÃO: SERVIÇOS EM ANDAMENTO (FreightInProgressCard com mapa) */}
        {/* ============================================================ */}
        {ongoingServiceRequests.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium text-muted-foreground flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Em Andamento ({ongoingServiceRequests.length})
            </h4>

            <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
              {ongoingServiceRequests.map((sr: any) => {
                // Extrair destino do additional_info
                let additionalInfo: any = null;
                try {
                  additionalInfo = typeof sr.additional_info === 'string'
                    ? JSON.parse(sr.additional_info)
                    : (typeof sr.additional_info === 'object' ? sr.additional_info : null);
                } catch { /* ignore */ }
                const destination = additionalInfo?.destination || null;

                const originLat = sr.location_lat || sr.city_lat || null;
                const originLng = sr.location_lng || sr.city_lng || null;
                const destLat = destination?.lat || null;
                const destLng = destination?.lng || null;
                const originCity = sr.city_name || sr.location_city || '';
                const originState = sr.state || sr.location_state || '';
                const destCity = destination?.city || originCity;
                const destState = destination?.state || originState;

                // Mapear status de service para status de frete
                const statusMap: Record<string, string> = {
                  ACCEPTED: 'ACCEPTED',
                  ON_THE_WAY: 'LOADING',
                  IN_PROGRESS: 'IN_TRANSIT',
                };
                const mappedStatus = statusMap[sr.status] || sr.status;

                return (
                  <FreightInProgressCard
                    key={sr.id}
                    freight={{
                      id: sr.id,
                      origin_city: originCity,
                      origin_state: originState,
                      destination_city: destCity,
                      destination_state: destState,
                      origin_lat: originLat,
                      origin_lng: originLng,
                      destination_lat: destLat,
                      destination_lng: destLng,
                      origin_address: sr.location_address || undefined,
                      origin_neighborhood: additionalInfo?.origin?.neighborhood || undefined,
                      origin_street: additionalInfo?.origin?.street || undefined,
                      origin_number: additionalInfo?.origin?.number || undefined,
                      origin_complement: additionalInfo?.origin?.complement || undefined,
                      origin_zip_code: additionalInfo?.origin?.zip_code || undefined,
                      destination_address: destination?.full_address || undefined,
                      destination_neighborhood: destination?.neighborhood || undefined,
                      destination_street: destination?.street || undefined,
                      destination_number: destination?.number || undefined,
                      destination_complement: destination?.complement || undefined,
                      destination_zip_code: destination?.zip_code || undefined,
                      weight: null,
                      distance_km: null,
                      pickup_date: sr.accepted_at || sr.created_at,
                      price: sr.estimated_price,
                      required_trucks: 1,
                      status: mappedStatus,
                      service_type: sr.service_type,
                      driver_profiles: sr.provider ? {
                        full_name: sr.provider.full_name,
                        profile_photo_url: sr.provider.profile_photo_url,
                      } : null,
                      driver_id: sr.provider_id,
                    }}
                    serviceWorkflowActions={
                      <div className="space-y-2">
                        {sr.problem_description && (
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            📝 {sr.problem_description}
                          </p>
                        )}
                        {sr.provider && (
                          <div className="bg-secondary/50 rounded-lg p-2 flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{sr.provider.full_name}</p>
                              {sr.provider.phone && (
                                <a
                                  href={`tel:${sr.provider.phone}`}
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <Phone className="h-3 w-3" />
                                  {sr.provider.phone}
                                </a>
                              )}
                            </div>
                            {sr.provider.rating && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                <span className="text-sm font-medium">{Number(sr.provider.rating).toFixed(1)}</span>
                              </div>
                            )}
                          </div>
                        )}
                        {sr.provider_id && sr.client_id && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setSelectedChatServiceRequest(sr);
                              setServiceChatOpen(true);
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Abrir Chat
                          </Button>
                        )}
                        {/* Propostas de valor */}
                        <ServiceProposalSection
                          proposals={getClientProposals(sr.id)}
                          currentUserProfileId={profile?.id || ''}
                          viewerRole="CLIENT"
                          onSubmitProposal={(price, msg) => submitClientProposal(sr.id, profile?.id || '', 'CLIENT', price, msg)}
                          onAcceptProposal={acceptClientProposal}
                          onRejectProposal={(id, returnToOpen) => rejectClientProposal(id, undefined, returnToOpen)}
                          submitting={clientProposalSubmitting}
                        />
                      </div>
                    }
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* SEÇÃO: SOLICITAÇÕES ABERTAS (cards simples com edit/cancel)   */}
        {/* ============================================================ */}
        {(openServiceRequests.length > 0 || freights.length > 0) && (
          <>
            {/* Freights (PET, Pacotes, etc.) — uses FreightCard with producer actions */}
            {freights.length > 0 && (
              <div className="space-y-3">
                {freights.map((freight) => (
                  <FreightCard
                    key={freight.id}
                    freight={freight as any}
                    showProducerActions
                    onAction={(action) => handleFreightAction(action, freight)}
                  />
                ))}
              </div>
            )}

            {/* Open Service Requests — cards with edit/cancel */}
            {openServiceRequests.length > 0 && (
              <div className="space-y-3">
                {openServiceRequests.map((request) => {
                  const statusConfig = getStatusConfig(request.status);
                  const isTransport = TRANSPORT_TYPES.includes(request.service_type);
                  const Icon = isTransport
                    ? (request.service_type === 'TRANSPORTE_PET' ? PawPrint : Truck)
                    : Wrench;
                  const canCancel = CANCELLABLE_SERVICE_STATUSES.includes(request.status);

                  return (
                    <Card key={request.id} className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="p-4 pb-3 space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className="p-2 rounded-lg bg-primary/10">
                                <Icon className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-sm">
                                  {getServiceLabel(request.service_type)}
                                </h4>
                                <p className="text-xs text-muted-foreground">
                                  Solicitação de serviço
                                </p>
                              </div>
                            </div>
                            <Badge variant={statusConfig.variant}>
                              {statusConfig.label}
                            </Badge>
                          </div>

                          {request.problem_description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {request.problem_description}
                            </p>
                          )}

                          {/* Origin & Destination */}
                          <div className="space-y-2">
                            <div className="flex items-start gap-2">
                              <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                              <div className="min-w-0">
                                <span className="text-xs font-semibold text-muted-foreground uppercase">Origem</span>
                                {(request as any).city_name && (
                                  <p className="text-sm font-bold text-foreground">
                                    {String((request as any).city_name).toUpperCase()} — {(request as any).state || ''}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {request.location_address || 'Endereço não informado'}
                                </p>
                              </div>
                            </div>
                            {(() => {
                              const ai = typeof request.additional_info === 'string'
                                ? (() => { try { return JSON.parse(request.additional_info); } catch { return null; } })()
                                : request.additional_info;
                              const destCity = (request as any).destination_city || ai?.destination?.city;
                              const destState = (request as any).destination_state || ai?.destination?.state;
                              const destAddr = (request as any).destination_address || ai?.destination?.full_address;
                              if (!destCity && !destAddr) return null;
                              return (
                                <div className="flex items-start gap-2">
                                  <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                                  <div className="min-w-0">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Destino</span>
                                    {destCity && (
                                      <p className="text-sm font-bold text-foreground">
                                        {String(destCity).toUpperCase()} — {destState || ''}
                                      </p>
                                    )}
                                    <p className="text-xs text-muted-foreground line-clamp-1">
                                      {destAddr || 'Endereço não informado'}
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(request.created_at).toLocaleDateString('pt-BR')}
                            </span>
                            {(request.estimated_price ?? 0) > 0 && (
                              <span className="flex items-center gap-1 font-medium text-foreground">
                                <DollarSign className="h-3 w-3" />
                                R$ {Number(request.estimated_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            )}
                          </div>

                          {request.is_emergency && (
                            <div className="flex items-center gap-1 text-xs text-destructive font-medium">
                              <AlertTriangle className="h-3 w-3" />
                              Emergência
                            </div>
                          )}
                          {/* Propostas de valor */}
                          <ServiceProposalSection
                            proposals={getClientProposals(request.id)}
                            currentUserProfileId={profile?.id || ''}
                            viewerRole="CLIENT"
                            onSubmitProposal={(price, msg) => submitClientProposal(request.id, profile?.id || '', 'CLIENT', price, msg)}
                            onAcceptProposal={acceptClientProposal}
                            onRejectProposal={(id, returnToOpen) => rejectClientProposal(id, undefined, returnToOpen)}
                            submitting={clientProposalSubmitting}
                          />
                        </div>

                        {request.status !== 'CANCELLED' && (
                          <div className="px-4 pb-4">
                            <div className="flex gap-2">
                              <Button
                                onClick={() => handleServiceAction('edit', request)}
                                className="flex-1"
                                size="sm"
                                variant="outline"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </Button>
                              {canCancel && (
                                <Button
                                  onClick={() => handleServiceAction('cancel', request)}
                                  className="flex-1"
                                  size="sm"
                                  variant="destructive"
                                >
                                  <X className="h-4 w-4 mr-2" />
                                  Cancelar
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {request.status === 'CANCELLED' && (
                          <div className="px-4 pb-4">
                            <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                              <p className="text-sm text-red-600 dark:text-red-400">Solicitação cancelada</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ============================================================ */}
      {/* MODAL: Confirmar Entrega (PET/Pacote)                        */}
      {/* ============================================================ */}
      <Dialog open={confirmDeliveryOpen} onOpenChange={(open) => {
        if (!open) {
          setConfirmDeliveryOpen(false);
          setServiceToConfirm(null);
          setConfirmNotes('');
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Confirmar Entrega
            </DialogTitle>
          </DialogHeader>

          {serviceToConfirm && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  {serviceToConfirm.service_type === 'TRANSPORTE_PET' 
                    ? <PawPrint className="h-4 w-4 text-purple-600" />
                    : <Package className="h-4 w-4 text-amber-600" />
                  }
                  <span className="font-medium">
                    {getServiceLabel(serviceToConfirm.service_type)}
                  </span>
                </div>
                {serviceToConfirm.problem_description && (
                  <p className="text-sm text-muted-foreground">{serviceToConfirm.problem_description}</p>
                )}
                {(serviceToConfirm.final_price || serviceToConfirm.estimated_price) > 0 && (
                  <p className="text-sm font-semibold text-green-600">
                    Valor: R$ {Number(serviceToConfirm.final_price || serviceToConfirm.estimated_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>

              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 text-sm mb-1">Importante</h4>
                <ul className="text-xs text-blue-800 dark:text-blue-400 space-y-1">
                  <li>• Confirme apenas se {serviceToConfirm.service_type === 'TRANSPORTE_PET' ? 'seu pet foi entregue em segurança' : 'seu pacote foi entregue corretamente'}</li>
                  <li>• Após a confirmação, o pagamento será liberado para o motorista</li>
                  <li>• Você poderá avaliar o serviço após a confirmação do motorista</li>
                </ul>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Observações (opcional)
                </label>
                <Textarea
                  placeholder={serviceToConfirm.service_type === 'TRANSPORTE_PET' 
                    ? 'Ex: Pet chegou bem, sem estresse...' 
                    : 'Ex: Pacote entregue sem danos...'
                  }
                  value={confirmNotes}
                  onChange={(e) => setConfirmNotes(e.target.value)}
                  rows={3}
                  className="mt-1"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setConfirmDeliveryOpen(false);
                    setServiceToConfirm(null);
                    setConfirmNotes('');
                  }}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleConfirmDelivery}
                  disabled={confirming}
                >
                  {confirming ? 'Confirmando...' : 'Confirmar Entrega'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Freight Edit Modal */}
      <EditFreightModal
        isOpen={editFreightModalOpen}
        onClose={() => setEditFreightModalOpen(false)}
        freight={selectedFreight}
        onSuccess={async () => {
          await refetchAll();
          setEditFreightModalOpen(false);
        }}
      />

      {/* Freight Cancel Confirmation */}
      <ConfirmDialog
        isOpen={confirmCancelOpen}
        onClose={() => setConfirmCancelOpen(false)}
        onConfirm={confirmCancelFreight}
        title="Cancelar Frete"
        description="Tem certeza que deseja cancelar este frete? Todos os motoristas atribuídos serão liberados. Esta ação não pode ser desfeita."
      />

      {/* Service Edit Modal */}
      {selectedServiceToEdit && (
        <ServiceEditModal
          isOpen={serviceEditModalOpen}
          onClose={() => {
            setServiceEditModalOpen(false);
            setSelectedServiceToEdit(null);
          }}
          onSuccess={async () => {
            await refetchAll();
          }}
          serviceRequest={selectedServiceToEdit}
        />
      )}

      {/* Service Cancel Confirmation */}
      <ConfirmDialog
        isOpen={confirmCancelServiceOpen}
        onClose={() => setConfirmCancelServiceOpen(false)}
        onConfirm={confirmCancelService}
        title="Cancelar Solicitação"
        description="Tem certeza que deseja cancelar esta solicitação? Esta ação não pode ser desfeita."
      />

      {/* ✅ Service Chat Dialog */}
      {serviceChatOpen && selectedChatServiceRequest && (
        <ServiceChatDialog
          isOpen={serviceChatOpen}
          onClose={() => {
            setServiceChatOpen(false);
            setSelectedChatServiceRequest(null);
          }}
          serviceRequest={selectedChatServiceRequest}
          currentUserProfile={profile}
        />
      )}
    </SafeListWrapper>
  );
};
