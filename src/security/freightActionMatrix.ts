/**
 * src/security/freightActionMatrix.ts
 *
 * Matriz COMPLETA de ações permitidas por status × papel.
 * Esta é a FONTE ÚNICA que a UI consome para decidir o que renderizar.
 *
 * REGRA: Se uma ação não está na matriz para aquele status+papel, o botão NÃO EXISTE.
 * A UI NUNCA decide ação sozinha — apenas consome esta matriz.
 *
 * Integra com:
 *   - freightWorkflowGuard.ts (validação de transições)
 *   - freightActionDispatcher.ts (execução)
 *   - i18nGuard.ts (labels PT-BR)
 *   - multiTruckPriceGuard.ts (contexto financeiro)
 */

import {
  type FreightWorkflowStatus,
  type UserRole,
  getUserAllowedActions,
  canTransition,
  WORKFLOW_ORDER,
  TERMINAL_STATUSES,
} from './freightWorkflowGuard';

import { getActionLabelPtBR, getStatusLabelPtBR } from './i18nGuard';
import { checkStateConsistency } from './freightActionDispatcher';

// =============================================================================
// TIPOS
// =============================================================================

export type MatrixAction =
  | 'ADVANCE'
  | 'CANCEL'
  | 'REQUEST_CANCEL'
  | 'REPORT_DELIVERY'
  | 'CONFIRM_DELIVERY'
  | 'MARK_PAID'
  | 'CONFIRM_PAYMENT'
  | 'RATE'
  | 'MONITOR'
  | 'VIEW_DETAILS'
  | 'CHAT'
  | 'TRACK_LOCATION';

export interface ActionDefinition {
  /** Identificador da ação */
  action: MatrixAction;
  /** Label PT-BR para o botão */
  label: string;
  /** Se a ação é destrutiva (visual vermelho) */
  destructive?: boolean;
  /** Se a ação é primária (destaque visual) */
  primary?: boolean;
  /** Status de destino (para transições de workflow) */
  targetStatus?: FreightWorkflowStatus;
  /** Ícone sugerido (nome Lucide) */
  icon?: string;
  /** Tooltip PT-BR */
  tooltip?: string;
}

export interface MatrixQuery {
  /** Status atual do frete */
  freightStatus: string;
  /** Papel do ator */
  actorRole: string;
  /** Status do assignment individual (para consistência) */
  assignmentStatus?: string;
  /** Status do driver_trip_progress (para consistência) */
  progressStatus?: string;
  /** Número de carretas requeridas */
  requiredTrucks?: number;
  /** Número de carretas aceitas */
  acceptedTrucks?: number;
  /** Status do pagamento */
  paymentStatus?: string;
  /** Se o motorista já avaliou */
  hasRated?: boolean;
}

export interface MatrixResult {
  /** Ações permitidas (ordenadas por prioridade) */
  actions: ActionDefinition[];
  /** Se a UI deve entrar em modo seguro (somente leitura) */
  safeMode: boolean;
  /** Mensagem de modo seguro PT-BR */
  safeModeMessage?: string;
  /** Se é um status terminal */
  isTerminal: boolean;
  /** Status exibido (PT-BR) */
  statusLabel: string;
}

// =============================================================================
// MATRIZ ESTÁTICA
// =============================================================================

/**
 * Matriz completa: status → role → ações permitidas.
 * Cada entrada define EXATAMENTE o que aparece na UI para aquele contexto.
 */
const ACTION_MATRIX: Record<string, Record<string, ActionDefinition[]>> = {
  NEW: {
    PRODUTOR: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
    ADMIN: [
      { action: 'ADVANCE', label: 'Aprovar', primary: true, targetStatus: 'APPROVED', icon: 'Check' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
    MOTORISTA: [],
    MOTORISTA_AFILIADO: [],
    TRANSPORTADORA: [],
  },
  APPROVED: {
    PRODUTOR: [
      { action: 'ADVANCE', label: 'Publicar', primary: true, targetStatus: 'OPEN', icon: 'Send' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
    ADMIN: [
      { action: 'ADVANCE', label: 'Publicar', primary: true, targetStatus: 'OPEN', icon: 'Send' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
    MOTORISTA: [],
    MOTORISTA_AFILIADO: [],
    TRANSPORTADORA: [],
  },
  OPEN: {
    PRODUTOR: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
    MOTORISTA: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    MOTORISTA_AFILIADO: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    TRANSPORTADORA: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
      { action: 'MONITOR', label: 'Monitorar', icon: 'Monitor' },
    ],
    ADMIN: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
  },
  ACCEPTED: {
    MOTORISTA: [
      { action: 'ADVANCE', label: 'A Caminho da Coleta', primary: true, targetStatus: 'LOADING', icon: 'Truck' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    MOTORISTA_AFILIADO: [
      { action: 'ADVANCE', label: 'A Caminho da Coleta', primary: true, targetStatus: 'LOADING', icon: 'Truck' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    PRODUTOR: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
    TRANSPORTADORA: [
      { action: 'MONITOR', label: 'Monitorar', icon: 'Monitor' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    ADMIN: [
      { action: 'ADVANCE', label: 'A Caminho da Coleta', targetStatus: 'LOADING', icon: 'Truck' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
  },
  LOADING: {
    MOTORISTA: [
      { action: 'ADVANCE', label: 'Carregado', primary: true, targetStatus: 'LOADED', icon: 'Package' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
      { action: 'TRACK_LOCATION', label: 'Rastrear', icon: 'MapPin' },
    ],
    MOTORISTA_AFILIADO: [
      { action: 'ADVANCE', label: 'Carregado', primary: true, targetStatus: 'LOADED', icon: 'Package' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
      { action: 'TRACK_LOCATION', label: 'Rastrear', icon: 'MapPin' },
    ],
    PRODUTOR: [
      { action: 'TRACK_LOCATION', label: 'Rastrear Motorista', icon: 'MapPin' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
    TRANSPORTADORA: [
      { action: 'MONITOR', label: 'Monitorar', icon: 'Monitor' },
      { action: 'TRACK_LOCATION', label: 'Rastrear', icon: 'MapPin' },
    ],
    ADMIN: [
      { action: 'ADVANCE', label: 'Carregado', targetStatus: 'LOADED', icon: 'Package' },
    ],
  },
  LOADED: {
    MOTORISTA: [
      { action: 'ADVANCE', label: 'Iniciar Viagem', primary: true, targetStatus: 'IN_TRANSIT', icon: 'Navigation' },
      { action: 'REQUEST_CANCEL', label: 'Cancelamento', icon: 'X', tooltip: 'Solicitar cancelamento ao produtor' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    MOTORISTA_AFILIADO: [
      { action: 'ADVANCE', label: 'Iniciar Viagem', primary: true, targetStatus: 'IN_TRANSIT', icon: 'Navigation' },
      { action: 'REQUEST_CANCEL', label: 'Cancelamento', icon: 'X', tooltip: 'Solicitar cancelamento ao produtor' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    PRODUTOR: [
      { action: 'TRACK_LOCATION', label: 'Rastrear Motorista', icon: 'MapPin' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
    TRANSPORTADORA: [
      { action: 'MONITOR', label: 'Monitorar', icon: 'Monitor' },
      { action: 'TRACK_LOCATION', label: 'Rastrear', icon: 'MapPin' },
    ],
    ADMIN: [
      { action: 'ADVANCE', label: 'Iniciar Viagem', targetStatus: 'IN_TRANSIT', icon: 'Navigation' },
    ],
  },
  IN_TRANSIT: {
    MOTORISTA: [
      { action: 'REPORT_DELIVERY', label: 'Reportar Entrega', primary: true, targetStatus: 'DELIVERED_PENDING_CONFIRMATION', icon: 'CheckCircle' },
      { action: 'REQUEST_CANCEL', label: 'Cancelamento', icon: 'X', tooltip: 'Solicitar cancelamento ao produtor' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
      { action: 'TRACK_LOCATION', label: 'Rastrear', icon: 'MapPin' },
    ],
    MOTORISTA_AFILIADO: [
      { action: 'REPORT_DELIVERY', label: 'Reportar Entrega', primary: true, targetStatus: 'DELIVERED_PENDING_CONFIRMATION', icon: 'CheckCircle' },
      { action: 'REQUEST_CANCEL', label: 'Cancelamento', icon: 'X', tooltip: 'Solicitar cancelamento ao produtor' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
      { action: 'TRACK_LOCATION', label: 'Rastrear', icon: 'MapPin' },
    ],
    PRODUTOR: [
      { action: 'TRACK_LOCATION', label: 'Rastrear Motorista', icon: 'MapPin' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
      { action: 'CANCEL', label: 'Cancelar', destructive: true, icon: 'X' },
    ],
    TRANSPORTADORA: [
      { action: 'MONITOR', label: 'Monitorar', icon: 'Monitor' },
      { action: 'TRACK_LOCATION', label: 'Rastrear', icon: 'MapPin' },
    ],
    ADMIN: [
      { action: 'REPORT_DELIVERY', label: 'Reportar Entrega', targetStatus: 'DELIVERED_PENDING_CONFIRMATION', icon: 'CheckCircle' },
    ],
  },
  DELIVERED_PENDING_CONFIRMATION: {
    PRODUTOR: [
      { action: 'CONFIRM_DELIVERY', label: 'Confirmar Entrega', primary: true, targetStatus: 'DELIVERED', icon: 'CheckCheck' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    MOTORISTA: [
      { action: 'REQUEST_CANCEL', label: 'Cancelamento', icon: 'X', tooltip: 'Solicitar cancelamento ao produtor' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle', tooltip: 'Aguardando confirmação do produtor' },
    ],
    MOTORISTA_AFILIADO: [
      { action: 'REQUEST_CANCEL', label: 'Cancelamento', icon: 'X', tooltip: 'Solicitar cancelamento ao produtor' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle', tooltip: 'Aguardando confirmação do produtor' },
    ],
    TRANSPORTADORA: [
      { action: 'MONITOR', label: 'Monitorar', icon: 'Monitor' },
    ],
    ADMIN: [
      { action: 'CONFIRM_DELIVERY', label: 'Confirmar Entrega', targetStatus: 'DELIVERED', icon: 'CheckCheck' },
    ],
  },
  DELIVERED: {
    PRODUTOR: [
      { action: 'ADVANCE', label: 'Concluir Frete', primary: true, targetStatus: 'COMPLETED', icon: 'Flag' },
      { action: 'MARK_PAID', label: 'Marcar como Pago', icon: 'DollarSign' },
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    MOTORISTA: [
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    MOTORISTA_AFILIADO: [
      { action: 'CHAT', label: 'Chat', icon: 'MessageCircle' },
    ],
    TRANSPORTADORA: [
      { action: 'MONITOR', label: 'Monitorar', icon: 'Monitor' },
    ],
    ADMIN: [
      { action: 'ADVANCE', label: 'Concluir Frete', targetStatus: 'COMPLETED', icon: 'Flag' },
    ],
  },
  COMPLETED: {
    PRODUTOR: [
      { action: 'RATE', label: 'Avaliar Motorista', icon: 'Star' },
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
    MOTORISTA: [
      { action: 'RATE', label: 'Avaliar Produtor', icon: 'Star' },
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
    MOTORISTA_AFILIADO: [
      { action: 'RATE', label: 'Avaliar Produtor', icon: 'Star' },
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
    TRANSPORTADORA: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
    ADMIN: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
  },
  CANCELLED: {
    PRODUTOR: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
    MOTORISTA: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
    MOTORISTA_AFILIADO: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
    TRANSPORTADORA: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
    ADMIN: [
      { action: 'VIEW_DETAILS', label: 'Ver Detalhes', icon: 'Eye' },
    ],
  },
};

// =============================================================================
// CONSULTA DA MATRIZ
// =============================================================================

/**
 * Consulta a matriz de ações para um contexto específico.
 * Retorna EXATAMENTE as ações que devem ser renderizadas na UI.
 *
 * REGRAS APLICADAS:
 * 1. Estado inconsistente → modo seguro (0 ações)
 * 2. Status terminal → apenas VIEW_DETAILS e RATE
 * 3. Transportadora NUNCA avança status diretamente
 * 4. Ações com paymentStatus são filtradas condicionalmente
 * 5. Rating removido se já avaliou
 */
export function queryActionMatrix(query: MatrixQuery): MatrixResult {
  const status = query.freightStatus?.toUpperCase().trim() || '';
  const role = query.actorRole?.toUpperCase().trim() || '';
  const isTerminal = TERMINAL_STATUSES.includes(status as FreightWorkflowStatus);
  const statusLabel = getStatusLabelPtBR(status);

  // 1. Consistência de estado
  const consistency = checkStateConsistency({
    freightStatus: status,
    assignmentStatus: query.assignmentStatus,
    progressStatus: query.progressStatus,
    requiredTrucks: query.requiredTrucks,
    acceptedTrucks: query.acceptedTrucks,
  });

  if (!consistency.isConsistent) {
    if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
      console.warn(consistency.debugDetails);
    }
    return {
      actions: [],
      safeMode: true,
      safeModeMessage: consistency.warningMessage || '⚠️ Dados inconsistentes. Recarregue a página.',
      isTerminal,
      statusLabel,
    };
  }

  // 2. Buscar na matriz
  const statusActions = ACTION_MATRIX[status] || {};
  let actions = [...(statusActions[role] || [])];

  // 3. Filtros condicionais

  // 3a. Rating: remover se já avaliou
  if (query.hasRated) {
    actions = actions.filter(a => a.action !== 'RATE');
  }

  // 3b. Pagamento: MARK_PAID apenas se não pago; CONFIRM_PAYMENT apenas se pago pelo produtor
  if (query.paymentStatus) {
    const ps = query.paymentStatus.toUpperCase().trim();
    if (ps === 'PAID_BY_PRODUCER' || ps === 'CONFIRMED') {
      actions = actions.filter(a => a.action !== 'MARK_PAID');
    }
    if (ps !== 'PAID_BY_PRODUCER') {
      actions = actions.filter(a => a.action !== 'CONFIRM_PAYMENT');
    }
  }

  // 3c. Transportadora: NUNCA tem ação ADVANCE (apenas MONITOR)
  if (role === 'TRANSPORTADORA') {
    actions = actions.filter(a => a.action !== 'ADVANCE' && a.action !== 'REPORT_DELIVERY' && a.action !== 'CONFIRM_DELIVERY');
  }

  // 4. Validação final via guard (double-check)
  actions = actions.filter(a => {
    if (a.targetStatus) {
      const check = canTransition(status, a.targetStatus);
      return check.valid;
    }
    return true;
  });

  return {
    actions,
    safeMode: false,
    isTerminal,
    statusLabel,
  };
}

/**
 * Verifica se uma ação específica é permitida para o contexto dado.
 * Shortcut para uso em componentes que precisam de boolean simples.
 */
export function isActionAllowed(
  action: MatrixAction,
  query: MatrixQuery
): boolean {
  const result = queryActionMatrix(query);
  return result.actions.some(a => a.action === action);
}

/**
 * Retorna os papéis que podem executar alguma ação em determinado status.
 * Útil para debug e documentação.
 */
export function getRolesWithActions(status: string): Record<string, MatrixAction[]> {
  const normalized = status.toUpperCase().trim();
  const statusActions = ACTION_MATRIX[normalized] || {};
  const result: Record<string, MatrixAction[]> = {};

  for (const [role, actions] of Object.entries(statusActions)) {
    if (actions.length > 0) {
      result[role] = actions.map(a => a.action);
    }
  }

  return result;
}

/**
 * Verifica se a UI deve entrar em modo seguro para o contexto dado.
 * Shortcut para uso em componentes.
 */
export function shouldEnterSafeMode(query: MatrixQuery): { safeMode: boolean; message?: string } {
  const result = queryActionMatrix(query);
  return {
    safeMode: result.safeMode,
    message: result.safeModeMessage,
  };
}
