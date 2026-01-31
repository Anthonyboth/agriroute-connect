/**
 * Hook para gerenciar expiração automática de fretes e serviços
 * 
 * REGRAS DE EXPIRAÇÃO (baseado em tempo de anúncio):
 * - GUINCHO: 2 horas
 * - FRETE_MOTO: 4 horas
 * - Fretes urbanos: 24 horas
 * - MUDANÇA: 48 horas
 * - CARGA (rural/rodoviário): 72 horas
 * - Serviços: 7 dias
 * 
 * REGRA CRÍTICA: Apenas itens NÃO ACEITOS podem ser cancelados automaticamente!
 * Após aceito ou agendado, apenas o usuário pode cancelar manualmente.
 * 
 * ORDENAÇÃO: Itens são ordenados por tempo restante (menor primeiro).
 * Itens próximos de vencer aparecem no topo, recém-postados aparecem embaixo.
 */

import { useMemo, useCallback } from 'react';

// Configuração de expiração por tipo de serviço (em horas)
export const EXPIRATION_CONFIG = {
  // Fretes
  GUINCHO: { hours: 2, label: '2 horas' },
  FRETE_MOTO: { hours: 4, label: '4 horas' },
  FRETE_URBANO: { hours: 24, label: '24 horas' },
  MUDANCA: { hours: 48, label: '48 horas' },
  MUDANCA_RESIDENCIAL: { hours: 48, label: '48 horas' },
  MUDANCA_COMERCIAL: { hours: 48, label: '48 horas' },
  CARGA: { hours: 72, label: '72 horas' },
  // Serviços
  SERVICE: { hours: 168, label: '7 dias' }, // 7 dias = 168 horas
} as const;

// Status que permitem cancelamento automático (não aceitos)
const AUTO_CANCEL_STATUSES = ['OPEN', 'IN_NEGOTIATION'];

export interface ExpirationInfo {
  expiresAt: Date;
  timeRemaining: number; // em milissegundos
  timeRemainingFormatted: string;
  isExpired: boolean;
  canAutoCancel: boolean;
  expirationLabel: string;
}

/**
 * Obtém as horas de expiração baseado no tipo de serviço
 */
export function getExpirationHours(serviceType: string | null | undefined): number {
  if (!serviceType) return EXPIRATION_CONFIG.CARGA.hours;
  
  const normalizedType = serviceType.toUpperCase().trim();
  
  // Verificar tipo específico primeiro
  const config = EXPIRATION_CONFIG[normalizedType as keyof typeof EXPIRATION_CONFIG];
  if (config) return config.hours;
  
  // Fallback: verificar se contém palavras-chave
  if (normalizedType.includes('GUINCHO')) return EXPIRATION_CONFIG.GUINCHO.hours;
  if (normalizedType.includes('MOTO')) return EXPIRATION_CONFIG.FRETE_MOTO.hours;
  if (normalizedType.includes('MUDANCA') || normalizedType.includes('MUDANÇA')) {
    return EXPIRATION_CONFIG.MUDANCA.hours;
  }
  if (normalizedType.includes('URBANO')) return EXPIRATION_CONFIG.FRETE_URBANO.hours;
  
  // Default: CARGA para fretes, SERVICE para serviços
  return EXPIRATION_CONFIG.CARGA.hours;
}

/**
 * Obtém o label de expiração baseado no tipo de serviço
 */
export function getExpirationLabel(serviceType: string | null | undefined): string {
  if (!serviceType) return EXPIRATION_CONFIG.CARGA.label;
  
  const normalizedType = serviceType.toUpperCase().trim();
  const config = EXPIRATION_CONFIG[normalizedType as keyof typeof EXPIRATION_CONFIG];
  
  if (config) return config.label;
  
  // Fallback baseado em palavras-chave
  if (normalizedType.includes('GUINCHO')) return EXPIRATION_CONFIG.GUINCHO.label;
  if (normalizedType.includes('MOTO')) return EXPIRATION_CONFIG.FRETE_MOTO.label;
  if (normalizedType.includes('MUDANCA') || normalizedType.includes('MUDANÇA')) {
    return EXPIRATION_CONFIG.MUDANCA.label;
  }
  if (normalizedType.includes('URBANO')) return EXPIRATION_CONFIG.FRETE_URBANO.label;
  
  return EXPIRATION_CONFIG.CARGA.label;
}

/**
 * Formata o tempo restante em texto legível
 */
export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return 'Expirado';
  
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    const remainingHours = hours % 24;
    return days === 1 
      ? `${days} dia${remainingHours > 0 ? ` e ${remainingHours}h` : ''}`
      : `${days} dias${remainingHours > 0 ? ` e ${remainingHours}h` : ''}`;
  }
  
  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes > 0 ? ` ${remainingMinutes}min` : ''}`;
  }
  
  if (minutes > 0) {
    return `${minutes} minuto${minutes !== 1 ? 's' : ''}`;
  }
  
  return `${seconds} segundo${seconds !== 1 ? 's' : ''}`;
}

/**
 * Calcula informações de expiração para um item
 */
export function calculateExpirationInfo(
  createdAt: string | Date,
  status: string,
  serviceType: string | null | undefined,
  isService: boolean = false
): ExpirationInfo {
  const createdDate = new Date(createdAt);
  const expirationHours = isService 
    ? EXPIRATION_CONFIG.SERVICE.hours 
    : getExpirationHours(serviceType);
  
  const expiresAt = new Date(createdDate.getTime() + expirationHours * 60 * 60 * 1000);
  const now = new Date();
  const timeRemaining = expiresAt.getTime() - now.getTime();
  
  const normalizedStatus = status?.toUpperCase().trim() || '';
  const canAutoCancel = AUTO_CANCEL_STATUSES.includes(normalizedStatus);
  
  return {
    expiresAt,
    timeRemaining: Math.max(0, timeRemaining),
    timeRemainingFormatted: formatTimeRemaining(timeRemaining),
    isExpired: timeRemaining <= 0,
    canAutoCancel,
    expirationLabel: isService 
      ? EXPIRATION_CONFIG.SERVICE.label 
      : getExpirationLabel(serviceType),
  };
}

/**
 * Calcula o tempo restante em milissegundos para um item
 * Usado para ordenação - itens com menor tempo restante aparecem primeiro
 */
export function getTimeRemainingMs(
  createdAt: string | Date | null | undefined,
  serviceType: string | null | undefined,
  isService: boolean = false
): number {
  if (!createdAt) return Number.MAX_SAFE_INTEGER; // Itens sem data vão para o final
  
  const createdDate = new Date(createdAt);
  if (isNaN(createdDate.getTime())) return Number.MAX_SAFE_INTEGER;
  
  const expirationHours = isService 
    ? EXPIRATION_CONFIG.SERVICE.hours 
    : getExpirationHours(serviceType);
  
  const expiresAt = createdDate.getTime() + expirationHours * 60 * 60 * 1000;
  const now = Date.now();
  
  return Math.max(0, expiresAt - now);
}

/**
 * Interface genérica para itens que podem ser ordenados por expiração
 */
export interface ExpirableItem {
  created_at?: string | Date | null;
  createdAt?: string | Date | null;
  service_type?: string | null;
  serviceType?: string | null;
  cargo_type?: string | null;
  cargoType?: string | null;
  type?: string | null;
}

/**
 * Extrai o tipo de serviço de um item (suporta múltiplos formatos de propriedade)
 */
function extractServiceType(item: ExpirableItem): string | null | undefined {
  return item.service_type || item.serviceType || item.cargo_type || item.cargoType || item.type;
}

/**
 * Extrai a data de criação de um item (suporta múltiplos formatos de propriedade)
 */
function extractCreatedAt(item: ExpirableItem): string | Date | null | undefined {
  return item.created_at || item.createdAt;
}

/**
 * Determina se um item é um serviço (não um frete)
 */
function isServiceItem(item: ExpirableItem): boolean {
  const serviceType = extractServiceType(item);
  if (!serviceType) return false;
  
  const normalized = serviceType.toUpperCase().trim();
  
  // Serviços agrícolas, mecânicos, etc. - não são fretes
  return normalized.includes('SERVICO') || 
         normalized.includes('SERVIÇO') ||
         normalized === 'SERVICE' ||
         normalized.includes('AGRICOLA') ||
         normalized.includes('MECANICO');
}

/**
 * Ordena um array de itens por tempo de expiração (menor primeiro)
 * Itens próximos de vencer aparecem no topo, recém-postados aparecem embaixo
 */
export function sortByExpiration<T extends ExpirableItem>(
  items: T[],
  forceIsService?: boolean
): T[] {
  if (!items || items.length === 0) return [];
  
  return [...items].sort((a, b) => {
    const isServiceA = forceIsService !== undefined ? forceIsService : isServiceItem(a);
    const isServiceB = forceIsService !== undefined ? forceIsService : isServiceItem(b);
    
    const timeA = getTimeRemainingMs(extractCreatedAt(a), extractServiceType(a), isServiceA);
    const timeB = getTimeRemainingMs(extractCreatedAt(b), extractServiceType(b), isServiceB);
    
    // Menor tempo restante primeiro (mais urgente no topo)
    return timeA - timeB;
  });
}

/**
 * Hook para obter informações de expiração de um frete ou serviço
 */
export function useItemExpiration(
  createdAt: string | Date | null | undefined,
  status: string | null | undefined,
  serviceType: string | null | undefined,
  isService: boolean = false
): ExpirationInfo | null {
  return useMemo(() => {
    if (!createdAt || !status) return null;
    
    return calculateExpirationInfo(createdAt, status, serviceType, isService);
  }, [createdAt, status, serviceType, isService]);
}

/**
 * Hook para verificar se um item pode ser cancelado automaticamente
 * Retorna true apenas se o item ainda não foi aceito
 */
export function useCanAutoCancel(status: string | null | undefined): boolean {
  return useMemo(() => {
    if (!status) return false;
    const normalizedStatus = status.toUpperCase().trim();
    return AUTO_CANCEL_STATUSES.includes(normalizedStatus);
  }, [status]);
}

/**
 * Hook para ordenar itens por tempo de expiração
 * Retorna os itens ordenados com os mais urgentes primeiro
 */
export function useSortByExpiration<T extends ExpirableItem>(
  items: T[] | null | undefined,
  forceIsService?: boolean
): T[] {
  return useMemo(() => {
    if (!items || items.length === 0) return [];
    return sortByExpiration(items, forceIsService);
  }, [items, forceIsService]);
}

/**
 * Hook que retorna uma função de ordenação memoizada
 * Útil para cenários onde você precisa ordenar múltiplas listas
 */
export function useSortByExpirationFn<T extends ExpirableItem>(): (
  items: T[],
  forceIsService?: boolean
) => T[] {
  return useCallback((items: T[], forceIsService?: boolean) => {
    return sortByExpiration(items, forceIsService);
  }, []);
}

/**
 * Verifica se um status permite cancelamento automático
 */
export function canBeAutoCancelled(status: string | null | undefined): boolean {
  if (!status) return false;
  const normalizedStatus = status.toUpperCase().trim();
  return AUTO_CANCEL_STATUSES.includes(normalizedStatus);
}

/**
 * Obtém mensagem de expiração para exibição
 */
export function getExpirationMessage(
  serviceType: string | null | undefined,
  isService: boolean = false
): string {
  const label = isService 
    ? EXPIRATION_CONFIG.SERVICE.label 
    : getExpirationLabel(serviceType);
  
  return `Este anúncio expira em ${label} se não for aceito`;
}
