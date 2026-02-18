import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useActiveFreight } from '@/hooks/useActiveFreight';
import { useOngoingFreightLocation } from '@/hooks/useOngoingFreightLocation';
import { checkPermissionSafe, requestPermissionSafe, watchPositionSafe, isNative } from '@/utils/location';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Navigation } from 'lucide-react';
import { GPSPermissionDeniedDialog } from '@/components/GPSPermissionDeniedDialog';

export const DriverAutoLocationTracking = () => {
  const { profile } = useAuth();
  const { hasActiveFreight, activeFreightId } = useActiveFreight();
  const [watchId, setWatchId] = useState<any>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [hasUserGesture, setHasUserGesture] = useState(false);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const { updateFromCoords } = useOngoingFreightLocation({
    driverProfileId: profile?.id ?? null,
    freightId: activeFreightId ?? null,
    minUpdateInterval: 5000
  });

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

    // ✅ No Capacitor (nativo), não precisa de user gesture para pedir permissão de GPS
    const canStart = isNative() ? true : hasUserGesture;

    if (hasActiveFreight && activeFreightId && canStart) {
      startAutoTracking();
    } else {
      stopAutoTracking();
    }

    return () => {
      stopAutoTracking();
    };
  }, [hasActiveFreight, activeFreightId, profile?.id, hasUserGesture]);

  const handleGeolocationError = (error: any) => {
    console.warn('[GPS] Erro no rastreamento:', error);
    
    const errorMsg = typeof error === 'string' ? error : (error?.message ?? '');
    
    // Interceptar mensagens nativas em inglês do Capacitor
    if (errorMsg.toLowerCase().includes('missing') && errorMsg.toLowerCase().includes('permission')) {
      setShowPermissionDialog(true);
      return;
    }
    
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
          toast.error('Tempo esgotado ao obter localização', {
            description: 'Tente novamente.'
          });
          break;
        default:
          toast.error('Erro ao rastrear localização');
      }
    } else if (errorMsg) {
      toast.error('Erro ao rastrear localização', {
        description: 'Verifique se o GPS está ativado e a permissão concedida.'
      });
    } else {
      toast.error('Erro ao rastrear localização');
    }
  };

  const startAutoTracking = async () => {
    if (isTracking || (!isNative() && !hasUserGesture)) {
      return;
    }

    try {
      let hasPermission = false;
      try {
        hasPermission = await checkPermissionSafe();
      } catch {
        hasPermission = false;
      }
      
      if (!hasPermission) {
        try {
          const granted = await requestPermissionSafe();
          if (!granted) {
            setShowPermissionDialog(true);
            return;
          }
        } catch (permErr: any) {
          handleGeolocationError(permErr);
          return;
        }
      }

      setTimeout(() => {
        try {
          const handle = watchPositionSafe(
            (coords) => updateFromCoords(coords),
            (error) => handleGeolocationError(error)
          );

          setWatchId(handle);
          setIsTracking(true);

          toast.success('Rastreamento automático iniciado', {
            description: 'Sua localização está sendo monitorada para segurança do frete.'
          });
        } catch (watchErr: any) {
          handleGeolocationError(watchErr);
        }
      }, 3000);

    } catch (error: any) {
      handleGeolocationError(error);
    }
  };

  const stopAutoTracking = () => {
    if (watchId) {
      if (typeof watchId.clear === 'function') {
        watchId.clear();
      }
      setWatchId(null);
      setIsTracking(false);

      if (hasActiveFreight) {
        toast.info('Rastreamento pausado');
      }
    }
  };

  if (!hasActiveFreight || !profile || !['MOTORISTA', 'MOTORISTA_AFILIADO', 'GUINCHO', 'MOTO_FRETE'].includes(profile.role)) {
    return (
      <GPSPermissionDeniedDialog 
        open={showPermissionDialog} 
        onOpenChange={setShowPermissionDialog} 
      />
    );
  }

  return (
    <>
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

    <GPSPermissionDeniedDialog 
      open={showPermissionDialog} 
      onOpenChange={setShowPermissionDialog} 
    />
    </>
  );
};
