/**
 * MyRequestsTab.tsx
 * 
 * Aba "Solicitações" — exibe fretes e serviços que o usuário solicitou como CLIENTE.
 * Usada nos dashboards de Motorista, Prestador de Serviços e Transportadora.
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Package, Wrench, MapPin, Clock, DollarSign, Truck, PawPrint, AlertTriangle } from 'lucide-react';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { FreightCard } from '@/components/FreightCard';

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
const ACTIVE_SERVICE_STATUSES = ['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'];
const ACTIVE_FREIGHT_STATUSES = ['OPEN', 'ACCEPTED', 'IN_NEGOTIATION', 'LOADING', 'IN_TRANSIT'] as const;

export const MyRequestsTab: React.FC = () => {
  const { profile } = useAuth();

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

        {/* Freights (PET, Pacotes, etc.) */}
        {freights.length > 0 && (
          <div className="space-y-3">
            {freights.map((freight) => (
              <FreightCard
                key={freight.id}
                freight={freight as any}
                showActions
                showProducerActions
                onAction={() => {}}
              />
            ))}
          </div>
        )}

        {/* Service Requests */}
        {serviceRequests.length > 0 && (
          <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
            {serviceRequests.map((request) => {
              const statusConfig = getStatusConfig(request.status);
              const isTransport = ['TRANSPORTE_PET', 'ENTREGA_PACOTES'].includes(request.service_type);
              const Icon = isTransport
                ? (request.service_type === 'TRANSPORTE_PET' ? PawPrint : Truck)
                : Wrench;

              return (
                <Card key={request.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-5 w-5 text-primary" />
                        <h4 className="font-semibold text-sm">
                          {getServiceLabel(request.service_type)}
                        </h4>
                      </div>
                      <Badge variant={statusConfig.variant}>
                        {statusConfig.label}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {request.problem_description}
                    </p>

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
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          R$ {Number(request.estimated_price).toLocaleString('pt-BR')}
                        </span>
                      )}
                    </div>

                    {request.is_emergency && (
                      <div className="flex items-center gap-1 text-xs text-destructive font-medium">
                        <AlertTriangle className="h-3 w-3" />
                        Emergência
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </SafeListWrapper>
  );
};
