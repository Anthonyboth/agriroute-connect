/**
 * src/lib/formatters.ts
 * 
 * Funções centralizadas de formatação.
 * Use estas funções em vez de formatar inline.
 */

import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ============= NÚMEROS =============

/**
 * Formata quilometragem
 * @param km - valor em km (number ou string)
 * @returns string formatada (ex: "150 km") ou "-" se inválido
 */
export const formatKm = (km: number | string | null | undefined): string => {
  const numValue = Number(km);
  if (!Number.isFinite(numValue)) return '-';
  return `${Math.round(numValue)} km`;
};

/**
 * Formata peso em toneladas
 * @param kg - peso em quilogramas
 * @param decimals - casas decimais (padrão: 1)
 * @returns string formatada (ex: "25.5 t")
 */
export const formatTons = (kg: number | null | undefined, decimals: number = 1): string => {
  if (typeof kg !== 'number' || !Number.isFinite(kg)) return '-';
  const tons = kg / 1000;
  return `${tons.toFixed(decimals)} t`;
};

/**
 * Formata peso em quilogramas
 * @param kg - peso em quilogramas
 * @returns string formatada (ex: "1.500 kg")
 */
export const formatKg = (kg: number | null | undefined): string => {
  if (typeof kg !== 'number' || !Number.isFinite(kg)) return '-';
  return `${kg.toLocaleString('pt-BR')} kg`;
};

// ============= MOEDA =============

/**
 * Formata valor monetário em BRL
 * @param value - valor numérico
 * @param showSymbol - incluir símbolo R$ (padrão: false)
 * @returns string formatada (ex: "1.500,00" ou "R$ 1.500,00")
 */
export const formatBRL = (
  value: number | null | undefined, 
  showSymbol: boolean = false
): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  
  const formatted = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  
  return showSymbol ? `R$ ${formatted}` : formatted;
};

/**
 * Formata valor monetário com símbolo
 * Alias para formatBRL(value, true)
 */
export const formatCurrency = (value: number | null | undefined): string => {
  return formatBRL(value, true);
};

// ============= PROBLEMA 8: PREÇO POR CARRETA =============

/**
 * Calcula o preço por carreta (dividindo o total pelo número de carretas)
 * @param totalPrice - preço total do frete
 * @param requiredTrucks - número de carretas necessárias
 * @returns preço por carreta individual
 */
export const getPricePerTruck = (
  totalPrice: number | null | undefined, 
  requiredTrucks: number | null | undefined
): number => {
  if (typeof totalPrice !== 'number' || !Number.isFinite(totalPrice)) return 0;
  const trucks = Math.max(requiredTrucks || 1, 1);
  return totalPrice / trucks;
};

/**
 * Formata preço por carreta com indicador
 * @param totalPrice - preço total do frete
 * @param requiredTrucks - número de carretas
 * @param showSymbol - mostrar símbolo R$
 * @returns objeto com preço formatado e indicador se há múltiplas carretas
 */
export const formatPricePerTruck = (
  totalPrice: number | null | undefined,
  requiredTrucks: number | null | undefined,
  showSymbol: boolean = true
): { 
  pricePerTruck: string; 
  totalPrice: string; 
  hasMultipleTrucks: boolean;
  trucksCount: number;
} => {
  const trucks = Math.max(requiredTrucks || 1, 1);
  const perTruck = getPricePerTruck(totalPrice, trucks);
  
  return {
    pricePerTruck: formatBRL(perTruck, showSymbol),
    totalPrice: formatBRL(totalPrice, showSymbol),
    hasMultipleTrucks: trucks > 1,
    trucksCount: trucks
  };
};

// ============= DATAS =============

/**
 * Formata data no formato dd/MM/yyyy
 * @param date - Date, string ISO ou timestamp
 * @returns string formatada (ex: "15/03/2024")
 */
export const formatDate = (date: Date | string | number | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(dateObj, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return '-';
  }
};

/**
 * Formata data com hora no formato dd/MM/yyyy HH:mm
 * @param date - Date, string ISO ou timestamp
 * @returns string formatada (ex: "15/03/2024 14:30")
 */
export const formatDateTime = (date: Date | string | number | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(dateObj, 'dd/MM/yyyy HH:mm', { locale: ptBR });
  } catch {
    return '-';
  }
};

/**
 * Formata data no formato extenso
 * @param date - Date, string ISO ou timestamp
 * @returns string formatada (ex: "15 de março de 2024")
 */
export const formatDateLong = (date: Date | string | number | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    return format(dateObj, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  } catch {
    return '-';
  }
};

/**
 * Formata data relativa (hoje, ontem, etc)
 * @param date - Date, string ISO ou timestamp
 * @returns string formatada
 */
export const formatRelativeDate = (date: Date | string | number | null | undefined): string => {
  if (!date) return '-';
  
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Hoje';
    if (diffDays === 1) return 'Ontem';
    if (diffDays < 7) return `${diffDays} dias atrás`;
    
    return formatDate(dateObj);
  } catch {
    return '-';
  }
};

// ============= ENDEREÇOS =============

/**
 * Formata cidade + estado
 * @param city - nome da cidade
 * @param state - sigla do estado
 * @returns string formatada (ex: "São Paulo - SP")
 */
export const formatCityState = (
  city: string | null | undefined, 
  state: string | null | undefined
): string => {
  if (!city && !state) return '-';
  if (!city) return state || '-';
  if (!state) return city;
  return `${city} - ${state}`;
};

/**
 * Trunca endereço longo
 * @param address - endereço completo
 * @param maxLength - tamanho máximo (padrão: 50)
 * @returns endereço truncado
 */
export const formatAddress = (
  address: string | null | undefined, 
  maxLength: number = 50
): string => {
  if (!address) return '-';
  if (address.length <= maxLength) return address;
  return `${address.substring(0, maxLength)}...`;
};

// ============= TEXTOS =============

/**
 * Capitaliza primeira letra
 */
export const capitalize = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Pluraliza texto baseado em contagem
 */
export const pluralize = (
  count: number, 
  singular: string, 
  plural?: string
): string => {
  if (count === 1) return singular;
  return plural || `${singular}s`;
};

// ============= PRECISÃO GPS =============

/**
 * Verifica se as coordenadas são reais (GPS) ou estimadas
 */
export const isGPSCoordinateReal = (lat: number | null | undefined, lng: number | null | undefined): boolean => {
  return lat !== null && lat !== undefined && lng !== null && lng !== undefined;
};

/**
 * Retorna indicador visual de precisão da distância
 */
export const getDistancePrecisionIndicator = (
  originLat: number | null | undefined,
  originLng: number | null | undefined,
  destLat: number | null | undefined,
  destLng: number | null | undefined
): { isAccurate: boolean; icon: string; tooltip: string } => {
  const originReal = isGPSCoordinateReal(originLat, originLng);
  const destReal = isGPSCoordinateReal(destLat, destLng);
  
  if (originReal && destReal) {
    return {
      isAccurate: true,
      icon: '📍',
      tooltip: 'Distância calculada com GPS preciso'
    };
  }
  
  return {
    isAccurate: false,
    icon: '📌',
    tooltip: 'Distância estimada por endereço'
  };
};

// ============= DEADLINE ENTREGAS =============

/**
 * Calcula tempo restante em horas para deadline de 72h
 */
export const calculateDeliveryDeadline = (deliveredAt: string | null | undefined): {
  hoursRemaining: number;
  isUrgent: boolean; // < 24h
  isCritical: boolean; // < 6h
  displayText: string;
} => {
  if (!deliveredAt) {
    return { hoursRemaining: 72, isUrgent: false, isCritical: false, displayText: '72h restantes' };
  }
  
  const deliveredDate = new Date(deliveredAt);
  const deadline = new Date(deliveredDate.getTime() + (72 * 60 * 60 * 1000)); // +72h
  const now = new Date();
  const msRemaining = deadline.getTime() - now.getTime();
  const hoursRemaining = Math.max(0, Math.floor(msRemaining / (1000 * 60 * 60)));
  
  const isUrgent = hoursRemaining < 24;
  const isCritical = hoursRemaining < 6;
  
  let displayText = '';
  if (hoursRemaining === 0) {
    displayText = 'PRAZO EXPIRADO';
  } else if (hoursRemaining < 24) {
    displayText = `${hoursRemaining}h restantes`;
  } else {
    const days = Math.floor(hoursRemaining / 24);
    const hours = hoursRemaining % 24;
    displayText = `${days}d ${hours}h restantes`;
  }
  
  return { hoursRemaining, isUrgent, isCritical, displayText };
};
