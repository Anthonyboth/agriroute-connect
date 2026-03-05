import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Hook that detects when the app goes to background/foreground (native only).
 * 
 * With background tracking ENABLED via Foreground Service:
 * - Going to background: logs info but does NOT stop tracking
 * - The Foreground Service keeps GPS alive in background
 * - Coming back to foreground: logs info
 * 
 * The onPause callback is only called if background tracking is NOT available
 * (e.g., FGS failed to start, permissions denied).
 */
export const useAppStateTracking = (
  isTracking: boolean,
  onPause: () => void,
  backgroundEnabled: boolean = true
) => {
  const isTrackingRef = useRef(isTracking);
  isTrackingRef.current = isTracking;

  const backgroundEnabledRef = useRef(backgroundEnabled);
  backgroundEnabledRef.current = backgroundEnabled;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listener: any;

    const setup = async () => {
      listener = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive && isTrackingRef.current) {
          if (backgroundEnabledRef.current) {
            // Background tracking enabled via FGS — keep tracking alive
            console.log('[AppState] App foi para background — rastreio continua via Foreground Service');
          } else {
            // No FGS — must pause
            console.log('[AppState] App foi para background — pausando rastreamento (sem FGS)');
            onPause();
          }
        }
        if (isActive && isTrackingRef.current) {
          console.log('[AppState] App voltou ao foreground — rastreio ativo');
        }
      });
    };

    setup();

    return () => {
      listener?.remove?.();
    };
  }, [onPause]);
};
