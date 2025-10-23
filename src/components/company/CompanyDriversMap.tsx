import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DriverTrackingCard } from './DriverTrackingCard';
import { MapPin, Users } from 'lucide-react';

export const CompanyDriversMap = () => {
  const { company } = useTransportCompany();
  const [driversTracking, setDriversTracking] = useState<any[]>([]);

  // Buscar tracking de todos os motoristas
  const { data } = useQuery({
    queryKey: ['drivers-tracking', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data, error } = await supabase
        .from('affiliated_drivers_tracking')
        .select(`
          *,
          driver:profiles!driver_profile_id(
            full_name, 
            profile_photo_url
          ),
          freight:freights!current_freight_id(
            origin_address, 
            destination_address,
            status
          )
        `)
        .eq('company_id', company.id)
        .order('is_available', { ascending: false })
        .order('last_gps_update', { ascending: false });
      
      if (error) {
        console.error('[CompanyDriversMap] Error:', error);
        throw error;
      }
      
      return data || [];
    },
    enabled: !!company?.id,
    refetchInterval: 30000, // Refetch a cada 30 segundos
  });

  // Realtime subscription para atualizações em tempo real
  useEffect(() => {
    if (!company?.id) return;
    
    console.log('[CompanyDriversMap] Iniciando subscription para company:', company.id);
    
    const channel = supabase
      .channel(`company-tracking-${company.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'affiliated_drivers_tracking',
        filter: `company_id=eq.${company.id}`
      }, (payload) => {
        console.log('[CompanyDriversMap] Realtime update:', payload);
        
        // Atualizar estado com nova localização
        setDriversTracking(prev => {
          const updated = [...prev];
          const newData = payload.new as any;
          
          if (!newData || !newData.id) return prev;
          
          const index = updated.findIndex(d => d.id === newData.id);
          
          if (index >= 0) {
            updated[index] = { ...updated[index], ...newData };
          } else {
            // Novo motorista adicionado
            updated.push(newData);
          }
          
          return updated;
        });
      })
      .subscribe();
    
    return () => {
      console.log('[CompanyDriversMap] Desinscrever subscription');
      channel.unsubscribe();
    };
  }, [company?.id]);

  // Atualizar estado local quando data mudar
  useEffect(() => {
    if (data) {
      setDriversTracking(data);
    }
  }, [data]);

  const availableDrivers = driversTracking.filter(d => d.is_available);
  const busyDrivers = driversTracking.filter(d => !d.is_available);

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Total de Motoristas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{driversTracking.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              Disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {availableDrivers.length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-blue-500" />
              Em Frete
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {busyDrivers.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mapa e Lista de Motoristas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Mapa (placeholder - pode ser implementado com Google Maps depois) */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Localização dos Motoristas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[500px] bg-muted rounded-lg flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MapPin className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Mapa em desenvolvimento</p>
                <p className="text-sm">Integração com Google Maps em breve</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Motoristas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Motoristas ({driversTracking.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px] px-4">
              <div className="space-y-2 pb-4">
                {/* Motoristas ocupados primeiro */}
                {busyDrivers.length > 0 && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground mb-2 mt-2">
                      EM FRETE ({busyDrivers.length})
                    </div>
                    {busyDrivers.map(driver => (
                      <DriverTrackingCard 
                        key={driver.id} 
                        driver={driver}
                        onClick={() => {
                          // TODO: Abrir modal com detalhes do motorista
                          console.log('Ver detalhes:', driver);
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Motoristas disponíveis */}
                {availableDrivers.length > 0 && (
                  <>
                    <div className="text-xs font-medium text-muted-foreground mb-2 mt-4">
                      DISPONÍVEIS ({availableDrivers.length})
                    </div>
                    {availableDrivers.map(driver => (
                      <DriverTrackingCard 
                        key={driver.id} 
                        driver={driver}
                        onClick={() => {
                          // TODO: Abrir modal com detalhes do motorista
                          console.log('Ver detalhes:', driver);
                        }}
                      />
                    ))}
                  </>
                )}

                {driversTracking.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Nenhum motorista afiliado</p>
                    <p className="text-sm">Convide motoristas para sua transportadora</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
