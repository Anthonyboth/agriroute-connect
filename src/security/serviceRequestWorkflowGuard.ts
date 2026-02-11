/**
 * src/security/serviceRequestWorkflowGuard.ts
 *
 * Módulo de segurança de workflow de fretes urbanos (service_requests).
 * Garante que NENHUMA transição de status inválida seja possível.
 *
 * Status Flow obrigatório:
 *   OPEN → ACCEPTED → ON_THE_WAY → IN_PROGRESS → COMPLETED
 *
 * Regras:
 * - Workflow linear obrigatório (sem pular, sem regredir)
 * - Cancelamento apenas por ação do usuário (não automático, exceto OPEN expirado)
 * - Expiração automática SOMENTE em status OPEN
 * - Validação por papel (GUEST, PRODUTOR, MOTORISTA, TRANSPORTADORA)
 * - Todas as mensagens em PT-BR
 */

// =============================================================================
// TIPOS
// =============================================================================

export type ServiceRequestStatus =
  | 'OPEN'
  | 'ACCEPTED'
  | 'ON_THE_WAY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type ServiceRequestType =
  | 'GUINCHO'
  | 'FRETE_MOTO'
  | 'FRETE_URBANO'
  | 'MUDANCA_RESIDENCIAL'
  | 'MUDANCA_COMERCIAL';

export type ServiceRequestRole =
  | 'GUEST'
  | 'PRODUTOR'
  | 'MOTORISTA'
  | 'MOTORISTA_AFILIADO'
  | 'TRANSPORTADORA'
  | 'PRESTADOR_SERVICOS'
  | 'ADMIN';

export type ServiceRequestAction =
  | 'ACCEPT'
  | 'START_ROUTE'
  | 'START_SERVICE'
  | 'COMPLETE'
  | 'CANCEL'
  | 'RATE';

export interface ServiceRequestTransitionValidation {
  valid: boolean;
  error: string | null;
  expectedNext: ServiceRequestStatus | null;
}

export class ServiceRequestWorkflowError extends Error {
  public readonly code: string;
  public readonly currentStatus: string;
  public readonly attemptedStatus: string;

  constructor(message: string, code: string, current: string, attempted: string) {
    super(message);
    this.name = 'ServiceRequestWorkflowError';
    this.code = code;
    this.currentStatus = current;
    this.attemptedStatus = attempted;
  }
}

// =============================================================================
// CONSTANTES
// =============================================================================

/**
 * Ordem oficial do workflow urbano.
 * Qualquer transição fora desta sequência é BLOQUEADA.
 */
export const SERVICE_REQUEST_WORKFLOW_ORDER: readonly ServiceRequestStatus[] = [
  'OPEN',
  'ACCEPTED',
  'ON_THE_WAY',
  'IN_PROGRESS',
  'COMPLETED',
] as const;

/**
 * Status terminais (não podem avançar)
 */
export const SERVICE_REQUEST_TERMINAL_STATUSES: readonly ServiceRequestStatus[] = [
  'COMPLETED',
  'CANCELLED',
] as const;

/**
 * Labels PT-BR para status de service_requests
 */
export const SERVICE_REQUEST_STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  OPEN: 'Aberto',
  ACCEPTED: 'Aceito',
  ON_THE_WAY: 'A Caminho',
  IN_PROGRESS: 'Em Andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
};

/**
 * Labels PT-BR para ações
 */
export const SERVICE_REQUEST_ACTION_LABELS: Record<ServiceRequestAction, string> = {
  ACCEPT: 'Aceitar',
  START_ROUTE: 'Iniciar Deslocamento',
  START_SERVICE: 'Iniciar Serviço',
  COMPLETE: 'Concluir',
  CANCEL: 'Cancelar',
  RATE: 'Avaliar',
};

/**
 * Labels PT-BR para tipos de serviço
 */
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  GUINCHO: 'Guincho',
  FRETE_MOTO: 'Frete Moto',
  FRETE_URBANO: 'Frete Urbano',
  MUDANCA_RESIDENCIAL: 'Mudança Residencial',
  MUDANCA_COMERCIAL: 'Mudança Comercial',
};

/**
 * TTL de expiração por tipo de serviço (em horas).
 * Apenas para status OPEN.
 */
export const SERVICE_REQUEST_EXPIRATION_HOURS: Record<string, number> = {
  GUINCHO: 4,
  FRETE_MOTO: 24,
  FRETE_URBANO: 72,
  MUDANCA_RESIDENCIAL: 72,
  MUDANCA_COMERCIAL: 72,
};

/**
 * Termos proibidos na UI (service_requests).
 */
const SR_FORBIDDEN_TERMS = new Set([
  'OPEN', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
  'PENDING', 'ON_THE_WAY',
  'driver', 'provider', 'carrier',
]);

/**
 * Ações permitidas por papel e status.
 */
const SR_ROLE_TRANSITIONS: Record<ServiceRequestRole, ServiceRequestStatus[]> = {
  GUEST: [],
  PRODUTOR: [],
  MOTORISTA: ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'],
  MOTORISTA_AFILIADO: ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'],
  TRANSPORTADORA: ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'],
  PRESTADOR_SERVICOS: ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'],
  ADMIN: [...SERVICE_REQUEST_WORKFLOW_ORDER],
};

/**
 * Papéis que podem cancelar, por status.
 */
const SR_CANCEL_PERMISSIONS: Record<string, ServiceRequestRole[]> = {
  OPEN: ['GUEST', 'PRODUTOR', 'ADMIN'],
  ACCEPTED: ['PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'PRESTADOR_SERVICOS', 'ADMIN'],
  ON_THE_WAY: ['PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'PRESTADOR_SERVICOS', 'ADMIN'],
  IN_PROGRESS: ['ADMIN'],
};

// =============================================================================
// FUNÇÕES DE VALIDAÇÃO
// =============================================================================

/**
 * Verifica se uma transição de status é válida.
 */
export function canTransitionSR(
  currentStatus: string,
  nextStatus: string
): ServiceRequestTransitionValidation {
  const current = currentStatus.toUpperCase().trim() as ServiceRequestStatus;
  const next = nextStatus.toUpperCase().trim() as ServiceRequestStatus;

  // Status terminal
  if (SERVICE_REQUEST_TERMINAL_STATUSES.includes(current)) {
    return {
      valid: false,
      error: `A solicitação está "${SERVICE_REQUEST_STATUS_LABELS[current] || current}" e não pode mais ser alterada.`,
      expectedNext: null,
    };
  }

  const currentIdx = SERVICE_REQUEST_WORKFLOW_ORDER.indexOf(current);
  const nextIdx = SERVICE_REQUEST_WORKFLOW_ORDER.indexOf(next);

  // Status desconhecido
  if (currentIdx === -1) {
    return {
      valid: false,
      error: `Status atual "${current}" não é reconhecido pelo sistema de serviços.`,
      expectedNext: null,
    };
  }
  if (nextIdx === -1 && next !== 'CANCELLED') {
    return {
      valid: false,
      error: `Status "${next}" não é reconhecido pelo sistema de serviços.`,
      expectedNext: null,
    };
  }

  // Cancelamento controlado
  if (next === 'CANCELLED') {
    return { valid: true, error: null, expectedNext: null };
  }

  // Regressão bloqueada
  if (nextIdx < currentIdx) {
    return {
      valid: false,
      error: `Não é permitido voltar de "${SERVICE_REQUEST_STATUS_LABELS[current]}" para "${SERVICE_REQUEST_STATUS_LABELS[next]}". O status só pode avançar.`,
      expectedNext: currentIdx < SERVICE_REQUEST_WORKFLOW_ORDER.length - 1
        ? SERVICE_REQUEST_WORKFLOW_ORDER[currentIdx + 1]
        : null,
    };
  }

  // Mesmo status (idempotente)
  if (nextIdx === currentIdx) {
    return { valid: true, error: null, expectedNext: null };
  }

  // Salto de etapas bloqueado
  if (nextIdx > currentIdx + 1) {
    const expected = SERVICE_REQUEST_WORKFLOW_ORDER[currentIdx + 1];
    return {
      valid: false,
      error: `Não é permitido pular etapas. De "${SERVICE_REQUEST_STATUS_LABELS[current]}" você deve ir para "${SERVICE_REQUEST_STATUS_LABELS[expected]}".`,
      expectedNext: expected,
    };
  }

  // Transição válida (+1)
  return { valid: true, error: null, expectedNext: null };
}

/**
 * Valida transição e LANÇA ERRO se inválida.
 */
export function assertValidTransitionSR(
  currentStatus: string,
  nextStatus: string
): void {
  const result = canTransitionSR(currentStatus, nextStatus);
  if (!result.valid) {
    throw new ServiceRequestWorkflowError(
      result.error!,
      'INVALID_SR_TRANSITION',
      currentStatus,
      nextStatus
    );
  }
}

/**
 * Retorna o próximo status permitido.
 */
export function getNextAllowedStatusSR(
  currentStatus: string
): ServiceRequestStatus | null {
  const current = currentStatus.toUpperCase().trim() as ServiceRequestStatus;
  if (SERVICE_REQUEST_TERMINAL_STATUSES.includes(current)) return null;

  const idx = SERVICE_REQUEST_WORKFLOW_ORDER.indexOf(current);
  if (idx === -1 || idx >= SERVICE_REQUEST_WORKFLOW_ORDER.length - 1) return null;

  return SERVICE_REQUEST_WORKFLOW_ORDER[idx + 1];
}

/**
 * Retorna ações permitidas por papel, status, tipo e contexto.
 */
export function getAllowedActions(params: {
  role: ServiceRequestRole;
  status: ServiceRequestStatus;
  service_type?: string;
  isGuest?: boolean;
  isCompanyFlow?: boolean;
}): {
  actions: ServiceRequestAction[];
  canAdvance: boolean;
  canCancel: boolean;
  nextStatus: ServiceRequestStatus | null;
  nextStatusLabel: string | null;
} {
  const { role, status, isGuest = false, isCompanyFlow = false } = params;

  const nextStatus = getNextAllowedStatusSR(status);
  const allowedTargets = SR_ROLE_TRANSITIONS[role] || [];

  // Guest/Produtor não avança — apenas provider/motorista/transportadora
  const canAdvance = nextStatus !== null && allowedTargets.includes(nextStatus);

  // Verificar permissão de cancelamento
  const cancelRoles = SR_CANCEL_PERMISSIONS[status] || [];
  const canCancel = cancelRoles.includes(role);

  const actions: ServiceRequestAction[] = [];

  if (canAdvance && nextStatus) {
    switch (nextStatus) {
      case 'ACCEPTED':
        actions.push('ACCEPT');
        break;
      case 'ON_THE_WAY':
        actions.push('START_ROUTE');
        break;
      case 'IN_PROGRESS':
        actions.push('START_SERVICE');
        break;
      case 'COMPLETED':
        actions.push('COMPLETE');
        break;
    }
  }

  if (canCancel) {
    actions.push('CANCEL');
  }

  // Avaliação após conclusão
  if (status === 'COMPLETED') {
    actions.push('RATE');
  }

  return {
    actions,
    canAdvance,
    canCancel,
    nextStatus: canAdvance ? nextStatus : null,
    nextStatusLabel: canAdvance && nextStatus
      ? SERVICE_REQUEST_STATUS_LABELS[nextStatus]
      : null,
  };
}

// =============================================================================
// FUNÇÕES i18n (PT-BR)
// =============================================================================

/**
 * Retorna label PT-BR para status de service_request.
 * NUNCA retorna código em inglês.
 */
export function getServiceRequestStatusLabelPtBR(status: string): string {
  if (!status) return 'Desconhecido';
  const normalized = status.toUpperCase().trim() as ServiceRequestStatus;
  return SERVICE_REQUEST_STATUS_LABELS[normalized] || 'Desconhecido';
}

/**
 * Retorna label PT-BR para ação.
 */
export function getServiceRequestActionLabelPtBR(action: string): string {
  if (!action) return '';
  const normalized = action.toUpperCase().trim() as ServiceRequestAction;
  return SERVICE_REQUEST_ACTION_LABELS[normalized] || action;
}

/**
 * Retorna label PT-BR para tipo de serviço.
 */
export function getServiceTypeLabelPtBR(serviceType: string): string {
  if (!serviceType) return 'Serviço';
  const normalized = serviceType.toUpperCase().trim();
  return SERVICE_TYPE_LABELS[normalized] || serviceType;
}

/**
 * Detecta termos proibidos em inglês no texto.
 */
export function detectForbiddenServiceTerms(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  const words = text.split(/[\s,;.:!?\-_/\\()\[\]{}]+/);

  for (const word of words) {
    const upper = word.toUpperCase().trim();
    if (SR_FORBIDDEN_TERMS.has(upper) && word === word.toUpperCase()) {
      found.push(word);
    }
    // Also catch lowercase forbidden terms (driver, provider, carrier)
    if (SR_FORBIDDEN_TERMS.has(word.toLowerCase())) {
      found.push(word);
    }
  }

  return [...new Set(found)];
}

/**
 * Sanitiza texto para UI, substituindo termos proibidos por PT-BR.
 */
export function sanitizeServiceUiTextPtBR(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // Substituir status
  for (const [status, label] of Object.entries(SERVICE_REQUEST_STATUS_LABELS)) {
    const regex = new RegExp(`\\b${status}\\b`, 'gi');
    sanitized = sanitized.replace(regex, label);
  }

  // Substituir termos comuns
  const termReplacements: Record<string, string> = {
    driver: 'motorista',
    Driver: 'Motorista',
    DRIVER: 'Motorista',
    provider: 'prestador',
    Provider: 'Prestador',
    PROVIDER: 'Prestador',
    carrier: 'transportadora',
    Carrier: 'Transportadora',
    CARRIER: 'Transportadora',
  };

  for (const [eng, ptbr] of Object.entries(termReplacements)) {
    const regex = new RegExp(`\\b${eng}\\b`, 'g');
    sanitized = sanitized.replace(regex, ptbr);
  }

  return sanitized;
}

/**
 * Verifica se expiração automática é permitida para este status.
 * SOMENTE status OPEN pode ser auto-cancelado.
 */
export function canAutoExpire(status: string): boolean {
  return status.toUpperCase().trim() === 'OPEN';
}

/**
 * Retorna o TTL de expiração em horas para um tipo de serviço.
 */
export function getExpirationHours(serviceType: string): number {
  const normalized = serviceType.toUpperCase().trim();
  return SERVICE_REQUEST_EXPIRATION_HOURS[normalized] ?? 72;
}
