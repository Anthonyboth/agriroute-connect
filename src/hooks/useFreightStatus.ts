/**
 * useFreightStatus.ts
 * 
 * Hook SIMPLIFICADO para atualização de status do frete.
 * Para gestão COMPLETA (risco, SLA, offline, etc.), use useFreightLifecycle.
 * 
 * Este hook é um wrapper fino sobre useFreightLifecycle para compatibilidade
 * com componentes existentes que só precisam de atualização de status.
 */

import { useCallback } from 'react';
import { useFreightLifecycle, FreightStatus } from '@/hooks/useFreightLifecycle';

type UpdateFreightStatusInput = {
  freightId: string;
  newStatus: string;
  lat?: number;
  lng?: number;
  notes?: string;
  showToast?: boolean;
};

/**
 * Hook para atualizar status/progresso do frete pelo motorista.
 * 
 * Para gestão completa do ciclo de vida (risco, SLA, offline), use useFreightLifecycle diretamente.
 */
export function useFreightStatus(freightId?: string) {
  const lifecycle = useFreightLifecycle({ freightId });

  const updateStatus = useCallback(async (input: UpdateFreightStatusInput) => {
    return lifecycle.updateStatus(input.newStatus as FreightStatus, {
      lat: input.lat,
      lng: input.lng,
      notes: input.notes,
      showToast: input.showToast,
    });
  }, [lifecycle]);

  return {
    // estado
    isUpdating: lifecycle.isUpdating,
    lastError: lifecycle.lastError,
    isOnline: lifecycle.isOnline,
    pendingOperations: lifecycle.pendingOperations,

    // ações
    updateStatus,
    advanceToNextStatus: lifecycle.advanceToNextStatus,

    // utilitários
    getNextStatus: lifecycle.getNextStatus,
    getStatusLabel: lifecycle.getStatusLabel,
    canAdvance: lifecycle.canAdvance,
    syncPendingOperations: lifecycle.syncPendingOperations,

    // constantes
    STATUS_ORDER: lifecycle.STATUS_ORDER,
    STATUS_LABELS: lifecycle.STATUS_LABELS,
  };
}

