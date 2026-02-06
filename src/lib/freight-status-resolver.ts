/**
 * src/lib/freight-status-resolver.ts
 *
 * Fonte única de verdade para o status EXIBIDO na UI.
 *
 * Problema resolvido:
 * - freights.status = status GLOBAL do frete
 * - freight_assignments.status = status do assignment individual
 * - driver_trip_progress.current_status = progresso do motorista
 * Estes 3 campos podem divergir temporariamente. A UI precisa de UMA resposta.
 *
 * Regras:
 * - Motorista em multi-carreta: status vem do progress/assignment (NÃO do frete pai)
 * - Produtor: status global + indicadores individuais
 * - Inconsistência detectada → modo seguro com banner PT-BR
 */

import { getStatusLabelPtBR } from '@/security/i18nGuard';

// =============================================================================
// TIPOS
// =============================================================================

export type ViewerContext = 'DRIVER' | 'PRODUCER' | 'COMPANY' | 'ADMIN';

export interface StatusResolverInput {
  /** Status global do frete (freights.status) */
  freightStatus: string;
  /** Status do assignment individual (freight_assignments.status) */
  assignmentStatus?: string | null;
  /** Status do progresso do motorista (driver_trip_progress.current_status) */
  progressStatus?: string | null;
  /** Quem está visualizando */
  viewerContext: ViewerContext;
  /** Se é multi-carreta */
  isMultiTruck?: boolean;
  /** Número de carretas aceitas */
  acceptedTrucks?: number;
  /** Número de carretas requeridas */
  requiredTrucks?: number;
}

export interface ResolvedStatus {
  /** Status a ser EXIBIDO na UI */
  displayStatus: string;
  /** Label PT-BR do status */
  displayLabel: string;
  /** Se há inconsistência detectada */
  hasInconsistency: boolean;
  /** Mensagem de inconsistência (PT-BR) para banner */
  inconsistencyMessage?: string;
  /** Se a UI deve entrar em modo seguro (somente leitura) */
  safeMode: boolean;
  /** Status raw usado (para lógica interna) */
  rawStatus: string;
  /** Detalhes para debug/log */
  debugInfo?: string;
}

// =============================================================================
// RESOLVER PRINCIPAL
// =============================================================================

/**
 * Resolve qual status deve ser exibido na UI, baseado no contexto do visualizador.
 *
 * Prioridade para MOTORISTA (single ou multi-truck):
 *   1. driver_trip_progress.current_status (mais preciso)
 *   2. freight_assignments.status (fallback)
 *   3. freights.status (último recurso)
 *
 * Prioridade para PRODUTOR/COMPANY/ADMIN:
 *   1. freights.status (visão global)
 *   2. Com indicadores por carreta quando multi-truck
 */
export function resolveDisplayStatus(input: StatusResolverInput): ResolvedStatus {
  const {
    freightStatus,
    assignmentStatus,
    progressStatus,
    viewerContext,
    isMultiTruck = false,
    acceptedTrucks = 0,
    requiredTrucks = 1,
  } = input;

  const fNorm = normalize(freightStatus);
  const aNorm = normalize(assignmentStatus);
  const pNorm = normalize(progressStatus);

  // --------------------------------------------------------------------------
  // MOTORISTA: prioriza progresso individual
  // --------------------------------------------------------------------------
  if (viewerContext === 'DRIVER') {
    // Prioridade 1: progress
    if (pNorm) {
      const inconsistency = checkDriverInconsistency(pNorm, aNorm, fNorm, isMultiTruck);
      return {
        displayStatus: pNorm,
        displayLabel: getStatusLabelPtBR(pNorm),
        hasInconsistency: inconsistency.hasIssue,
        inconsistencyMessage: inconsistency.message,
        safeMode: inconsistency.safeMode,
        rawStatus: pNorm,
        debugInfo: inconsistency.debug,
      };
    }

    // Prioridade 2: assignment
    if (aNorm) {
      return {
        displayStatus: aNorm,
        displayLabel: getStatusLabelPtBR(aNorm),
        hasInconsistency: false,
        safeMode: false,
        rawStatus: aNorm,
      };
    }

    // Prioridade 3: freight global
    return {
      displayStatus: fNorm,
      displayLabel: getStatusLabelPtBR(fNorm),
      hasInconsistency: false,
      safeMode: false,
      rawStatus: fNorm,
    };
  }

  // --------------------------------------------------------------------------
  // PRODUTOR / COMPANY / ADMIN: status global
  // --------------------------------------------------------------------------

  // Verificar inconsistência de trucks
  if (isMultiTruck && acceptedTrucks > requiredTrucks) {
    return {
      displayStatus: fNorm,
      displayLabel: getStatusLabelPtBR(fNorm),
      hasInconsistency: true,
      inconsistencyMessage: '⚠️ Dados inconsistentes: mais carretas aceitas do que solicitadas. Recarregue a página.',
      safeMode: true,
      rawStatus: fNorm,
      debugInfo: `[SECURITY_FLOW_MISMATCH] accepted(${acceptedTrucks}) > required(${requiredTrucks})`,
    };
  }

  return {
    displayStatus: fNorm,
    displayLabel: getStatusLabelPtBR(fNorm),
    hasInconsistency: false,
    safeMode: false,
    rawStatus: fNorm,
  };
}

// =============================================================================
// HELPERS
// =============================================================================

function normalize(status: string | null | undefined): string {
  if (!status) return '';
  return status.toUpperCase().trim();
}

const STATUS_INDEX: Record<string, number> = {
  NEW: 0, APPROVED: 1, OPEN: 2, ACCEPTED: 3,
  LOADING: 4, LOADED: 5, IN_TRANSIT: 6,
  DELIVERED_PENDING_CONFIRMATION: 7, DELIVERED: 8, COMPLETED: 9,
  CANCELLED: -1,
};

function checkDriverInconsistency(
  progress: string,
  assignment: string,
  freight: string,
  isMultiTruck: boolean
): { hasIssue: boolean; message?: string; safeMode: boolean; debug?: string } {
  if (!assignment) return { hasIssue: false, safeMode: false };

  const pIdx = STATUS_INDEX[progress] ?? -2;
  const aIdx = STATUS_INDEX[assignment] ?? -2;

  // Divergência significativa (mais de 1 passo)
  if (pIdx >= 0 && aIdx >= 0 && Math.abs(pIdx - aIdx) > 1) {
    return {
      hasIssue: true,
      message: '⚠️ Sincronização em andamento. Recarregue a página.',
      safeMode: true,
      debug: `[SECURITY_FLOW_MISMATCH] progress=${progress} assignment=${assignment} freight=${freight} multiTruck=${isMultiTruck}`,
    };
  }

  return { hasIssue: false, safeMode: false };
}

/**
 * Obtém o status efetivo para um motorista, priorizando progress > assignment > freight.
 * Shortcut para uso direto em componentes simples.
 */
export function getDriverEffectiveStatus(input: {
  freightStatus: string;
  assignmentStatus?: string | null;
  progressStatus?: string | null;
}): string {
  const p = normalize(input.progressStatus);
  if (p) return p;
  const a = normalize(input.assignmentStatus);
  if (a) return a;
  return normalize(input.freightStatus);
}
