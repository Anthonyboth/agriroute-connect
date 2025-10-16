import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFreight } from '@/hooks/useActiveFreight';
import { getCurrentPositionSafe, watchPositionSafe } from '@/utils/location';
import { supabase } from '@/integrations/supabase/client';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { MapPin, Navigation } from 'lucide-react';

export const DriverAutoLocationTracking = () => {
  const { profile } = useAuth();
  const { hasActiveFreight, activeFreightId, activeFreightType } = useActiveFreight();
  const [watchId, setWatchId] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;

    // Iniciar tracking quando houver frete ativo
    if (hasActiveFreight && activeFreightId) {
      startAutoTracking();
    } else {
      // Parar tracking quando não houver frete ativo
      stopAutoTracking();
    }

    return () => {
      stopAutoTracking();
    };
  }, [hasActiveFreight, activeFreightId, profile?.id]);

  const startAutoTracking = async () => {
    if (isTracking) return;

    try {
      // Obter posição inicial
      const position = await getCurrentPositionSafe();
      await updateLocation(position.coords);

      // Iniciar rastreamento contínuo
      const handle = watchPositionSafe(
        (coords) => updateLocation(coords),
        (error) => {
          console.error('Erro no rastreamento:', error);
          toast.error('Erro ao rastrear localização. Verifique suas permissões.');
        }
      );

      setWatchId(handle);
      setIsTracking(true);

      toast.success('Rastreamento automático iniciado', {
        description: 'Sua localização está sendo monitorada para segurança do frete.'
      });

    } catch (error) {
      console.error('Erro ao iniciar tracking:', error);
      toast.error('Não foi possível iniciar o rastreamento', {
        description: 'Verifique se você concedeu permissão de localização.'
      });
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
