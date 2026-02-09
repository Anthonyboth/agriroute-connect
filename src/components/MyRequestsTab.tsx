/**
 * MyRequestsTab.tsx
 * 
 * Aba "Solicitações" — exibe fretes e serviços que o usuário solicitou como CLIENTE.
 * Usada nos dashboards de Motorista, Prestador de Serviços e Transportadora.
 * Padrão visual e funcional igual ao painel do Produtor (edit/cancel).
 */
import React, { useState } from 'react';
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
import { Package, Wrench, MapPin, Clock, DollarSign, Truck, PawPrint, AlertTriangle, Edit, X } from 'lucide-react';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { toast } from 'sonner';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  GUINCHO: 'Guincho',
  MECANICO: 'Mecânico',
  BORRACHEIRO: 'Borracheiro',
  ELETRICISTA: 'Eletricista',
  SOCORRO_MECANICO: 'Socorro Mecânico',
  MUDANCA: 'Mudança',
  TRANSPORTE_PET: 'Transporte Pet',
  ENTREGA_PACOTES: 'Entrega de Pacotes',
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

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] || { label: status, variant: 'secondary' as const };
}

function getServiceLabel(type: string) {
  return SERVICE_TYPE_LABELS[type] || type;
}

// Statuses considered "active" (not finalized)
const ACTIVE_SERVICE_STATUSES = ['PENDING', 'OPEN', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'];
const ACTIVE_FREIGHT_STATUSES = ['OPEN', 'ACCEPTED', 'IN_NEGOTIATION', 'LOADING', 'IN_TRANSIT'] as const;

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

  // Fetch service requests where user is the client (active only)
  const { data: myServiceRequests, isLoading: loadingServices } = useQuery({
    queryKey: ['my-client-service-requests', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('service_requests')
        .select('*')
        .eq('client_id', profile.id)
        .in('status', ACTIVE_SERVICE_STATUSES)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
    staleTime: 2 * 60 * 1000,
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

  const refetchAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['my-client-service-requests', profile?.id] }),
      queryClient.invalidateQueries({ queryKey: ['my-client-freights', profile?.id] }),
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

  const isLoading = loadingServices || loadingFreights;
  const serviceRequests = myServiceRequests || [];
  const freights = myFreights || [];
  const totalCount = serviceRequests.length + freights.length;

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
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Minhas Solicitações</h3>
          <Badge variant="secondary">{totalCount} ativa{totalCount !== 1 ? 's' : ''}</Badge>
        </div>

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

        {/* Service Requests — cards with edit/cancel like producer */}
        {serviceRequests.length > 0 && (
          <div className="space-y-3">
            {serviceRequests.map((request) => {
              const statusConfig = getStatusConfig(request.status);
              const isTransport = ['TRANSPORTE_PET', 'ENTREGA_PACOTES'].includes(request.service_type);
              const Icon = isTransport
                ? (request.service_type === 'TRANSPORTE_PET' ? PawPrint : Truck)
                : Wrench;
              const canCancel = CANCELLABLE_SERVICE_STATUSES.includes(request.status);

              return (
                <Card key={request.id} className="overflow-hidden">
                  <CardContent className="p-0">
                    {/* Header with status */}
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

                      {/* Description */}
                      {request.problem_description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {request.problem_description}
                        </p>
                      )}

                      {/* Details row */}
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {request.location_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {request.location_city}/{request.location_state}
                          </span>
                        )}
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
                    </div>

                    {/* Action buttons — same pattern as FreightCard producer actions */}
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
      </div>

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
    </SafeListWrapper>
  );
};
