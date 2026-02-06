/**
 * src/security/freightWorkflowGuard.ts
 *
 * Módulo de segurança de workflow do frete rural.
 * Garante que NENHUMA transição de status inválida seja possível.
 *
 * Regras:
 * - Workflow linear obrigatório (sem pular, sem regredir)
 * - Validação por papel (MOTORISTA, TRANSPORTADORA, PRODUTOR)
 * - Erros bloqueantes em tentativas inválidas
 * - Todas as mensagens em PT-BR
 */

// =============================================================================
// TIPOS
// =============================================================================

export type FreightWorkflowStatus =
  | 'NEW'
  | 'APPROVED'
  | 'OPEN'
  | 'ACCEPTED'
  | 'LOADING'
  | 'LOADED'
  | 'IN_TRANSIT'
  | 'DELIVERED_PENDING_CONFIRMATION'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export type UserRole =
  | 'PRODUTOR'
  | 'MOTORISTA'
  | 'MOTORISTA_AFILIADO'
  | 'TRANSPORTADORA'
  | 'ADMIN';

export interface TransitionValidation {
  valid: boolean;
  /** Mensagem de erro em PT-BR (null se válido) */
  error: string | null;
  /** Status esperado como próximo (null se terminal) */
  expectedNext: FreightWorkflowStatus | null;
}

export class FreightWorkflowError extends Error {
  public readonly code: string;
  public readonly currentStatus: string;
  public readonly attemptedStatus: string;

  constructor(message: string, code: string, current: string, attempted: string) {
    super(message);
    this.name = 'FreightWorkflowError';
    this.code = code;
    this.currentStatus = current;
    this.attemptedStatus = attempted;
  }
}

// =============================================================================
// CONSTANTES
// =============================================================================

/**
 * Ordem oficial do workflow do frete rural.
 * Qualquer transição fora desta sequência é BLOQUEADA.
 */
export const WORKFLOW_ORDER: readonly FreightWorkflowStatus[] = [
  'NEW',
  'APPROVED',
  'OPEN',
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'COMPLETED',
] as const;

/**
 * Status terminais (não podem avançar)
 */
export const TERMINAL_STATUSES: readonly FreightWorkflowStatus[] = [
  'COMPLETED',
  'CANCELLED',
] as const;

/**
 * Labels em PT-BR para cada status
 */
export const STATUS_LABELS_PTBR: Record<FreightWorkflowStatus, string> = {
  NEW: 'Novo',
  APPROVED: 'Aprovado',
  OPEN: 'Aberto',
  ACCEPTED: 'Aceito',
  LOADING: 'A Caminho da Coleta',
  LOADED: 'Carregado',
  IN_TRANSIT: 'Em Trânsito',
  DELIVERED_PENDING_CONFIRMATION: 'Entrega Reportada',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

/**
 * Ações permitidas por papel e status atual.
 * Se um papel não está listado para um status, ele NÃO pode avançar nesse ponto.
 */
const ROLE_ALLOWED_TRANSITIONS: Record<string, FreightWorkflowStatus[]> = {
  // Produtor controla fase inicial e confirmação
  PRODUTOR: ['APPROVED', 'OPEN', 'DELIVERED', 'COMPLETED'],
  // Motoristas controlam a fase operacional
  MOTORISTA: ['LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'],
  MOTORISTA_AFILIADO: ['LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'],
  // Transportadora pode atualizar em nome dos seus motoristas
  TRANSPORTADORA: ['LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'],
  // Admin pode fazer tudo
  ADMIN: [...WORKFLOW_ORDER],
};

// =============================================================================
// FUNÇÕES DE VALIDAÇÃO
// =============================================================================

/**
 * Verifica se uma transição de status é válida.
 * NÃO lança erro — retorna um objeto de validação.
 */
export function canTransition(
  currentStatus: string,
  nextStatus: string
): TransitionValidation {
  const current = currentStatus.toUpperCase().trim() as FreightWorkflowStatus;
  const next = nextStatus.toUpperCase().trim() as FreightWorkflowStatus;

  // Status terminal — não pode avançar
  if (TERMINAL_STATUSES.includes(current)) {
    return {
      valid: false,
      error: `O frete está "${STATUS_LABELS_PTBR[current] || current}" e não pode mais ser alterado.`,
      expectedNext: null,
    };
  }

  const currentIdx = WORKFLOW_ORDER.indexOf(current);
  const nextIdx = WORKFLOW_ORDER.indexOf(next);

  // Status desconhecido
  if (currentIdx === -1) {
    return {
      valid: false,
      error: `Status atual "${current}" não é reconhecido pelo sistema.`,
      expectedNext: null,
    };
  }
  if (nextIdx === -1 && next !== 'CANCELLED') {
    return {
      valid: false,
      error: `Status "${next}" não é reconhecido pelo sistema.`,
      expectedNext: null,
    };
  }

  // Cancelamento é permitido em qualquer ponto (exceto COMPLETED)
  if (next === 'CANCELLED') {
    return { valid: true, error: null, expectedNext: null };
  }

  // Regressão bloqueada
  if (nextIdx < currentIdx) {
    return {
      valid: false,
      error: `Não é permitido voltar de "${STATUS_LABELS_PTBR[current]}" para "${STATUS_LABELS_PTBR[next]}". O status só pode avançar.`,
      expectedNext: currentIdx < WORKFLOW_ORDER.length - 1 ? WORKFLOW_ORDER[currentIdx + 1] : null,
    };
  }

  // Mesmo status (idempotente — aceito)
  if (nextIdx === currentIdx) {
    return { valid: true, error: null, expectedNext: null };
  }

  // Salto de etapas bloqueado (mais de 1 passo)
  if (nextIdx > currentIdx + 1) {
    const expected = WORKFLOW_ORDER[currentIdx + 1];
    return {
      valid: false,
      error: `Não é permitido pular etapas. De "${STATUS_LABELS_PTBR[current]}" você deve ir para "${STATUS_LABELS_PTBR[expected]}".`,
      expectedNext: expected,
    };
  }

  // Transição válida (exatamente +1)
  return { valid: true, error: null, expectedNext: null };
}

/**
 * Retorna o próximo status permitido a partir do atual.
 * Retorna null se o status for terminal.
 */
export function getNextAllowedStatus(
  currentStatus: string
): FreightWorkflowStatus | null {
  const current = currentStatus.toUpperCase().trim() as FreightWorkflowStatus;

  if (TERMINAL_STATUSES.includes(current)) return null;

  const idx = WORKFLOW_ORDER.indexOf(current);
  if (idx === -1 || idx >= WORKFLOW_ORDER.length - 1) return null;

  return WORKFLOW_ORDER[idx + 1];
}

/**
 * Valida a transição e LANÇA ERRO se inválida.
 * Use em pontos de execução onde falha deve ser bloqueante.
 */
export function assertValidTransition(
  currentStatus: string,
  nextStatus: string
): void {
  const result = canTransition(currentStatus, nextStatus);

  if (!result.valid) {
    throw new FreightWorkflowError(
      result.error!,
      'INVALID_TRANSITION',
      currentStatus,
      nextStatus
    );
  }
}

/**
 * Retorna as ações que um papel pode executar no status atual.
 */
export function getUserAllowedActions(
  role: string,
  currentStatus: string
): {
  canAdvance: boolean;
  canCancel: boolean;
  nextStatus: FreightWorkflowStatus | null;
  nextStatusLabel: string | null;
  allowedActions: string[];
} {
  const normalizedRole = role.toUpperCase().trim();
  const current = currentStatus.toUpperCase().trim() as FreightWorkflowStatus;

  const nextStatus = getNextAllowedStatus(current);
  const allowedTargets = ROLE_ALLOWED_TRANSITIONS[normalizedRole] || [];

  const canAdvance = nextStatus !== null && allowedTargets.includes(nextStatus);
  const canCancel = current !== 'COMPLETED' && current !== 'CANCELLED' &&
    (normalizedRole === 'ADMIN' || normalizedRole === 'PRODUTOR');

  const actions: string[] = [];
  if (canAdvance && nextStatus) {
    actions.push(`Avançar para "${STATUS_LABELS_PTBR[nextStatus]}"`);
  }
  if (canCancel) {
    actions.push('Cancelar frete');
  }

  return {
    canAdvance,
    canCancel,
    nextStatus: canAdvance ? nextStatus : null,
    nextStatusLabel: canAdvance && nextStatus ? STATUS_LABELS_PTBR[nextStatus] : null,
    allowedActions: actions,
  };
}

/**
 * Valida se o motorista pode reportar entrega.
 * Regra: só pode se estiver IN_TRANSIT.
 */
export function canReportDelivery(currentStatus: string): TransitionValidation {
  return canTransition(currentStatus, 'DELIVERED_PENDING_CONFIRMATION');
}

/**
 * Valida se o produtor pode confirmar entrega.
 * Regra: só pode se o status for DELIVERED_PENDING_CONFIRMATION.
 */
export function canConfirmDelivery(currentStatus: string): TransitionValidation {
  const current = currentStatus.toUpperCase().trim();
  if (current !== 'DELIVERED_PENDING_CONFIRMATION') {
    return {
      valid: false,
      error: `Para confirmar a entrega, o motorista precisa primeiro reportar a entrega. Status atual: "${STATUS_LABELS_PTBR[current as FreightWorkflowStatus] || current}".`,
      expectedNext: null,
    };
  }
  return { valid: true, error: null, expectedNext: 'DELIVERED' as FreightWorkflowStatus };
}

/**
 * Valida se o pagamento pode ser confirmado pelo motorista.
 * Regra: só após o produtor marcar como pago (status paid_by_producer).
 */
export function canConfirmPayment(
  paymentStatus: string | null | undefined
): { valid: boolean; error: string | null } {
  if (!paymentStatus || paymentStatus !== 'paid_by_producer') {
    return {
      valid: false,
      error: 'O pagamento só pode ser confirmado após o produtor marcar como pago.',
    };
  }
  return { valid: true, error: null };
}

/**
 * Retorna o label em PT-BR para um status.
 * NUNCA retorna o código em inglês ao usuário.
 */
export function getStatusLabelPtBR(status: string): string {
  const normalized = status.toUpperCase().trim() as FreightWorkflowStatus;
  return STATUS_LABELS_PTBR[normalized] || 'Desconhecido';
}
