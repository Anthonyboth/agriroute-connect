import { useDriverTracking } from "@/hooks/useDriverTracking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, MapPin, Clock } from "lucide-react";
import { DriverLocationMap } from "./DriverLocationMap";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface DriverLocationTabProps {
  driverProfileId: string;
}

export const DriverLocationTab = ({ driverProfileId }: DriverLocationTabProps) => {
  const { currentLocation, isLoading, refreshLocation } = useDriverTracking(driverProfileId);

  const { data: driver } = useQuery({
    queryKey: ['driver-name', driverProfileId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', driverProfileId)
        .single();
      return data;
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  if (!currentLocation.lat || !currentLocation.lng) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Localização não disponível</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            O motorista precisa ativar o GPS e abrir o aplicativo para compartilhar sua localização.
          </p>
          <Button onClick={refreshLocation} className="mt-4" variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar Novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Localização em Tempo Real</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={currentLocation.isOnline ? 'default' : 'secondary'}>
              {currentLocation.isOnline ? 'Online' : 'Offline'}
            </Badge>
            <Button onClick={refreshLocation} size="sm" variant="outline">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              Última atualização:{' '}
              {currentLocation.lastUpdate
                ? new Date(currentLocation.lastUpdate).toLocaleString('pt-BR')
                : 'Nunca'}
            </span>
          </div>

          <DriverLocationMap
            lat={currentLocation.lat}
            lng={currentLocation.lng}
            driverName={driver?.full_name}
          />

          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Latitude</p>
              <p className="font-mono text-sm">{currentLocation.lat.toFixed(6)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Longitude</p>
              <p className="font-mono text-sm">{currentLocation.lng.toFixed(6)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
