import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Navigation, MapPin, Power, PowerOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFreight } from '@/hooks/useActiveFreight';
import { checkPermissionSafe, requestPermissionSafe, watchPositionSafe, isNative } from '@/utils/location';
import { startForegroundService, stopForegroundService, isForegroundServiceRunning } from '@/utils/foregroundService';
import { supabase } from '@/integrations/supabase/client';
import { GPSPermissionDeniedDialog } from '@/components/GPSPermissionDeniedDialog';
import { useAppStateTracking } from '@/hooks/useAppStateTracking';
import { BackgroundTrackingDisclosureModal } from '@/components/BackgroundTrackingDisclosureModal';

export const ManualLocationTracking = () => {
  const { profile } = useAuth();
  const { hasActiveFreight, activeFreightId, activeFreightType } = useActiveFreight();
  const [watchId, setWatchId] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [showDisclosureModal, setShowDisclosureModal] = useState(false);
  const [backgroundEnabled, setBackgroundEnabled] = useState(true);

  // Background pause handler — only if FGS is NOT running
  const handleBackgroundPause = useCallback(() => {
    if (watchId && !isForegroundServiceRunning()) {
      if (typeof watchId.clear === 'function') {
        watchId.clear();
      }
      setWatchId(null);
      setIsTracking(false);
      setBackgroundEnabled(false);
    }
  }, [watchId]);

  useAppStateTracking(isTracking, handleBackgroundPause, backgroundEnabled);

  const handleStartClick = () => {
    if (!sessionStorage.getItem('tracking_disclosure_accepted')) {
      setShowDisclosureModal(true);
    } else {
      startTracking();
    }
  };

  const handleDisclosureAccept = () => {
    sessionStorage.setItem('tracking_disclosure_accepted', '1');
    setShowDisclosureModal(false);
    startTracking();
  };

  const startTracking = async () => {
    try {
      const hasPermission = await checkPermissionSafe();
      if (!hasPermission) {
        const granted = await requestPermissionSafe();
        if (!granted) {
          setShowPermissionDialog(true);
          return;
        }
      }

      // Start Android Foreground Service BEFORE watchPosition
      if (isNative()) {
        const fgsStarted = await startForegroundService();
        setBackgroundEnabled(fgsStarted);
        if (!fgsStarted) {
          toast.warning('Permissão de notificações negada — rastreio não pode rodar em segundo plano', { duration: 6000 });
        }
      }

      const handle = watchPositionSafe(
        (coords) => updateLocation(coords),
        (error) => handleGeolocationError(error)
      );

      setWatchId(handle);
      setIsTracking(true);
      toast.success('Rastreamento ativado', {
        description: isNative() ? 'Rastreio continua em segundo plano.' : 'Sua localização está sendo monitorada.'
      });
    } catch (error: any) {
      console.error('Erro ao iniciar tracking:', error);
      handleGeolocationError(error);
    }
  };

  const stopTracking = async () => {
    if (watchId) {
      if (typeof watchId.clear === 'function') {
        watchId.clear();
      }
    }
    if (isNative()) {
      await stopForegroundService();
    }
    setWatchId(null);
    setIsTracking(false);
    toast.info('Rastreamento pausado');
  };

  const handleGeolocationError = (error: any) => {
    console.error('Erro no rastreamento:', error);
    
    if (error && error.code) {
      switch (error.code) {
        case 1:
          setShowPermissionDialog(true);
          break;
        case 2:
          toast.error('Localização indisponível', {
            description: 'Verifique se o GPS está ativado.'
          });
          break;
        case 3:
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
      await supabase
        .from('profiles')
        .update({
          current_location_lat: coords.latitude,
          current_location_lng: coords.longitude,
          last_gps_update: new Date().toISOString()
        })
        .eq('id', profile.id);

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
    <BackgroundTrackingDisclosureModal
      open={showDisclosureModal}
      onAccept={handleDisclosureAccept}
      onCancel={() => setShowDisclosureModal(false)}
    />

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
            onClick={isTracking ? stopTracking : handleStartClick}
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