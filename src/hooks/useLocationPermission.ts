import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { checkPermissionSafe, requestPermissionSafe, getCurrentPositionSafe, watchPositionSafe } from '@/utils/location';

interface LocationState {
  hasPermission: boolean;
  isRequesting: boolean;
  error: string | null;
  coords: GeolocationCoordinates | null;
}

export const useLocationPermission = (mandatory: boolean = true) => {
  const [locationState, setLocationState] = useState<LocationState>({
    hasPermission: false,
    isRequesting: false,
    error: null,
    coords: null
  });

  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    const granted = await checkPermissionSafe();
    if (granted) {
      try {
        const pos = await getCurrentPositionSafe();
        setLocationState({
          hasPermission: true,
          isRequesting: false,
          error: null,
          coords: pos.coords
        });
      } catch (e) {
        setLocationState(prev => ({ ...prev, hasPermission: true }));
      }
    } else {
      if (mandatory) setShowPermissionModal(true);
      setLocationState(prev => ({ ...prev, hasPermission: false }));
    }
  };

  const requestLocation = async (): Promise<boolean> => {
    setLocationState(prev => ({ ...prev, isRequesting: true, error: null }));

    try {
      const granted = await requestPermissionSafe();
      if (!granted) throw Object.assign(new Error('Permissão de localização negada'), { code: 1 });

      const pos = await getCurrentPositionSafe();
      setLocationState({
        hasPermission: true,
        isRequesting: false,
        error: null,
        coords: pos.coords
      });
      setShowPermissionModal(false);
      return true;
    } catch (error: any) {
      let errorMessage = 'Erro ao acessar localização';
      if (error?.code === 1) errorMessage = 'Permissão de localização negada';
      setLocationState(prev => ({
        ...prev,
        isRequesting: false,
        error: errorMessage,
        hasPermission: false
      }));
      if (mandatory) toast.error(errorMessage + '. A localização é obrigatória para usar o AgroRoute.');
      return false;
    }
  };

  const watchLocation = (callback: (coords: GeolocationCoordinates) => void) => {
    if (!locationState.hasPermission) return null as any;
    const handle = watchPositionSafe((coords) => {
      setLocationState(prev => ({ ...prev, coords }));
      callback(coords);
    }, (error) => {
      console.error('Location watch error:', error);
    });
    return handle;
  };
  const hidePermissionModal = () => {
    if (!mandatory) {
      setShowPermissionModal(false);
    }
  };

  return {
    ...locationState,
    showPermissionModal,
    requestLocation,
    watchLocation,
    hidePermissionModal,
    checkLocationPermission
  };
};