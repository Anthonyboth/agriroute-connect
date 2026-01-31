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
 */

import { useMemo } from 'react';

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
