/**
 * ========================================================================
 * REGRAS CENTRALIZADAS DE FRETES EM ANDAMENTO
 * ========================================================================
 * 
 * Este arquivo define as regras de negócio padrão para fretes rurais
 * em toda a plataforma AgriRoute. Qualquer alteração aqui deve ser
 * refletida automaticamente em todos os hooks e componentes.
 * 
 * Documentado em:
 * - memory/features/freight-in-progress-status-logic-standard
 * - memory/features/freight-status-progression-workflow
 * - memory/features/driver-ongoing-card-standard
 * - memory/business/freight-concurrency-rules-by-role
 * - memory/database/multi-truck-freight-capacity-logic
 */

// ========================================================================
// STATUS DE FRETE EM ANDAMENTO
// ========================================================================

/**
 * Status que definem um frete como "Em Andamento" para motoristas.
 * Inclui DELIVERED_PENDING_CONFIRMATION até que seja confirmado pelo produtor.
 */
export const FREIGHT_ONGOING_STATUSES = [
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION',
] as const;

/**
 * Status que definem um frete como "Em Andamento" para o produtor.
 * Não inclui DELIVERED_PENDING_CONFIRMATION pois o produtor ainda precisa confirmar.
 */
export const FREIGHT_ONGOING_STATUSES_PRODUCER = [
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
] as const;

/**
 * Status de assignments que devem aparecer na aba "Em Andamento" do motorista.
 * Inclui PENDING para assignments que ainda precisam ser aceitos.
 */
export const ASSIGNMENT_ONGOING_STATUSES = [
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION',
  'PENDING',
] as const;

/**
 * Status que permitem que um motorista atualize o progresso da viagem.
 * Usado no RPC 'update_trip_progress' e 'driver_update_freight_status'.
 */
export const DRIVER_UPDATABLE_STATUSES = [
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
] as const;

// ========================================================================
// FLUXO DE PROGRESSÃO DE STATUS
// ========================================================================

/**
 * Workflow sequencial obrigatório para progressão de status do motorista.
 * Cada status só pode avançar para o próximo na sequência.
 */
export const STATUS_PROGRESSION_WORKFLOW = {
  ACCEPTED: 'LOADING',
  LOADING: 'LOADED',
  LOADED: 'IN_TRANSIT',
  IN_TRANSIT: 'DELIVERED_PENDING_CONFIRMATION',
  DELIVERED_PENDING_CONFIRMATION: 'DELIVERED', // Apenas produtor pode confirmar
} as const;

/**
 * Labels amigáveis para os botões de progressão de status.
 */
export const STATUS_BUTTON_LABELS: Record<string, string> = {
  ACCEPTED: 'A caminho da coleta',
  LOADING: 'Carregado',
  LOADED: 'Em trânsito',
  IN_TRANSIT: 'Reportar Entrega',
};

/**
 * Retorna o próximo status no workflow de progressão.
 */
export function getNextStatus(currentStatus: string): string | null {
  const normalized = currentStatus.toUpperCase().trim();
  return STATUS_PROGRESSION_WORKFLOW[normalized as keyof typeof STATUS_PROGRESSION_WORKFLOW] || null;
}

/**
 * Retorna o label do botão para avançar para o próximo status.
 */
export function getStatusButtonLabel(currentStatus: string): string | null {
  const normalized = currentStatus.toUpperCase().trim();
  return STATUS_BUTTON_LABELS[normalized] || null;
}

// ========================================================================
// REGRAS DE MULTI-CARRETA (Multi-Truck)
// ========================================================================

/**
 * Para fretes multi-carreta (required_trucks > 1), o status 'OPEN' 
 * também é incluído na aba 'Em Andamento' para:
 * - Motoristas atribuídos (via freight_assignments)
 * - Produtores se accepted_trucks > 0
 */
export const MULTI_TRUCK_OPEN_INCLUDED_STATUSES = [
  'OPEN',
  ...FREIGHT_ONGOING_STATUSES,
] as const;

/**
 * Verifica se um frete deve aparecer na aba "Em Andamento" considerando
 * regras de multi-carreta.
 */
export function isFreightOngoing(
  status: string,
  requiredTrucks: number = 1,
  acceptedTrucks: number = 0,
  isDriverAssigned: boolean = false
): boolean {
  const normalized = status.toUpperCase().trim();
  
  // Status padrão de "Em Andamento"
  if (FREIGHT_ONGOING_STATUSES.includes(normalized as any)) {
    return true;
  }
  
  // Multi-carreta: OPEN também conta se há motoristas atribuídos ou carretas aceitas
  if (normalized === 'OPEN' && requiredTrucks > 1) {
    return isDriverAssigned || acceptedTrucks > 0;
  }
  
  return false;
}

// ========================================================================
// REGRAS DE CONCORRÊNCIA POR PAPEL (Role)
// ========================================================================

/**
 * Limite de fretes ativos simultâneos por tipo de usuário.
 * - Motoristas (autônomos ou afiliados): 1 frete ativo
 * - Transportadoras: Ilimitado (gestão de frota)
 */
export const CONCURRENT_FREIGHT_LIMITS = {
  MOTORISTA: 1,
  MOTORISTA_AFILIADO: 1,
  TRANSPORTADORA: Infinity,
} as const;

/**
 * Verifica se um motorista pode aceitar um novo frete.
 */
export function canDriverAcceptNewFreight(
  currentActiveFreights: number,
  role: 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'TRANSPORTADORA' = 'MOTORISTA'
): boolean {
  const limit = CONCURRENT_FREIGHT_LIMITS[role] || 1;
  return currentActiveFreights < limit;
}

// ========================================================================
// REGRAS DE RASTREAMENTO GPS
// ========================================================================

/**
 * Tempo em segundos sem sinal GPS para considerar motorista "Offline".
 */
export const GPS_OFFLINE_THRESHOLD_SECONDS = 120;

/**
 * Intervalo de atualização de localização em milissegundos.
 */
export const GPS_UPDATE_INTERVAL_MS = 30000;

/**
 * Verifica se a última atualização de GPS está dentro do threshold de "online".
 */
export function isDriverOnline(lastGpsUpdate: string | null | undefined): boolean {
  if (!lastGpsUpdate) return false;
  
  const lastUpdate = new Date(lastGpsUpdate).getTime();
  const now = Date.now();
  const diffSeconds = (now - lastUpdate) / 1000;
  
  return diffSeconds <= GPS_OFFLINE_THRESHOLD_SECONDS;
}

// ========================================================================
// REGRAS DE SERVIÇOS (Guincho, Mudança, etc.)
// ========================================================================

/**
 * Tipos de serviço que aparecem na aba "Em Andamento" do motorista.
 */
export const ONGOING_SERVICE_TYPES = [
  'GUINCHO',
  'MUDANCA',
  'FRETE_URBANO',
  'FRETE_MOTO',
] as const;

/**
 * Status de service_requests que indicam trabalho ativo.
 */
export const SERVICE_ONGOING_STATUSES = [
  'ACCEPTED',
  'ON_THE_WAY',
  'IN_PROGRESS',
] as const;

// ========================================================================
// NORMALIZAÇÃO DE STATUS
// ========================================================================

/**
 * Normaliza uma string de status para formato padrão (uppercase, trimmed).
 * Previne bugs de comparação por inconsistências de formato.
 */
export function normalizeStatus(status: string | null | undefined): string {
  if (!status) return '';
  return status.toUpperCase().trim();
}

/**
 * Compara dois status de forma segura (case-insensitive, trimmed).
 */
export function statusEquals(status1: string | null | undefined, status2: string): boolean {
  return normalizeStatus(status1) === normalizeStatus(status2);
}

/**
 * Verifica se um status está em uma lista (case-insensitive).
 */
export function statusIn(status: string | null | undefined, statusList: readonly string[]): boolean {
  const normalized = normalizeStatus(status);
  return statusList.some(s => s.toUpperCase().trim() === normalized);
}

// ========================================================================
// TIPOS
// ========================================================================

export type FreightOngoingStatus = typeof FREIGHT_ONGOING_STATUSES[number];
export type AssignmentOngoingStatus = typeof ASSIGNMENT_ONGOING_STATUSES[number];
export type ServiceOngoingStatus = typeof SERVICE_ONGOING_STATUSES[number];
export type ServiceType = typeof ONGOING_SERVICE_TYPES[number];
