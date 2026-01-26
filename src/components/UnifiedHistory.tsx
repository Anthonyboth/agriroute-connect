import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FreightHistory } from './FreightHistory';
import { ServiceHistory } from './ServiceHistory';
import { Truck, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { getFreightTypesForQuery, isFreightType } from '@/lib/item-classification';

interface UnifiedHistoryProps {
  userRole: 'MOTORISTA' | 'PRODUTOR';
  initialTab?: 'freights' | 'services';
}

export const UnifiedHistory: React.FC<UnifiedHistoryProps> = ({ 
  userRole, 
  initialTab = 'freights' 
}) => {
  const { profile } = useAuth();
  const [freightCount, setFreightCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'freights' | 'services'>(initialTab);

  useEffect(() => {
    if (!profile?.id) return;

    const fetchCounts = async () => {
      try {
        // ✅ P0 FIX: Usar classificação centralizada para contadores corretos
        const freightTypes = getFreightTypesForQuery();
        
        if (userRole === 'MOTORISTA') {
          // Fretes rurais = freights.driver_id
          const { count: freightsCount } = await supabase
            .from('freights')
            .select('*', { count: 'exact', head: true })
            .eq('driver_id', profile.id);
          
          // Fretes urbanos = service_requests onde provider_id E tipo é FRETE
          const { count: providedFreightsCount } = await supabase
            .from('service_requests')
            .select('*', { count: 'exact', head: true })
            .eq('provider_id', profile.id)
            .in('service_type', freightTypes);

          // Serviços = service_requests onde client_id E tipo NÃO é FRETE
          const { data: clientServices } = await supabase
            .from('service_requests')
            .select('service_type')
            .eq('client_id', profile.id);
          
          // ✅ Contar apenas serviços NÃO-frete
          const serviceOnlyCount = (clientServices || []).filter(
            s => !isFreightType(s.service_type)
          ).length;

          setFreightCount((freightsCount || 0) + (providedFreightsCount || 0));
          setServiceCount(serviceOnlyCount);
          
        } else if (userRole === 'PRODUTOR') {
          // ✅ P0 FIX: Para PRODUTOR, separar corretamente FRETE de SERVIÇO
          
          // Fretes rurais = freights.producer_id
          const { count: ruralFreightCount } = await supabase
            .from('freights')
            .select('*', { count: 'exact', head: true })
            .eq('producer_id', profile.id);
          
          // Fretes urbanos = service_requests onde client_id E tipo é FRETE
          const { count: urbanFreightCount } = await supabase
            .from('service_requests')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', profile.id)
            .in('service_type', freightTypes);
          
          // Serviços = service_requests onde client_id E tipo NÃO é FRETE
          const { data: allServices } = await supabase
            .from('service_requests')
            .select('service_type')
            .eq('client_id', profile.id);
          
          // ✅ Contar apenas serviços NÃO-frete
          const serviceOnlyCount = (allServices || []).filter(
            s => !isFreightType(s.service_type)
          ).length;

          // ✅ Total de fretes = rural + urbano
          setFreightCount((ruralFreightCount || 0) + (urbanFreightCount || 0));
          setServiceCount(serviceOnlyCount);
          
          if (import.meta.env.DEV) {
            console.log('[UnifiedHistory] ✅ PRODUTOR counts:', {
              ruralFreights: ruralFreightCount,
              urbanFreights: urbanFreightCount,
              totalFreights: (ruralFreightCount || 0) + (urbanFreightCount || 0),
              services: serviceOnlyCount
            });
          }
        }
      } catch (error) {
        console.error('Erro ao buscar contadores:', error);
      }
    };

    fetchCounts();

    // Realtime para atualizar contadores
    const channel = supabase
      .channel('history-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freights' }, fetchCounts)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, fetchCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, userRole]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-2xl">
          Histórico Completo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'freights' | 'services')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="freights" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Fretes
              {freightCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {freightCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              Serviços
              {serviceCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {serviceCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="freights" className="mt-6">
            <FreightHistory />
          </TabsContent>

          <TabsContent value="services" className="mt-6">
            <ServiceHistory />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
