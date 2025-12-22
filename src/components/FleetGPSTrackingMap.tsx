import React, { useState, useEffect, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MapPin, 
  Truck, 
  RefreshCw, 
  Search,
  Navigation,
  Clock,
  AlertCircle,
  CheckCircle,
  Circle,
  Users,
  Route
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DriverLocation {
  id: string;
  driver_profile_id: string;
  driver_name: string;
  driver_phone: string | null;
  current_lat: number;
  current_lng: number;
  last_gps_update: string;
  is_available: boolean;
  tracking_status: string;
  current_freight_id: string | null;
  freight_origin?: string;
  freight_destination?: string;
  vehicle_plate?: string;
}

interface FleetGPSTrackingMapProps {
  companyId: string;
  refreshInterval?: number;
  showDriverList?: boolean;
  className?: string;
}

type DriverStatus = 'all' | 'available' | 'in_transit' | 'offline';

/**
 * Fleet GPS Tracking Map
 * Real-time visualization of all company drivers on a map
 */
export const FleetGPSTrackingMap = memo(function FleetGPSTrackingMap({
  companyId,
  refreshInterval = 30000,
  showDriverList = true,
  className,
}: FleetGPSTrackingMapProps) {
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DriverStatus>('all');
  const [mapCenter, setMapCenter] = useState({ lat: -15.7801, lng: -47.9292 }); // Default: Brasília

  // Fetch driver locations
  const { data: drivers = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['fleet-drivers', companyId],
    queryFn: async () => {
      // Get affiliated drivers with tracking data
      const { data: trackingData, error } = await supabase
        .from('affiliated_drivers_tracking')
        .select(`
          id,
          driver_profile_id,
          current_lat,
          current_lng,
          last_gps_update,
          is_available,
          tracking_status,
          current_freight_id
        `)
        .eq('company_id', companyId)
        .not('current_lat', 'is', null);

      if (error) throw error;

      // Get driver profiles
      const driverIds = trackingData?.map(t => t.driver_profile_id).filter(Boolean) || [];
      
      if (driverIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone')
        .in('id', driverIds);

      // Get current freight info
      const freightIds = trackingData?.map(t => t.current_freight_id).filter(Boolean) || [];
      
      let freightsMap: Record<string, any> = {};
      if (freightIds.length > 0) {
        const { data: freights } = await supabase
          .from('freights')
          .select('id, origin_city, origin_state, destination_city, destination_state')
          .in('id', freightIds);
        
        freights?.forEach(f => {
          freightsMap[f.id] = f;
        });
      }

      // Combine data
      const locations: DriverLocation[] = (trackingData || []).map(tracking => {
        const profile = profiles?.find(p => p.id === tracking.driver_profile_id);
        const freight = tracking.current_freight_id ? freightsMap[tracking.current_freight_id] : null;
        
        return {
          id: tracking.id,
          driver_profile_id: tracking.driver_profile_id || '',
          driver_name: profile?.full_name || 'Motorista',
          driver_phone: profile?.phone || null,
          current_lat: tracking.current_lat,
          current_lng: tracking.current_lng,
          last_gps_update: tracking.last_gps_update,
          is_available: tracking.is_available || false,
          tracking_status: tracking.tracking_status || 'offline',
          current_freight_id: tracking.current_freight_id,
          freight_origin: freight ? `${freight.origin_city}/${freight.origin_state}` : undefined,
          freight_destination: freight ? `${freight.destination_city}/${freight.destination_state}` : undefined,
        };
      });

      return locations;
    },
    refetchInterval: refreshInterval,
    staleTime: 10000,
  });

  // Filter drivers
  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch = driver.driver_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      driver.vehicle_plate?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'available' && driver.is_available) ||
      (statusFilter === 'in_transit' && driver.current_freight_id) ||
      (statusFilter === 'offline' && !driver.is_available && !driver.current_freight_id);
    
    return matchesSearch && matchesStatus;
  });

  // Get status badge
  const getStatusBadge = (driver: DriverLocation) => {
    if (driver.current_freight_id) {
      return <Badge className="bg-blue-500 text-white">Em Viagem</Badge>;
    }
    if (driver.is_available) {
      return <Badge className="bg-green-500 text-white">Disponível</Badge>;
    }
    return <Badge variant="secondary">Offline</Badge>;
  };

  // Get status icon
  const getStatusIcon = (driver: DriverLocation) => {
    if (driver.current_freight_id) {
      return <Navigation className="h-4 w-4 text-blue-500" />;
    }
    if (driver.is_available) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Circle className="h-4 w-4 text-muted-foreground" />;
  };

  // Calculate time since last update
  const getLastUpdateText = (lastUpdate: string) => {
    if (!lastUpdate) return 'Nunca';
    try {
      return formatDistanceToNow(new Date(lastUpdate), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return 'Desconhecido';
    }
  };

  // Stats
  const stats = {
    total: drivers.length,
    available: drivers.filter(d => d.is_available).length,
    inTransit: drivers.filter(d => d.current_freight_id).length,
    offline: drivers.filter(d => !d.is_available && !d.current_freight_id).length,
  };

  return (
    <div className={className}>
      <Card className="h-full">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Rastreamento da Frota
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
          
          {/* Stats */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            <div className="text-center p-2 bg-muted rounded-lg">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="text-center p-2 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.available}</div>
              <div className="text-xs text-green-600">Disponíveis</div>
            </div>
            <div className="text-center p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.inTransit}</div>
              <div className="text-xs text-blue-600">Em Viagem</div>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-muted-foreground">{stats.offline}</div>
              <div className="text-xs text-muted-foreground">Offline</div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar motorista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DriverStatus)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="available">Disponíveis</SelectItem>
                <SelectItem value="in_transit">Em Viagem</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Map Placeholder + Driver List */}
          <div className="grid lg:grid-cols-3 gap-4">
            {/* Map Area */}
            <div className="lg:col-span-2">
              <div className="aspect-video bg-muted rounded-xl flex items-center justify-center border-2 border-dashed border-muted-foreground/25">
                <div className="text-center p-8">
                  <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-semibold text-lg mb-2">Mapa de Rastreamento</h3>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Visualize a localização em tempo real de todos os motoristas.
                    {filteredDrivers.length > 0 && (
                      <span className="block mt-2 text-primary font-medium">
                        {filteredDrivers.length} motorista(s) com GPS ativo
                      </span>
                    )}
                  </p>
                  {filteredDrivers.length > 0 && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {filteredDrivers.slice(0, 5).map(driver => (
                        <Badge key={driver.id} variant="outline" className="text-xs">
                          <Truck className="h-3 w-3 mr-1" />
                          {driver.driver_name.split(' ')[0]}
                        </Badge>
                      ))}
                      {filteredDrivers.length > 5 && (
                        <Badge variant="secondary" className="text-xs">
                          +{filteredDrivers.length - 5} mais
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Driver List */}
            {showDriverList && (
              <div className="lg:col-span-1">
                <div className="border rounded-xl h-full">
                  <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
                    <span className="font-medium text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Motoristas ({filteredDrivers.length})
                    </span>
                  </div>
                  
                  <ScrollArea className="h-[300px] lg:h-[400px]">
                    {isLoading ? (
                      <div className="p-4 space-y-3">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-2 flex-1">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-32" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : filteredDrivers.length === 0 ? (
                      <div className="p-8 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum motorista encontrado
                        </p>
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredDrivers.map(driver => (
                          <div
                            key={driver.id}
                            className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                              selectedDriver === driver.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                            }`}
                            onClick={() => setSelectedDriver(driver.id)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-full bg-primary/10">
                                <Truck className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-sm truncate">
                                    {driver.driver_name}
                                  </span>
                                  {getStatusIcon(driver)}
                                </div>
                                
                                {driver.current_freight_id && driver.freight_origin && (
                                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                    <Route className="h-3 w-3" />
                                    {driver.freight_origin} → {driver.freight_destination}
                                  </p>
                                )}
                                
                                <div className="flex items-center gap-2 mt-2">
                                  {getStatusBadge(driver)}
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {getLastUpdateText(driver.last_gps_update)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});

export default FleetGPSTrackingMap;
