import React, { useState, useEffect } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Package, MapPin, DollarSign, Calendar, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { formatDate, formatKm } from '@/lib/formatters';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';

interface HistoricalFreight {
  id: string;
  cargo_type: string;
  origin_address: string;
  destination_address: string;
  pickup_date: string;
  delivery_date?: string;
  price: number;
  distance_km: number;
  weight: number;
  status: string;
  created_at: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  driver?: {
    full_name: string;
  };
}

export const CompanyHistory: React.FC = () => {
  const { company, drivers } = useTransportCompany();
  const [freights, setFreights] = useState<HistoricalFreight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (company?.id) {
      fetchHistoricalFreights();
    }
  }, [company]);

  const fetchHistoricalFreights = async () => {
    if (!company?.id) return;

    try {
      setLoading(true);

      // Buscar IDs dos motoristas afiliados
      const driverIds = drivers?.filter(d => d.status === 'ACTIVE').map(d => d.driver_profile_id) || [];

      // Buscar fretes finalizados da empresa
      const { data, error } = await supabase
        .from('freights')
        .select(`
          *,
          driver:profiles!freights_driver_id_fkey(full_name)
        `)
        .or(`company_id.eq.${company.id}${driverIds.length > 0 ? `,driver_id.in.(${driverIds.join(',')})` : ''}`)
        .in('status', ['CANCELLED', 'DELIVERED', 'COMPLETED', 'DELIVERED_PENDING_CONFIRMATION'])
        .order('updated_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setFreights(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const filterFreights = (status: string) => {
    if (status === 'all') return freights;
    if (status === 'completed') {
      return freights.filter(f => f.status === 'DELIVERED' || f.status === 'COMPLETED' || f.status === 'DELIVERED_PENDING_CONFIRMATION');
    }
    if (status === 'cancelled') {
      return freights.filter(f => f.status === 'CANCELLED');
    }
    return freights;
  };

  const renderFreightCard = (freight: HistoricalFreight) => (
    <Card key={freight.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold">{freight.cargo_type}</span>
              </div>
              {freight.driver && (
                <p className="text-sm text-muted-foreground">
                  Motorista: {freight.driver.full_name}
                </p>
              )}
            </div>
            <Badge variant={getFreightStatusVariant(freight.status)}>
              {getFreightStatusLabel(freight.status)}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground flex-1">{freight.origin_address}</span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground flex-1">{freight.destination_address}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="font-semibold text-sm">{precoPreenchidoDoFrete(freight.id, freight, { unitOnly: true }).primaryText}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Distância</p>
              <p className="font-semibold text-sm">{formatKm(freight.distance_km)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Coleta</p>
              <p className="font-semibold text-sm">{formatDate(freight.pickup_date)}</p>
            </div>
          </div>

          {freight.status === 'CANCELLED' && freight.cancellation_reason && (
            <div className="bg-destructive/10 p-2 rounded text-xs text-destructive">
              <strong>Motivo:</strong> {freight.cancellation_reason}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return <CenteredSpinner />;
  }

  const completedCount = freights.filter(f => ['DELIVERED', 'COMPLETED', 'DELIVERED_PENDING_CONFIRMATION'].includes(f.status)).length;
  const cancelledCount = freights.filter(f => f.status === 'CANCELLED').length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Histórico de Fretes
          </CardTitle>
          <CardDescription>
            Fretes finalizados e cancelados da transportadora
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">{freights.length}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{completedCount}</div>
              <div className="text-sm text-muted-foreground">Concluídos</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{cancelledCount}</div>
              <div className="text-sm text-muted-foreground">Cancelados</div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">Todos ({freights.length})</TabsTrigger>
              <TabsTrigger value="completed">Concluídos ({completedCount})</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelados ({cancelledCount})</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4 mt-4">
              {filterFreights('all').length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhum frete no histórico</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterFreights('all').map(renderFreightCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4 mt-4">
              {filterFreights('completed').length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhum frete concluído ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterFreights('completed').map(renderFreightCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="cancelled" className="space-y-4 mt-4">
              {filterFreights('cancelled').length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhum frete cancelado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterFreights('cancelled').map(renderFreightCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
