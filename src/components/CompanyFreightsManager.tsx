import React, { useState, useEffect, useCallback } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, MapPin, UserPlus, XCircle, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { ShareFreightToDriver } from './ShareFreightToDriver';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { formatKm, formatBRL, formatTons, formatDate } from '@/lib/formatters';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { getVehicleTypeLabel } from '@/lib/vehicle-types';

export const CompanyFreightsManager: React.FC = () => {
  const { company } = useTransportCompany();
  const [freights, setFreights] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('open');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedFreightForShare, setSelectedFreightForShare] = useState<any | null>(null);

  const fetchFreights = useCallback(async () => {
    if (!company?.id) return;

    try {
      setIsLoading(true);

      // Step 1: Get freight IDs linked to this company via freight_assignments
      const { data: assignments, error: assignError } = await supabase
        .from('freight_assignments')
        .select('freight_id')
        .eq('company_id', company.id);

      if (assignError) throw assignError;

      const assignedFreightIds = (assignments || []).map(a => a.freight_id).filter(Boolean);

      // Step 2: Also get freights directly owned by this company (company_id on freights table)
      // Combine both sources
      let allFreightIds = [...new Set(assignedFreightIds)];

      // Step 3: Fetch freights from both sources
      const freightsByAssignment = allFreightIds.length > 0
        ? await supabase
            .from('freights')
            .select(`
              *,
              producer:profiles_secure!freights_producer_id_fkey(id, full_name, contact_phone),
              driver:profiles_secure!freights_driver_id_fkey(id, full_name, contact_phone)
            `)
            .in('id', allFreightIds)
            .order('updated_at', { ascending: false })
            .limit(500)
        : { data: [], error: null };

      const freightsByCompany = await supabase
        .from('freights')
        .select(`
          *,
          producer:profiles_secure!freights_producer_id_fkey(id, full_name, contact_phone),
          driver:profiles_secure!freights_driver_id_fkey(id, full_name, contact_phone)
        `)
        .eq('company_id', company.id)
        .order('updated_at', { ascending: false })
        .limit(500);

      // Merge and deduplicate
      const allFreights = new Map<string, any>();
      for (const result of [freightsByAssignment, freightsByCompany]) {
        if (result.error) {
          console.error('Erro parcial ao buscar fretes:', result.error);
          continue;
        }
        for (const freight of (result.data || [])) {
          allFreights.set(freight.id, freight);
        }
      }

      // Sort by updated_at desc
      const merged = Array.from(allFreights.values()).sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setFreights(merged);
    } catch (error) {
      console.error('Erro ao buscar fretes:', error);
      toast.error('Erro ao carregar fretes');
    } finally {
      setIsLoading(false);
    }
  }, [company?.id]);

  useEffect(() => {
    if (company?.id) {
      fetchFreights();
    }
  }, [company?.id, fetchFreights]);

  // Realtime
  useEffect(() => {
    if (!company?.id) return;

    const channel = supabase
      .channel('company-freights-manager')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freights',
        },
        () => fetchFreights()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `company_id=eq.${company.id}`
        },
        () => fetchFreights()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [company?.id, fetchFreights]);

  const handleCancelExpired = async (freightId: string) => {
    if (!confirm('Cancelar este frete por vencimento?')) return;

    try {
      const { error } = await supabase
        .from('freights')
        .update({
          status: 'CANCELLED',
          cancellation_reason: 'Cancelamento por vencimento (48h após data de coleta)',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', freightId);

      if (error) throw error;

      await supabase.from('freight_status_history').insert({
        freight_id: freightId,
        status: 'CANCELLED',
        changed_by: company?.id,
        notes: 'Cancelado por vencimento pela transportadora'
      });

      toast.success('Frete cancelado por vencimento');
      fetchFreights();
    } catch (error) {
      console.error('Erro ao cancelar:', error);
      toast.error('Erro ao cancelar frete');
    }
  };

  const filterFreights = (status: string) => {
    if (status === 'open') {
      return freights.filter(f => ['OPEN', 'IN_NEGOTIATION'].includes(f.status));
    }
    if (status === 'in_progress') {
      // Any freight with active operational status
      return freights.filter(f =>
        ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED'].includes(f.status)
      );
    }
    if (status === 'cancelled') {
      return freights.filter(f => f.status === 'CANCELLED');
    }
    return freights;
  };

  const renderFreightRow = (freight: any) => {
    const pickupDate = new Date(freight.pickup_date);
    const now = new Date();
    const hoursSincePickup = (now.getTime() - pickupDate.getTime()) / (1000 * 60 * 60);
    const isExpired = hoursSincePickup > 48 && ['OPEN', 'IN_NEGOTIATION', 'ACCEPTED'].includes(freight.status);

    return (
      <Card key={freight.id} className="border-l-4 border-l-primary">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="font-semibold text-lg">{getCargoTypeLabel(freight.cargo_type)}</h4>
                  <Badge variant={getFreightStatusVariant(freight.status)} className="mt-1">
                    {getFreightStatusLabel(freight.status)}
                  </Badge>
                  {isExpired && (
                    <Badge variant="destructive" className="ml-2">
                      Vencido
                    </Badge>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-bold text-xl text-primary">{formatBRL(freight.price)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Origem</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-green-600" />
                    {freight.origin_city}, {freight.origin_state}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Destino</p>
                  <p className="font-medium flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-red-600" />
                    {freight.destination_city}, {freight.destination_state}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Distância</p>
                  <p className="font-medium">{formatKm(freight.distance_km)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Peso</p>
                  <p className="font-medium">{formatTons(freight.weight)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data de Coleta</p>
                  <p className="font-medium">{formatDate(freight.pickup_date)}</p>
                </div>
                {freight.vehicle_type_required && (
                  <div>
                    <p className="text-muted-foreground">Veículo Preferencial</p>
                    <p className="font-medium flex items-center gap-1">
                      <Truck className="h-3 w-3 text-primary" />
                      {getVehicleTypeLabel(freight.vehicle_type_required)}
                      {freight.vehicle_axles_required > 0 && (
                        <span className="text-xs text-muted-foreground">({freight.vehicle_axles_required} eixos)</span>
                      )}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Motorista</p>
                  <p className="font-medium">{freight.driver?.full_name || 'Aguardando'}</p>
                </div>
              </div>
            </div>

            <div className="flex md:flex-col gap-2">
              {!freight.driver_id && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setSelectedFreightForShare(freight);
                    setShareModalOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Direcionar
                </Button>
              )}

              {isExpired && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleCancelExpired(freight.id)}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return <CenteredSpinner className="py-12" />;
  }

  const openFreights = filterFreights('open');
  const inProgressFreights = filterFreights('in_progress');
  const cancelledFreights = filterFreights('cancelled');

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Gerenciamento de Fretes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="open">
                Abertos ({openFreights.length})
              </TabsTrigger>
              <TabsTrigger value="in_progress">
                Em Andamento ({inProgressFreights.length})
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Cancelados ({cancelledFreights.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="open" className="mt-6">
              <div className="space-y-4">
                {openFreights.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">Nenhum frete aberto</p>
                  </div>
                ) : (
                  openFreights.map(renderFreightRow)
                )}
              </div>
            </TabsContent>

            <TabsContent value="in_progress" className="mt-6">
              <div className="space-y-4">
                {inProgressFreights.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">Nenhum frete em andamento</p>
                  </div>
                ) : (
                  inProgressFreights.map(renderFreightRow)
                )}
              </div>
            </TabsContent>

            <TabsContent value="cancelled" className="mt-6">
              <div className="space-y-4">
                {cancelledFreights.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-muted-foreground">Nenhum frete cancelado</p>
                  </div>
                ) : (
                  cancelledFreights.map(renderFreightRow)
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={shareModalOpen} onOpenChange={setShareModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Direcionar Motorista para o Frete</DialogTitle>
          </DialogHeader>
          {selectedFreightForShare && company && (
            <ShareFreightToDriver
              freight={selectedFreightForShare}
              companyId={company.id}
              onSuccess={() => {
                setShareModalOpen(false);
                setSelectedFreightForShare(null);
                fetchFreights();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
