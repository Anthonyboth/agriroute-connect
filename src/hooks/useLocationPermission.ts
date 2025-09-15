import { useState, useEffect } from 'react';
import { toast } from 'sonner';

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

  const checkLocationPermission = () => {
    if (!('geolocation' in navigator)) {
      setLocationState(prev => ({ 
        ...prev, 
        error: 'Geolocalização não suportada' 
      }));
      return;
    }

    // Verificar se já tem permissão
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationState({
          hasPermission: true,
          isRequesting: false,
          error: null,
          coords: position.coords
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          if (mandatory) {
            setShowPermissionModal(true);
          }
          setLocationState(prev => ({
            ...prev,
            hasPermission: false,
            error: 'Permissão de localização negada'
          }));
        }
      },
      { timeout: 5000, maximumAge: 300000 }
    );
  };

  const requestLocation = async (): Promise<boolean> => {
    setLocationState(prev => ({ ...prev, isRequesting: true, error: null }));

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocationState({
            hasPermission: true,
            isRequesting: false,
            error: null,
            coords: position.coords
          });
          setShowPermissionModal(false);
          resolve(true);
        },
        (error) => {
          let errorMessage = 'Erro ao acessar localização';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permissão de localização negada';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Localização não disponível';
              break;
            case error.TIMEOUT:
              errorMessage = 'Timeout ao solicitar localização';
              break;
          }
          
          setLocationState(prev => ({
            ...prev,
            isRequesting: false,
            error: errorMessage,
            hasPermission: false
          }));
          
          if (mandatory) {
            toast.error(errorMessage + '. A localização é obrigatória para usar o AgroRoute.');
          }
          
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000
        }
      );
    });
  };

  const watchLocation = (callback: (coords: GeolocationCoordinates) => void) => {
    if (!locationState.hasPermission) return null;

    return navigator.geolocation.watchPosition(
      (position) => {
        setLocationState(prev => ({ ...prev, coords: position.coords }));
        callback(position.coords);
      },
      (error) => {
        console.error('Location watch error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // 1 minuto
      }
    );
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