import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { FreightHistory } from './FreightHistory';
import { ServiceHistory } from './ServiceHistory';
import { Truck, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface UnifiedHistoryProps {
  userRole: 'MOTORISTA' | 'PRODUTOR';
}

export const UnifiedHistory: React.FC<UnifiedHistoryProps> = ({ userRole }) => {
  const { profile } = useAuth();
  const [freightCount, setFreightCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'freights' | 'services'>('freights');

  useEffect(() => {
    if (!profile?.id) return;

    const fetchCounts = async () => {
      try {
        // Contagem de fretes
        if (userRole === 'MOTORISTA') {
          const { count: freightCount } = await supabase
            .from('freights')
            .select('*', { count: 'exact', head: true })
            .eq('driver_id', profile.id);
          
          const { count: serviceCount } = await supabase
            .from('service_requests')
            .select('*', { count: 'exact', head: true })
            .eq('provider_id', profile.id);

          setFreightCount(freightCount || 0);
          setServiceCount(serviceCount || 0);
        } else if (userRole === 'PRODUTOR') {
          const { count: freightCount } = await supabase
            .from('freights')
            .select('*', { count: 'exact', head: true })
            .eq('producer_id', profile.id);
          
          const { count: serviceCount } = await supabase
            .from('service_requests')
            .select('*', { count: 'exact', head: true })
            .eq('client_id', profile.id);

          setFreightCount(freightCount || 0);
          setServiceCount(serviceCount || 0);
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
