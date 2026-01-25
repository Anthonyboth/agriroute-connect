import { useDriverTracking } from "@/hooks/useDriverTracking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, MapPin, Clock } from "lucide-react";
import { DriverLocationMapMapLibre as DriverLocationMap } from "./DriverLocationMapMapLibre";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/utils/notify";

interface DriverLocationTabProps {
  driverProfileId: string;
  companyId?: string;
}

export const DriverLocationTab = ({ driverProfileId, companyId }: DriverLocationTabProps) => {
  const { currentLocation, isLoading, refreshLocation } = useDriverTracking(driverProfileId, companyId);

  // Usar profiles_secure para proteção de PII - mascara dados para não-proprietários
  const { data: driver } = useQuery({
    queryKey: ['driver-name-secure', driverProfileId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles_secure')
        .select('full_name')
        .eq('id', driverProfileId)
        .maybeSingle();
      return data;
    },
  });

  if (isLoading) {
    return <Skeleton className="h-[500px] w-full" />;
  }

  const handleRequestLocation = async () => {
    if (!driverProfileId || !companyId) return;
    
    try {
      const success = await sendNotification({
        user_id: driverProfileId,
        title: '📍 Solicitação de Localização',
        message: 'A transportadora solicitou que você ative o GPS e compartilhe sua localização. Por favor, abra o aplicativo e ative o rastreamento.',
        type: 'request_location',
        data: { companyId, requestedAt: new Date().toISOString() }
      });
      
      if (!success) {
        throw new Error('Falha ao enviar notificação');
      }
      
      alert('✅ Solicitação enviada! O motorista receberá uma notificação para ativar o GPS.');
    } catch (error) {
      console.error('Erro ao solicitar localização:', error);
      alert('❌ Erro ao enviar solicitação. Tente novamente.');
    }
  };

  if (!currentLocation.lat || !currentLocation.lng) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium mb-2">Localização não disponível</p>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            O motorista precisa ativar o GPS e abrir o aplicativo para compartilhar sua localização.
          </p>
          <div className="flex gap-2 mt-4">
            <Button onClick={refreshLocation} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
            <Button onClick={handleRequestLocation} variant="default" size="sm">
              <MapPin className="h-4 w-4 mr-2" />
              Solicitar Localização
            </Button>
          </div>
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
