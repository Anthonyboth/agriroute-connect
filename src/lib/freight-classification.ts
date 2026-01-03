/**
 * Módulo central de classificação de fretes
 * Define regras consistentes para categorizar fretes em todas as telas
 */

import { normalizeFreightStatus } from './freight-status';

// Status considerados "ativos" (frete em andamento)
export const ACTIVE_STATUSES = [
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION'
] as const;

// Status considerados "abertos" (disponível para aceitar)
export const OPEN_STATUSES = [
  'OPEN',
  'IN_NEGOTIATION',
  'PENDING'
] as const;

// Status considerados "finalizados"
export const COMPLETED_STATUSES = [
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED'
] as const;

export type FreightClassification = 'open' | 'active' | 'scheduled' | 'completed';

export interface ClassificationResult {
  classification: FreightClassification;
  isActive: boolean;
  isOpen: boolean;
  isScheduled: boolean;
  isCompleted: boolean;
  daysUntilPickup: number | null;
}

/**
 * Classifica um frete com base no seu status e data de coleta
 */
export function classifyFreight(
  status: string,
  pickupDate: string | null | undefined
): ClassificationResult {
  const normalized = normalizeFreightStatus(status);
  
  // Verificar categoria base
  const isOpen = (OPEN_STATUSES as readonly string[]).includes(normalized);
  const isActive = (ACTIVE_STATUSES as readonly string[]).includes(normalized);
  const isCompleted = (COMPLETED_STATUSES as readonly string[]).includes(normalized);
  
  // Calcular dias até a coleta
  let daysUntilPickup: number | null = null;
  if (pickupDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pickup = new Date(pickupDate);
    pickup.setHours(0, 0, 0, 0);
    
    daysUntilPickup = Math.ceil((pickup.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  // Determinar classificação final
  let classification: FreightClassification;
  
  if (isCompleted) {
    classification = 'completed';
  } else if (isActive) {
    // Fretes ativos com data futura são "agendados" mas ainda contam como ativos
    classification = (daysUntilPickup !== null && daysUntilPickup > 0) ? 'scheduled' : 'active';
  } else if (isOpen) {
    classification = 'open';
  } else {
    // Fallback para status desconhecido
    classification = 'open';
  }
  
  // isScheduled é true quando é ativo E tem data futura
  const isScheduled = isActive && daysUntilPickup !== null && daysUntilPickup > 0;
  
  return {
    classification,
    isActive,
    isOpen,
    isScheduled,
    isCompleted,
    daysUntilPickup,
  };
}

/**
 * Conta fretes por categoria
 */
export function countFreightsByCategory(freights: Array<{ status: string; pickup_date?: string | null }>) {
  const counts = {
    open: 0,
    active: 0,
    scheduled: 0,
    completed: 0,
    total: freights.length,
  };
  
  for (const freight of freights) {
    const result = classifyFreight(freight.status, freight.pickup_date);
    
    if (result.isOpen) counts.open++;
    if (result.isActive) counts.active++;
    if (result.isScheduled) counts.scheduled++;
    if (result.isCompleted) counts.completed++;
  }
  
  return counts;
}

/**
 * Filtra fretes por categoria
 */
export function filterFreightsByCategory(
  freights: Array<{ status: string; pickup_date?: string | null }>,
  category: FreightClassification
) {
  return freights.filter(freight => {
    const result = classifyFreight(freight.status, freight.pickup_date);
    
    switch (category) {
      case 'open':
        return result.isOpen;
      case 'active':
        return result.isActive && !result.isScheduled;
      case 'scheduled':
        return result.isScheduled;
      case 'completed':
        return result.isCompleted;
      default:
        return false;
    }
  });
}

/**
 * Verifica se um frete deve aparecer na aba "Ativos"
 * Inclui tanto fretes em andamento quanto agendados
 */
export function isActiveFreight(status: string, pickupDate?: string | null): boolean {
  const result = classifyFreight(status, pickupDate);
  return result.isActive;
}

/**
 * Verifica se um frete deve aparecer na aba "Agendados"
 * Fretes ativos com data de coleta futura
 */
export function isScheduledFreightClassified(status: string, pickupDate?: string | null): boolean {
  const result = classifyFreight(status, pickupDate);
  return result.isScheduled;
}

/**
 * Verifica se um frete deve aparecer na aba "Abertos"
 */
export function isOpenFreight(status: string): boolean {
  const normalized = normalizeFreightStatus(status);
  return (OPEN_STATUSES as readonly string[]).includes(normalized);
}

/**
 * Verifica se um frete está finalizado
 */
export function isCompletedFreight(status: string): boolean {
  const normalized = normalizeFreightStatus(status);
  return (COMPLETED_STATUSES as readonly string[]).includes(normalized);
}
