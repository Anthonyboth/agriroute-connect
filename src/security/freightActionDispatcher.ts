/**
 * src/security/freightActionDispatcher.ts
 *
 * Dispatcher centralizado para TODAS as ações do workflow de frete rural.
 *
 * Responsabilidades:
 * 1. Consultar guards ANTES de executar qualquer ação
 * 2. Bloquear ações inválidas com erro PT-BR
 * 3. Executar a chamada correta (RPC/Edge)
 * 4. Retornar payload padronizado para UI atualizar cache
 * 5. Nunca duplicar regras já server-side — apenas impedir chamadas fora de hora
 *
 * PROIBIDO chamar RPCs de workflow diretamente nos componentes.
 * Use este dispatcher via useFreightActionDispatcher hook.
 */

import {
  getUserAllowedActions,
  assertValidTransition,
  canTransition,
  getNextAllowedStatus,
  FreightWorkflowError,
  type FreightWorkflowStatus,
  type UserRole,
} from './freightWorkflowGuard';

import {
  getStatusLabelPtBR,
  getActionLabelPtBR,
} from './i18nGuard';

import {
  assertPriceIsPerTruck,
} from './multiTruckPriceGuard';

// =============================================================================
// TIPOS
// =============================================================================

export type FreightAction =
  | 'ADVANCE'
  | 'CANCEL'
  | 'ACCEPT'
  | 'REJECT'
  | 'REPORT_DELIVERY'
  | 'CONFIRM_DELIVERY'
  | 'CONFIRM_PAYMENT'
  | 'MARK_PAID'
  | 'RATE';

export interface DispatchInput {
  /** Ação a executar */
  action: FreightAction;
  /** ID do frete */
  freightId: string;
  /** Status atual do frete (global) */
  freightStatus: string;
  /** Papel do ator */
  actorRole: string;
  /** ID do assignment (multi-carreta) */
  assignmentId?: string;
  /** ID do motorista */
  driverId?: string;
  /** Status do assignment (para consistência) */
  assignmentStatus?: string;
  /** Status do driver_trip_progress (para consistência) */
  progressStatus?: string;
  /** Metadados extras (ex: payload de proposta) */
  metadata?: Record<string, unknown>;
}

export interface DispatchResult {
  success: boolean;
  /** Novo status após a ação (para atualização otimista) */
  newStatus?: FreightWorkflowStatus;
  /** Label PT-BR do novo status */
  newStatusLabel?: string;
  /** Mensagem de sucesso PT-BR */
  successMessage?: string;
  /** Mensagem de erro PT-BR (se falhou) */
  errorMessage?: string;
  /** Código de erro para debug */
  errorCode?: string;
}

export interface ConsistencyCheck {
  isConsistent: boolean;
  /** Mensagem de inconsistência PT-BR */
  warningMessage?: string;
  /** Detalhes para console.warn */
  debugDetails?: string;
}

// =============================================================================
// CONSTANTES
// =============================================================================

/** Mapa de ações para o próximo status esperado */
const ACTION_TARGET_STATUS: Partial<Record<FreightAction, FreightWorkflowStatus>> = {
  REPORT_DELIVERY: 'DELIVERED_PENDING_CONFIRMATION',
  CONFIRM_DELIVERY: 'DELIVERED',
};

/** Mensagens de sucesso por ação */
const SUCCESS_MESSAGES: Record<FreightAction, string> = {
  ADVANCE: 'Status atualizado com sucesso.',
  CANCEL: 'Frete cancelado.',
  ACCEPT: 'Proposta aceita com sucesso.',
  REJECT: 'Proposta rejeitada.',
  REPORT_DELIVERY: 'Entrega reportada. Aguardando confirmação do produtor.',
  CONFIRM_DELIVERY: 'Entrega confirmada com sucesso.',
  CONFIRM_PAYMENT: 'Pagamento confirmado.',
  MARK_PAID: 'Pagamento registrado.',
  RATE: 'Avaliação enviada com sucesso.',
};

// =============================================================================
// VALIDAÇÃO DE CONSISTÊNCIA
// =============================================================================

/**
 * Verifica se os estados (frete global, assignment, progress) estão consistentes.
 * Se não estiverem, a UI deve entrar em "modo seguro" (somente leitura).
 */
export function checkStateConsistency(input: {
  freightStatus: string;
  assignmentStatus?: string;
  progressStatus?: string;
  requiredTrucks?: number;
  acceptedTrucks?: number;
  driverId?: string;
}): ConsistencyCheck {
  const {
    freightStatus,
    assignmentStatus,
    progressStatus,
    requiredTrucks = 1,
    acceptedTrucks = 0,
  } = input;

  const fNorm = freightStatus?.toUpperCase().trim() || '';
  const aNorm = assignmentStatus?.toUpperCase().trim() || '';
  const pNorm = progressStatus?.toUpperCase().trim() || '';

  // Regra 1: accepted_trucks nunca pode exceder required_trucks
  if (acceptedTrucks > requiredTrucks) {
    return {
      isConsistent: false,
      warningMessage: '⚠️ Dados inconsistentes: mais carretas aceitas do que solicitadas. Recarregue a página.',
      debugDetails: `[SECURITY_FLOW_MISMATCH] accepted_trucks(${acceptedTrucks}) > required_trucks(${requiredTrucks})`,
    };
  }

  // Regra 2: Se progress diz IN_TRANSIT mas assignment diz ACCEPTED → inconsistente
  if (pNorm && aNorm && pNorm !== aNorm) {
    const progressOrder = getStatusIndex(pNorm);
    const assignmentOrder = getStatusIndex(aNorm);

    // Divergência significativa (mais de 1 passo de diferença)
    if (Math.abs(progressOrder - assignmentOrder) > 1 && progressOrder !== -1 && assignmentOrder !== -1) {
      return {
        isConsistent: false,
        warningMessage: '⚠️ Sincronização em andamento. Recarregue a página.',
        debugDetails: `[SECURITY_FLOW_MISMATCH] progress=${pNorm} vs assignment=${aNorm}`,
      };
    }
  }

  // Regra 3: Se frete global diz COMPLETED mas assignment/progress não
  if (fNorm === 'COMPLETED' && aNorm && aNorm !== 'COMPLETED' && aNorm !== 'DELIVERED') {
    return {
      isConsistent: false,
      warningMessage: '⚠️ Dados em sincronização. Recarregue a página.',
      debugDetails: `[SECURITY_FLOW_MISMATCH] freight=COMPLETED but assignment=${aNorm}`,
    };
  }

  return { isConsistent: true };
}

// =============================================================================
// DISPATCHER PRINCIPAL
// =============================================================================

/**
 * Valida se uma ação pode ser executada ANTES de chamar o backend.
 * NÃO executa a ação — apenas retorna se é permitida.
 *
 * Use para habilitar/desabilitar botões e validar pré-condições.
 */
export function canDispatch(input: DispatchInput): DispatchResult {
  const { action, freightStatus, actorRole } = input;

  // 1. Verificar consistência de estado
  const consistency = checkStateConsistency({
    freightStatus,
    assignmentStatus: input.assignmentStatus,
    progressStatus: input.progressStatus,
  });

  if (!consistency.isConsistent) {
    if (import.meta.env.DEV) {
      console.warn(consistency.debugDetails);
    }
    return {
      success: false,
      errorMessage: consistency.warningMessage || '⚠️ Dados inconsistentes. Recarregue.',
      errorCode: 'STATE_INCONSISTENT',
    };
  }

  // 2. Verificar permissões do papel
  const allowed = getUserAllowedActions(actorRole, freightStatus);

  switch (action) {
    case 'ADVANCE': {
      if (!allowed.canAdvance) {
        return {
          success: false,
          errorMessage: `Você (${actorRole}) não tem permissão para avançar o frete neste status (${getStatusLabelPtBR(freightStatus)}).`,
          errorCode: 'ROLE_NOT_ALLOWED',
        };
      }
      break;
    }
    case 'CANCEL': {
      if (!allowed.canCancel) {
        return {
          success: false,
          errorMessage: 'Cancelamento não permitido neste status ou para seu papel.',
          errorCode: 'CANCEL_NOT_ALLOWED',
        };
      }
      break;
    }
    case 'REPORT_DELIVERY': {
      const check = canTransition(freightStatus, 'DELIVERED_PENDING_CONFIRMATION');
      if (!check.valid) {
        return {
          success: false,
          errorMessage: check.error || 'Não é possível reportar entrega neste status.',
          errorCode: 'TRANSITION_INVALID',
        };
      }
      break;
    }
    case 'CONFIRM_DELIVERY': {
      const check = canTransition(freightStatus, 'DELIVERED');
      if (!check.valid) {
        return {
          success: false,
          errorMessage: check.error || 'Não é possível confirmar entrega neste status.',
          errorCode: 'TRANSITION_INVALID',
        };
      }
      break;
    }
    // Ações de proposta/pagamento/avaliação não dependem do workflow guard
    case 'ACCEPT':
    case 'REJECT':
    case 'CONFIRM_PAYMENT':
    case 'MARK_PAID':
    case 'RATE':
      break;
  }

  // 3. Validar transição se é uma ação de workflow
  const targetStatus = ACTION_TARGET_STATUS[action] || (action === 'ADVANCE' ? allowed.nextStatus : null);
  if (targetStatus) {
    const transCheck = canTransition(freightStatus, targetStatus);
    if (!transCheck.valid) {
      return {
        success: false,
        errorMessage: transCheck.error || 'Transição de status não permitida.',
        errorCode: 'TRANSITION_INVALID',
      };
    }
  }

  // Tudo OK
  return {
    success: true,
    newStatus: (targetStatus || (action === 'CANCEL' ? 'CANCELLED' : undefined)) as FreightWorkflowStatus | undefined,
    newStatusLabel: targetStatus ? getStatusLabelPtBR(targetStatus) : action === 'CANCEL' ? 'Cancelado' : undefined,
    successMessage: SUCCESS_MESSAGES[action],
  };
}

/**
 * Retorna a lista de ações disponíveis para um ator em um dado estado.
 * Usa guards internamente. Resultado usado para renderizar botões na UI.
 */
export function getAvailableActions(input: {
  freightStatus: string;
  actorRole: string;
  assignmentStatus?: string;
  progressStatus?: string;
  paymentStatus?: string;
  isMultiTruck?: boolean;
}): FreightAction[] {
  const { freightStatus, actorRole, paymentStatus } = input;
  const actions: FreightAction[] = [];

  const allowed = getUserAllowedActions(actorRole, freightStatus);
  const normalizedRole = actorRole.toUpperCase().trim();

  // Consistency check
  const consistency = checkStateConsistency({
    freightStatus,
    assignmentStatus: input.assignmentStatus,
    progressStatus: input.progressStatus,
  });

  // If state is inconsistent, return empty (safe mode)
  if (!consistency.isConsistent) {
    if (import.meta.env.DEV) {
      console.warn(consistency.debugDetails);
    }
    return [];
  }

  // Advance (role-based)
  if (allowed.canAdvance && allowed.nextStatus) {
    // Map to specific action names for clarity
    if (allowed.nextStatus === 'DELIVERED_PENDING_CONFIRMATION' &&
        (normalizedRole === 'MOTORISTA' || normalizedRole === 'MOTORISTA_AFILIADO' || normalizedRole === 'TRANSPORTADORA')) {
      actions.push('REPORT_DELIVERY');
    } else if (allowed.nextStatus === 'DELIVERED' && normalizedRole === 'PRODUTOR') {
      actions.push('CONFIRM_DELIVERY');
    } else {
      actions.push('ADVANCE');
    }
  }

  // Cancel
  if (allowed.canCancel) {
    actions.push('CANCEL');
  }

  return actions;
}

// =============================================================================
// HELPERS INTERNOS
// =============================================================================

const STATUS_ORDER_MAP: Record<string, number> = {
  NEW: 0, APPROVED: 1, OPEN: 2, ACCEPTED: 3,
  LOADING: 4, LOADED: 5, IN_TRANSIT: 6,
  DELIVERED_PENDING_CONFIRMATION: 7, DELIVERED: 8, COMPLETED: 9,
};

function getStatusIndex(status: string): number {
  return STATUS_ORDER_MAP[status.toUpperCase().trim()] ?? -1;
}
