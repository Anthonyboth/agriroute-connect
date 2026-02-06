/**
 * src/security/paymentClosureGuard.ts
 *
 * Módulo de segurança para pagamento, confirmação de entrega, avaliação e encerramento.
 * Garante que NENHUMA etapa do fluxo financeiro seja pulada, regredida ou executada
 * por papel sem permissão.
 *
 * Fluxo obrigatório (Rural):
 *   DELIVERED_PENDING_CONFIRMATION → DELIVERED → pagamento proposed → paid_by_producer → confirmed → COMPLETED → rating
 *
 * Fluxo obrigatório (Urbano):
 *   COMPLETED → (pagamento opcional) → rating
 *
 * Integra com:
 *   - freightWorkflowGuard.ts (transições de status)
 *   - multiTruckPriceGuard.ts (preço por carreta)
 *   - i18nGuard.ts (labels PT-BR)
 *   - freightActionMatrix.ts (ações na UI)
 */

// =============================================================================
// TIPOS
// =============================================================================

export type PaymentStatus =
  | 'proposed'
  | 'paid_by_producer'
  | 'confirmed'
  | 'disputed'
  | 'cancelled'
  | 'rejected';

export type PaymentActorRole =
  | 'PRODUTOR'
  | 'MOTORISTA'
  | 'MOTORISTA_AFILIADO'
  | 'TRANSPORTADORA'
  | 'ADMIN';

export type FreightClosureStatus =
  | 'DELIVERED_PENDING_CONFIRMATION'
  | 'DELIVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface PaymentTransitionValidation {
  valid: boolean;
  /** Mensagem de erro em PT-BR (null se válido) */
  error: string | null;
}

export interface ClosureValidation {
  valid: boolean;
  error: string | null;
  /** Razão específica do bloqueio */
  blockReason?: string;
}

export interface RatingValidation {
  canRate: boolean;
  /** Mensagem explicativa PT-BR */
  message: string;
  /** Se está aguardando alguma ação para desbloquear */
  waitingFor?: string;
}

export class PaymentClosureError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(message: string, code: string, context: Record<string, unknown> = {}) {
    super(message);
    this.name = 'PaymentClosureError';
    this.code = code;
    this.context = context;
  }
}

// =============================================================================
// CONSTANTES
// =============================================================================

/**
 * Ordem válida de transições de pagamento.
 * Qualquer transição fora desta sequência é BLOQUEADA.
 */
const PAYMENT_STATUS_ORDER: readonly PaymentStatus[] = [
  'proposed',
  'paid_by_producer',
  'confirmed',
] as const;

/**
 * Status terminais de pagamento (não podem mais transicionar normalmente)
 */
const PAYMENT_TERMINAL_STATUSES: readonly PaymentStatus[] = [
  'confirmed',
  'cancelled',
  'rejected',
] as const;

/**
 * Transições válidas de pagamento: [de] → [para[]]
 */
const VALID_PAYMENT_TRANSITIONS: Record<string, PaymentStatus[]> = {
  proposed: ['paid_by_producer', 'cancelled', 'rejected'],
  paid_by_producer: ['confirmed', 'disputed'],
  confirmed: [], // terminal
  disputed: ['paid_by_producer', 'cancelled'], // pode ser resolvido
  cancelled: [], // terminal
  rejected: [], // terminal
};

/**
 * Quem pode executar cada transição de pagamento
 */
const PAYMENT_TRANSITION_PERMISSIONS: Record<string, PaymentActorRole[]> = {
  'proposed→paid_by_producer': ['PRODUTOR', 'ADMIN'],
  'proposed→cancelled': ['PRODUTOR', 'ADMIN'],
  'proposed→rejected': ['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'ADMIN'],
  'paid_by_producer→confirmed': ['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'ADMIN'],
  'paid_by_producer→disputed': ['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'ADMIN'],
  'disputed→paid_by_producer': ['PRODUTOR', 'ADMIN'],
  'disputed→cancelled': ['ADMIN'],
};

/**
 * Labels PT-BR para status de pagamento
 */
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  proposed: 'Proposto',
  paid_by_producer: 'Pago pelo Produtor',
  confirmed: 'Confirmado',
  disputed: 'Em Disputa',
  cancelled: 'Cancelado',
  rejected: 'Rejeitado',
};

/**
 * Labels PT-BR para ações de pagamento
 */
const PAYMENT_ACTION_LABELS: Record<string, string> = {
  mark_paid: 'Marcar como Pago',
  confirm_receipt: 'Confirmar Recebimento',
  dispute: 'Contestar',
  cancel: 'Cancelar Pagamento',
  reject: 'Rejeitar Proposta',
  create_proposal: 'Criar Proposta de Pagamento',
};

/**
 * Status de frete que permitem criar pagamento externo
 */
const FREIGHT_STATUSES_FOR_PAYMENT: readonly string[] = [
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'COMPLETED',
] as const;

// =============================================================================
// FUNÇÕES DE VALIDAÇÃO - PAGAMENTO
// =============================================================================

/**
 * Verifica se um pagamento externo pode ser criado para o frete.
 */
export function canCreateExternalPayment(input: {
  freightStatus: string;
  assignmentStatus?: string;
  actorRole: string;
  existingPaymentStatus?: string | null;
}): PaymentTransitionValidation {
  const { freightStatus, actorRole, existingPaymentStatus } = input;
  const normalizedFreight = freightStatus.toUpperCase().trim();
  const normalizedRole = actorRole.toUpperCase().trim();

  // Apenas PRODUTOR ou ADMIN pode criar proposta de pagamento
  if (normalizedRole !== 'PRODUTOR' && normalizedRole !== 'ADMIN') {
    return {
      valid: false,
      error: 'Apenas o produtor pode criar propostas de pagamento.',
    };
  }

  // Frete precisa estar em status adequado
  if (!FREIGHT_STATUSES_FOR_PAYMENT.includes(normalizedFreight)) {
    return {
      valid: false,
      error: `O frete precisa estar com entrega reportada ou confirmada para criar pagamento. Status atual: ${getPaymentFreightStatusLabel(normalizedFreight)}.`,
    };
  }

  // Se já existe pagamento ativo, bloquear
  if (existingPaymentStatus) {
    const normalized = existingPaymentStatus.toLowerCase().trim();
    if (normalized === 'proposed' || normalized === 'paid_by_producer' || normalized === 'confirmed') {
      return {
        valid: false,
        error: `Já existe um pagamento ${PAYMENT_STATUS_LABELS[normalized] || normalized} para este frete.`,
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Verifica se o produtor pode marcar o pagamento como "pago".
 */
export function canMarkPaidByProducer(input: {
  paymentStatus: string;
  freightStatus: string;
  actorRole: string;
}): PaymentTransitionValidation {
  const { paymentStatus, freightStatus, actorRole } = input;
  const normalizedPayment = paymentStatus.toLowerCase().trim();
  const normalizedFreight = freightStatus.toUpperCase().trim();
  const normalizedRole = actorRole.toUpperCase().trim();

  // Verificar papel
  if (normalizedRole !== 'PRODUTOR' && normalizedRole !== 'ADMIN') {
    return {
      valid: false,
      error: 'Apenas o produtor pode marcar o pagamento como efetuado.',
    };
  }

  // Status do pagamento precisa ser "proposed"
  if (normalizedPayment !== 'proposed') {
    if (normalizedPayment === 'paid_by_producer') {
      return {
        valid: false,
        error: 'Este pagamento já foi marcado como pago. Aguardando confirmação do motorista.',
      };
    }
    if (normalizedPayment === 'confirmed') {
      return {
        valid: false,
        error: 'Este pagamento já foi confirmado pelo motorista.',
      };
    }
    return {
      valid: false,
      error: `Pagamento no status "${PAYMENT_STATUS_LABELS[normalizedPayment] || normalizedPayment}" não pode ser marcado como pago.`,
    };
  }

  // Frete precisa estar em status adequado (ao menos entrega reportada)
  if (!FREIGHT_STATUSES_FOR_PAYMENT.includes(normalizedFreight)) {
    return {
      valid: false,
      error: 'O pagamento só pode ser marcado como pago após a entrega ser reportada.',
    };
  }

  return { valid: true, error: null };
}

/**
 * Verifica se o motorista/transportadora pode confirmar o recebimento do pagamento.
 */
export function canConfirmReceivedByDriver(input: {
  paymentStatus: string;
  actorRole: string;
}): PaymentTransitionValidation {
  const { paymentStatus, actorRole } = input;
  const normalizedPayment = paymentStatus.toLowerCase().trim();
  const normalizedRole = actorRole.toUpperCase().trim();

  // Verificar papel
  const allowedRoles: string[] = ['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'ADMIN'];
  if (!allowedRoles.includes(normalizedRole)) {
    return {
      valid: false,
      error: 'Apenas o motorista ou transportadora pode confirmar o recebimento.',
    };
  }

  // Status do pagamento precisa ser "paid_by_producer"
  if (normalizedPayment !== 'paid_by_producer') {
    if (normalizedPayment === 'proposed') {
      return {
        valid: false,
        error: 'O pagamento só pode ser confirmado após o produtor marcar como pago.',
      };
    }
    if (normalizedPayment === 'confirmed') {
      return {
        valid: false,
        error: 'Este pagamento já foi confirmado.',
      };
    }
    return {
      valid: false,
      error: `Pagamento no status "${PAYMENT_STATUS_LABELS[normalizedPayment] || normalizedPayment}" não pode ser confirmado.`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Valida se uma transição de pagamento é válida e permitida para o papel.
 * Função genérica para qualquer transição.
 */
export function assertValidPaymentTransition(
  currentStatus: string,
  nextStatus: string,
  actorRole?: string
): PaymentTransitionValidation {
  const current = currentStatus.toLowerCase().trim();
  const next = nextStatus.toLowerCase().trim();

  // Verificar se o status atual existe
  if (!VALID_PAYMENT_TRANSITIONS[current]) {
    return {
      valid: false,
      error: `Status de pagamento "${PAYMENT_STATUS_LABELS[current] || current}" não é reconhecido.`,
    };
  }

  // Verificar se a transição é válida
  const allowedNext = VALID_PAYMENT_TRANSITIONS[current];
  if (!allowedNext.includes(next as PaymentStatus)) {
    // Verificar se é regressão
    const currentIdx = PAYMENT_STATUS_ORDER.indexOf(current as PaymentStatus);
    const nextIdx = PAYMENT_STATUS_ORDER.indexOf(next as PaymentStatus);

    if (currentIdx !== -1 && nextIdx !== -1 && nextIdx < currentIdx) {
      return {
        valid: false,
        error: `Não é permitido voltar o pagamento de "${PAYMENT_STATUS_LABELS[current]}" para "${PAYMENT_STATUS_LABELS[next]}". O status só pode avançar.`,
      };
    }

    return {
      valid: false,
      error: `Transição de "${PAYMENT_STATUS_LABELS[current] || current}" para "${PAYMENT_STATUS_LABELS[next] || next}" não é permitida.`,
    };
  }

  // Verificar permissão do papel (se fornecido)
  if (actorRole) {
    const transitionKey = `${current}→${next}`;
    const allowedRoles = PAYMENT_TRANSITION_PERMISSIONS[transitionKey];

    if (allowedRoles && !allowedRoles.includes(actorRole.toUpperCase().trim() as PaymentActorRole)) {
      return {
        valid: false,
        error: `Você não tem permissão para alterar o pagamento de "${PAYMENT_STATUS_LABELS[current]}" para "${PAYMENT_STATUS_LABELS[next]}".`,
      };
    }
  }

  return { valid: true, error: null };
}

// =============================================================================
// FUNÇÕES DE VALIDAÇÃO - ENCERRAMENTO (CLOSURE)
// =============================================================================

/**
 * Verifica se o frete pode ser encerrado como COMPLETED.
 */
export function canCloseFreightAsCompleted(input: {
  freightStatus: string;
  paymentStatus: string | null | undefined;
  allAssignmentsCompleted?: boolean;
  requiredTrucks?: number;
  completedAssignments?: number;
  actorRole: string;
}): ClosureValidation {
  const {
    freightStatus,
    paymentStatus,
    allAssignmentsCompleted = true,
    requiredTrucks = 1,
    completedAssignments = requiredTrucks,
    actorRole,
  } = input;

  const normalizedFreight = freightStatus.toUpperCase().trim();
  const normalizedRole = actorRole.toUpperCase().trim();
  const normalizedPayment = paymentStatus?.toLowerCase().trim() || '';

  // Apenas roles específicos podem encerrar
  if (normalizedRole !== 'PRODUTOR' && normalizedRole !== 'ADMIN') {
    // Motorista pode encerrar via confirmação de pagamento (trigger automático)
    if (normalizedRole === 'MOTORISTA' || normalizedRole === 'MOTORISTA_AFILIADO') {
      return {
        valid: false,
        error: 'O encerramento do frete é automático ao confirmar o recebimento do pagamento.',
        blockReason: 'DRIVER_CANNOT_CLOSE_DIRECTLY',
      };
    }
    return {
      valid: false,
      error: 'Você não tem permissão para encerrar este frete.',
      blockReason: 'ROLE_NOT_ALLOWED',
    };
  }

  // Frete precisa estar DELIVERED para ser encerrado
  if (normalizedFreight !== 'DELIVERED' && normalizedFreight !== 'DELIVERED_PENDING_CONFIRMATION') {
    if (normalizedFreight === 'COMPLETED') {
      return { valid: false, error: 'Este frete já foi concluído.', blockReason: 'ALREADY_COMPLETED' };
    }
    if (normalizedFreight === 'CANCELLED') {
      return { valid: false, error: 'Este frete foi cancelado.', blockReason: 'CANCELLED' };
    }
    return {
      valid: false,
      error: `O frete precisa estar com entrega confirmada para ser encerrado. Status atual: ${getPaymentFreightStatusLabel(normalizedFreight)}.`,
      blockReason: 'FREIGHT_NOT_DELIVERED',
    };
  }

  // Pagamento precisa estar confirmado para encerrar
  if (normalizedPayment !== 'confirmed') {
    if (!normalizedPayment || normalizedPayment === 'proposed') {
      return {
        valid: false,
        error: 'O pagamento precisa ser efetuado e confirmado pelo motorista antes de encerrar.',
        blockReason: 'PAYMENT_NOT_STARTED',
      };
    }
    if (normalizedPayment === 'paid_by_producer') {
      return {
        valid: false,
        error: 'Aguardando o motorista confirmar o recebimento do pagamento.',
        blockReason: 'PAYMENT_AWAITING_DRIVER_CONFIRMATION',
      };
    }
    if (normalizedPayment === 'disputed') {
      return {
        valid: false,
        error: 'Existe uma disputa pendente sobre o pagamento. Resolva antes de encerrar.',
        blockReason: 'PAYMENT_DISPUTED',
      };
    }
    return {
      valid: false,
      error: `Pagamento no status "${PAYMENT_STATUS_LABELS[normalizedPayment] || normalizedPayment}" impede o encerramento.`,
      blockReason: 'PAYMENT_INVALID_STATUS',
    };
  }

  // Multi-carreta: todas as atribuições devem estar completas
  if (requiredTrucks > 1) {
    if (!allAssignmentsCompleted || completedAssignments < requiredTrucks) {
      return {
        valid: false,
        error: `Aguardando conclusão de todas as carretas: ${completedAssignments}/${requiredTrucks} concluídas.`,
        blockReason: 'MULTI_TRUCK_INCOMPLETE',
      };
    }
  }

  return { valid: true, error: null };
}

// =============================================================================
// FUNÇÕES DE VALIDAÇÃO - AVALIAÇÃO (RATING)
// =============================================================================

/**
 * Verifica se o ator pode avaliar a operação (rural).
 */
export function canRateFreight(input: {
  freightStatus: string;
  paymentStatus: string | null | undefined;
  actorRole: string;
  hasAlreadyRated?: boolean;
  targetType?: string; // 'driver' | 'producer' | 'company'
}): RatingValidation {
  const { freightStatus, paymentStatus, actorRole, hasAlreadyRated = false, targetType } = input;
  const normalizedFreight = freightStatus.toUpperCase().trim();
  const normalizedPayment = paymentStatus?.toLowerCase().trim() || '';
  const normalizedRole = actorRole.toUpperCase().trim();

  // Já avaliou
  if (hasAlreadyRated) {
    return {
      canRate: false,
      message: 'Avaliação já enviada.',
    };
  }

  // Frete precisa estar COMPLETED
  if (normalizedFreight !== 'COMPLETED') {
    if (normalizedFreight === 'DELIVERED' || normalizedFreight === 'DELIVERED_PENDING_CONFIRMATION') {
      return {
        canRate: false,
        message: 'Avaliação disponível após o encerramento do frete.',
        waitingFor: 'Confirmação de pagamento e encerramento',
      };
    }
    return {
      canRate: false,
      message: 'Avaliação disponível apenas após a conclusão do frete.',
      waitingFor: `Status atual: ${getPaymentFreightStatusLabel(normalizedFreight)}`,
    };
  }

  // Pagamento precisa estar confirmado
  if (normalizedPayment && normalizedPayment !== 'confirmed') {
    return {
      canRate: false,
      message: 'Avaliação disponível após a confirmação do pagamento.',
      waitingFor: `Pagamento: ${PAYMENT_STATUS_LABELS[normalizedPayment] || normalizedPayment}`,
    };
  }

  // Papel deve ter relação com o frete
  const ratingRoles = ['PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA'];
  if (!ratingRoles.includes(normalizedRole)) {
    return {
      canRate: false,
      message: 'Você não tem permissão para avaliar este frete.',
    };
  }

  // Transportadora não avalia diretamente (apenas seus motoristas são avaliados)
  if (normalizedRole === 'TRANSPORTADORA' && targetType === 'company') {
    return {
      canRate: false,
      message: 'Transportadoras não podem se auto-avaliar.',
    };
  }

  return {
    canRate: true,
    message: 'Avaliação disponível',
  };
}

/**
 * Verifica se o ator pode avaliar um serviço urbano.
 */
export function canRateServiceRequest(input: {
  serviceStatus: string;
  actorRole: string;
  hasAlreadyRated?: boolean;
}): RatingValidation {
  const { serviceStatus, actorRole, hasAlreadyRated = false } = input;
  const normalizedStatus = serviceStatus.toUpperCase().trim();

  if (hasAlreadyRated) {
    return { canRate: false, message: 'Avaliação já enviada.' };
  }

  if (normalizedStatus !== 'COMPLETED') {
    return {
      canRate: false,
      message: 'Avaliação disponível apenas após a conclusão do serviço.',
      waitingFor: `Status atual: ${normalizedStatus}`,
    };
  }

  const ratingRoles = ['PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'GUEST'];
  if (!ratingRoles.includes(actorRole.toUpperCase().trim())) {
    return { canRate: false, message: 'Você não tem permissão para avaliar este serviço.' };
  }

  return { canRate: true, message: 'Avaliação disponível' };
}

// =============================================================================
// FUNÇÕES i18n (PT-BR)
// =============================================================================

/**
 * Retorna label PT-BR para status de pagamento.
 * NUNCA retorna código em inglês.
 */
export function getPaymentUILabelPtBR(status: string): string {
  if (!status) return 'Desconhecido';
  const normalized = status.toLowerCase().trim();
  return PAYMENT_STATUS_LABELS[normalized] || 'Desconhecido';
}

/**
 * Retorna label PT-BR para ação de pagamento.
 * NUNCA retorna código em inglês.
 */
export function getPaymentActionLabelPtBR(action: string): string {
  if (!action) return '';
  const normalized = action.toLowerCase().trim();
  return PAYMENT_ACTION_LABELS[normalized] || action;
}

/**
 * Retorna mensagem explicativa PT-BR para o estado atual do pagamento.
 * Útil para tooltips e cards.
 */
export function getPaymentStatusExplanation(status: string, role: string): string {
  const normalizedStatus = status.toLowerCase().trim();
  const normalizedRole = role.toUpperCase().trim();

  const explanations: Record<string, Record<string, string>> = {
    proposed: {
      PRODUTOR: 'Pagamento proposto. Marque como pago após efetuar o pagamento ao motorista.',
      MOTORISTA: 'Pagamento proposto pelo produtor. Aguardando o produtor informar que efetuou o pagamento.',
      MOTORISTA_AFILIADO: 'Pagamento proposto pelo produtor. Aguardando o produtor informar que efetuou o pagamento.',
      TRANSPORTADORA: 'Pagamento proposto ao motorista afiliado. Aguardando produtor efetuar pagamento.',
      ADMIN: 'Pagamento proposto. Aguardando produtor marcar como pago.',
    },
    paid_by_producer: {
      PRODUTOR: 'Você marcou o pagamento como efetuado. Aguardando confirmação do motorista.',
      MOTORISTA: 'O produtor informou que efetuou o pagamento. Confirme o recebimento.',
      MOTORISTA_AFILIADO: 'O produtor informou que efetuou o pagamento. Confirme o recebimento.',
      TRANSPORTADORA: 'O produtor informou que efetuou o pagamento. Seu motorista precisa confirmar o recebimento.',
      ADMIN: 'Pagamento marcado como efetuado. Aguardando confirmação do motorista.',
    },
    confirmed: {
      PRODUTOR: 'Pagamento confirmado pelo motorista. O frete será encerrado.',
      MOTORISTA: 'Você confirmou o recebimento do pagamento.',
      MOTORISTA_AFILIADO: 'Você confirmou o recebimento do pagamento.',
      TRANSPORTADORA: 'O motorista confirmou o recebimento. Pagamento concluído.',
      ADMIN: 'Pagamento confirmado por ambas as partes.',
    },
    disputed: {
      PRODUTOR: 'O motorista contestou o pagamento. Verifique e tente novamente.',
      MOTORISTA: 'Você contestou este pagamento. Aguardando resolução.',
      MOTORISTA_AFILIADO: 'Você contestou este pagamento. Aguardando resolução.',
      TRANSPORTADORA: 'O motorista contestou o pagamento. Aguardando resolução.',
      ADMIN: 'Pagamento em disputa. Requer intervenção manual.',
    },
    cancelled: {
      DEFAULT: 'Pagamento cancelado.',
    },
    rejected: {
      DEFAULT: 'Proposta de pagamento rejeitada.',
    },
  };

  const statusExplanations = explanations[normalizedStatus];
  if (!statusExplanations) return 'Status de pagamento desconhecido.';

  return statusExplanations[normalizedRole] || statusExplanations.DEFAULT || 'Status de pagamento desconhecido.';
}

// =============================================================================
// MULTI-CARRETA: VALIDAÇÕES ESPECÍFICAS
// =============================================================================

/**
 * Verifica se o frete multi-carreta pode ser marcado como COMPLETED globalmente.
 * Só é possível quando TODAS as atribuições individuais estiverem finalizadas.
 */
export function canCloseMultiTruckFreight(input: {
  requiredTrucks: number;
  assignments: Array<{
    id: string;
    status: string;
    paymentStatus?: string;
  }>;
}): ClosureValidation {
  const { requiredTrucks, assignments } = input;

  if (requiredTrucks <= 1) {
    return { valid: true, error: null };
  }

  if (assignments.length < requiredTrucks) {
    return {
      valid: false,
      error: `Aguardando atribuição de todas as carretas: ${assignments.length}/${requiredTrucks} atribuídas.`,
      blockReason: 'ASSIGNMENTS_INCOMPLETE',
    };
  }

  const completedStatuses = ['DELIVERED', 'COMPLETED'];
  const incompleteAssignments = assignments.filter(
    a => !completedStatuses.includes(a.status.toUpperCase().trim())
  );

  if (incompleteAssignments.length > 0) {
    return {
      valid: false,
      error: `${incompleteAssignments.length} carreta(s) ainda não finalizou/finalizaram a entrega.`,
      blockReason: 'ASSIGNMENTS_NOT_DELIVERED',
    };
  }

  // Verificar pagamentos individuais
  const unconfirmedPayments = assignments.filter(
    a => a.paymentStatus && a.paymentStatus.toLowerCase().trim() !== 'confirmed'
  );

  if (unconfirmedPayments.length > 0) {
    return {
      valid: false,
      error: `${unconfirmedPayments.length} pagamento(s) ainda não foi/foram confirmado(s).`,
      blockReason: 'PAYMENTS_NOT_CONFIRMED',
    };
  }

  return { valid: true, error: null };
}

// =============================================================================
// HELPERS INTERNOS
// =============================================================================

/**
 * Label PT-BR para status de frete no contexto de pagamento.
 */
function getPaymentFreightStatusLabel(status: string): string {
  const labels: Record<string, string> = {
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
  return labels[status.toUpperCase().trim()] || status;
}
