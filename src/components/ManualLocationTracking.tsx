import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Navigation, MapPin, Power, PowerOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFreight } from '@/hooks/useActiveFreight';
import { checkPermissionSafe, requestPermissionSafe, watchPositionSafe, isNative } from '@/utils/location';
import { supabase } from '@/integrations/supabase/client';
import { GPSPermissionDeniedDialog } from '@/components/GPSPermissionDeniedDialog';

export const ManualLocationTracking = () => {
  const { profile } = useAuth();
  const { hasActiveFreight, activeFreightId, activeFreightType } = useActiveFreight();
  const [watchId, setWatchId] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const startTracking = async () => {
    try {
      // Verificar permissão primeiro
      const hasPermission = await checkPermissionSafe();
      if (!hasPermission) {
        const granted = await requestPermissionSafe();
        if (!granted) {
          setShowPermissionDialog(true);
          return;
        }
      }

      const handle = watchPositionSafe(
        (coords) => updateLocation(coords),
        (error) => handleGeolocationError(error)
      );

      setWatchId(handle);
      setIsTracking(true);
      toast.success('Rastreamento ativado', {
        description: 'Sua localização está sendo monitorada.'
      });
    } catch (error: any) {
      console.error('Erro ao iniciar tracking:', error);
      handleGeolocationError(error);
    }
  };

  const stopTracking = () => {
    if (watchId) {
      if (typeof watchId.clear === 'function') {
        watchId.clear();
      }
      setWatchId(null);
      setIsTracking(false);
      toast.info('Rastreamento pausado');
    }
  };

  const handleGeolocationError = (error: any) => {
    console.error('Erro no rastreamento:', error);
    
    if (error && error.code) {
      switch (error.code) {
        case 1: // PERMISSION_DENIED
          setShowPermissionDialog(true);
          break;
        case 2: // POSITION_UNAVAILABLE
          toast.error('Localização indisponível', {
            description: 'Verifique se o GPS está ativado.'
          });
          break;
        case 3: // TIMEOUT
          toast.error('Tempo esgotado ao obter localização');
          break;
        default:
          toast.error('Erro ao rastrear localização');
      }
    }
  };

  const updateLocation = async (coords: GeolocationCoordinates) => {
    if (!profile?.id || !activeFreightId) return;

    try {
      // Atualizar localização no perfil
      await supabase
        .from('profiles')
        .update({
          current_location_lat: coords.latitude,
          current_location_lng: coords.longitude,
          last_gps_update: new Date().toISOString()
        })
        .eq('id', profile.id);

      // ❌ REMOVIDO: Atualização direta na tabela freights
      // Isso causava erro "Data de coleta deve ser futura" devido ao trigger validate_freight_input
      // A localização agora é lida de driver_current_locations ou profiles pelo hook useFreightRealtimeLocation

      setLastUpdate(new Date());
    } catch (error) {
      console.error('Erro ao atualizar localização:', error);
    }
  };

  if (!profile || !['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(profile.role)) {
    return null;
  }

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-5 w-5" />
          Rastreamento Manual
        </CardTitle>
        <CardDescription>
          Controle quando sua localização é compartilhada
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={isTracking ? "default" : "secondary"}>
              {isTracking ? (
                <>
                  <MapPin className="h-3 w-3 mr-1 animate-pulse" />
                  Ativo
                </>
              ) : (
                <>
                  <PowerOff className="h-3 w-3 mr-1" />
                  Pausado
                </>
              )}
            </Badge>
            {lastUpdate && isTracking && (
              <span className="text-xs text-muted-foreground">
                Última atualização: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
          
          <Button
            onClick={isTracking ? stopTracking : startTracking}
            variant={isTracking ? "destructive" : "default"}
            size="sm"
          >
            {isTracking ? (
              <>
                <PowerOff className="h-4 w-4 mr-2" />
                Parar
              </>
            ) : (
              <>
                <Power className="h-4 w-4 mr-2" />
                Iniciar
              </>
            )}
          </Button>
        </div>

        {!hasActiveFreight && (
          <p className="text-sm text-muted-foreground">
            ℹ️ O rastreamento só é necessário quando você tem um frete ativo.
          </p>
        )}
      </CardContent>
    </Card>

    <GPSPermissionDeniedDialog 
      open={showPermissionDialog} 
      onOpenChange={setShowPermissionDialog} 
    />
    </>
  );
};
