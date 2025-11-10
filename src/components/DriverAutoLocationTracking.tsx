import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFreight } from '@/hooks/useActiveFreight';
import { checkPermissionSafe, requestPermissionSafe, watchPositionSafe } from '@/utils/location';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Navigation } from 'lucide-react';

export const DriverAutoLocationTracking = () => {
  const { profile } = useAuth();
  const { hasActiveFreight, activeFreightId, activeFreightType } = useActiveFreight();
  const [watchId, setWatchId] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [hasUserGesture, setHasUserGesture] = useState(false);

  // Registrar user gesture
  useEffect(() => {
    const handleUserGesture = () => {
      setHasUserGesture(true);
      document.removeEventListener('click', handleUserGesture);
      document.removeEventListener('touchstart', handleUserGesture);
    };

    document.addEventListener('click', handleUserGesture, { once: true });
    document.addEventListener('touchstart', handleUserGesture, { once: true });

    return () => {
      document.removeEventListener('click', handleUserGesture);
      document.removeEventListener('touchstart', handleUserGesture);
    };
  }, []);

  useEffect(() => {
    if (!profile?.id) return;

    // Iniciar tracking quando houver frete ativo E houver gesto do usuário
    if (hasActiveFreight && activeFreightId && hasUserGesture) {
      startAutoTracking();
    } else {
      // Parar tracking quando não houver frete ativo
      stopAutoTracking();
    }

    return () => {
      stopAutoTracking();
    };
  }, [hasActiveFreight, activeFreightId, profile?.id, hasUserGesture]);

  const handleGeolocationError = (error: any) => {
    console.error('Erro no rastreamento:', error);
    
    if (error && error.code) {
      switch (error.code) {
        case 1: // PERMISSION_DENIED
          toast.error('Permissão de localização negada', {
            description: 'Ative nas configurações do dispositivo.'
          });
          break;
        case 2: // POSITION_UNAVAILABLE
          toast.error('Localização indisponível', {
            description: 'Verifique se o GPS está ativado.'
          });
          break;
        case 3: // TIMEOUT
          toast.error('Tempo esgotado ao obter localização', {
            description: 'Tente novamente.'
          });
          break;
        default:
          toast.error('Erro ao rastrear localização');
      }
    } else {
      toast.error('Erro ao rastrear localização');
    }
  };

  const startAutoTracking = async () => {
    if (isTracking || !hasUserGesture) {
      console.log('⏳ Aguardando gesto do usuário para GPS...');
      return;
    }

    try {
      // Verificar permissão primeiro
      const hasPermission = await checkPermissionSafe();
      if (!hasPermission) {
        const granted = await requestPermissionSafe();
        if (!granted) {
          toast.error('Permissão de localização negada');
          return;
        }
      }

      setTimeout(() => {
        const handle = watchPositionSafe(
          (coords) => updateLocation(coords),
          (error) => handleGeolocationError(error)
        );

        setWatchId(handle);
        setIsTracking(true);

        toast.success('Rastreamento automático iniciado', {
          description: 'Sua localização está sendo monitorada para segurança do frete.'
        });
      }, 3000);

    } catch (error) {
      console.error('Erro ao iniciar tracking:', error);
      handleGeolocationError(error);
    }
  };

  const stopAutoTracking = () => {
    if (watchId) {
      if (typeof watchId.clear === 'function') {
        watchId.clear();
      } else {
        try { navigator.geolocation.clearWatch(watchId as number); } catch {}
      }
      setWatchId(null);
      setIsTracking(false);

      if (hasActiveFreight) {
        toast.info('Rastreamento pausado');
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

      // Atualizar localização no frete ativo
      if (activeFreightType === 'freight' || activeFreightType === 'assignment') {
        await supabase
          .from('freights')
          .update({
            current_lat: coords.latitude,
            current_lng: coords.longitude,
            last_location_update: new Date().toISOString()
          })
          .eq('id', activeFreightId);
      }
      // Para serviços, apenas atualizar no perfil (service_requests não tem campos de tracking)

    } catch (error) {
      console.error('Erro ao atualizar localização:', error);
    }
  };

  // Não renderizar nada se não houver frete ativo ou se não for motorista
  if (!hasActiveFreight || !profile || !['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(profile.role)) {
    return null;
  }

  return (
    <Alert className="mb-4">
      <Navigation className="h-4 w-4 animate-pulse" />
      <AlertTitle className="flex items-center gap-2">
        Rastreamento Automático Ativo
      </AlertTitle>
      <AlertDescription>
        Sua localização está sendo rastreada automaticamente para segurança e tracking do frete.
        O rastreamento será encerrado automaticamente quando o frete for concluído.
      </AlertDescription>
    </Alert>
  );
};
