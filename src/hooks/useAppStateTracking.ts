import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { toast } from 'sonner';

/**
 * Hook that detects when the app goes to background (native only)
 * and calls the provided callback to stop tracking.
 * 
 * Play Store Compliance: This ensures zero location collection in background.
 */
export const useAppStateTracking = (
  isTracking: boolean,
  onPause: () => void
) => {
  const isTrackingRef = useRef(isTracking);
  isTrackingRef.current = isTracking;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: any;

    const setup = async () => {
      listener = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive && isTrackingRef.current) {
          console.log('[AppState] App foi para background — pausando rastreamento');
          onPause();
          toast.info('Rastreamento pausado', {
            description: 'Rastreamento em segundo plano desativado nesta versão. Mantenha o app aberto durante a viagem.',
            duration: 8000,
          });
        }
      });
    };

    setup();

    return () => {
      listener?.remove?.();
    };
  }, [onPause]);
};
