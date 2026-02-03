import { useCallback, useMemo } from 'react';
import { useTripProgress } from '@/hooks/useTripProgress';
import { useIdempotentAction, useSingleFlight } from '@/hooks/utils';

type UpdateFreightStatusInput = {
  freightId: string;
  newStatus: string;
  lat?: number;
  lng?: number;
  notes?: string;
  /** Por padrão o hook mostra toast; set false quando a UI já controla feedback */
  showToast?: boolean;
};

/**
 * Hook unificado para atualizar status/progresso do frete pelo motorista.
 *
 * Objetivo imediato: parar 403/timeout em flows legados e reduzir latência,
 * usando a RPC idempotente `update_trip_progress`.
 */
export function useFreightStatus() {
  const trip = useTripProgress();

  const updateImpl = useCallback(async (input: UpdateFreightStatusInput) => {
    return trip.updateProgress(input.freightId, input.newStatus, {
      lat: input.lat,
      lng: input.lng,
      notes: input.notes,
      showToast: input.showToast,
    });
  }, [trip]);

  // Evita múltiplos cliques simultâneos
  const updateSingleFlight = useSingleFlight(updateImpl);

  // Idempotência + cooldown curto para evitar duplo envio
  const actionId = useMemo(() => 'freight-status:update', []);
  const idempotent = useIdempotentAction(updateSingleFlight, {
    actionId,
    cooldownMs: 800,
  });

  const updateStatus = useCallback(async (input: UpdateFreightStatusInput) => {
    return idempotent.execute(input);
  }, [idempotent]);

  return {
    // estado
    isUpdating: trip.isUpdating || idempotent.isExecuting,
    lastError: trip.lastError,

    // ações
    updateStatus,

    // utilitários
    getNextStatus: trip.getNextStatus,
    getStatusLabel: trip.getStatusLabel,
    canAdvance: trip.canAdvance,
    advanceToNextStatus: trip.advanceToNextStatus,

    // constantes
    STATUS_ORDER: trip.STATUS_ORDER,
    STATUS_LABELS: trip.STATUS_LABELS,
  };
}
