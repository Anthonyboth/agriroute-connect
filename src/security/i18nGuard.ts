/**
 * src/security/i18nGuard.ts
 *
 * Módulo de segurança de localização (PT-BR).
 * Garante que NENHUM status em inglês seja exibido ao usuário final.
 *
 * Regras:
 * - Todos os status devem passar por getStatusLabelPtBR()
 * - Textos proibidos são interceptados com fallback seguro
 * - Erros são logados para auditoria
 */

// =============================================================================
// DICIONÁRIO COMPLETO DE STATUS -> PT-BR
// =============================================================================

const STATUS_DICTIONARY: Record<string, string> = {
  // Freight statuses
  NEW: 'Novo',
  APPROVED: 'Aprovado',
  OPEN: 'Aberto',
  IN_NEGOTIATION: 'Em Negociação',
  ACCEPTED: 'Aceito',
  LOADING: 'A Caminho da Coleta',
  LOADED: 'Carregado',
  IN_TRANSIT: 'Em Trânsito',
  DELIVERED_PENDING_CONFIRMATION: 'Entrega Reportada',
  DELIVERED: 'Entregue',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  REJECTED: 'Rejeitado',
  PENDING: 'Pendente',
  EXPIRED: 'Expirado',

  // Assignment statuses
  ASSIGNED: 'Atribuído',
  UNASSIGNED: 'Não Atribuído',
  REMOVED: 'Removido',

  // Payment statuses
  PROPOSED: 'Proposto',
  PAID_BY_PRODUCER: 'Pago pelo Produtor',
  CONFIRMED: 'Confirmado',
  PROCESSING: 'Processando',
  FAILED: 'Falhou',
  REFUNDED: 'Reembolsado',

  // User statuses
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  SUSPENDED: 'Suspenso',
  LEFT: 'Saiu',
  VALIDATED: 'Validado',

  // Service statuses
  IN_PROGRESS: 'Em Andamento',
  ON_THE_WAY: 'A Caminho',
  RESOLVED: 'Resolvido',

  // Tracking statuses
  WAITING: 'Aguardando',
  WAITING_DRIVER: 'Aguardando Motorista',
  WAITING_PRODUCER: 'Aguardando Produtor',
  UNLOADING: 'Descarregando',
};

/**
 * Lista de termos em inglês proibidos na UI.
 * Se qualquer um destes aparecer em texto visível, é uma falha de segurança UX.
 */
const FORBIDDEN_ENGLISH_TERMS = new Set([
  'OPEN',
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'ON_THE_WAY',
  'DELIVERED',
  'DELIVERED_PENDING_CONFIRMATION',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'PENDING',
  'IN_NEGOTIATION',
  'APPROVED',
  'EXPIRED',
  'PROCESSING',
  'FAILED',
  'NEW',
]);

// =============================================================================
// FUNÇÕES
// =============================================================================

/**
 * Traduz um status para PT-BR.
 * NUNCA retorna o código em inglês — se não encontrar, retorna fallback genérico.
 */
export function getStatusLabelPtBR(status: string): string {
  if (!status) return 'Desconhecido';

  const normalized = status.toUpperCase().trim();
  const translated = STATUS_DICTIONARY[normalized];

  if (translated) return translated;

  // Se não encontrou, logar aviso e retornar versão humanizada
  if (import.meta.env.DEV) {
    console.warn(
      `[i18nGuard] ⚠️ Status não mapeado: "${status}". Adicione ao dicionário.`
    );
  }

  // Fallback: converter SNAKE_CASE para "Título Humanizado"
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Traduz uma ação/botão para PT-BR.
 */
export function getActionLabelPtBR(action: string): string {
  const ACTION_DICTIONARY: Record<string, string> = {
    ADVANCE: 'Avançar',
    CANCEL: 'Cancelar',
    CONFIRM: 'Confirmar',
    REJECT: 'Rejeitar',
    ACCEPT: 'Aceitar',
    REPORT_DELIVERY: 'Reportar Entrega',
    CONFIRM_DELIVERY: 'Confirmar Entrega',
    CONFIRM_PAYMENT: 'Confirmar Pagamento',
    MARK_PAID: 'Marcar como Pago',
    RATE: 'Avaliar',
    EDIT: 'Editar',
    DELETE: 'Excluir',
    SAVE: 'Salvar',
    SUBMIT: 'Enviar',
    REFRESH: 'Atualizar',
    RETRY: 'Tentar Novamente',
    CLOSE: 'Fechar',
    VIEW: 'Visualizar',
    TRACK: 'Rastrear',
    NAVIGATE: 'Navegar',
  };

  const normalized = action.toUpperCase().trim();
  return ACTION_DICTIONARY[normalized] || action;
}

/**
 * Verifica se um texto contém termos em inglês proibidos.
 * Retorna os termos encontrados (vazio se seguro).
 */
export function detectForbiddenTerms(text: string): string[] {
  if (!text) return [];

  const found: string[] = [];
  const words = text.split(/[\s,;.:!?\-_/\\()\[\]{}]+/);

  for (const word of words) {
    const upper = word.toUpperCase().trim();
    if (FORBIDDEN_ENGLISH_TERMS.has(upper) && upper === word.toUpperCase()) {
      // Verificar se é realmente o código cru (não parte de uma frase PT-BR)
      if (word === upper || word === word.toUpperCase()) {
        found.push(word);
      }
    }
  }

  return found;
}

/**
 * Sanitiza texto para exibição, substituindo termos em inglês por PT-BR.
 * Use como último recurso em componentes que renderizam strings dinâmicas.
 */
export function sanitizeForDisplay(text: string): string {
  if (!text) return '';

  let sanitized = text;

  // Substituir termos proibidos pelo equivalente PT-BR
  for (const [english, portuguese] of Object.entries(STATUS_DICTIONARY)) {
    // Só substituir se for uma palavra inteira (com delimitadores)
    const regex = new RegExp(`\\b${english}\\b`, 'g');
    sanitized = sanitized.replace(regex, portuguese);
  }

  return sanitized;
}

/**
 * Valida que um componente não está renderizando status cru em inglês.
 * Em DEV, loga erro. Em produção, retorna o texto sanitizado silenciosamente.
 */
export function guardStatusDisplay(rawStatus: string): string {
  const translated = getStatusLabelPtBR(rawStatus);

  // Se o input é um código puro (todo maiúsculo com underscore)
  if (/^[A-Z_]+$/.test(rawStatus) && rawStatus.length > 2) {
    if (import.meta.env.DEV) {
      console.error(
        `[i18nGuard] 🚨 Status cru renderizado: "${rawStatus}" → Traduzido para: "${translated}". Corrija o componente para usar getStatusLabelPtBR().`
      );
    }
  }

  return translated;
}
