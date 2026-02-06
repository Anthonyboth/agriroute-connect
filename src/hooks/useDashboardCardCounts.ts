import { useMemo } from 'react';

/**
 * Hook centralizado para contagens de cards de dashboard.
 * 
 * REGRA FUNDAMENTAL: As contagens dos cards DEVEM ser derivadas dos mesmos
 * arrays de dados que as abas exibem. Nunca buscar contagens separadamente
 * do banco, pois isso causa drift entre card e conteúdo da aba.
 * 
 * Cada dashboard fornece seus arrays de dados e este hook retorna
 * as contagens consistentes para os StatsCards.
 */

// ============================================================
// PRESTADOR DE SERVIÇOS
// ============================================================

interface ProviderRequest {
  id: string;
  status: string;
  provider_id: string | null;
}

interface ProviderCardCountsInput {
  /** Solicitações disponíveis (OPEN, sem provider) */
  availableRequests: ProviderRequest[];
  /** Solicitações próprias do prestador (aceitas, em andamento, concluídas) */
  ownRequests: ProviderRequest[];
}

export interface ProviderCardCounts {
  /** Disponíveis para aceitar (aba "Disponível") */
  available: number;
  /** Em andamento: ACCEPTED + ON_THE_WAY + IN_PROGRESS (aba "Em Andamento") */
  active: number;
  /** Concluídos: COMPLETED (aba "Concluídos") */
  completed: number;
  /** Total de solicitações próprias */
  total: number;
}

const PROVIDER_ACTIVE_STATUSES = new Set([
  'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS',
  'ACEITO', 'A_CAMINHO', 'EM_ANDAMENTO'
]);

const PROVIDER_COMPLETED_STATUSES = new Set([
  'COMPLETED', 'CONCLUIDO'
]);

export function useProviderCardCounts(input: ProviderCardCountsInput): ProviderCardCounts {
  return useMemo(() => {
    const available = input.availableRequests.filter(r => {
      const status = (r.status || '').toUpperCase().trim();
      return !r.provider_id && (status === 'OPEN' || status === 'ABERTO');
    }).length;

    const active = input.ownRequests.filter(r => {
      const status = (r.status || '').toUpperCase().trim();
      return r.provider_id && PROVIDER_ACTIVE_STATUSES.has(status);
    }).length;

    const completed = input.ownRequests.filter(r => {
      const status = (r.status || '').toUpperCase().trim();
      return r.provider_id && PROVIDER_COMPLETED_STATUSES.has(status);
    }).length;

    return {
      available,
      active,
      completed,
      total: input.ownRequests.length,
    };
  }, [input.availableRequests, input.ownRequests]);
}

// ============================================================
// MOTORISTA
// ============================================================

interface DriverCardCountsInput {
  /** Fretes disponíveis para aceitar */
  availableFreights: any[];
  /** Serviços de transporte disponíveis */
  transportRequests: any[];
  /** Fretes diretos em andamento (já filtrados como visibleOngoing) */
  activeDirectFreights: any[];
  /** Assignments multi-carreta ativos (já filtrados) */
  activeAssignments: any[];
  /** Propostas pendentes */
  pendingProposals: any[];
  /** Se pode ver fretes */
  canSeeFreights: boolean;
}

export interface DriverCardCounts {
  /** Disponíveis (fretes + transportes) */
  available: number;
  /** Viagens ativas (diretas + assignments) */
  activeTrips: number;
  /** Propostas pendentes */
  pendingProposals: number;
}

export function useDriverCardCounts(input: DriverCardCountsInput): DriverCardCounts {
  return useMemo(() => ({
    available: input.canSeeFreights 
      ? input.availableFreights.length + input.transportRequests.length 
      : 0,
    activeTrips: input.activeDirectFreights.length + input.activeAssignments.length,
    pendingProposals: input.pendingProposals.length,
  }), [
    input.availableFreights.length,
    input.transportRequests.length,
    input.activeDirectFreights.length,
    input.activeAssignments.length,
    input.pendingProposals.length,
    input.canSeeFreights,
  ]);
}

// ============================================================
// PRODUTOR
// ============================================================

interface ProducerCardCountsInput {
  /** Contagem de fretes abertos (do classificador central) */
  openFreights: number;
  /** Contagem de serviços abertos (do classificador central) */
  openServices: number;
  /** Fretes em andamento */
  activeFreights: number;
  /** Confirmações pendentes de entrega */
  pendingConfirmation: number;
  /** Propostas pendentes */
  pendingProposals: number;
  /** Pagamentos pendentes */
  pendingPayments: number;
}

export interface ProducerCardCounts {
  openFreights: number;
  openServices: number;
  openTotal: number;
  activeFreights: number;
  pendingConfirmation: number;
  pendingProposals: number;
  pendingPayments: number;
}

export function useProducerCardCounts(input: ProducerCardCountsInput): ProducerCardCounts {
  return useMemo(() => ({
    openFreights: input.openFreights,
    openServices: input.openServices,
    openTotal: input.openFreights + input.openServices,
    activeFreights: input.activeFreights,
    pendingConfirmation: input.pendingConfirmation,
    pendingProposals: input.pendingProposals,
    pendingPayments: input.pendingPayments,
  }), [
    input.openFreights,
    input.openServices,
    input.activeFreights,
    input.pendingConfirmation,
    input.pendingProposals,
    input.pendingPayments,
  ]);
}
