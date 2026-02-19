/**
 * useFreightGPSMonitoring — v4
 *
 * Orquestrador de rastreamento para frete ativo.
 * Combina useLocationSecurityMonitor + useLocationPersistence + useLocationFraudSignals.
 *
 * REGRAS:
 *   - Só rastreia em status LOADING/LOADED/IN_TRANSIT/DELIVERED_PENDING_CONFIRMATION
 *   - Para tracking ao finalizar/cancelar
 *   - Salva no banco 1x/min com debounce por distância
 *   - Antifraude analisa cada posição
 */

import { useEffect, useRef } from 'react';
import { isNative } from '@/utils/location';
import { useLocationSecurityMonitor } from './location/useLocationSecurityMonitor';
import { useLocationPersistence } from './location/useLocationPersistence';
import { useLocationFraudSignals } from './location/useLocationFraudSignals';

export const useFreightGPSMonitoring = (
  freightId: string | null,
  driverProfileId: string | null,
  isFreightActive: boolean,
) => {
  const { start, stop, coords, status, debug } = useLocationSecurityMonitor();
  const { persist } = useLocationPersistence({ driverProfileId, freightId });
  const { analyze, reset: resetFraud } = useLocationFraudSignals({ freightId, driverProfileId });

  const activeRef = useRef(false);
  const lastPersistRef = useRef(0);

  // Iniciar/parar tracking
  useEffect(() => {
    if (!isFreightActive || !freightId || !driverProfileId) {
      if (activeRef.current) {
        activeRef.current = false;
        stop();
        resetFraud();
      }
      return;
    }

    if (!activeRef.current) {
      activeRef.current = true;
      start();
    }

    return () => {
      activeRef.current = false;
      stop();
      resetFraud();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFreightActive, freightId, driverProfileId]);

  // Persistir e analisar fraude quando coords chegam
  useEffect(() => {
    if (!coords || !isFreightActive || !driverProfileId) return;

    const now = Date.now();
    if (now - lastPersistRef.current < 60_000) return;
    lastPersistRef.current = now;

    persist(coords);
    analyze(coords);
  }, [coords, isFreightActive, driverProfileId, persist, analyze]);

  return { status, coords, debug };
};
