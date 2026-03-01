import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, MapPin, Calendar, DollarSign, RefreshCw, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatBRL, formatDate, formatTons } from '@/lib/formatters';
import { LABELS } from '@/lib/labels';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';

interface CompanyFreightHistoryProps {
  companyId: string;
}

interface FreightData {
  id: string;
  cargo_type: string;
  weight: number;
  origin_address: string;
  destination_address: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
  pickup_date: string;
  delivery_date?: string;
  price: number;
  status: string;
  urgency: string;
  created_at: string;
  producer_id?: string;
  driver_id?: string;
  producer?: { full_name: string; contact_phone?: string };
  driver?: { full_name: string; contact_phone?: string };
}

export const CompanyFreightHistory: React.FC<CompanyFreightHistoryProps> = ({ companyId }) => {
  const [freights, setFreights] = useState<FreightData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'active' | 'completed' | 'cancelled'>('active');

  const fetchFreights = async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      console.log('🔍 [CompanyHistory] Buscando histórico para company:', companyId);

      // Buscar fretes diretos da empresa
      const { data: directFreights, error: directError } = await supabase
        .from('freights')
        .select(`
          *,
          producer:profiles_secure!freights_producer_id_fkey(full_name, contact_phone),
          driver:profiles_secure!freights_driver_id_fkey(full_name, contact_phone)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (directError) throw directError;

      // Buscar fretes via assignments
      const { data: assignments, error: assignError } = await supabase
        .from('freight_assignments')
        .select(`
          freight_id,
          freight:freights(
            *,
            producer:profiles_secure!freights_producer_id_fkey(full_name, contact_phone),
            driver:profiles_secure!freights_driver_id_fkey(full_name, contact_phone)
          )
        `)
        .eq('company_id', companyId);

      if (assignError) throw assignError;

      // Combinar e deduplicar
      const assignmentFreights = (assignments || [])
        .map(a => a.freight)
        .filter(f => f !== null) as FreightData[];

      const allFreights = [...(directFreights || []), ...assignmentFreights];
      const uniqueFreights = Array.from(
        new Map(allFreights.map(f => [f.id, f])).values()
      );

      console.log(`✅ [CompanyHistory] ${uniqueFreights.length} fretes encontrados`);
      setFreights(uniqueFreights);
    } catch (error: any) {
      console.error('Erro ao buscar histórico:', error);
      toast.error('Erro ao carregar histórico de fretes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFreights();
  }, [companyId]);

  // Realtime updates
  useEffect(() => {
    if (!companyId) return;

    const channel = supabase
      .channel('company-freight-history')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freights',
          filter: `company_id=eq.${companyId}`
        },
        () => fetchFreights()
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments',
          filter: `company_id=eq.${companyId}`
        },
        () => fetchFreights()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]);

  // Filtrar por status
  const activeStatuses = ['OPEN', 'ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT'];
  const completedStatuses = ['DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED'];
  const cancelledStatuses = ['CANCELLED'];

  const activeFreights = freights.filter(f => activeStatuses.includes(f.status));
  const completedFreights = freights.filter(f => completedStatuses.includes(f.status));
  const cancelledFreights = freights.filter(f => cancelledStatuses.includes(f.status));

  const renderFreightCard = (freight: FreightData) => (
    <Card key={freight.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">
              {getCargoTypeLabel(freight.cargo_type)}
            </span>
          </div>
          <Badge variant={getFreightStatusVariant(freight.status)}>
            {getFreightStatusLabel(freight.status)}
          </Badge>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Origem:</p>
              <p className="text-muted-foreground">
                {freight.origin_city && freight.origin_state
                  ? `${freight.origin_city}, ${freight.origin_state}`
                  : freight.origin_address}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium">Destino:</p>
              <p className="text-muted-foreground">
                {freight.destination_city && freight.destination_state
                  ? `${freight.destination_city}, ${freight.destination_state}`
                  : freight.destination_address}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {LABELS.COLETA}: {formatDate(freight.pickup_date)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-semibold text-green-600">
              {/* ✅ Histórico da empresa — preço unitário canônico, NUNCA total */}
              {precoPreenchidoDoFrete(freight.id, freight, { unitOnly: true }).primaryText}
            </span>
          </div>

          {freight.producer && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">
                Produtor: <span className="font-medium">{freight.producer.full_name}</span>
              </p>
            </div>
          )}

          {freight.driver && (
            <div className="pt-1">
              <p className="text-xs text-muted-foreground">
                Motorista: <span className="font-medium">{freight.driver.full_name}</span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Histórico de Fretes da Empresa
              </CardTitle>
              <CardDescription>
                Acompanhe todos os fretes da sua transportadora
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchFreights}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="active" className="relative">
                Ativos
                {activeFreights.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFreights.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed" className="relative">
                Concluídos
                {completedFreights.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {completedFreights.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="cancelled" className="relative">
                Cancelados
                {cancelledFreights.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {cancelledFreights.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : activeFreights.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum frete ativo no momento
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeFreights.map(renderFreightCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="completed" className="mt-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : completedFreights.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum frete concluído
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {completedFreights.map(renderFreightCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="cancelled" className="mt-4">
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Carregando...
                </div>
              ) : cancelledFreights.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum frete cancelado
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {cancelledFreights.map(renderFreightCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
