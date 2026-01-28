/**
 * src/lib/proposal-utils.ts
 * 
 * Utilitários centralizados para cálculos e formatação de propostas.
 * Garante consistência entre todos os modais e cards de proposta/contra-proposta.
 */

import { formatBRL, formatTons as _formatTons } from './formatters';

// ============= HELPERS DE CARRETAS =============

/**
 * Retorna o número de carretas, garantindo mínimo de 1
 */
export const getRequiredTrucks = (freight: { required_trucks?: number } | null | undefined): number => {
  return Math.max((freight?.required_trucks) || 1, 1);
};

/**
 * Calcula o preço por carreta
 * @param totalPrice - Preço TOTAL do frete
 * @param requiredTrucks - Número de carretas
 * @returns Preço por carreta individual
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
 * Formata preço por carreta com sufixo "/carreta" quando aplicável
 * @param price - Preço individual por carreta
 * @param requiredTrucks - Número de carretas
 * @param showSymbol - Mostrar símbolo R$
 * @returns String formatada (ex: "R$ 5.400,00 /carreta" ou "R$ 5.400,00")
 */
export const formatPricePerTruck = (
  price: number | null | undefined,
  requiredTrucks: number | null | undefined,
  showSymbol: boolean = true
): string => {
  const trucks = Math.max(requiredTrucks || 1, 1);
  const formatted = formatBRL(price, showSymbol);
  if (trucks > 1) {
    return `${formatted} /carreta`;
  }
  return formatted;
};

/**
 * Calcula peso por carreta em kg
 */
export const getWeightPerTruck = (
  totalWeightKg: number | null | undefined,
  requiredTrucks: number | null | undefined
): number => {
  if (typeof totalWeightKg !== 'number' || !Number.isFinite(totalWeightKg)) return 0;
  const trucks = Math.max(requiredTrucks || 1, 1);
  return totalWeightKg / trucks;
};

/**
 * Converte peso em kg para toneladas, já dividido por carretas
 * @param totalWeightKg - Peso TOTAL em kg
 * @param requiredTrucks - Número de carretas
 * @returns Peso em toneladas por carreta
 */
export const getWeightInTons = (
  totalWeightKg: number | null | undefined,
  requiredTrucks: number | null | undefined
): number => {
  const weightPerTruck = getWeightPerTruck(totalWeightKg, requiredTrucks);
  return weightPerTruck / 1000;
};

/**
 * Formata peso em toneladas por carreta
 */
export const formatWeightPerTruck = (
  totalWeightKg: number | null | undefined,
  requiredTrucks: number | null | undefined
): string => {
  const tons = getWeightInTons(totalWeightKg, requiredTrucks);
  const trucks = Math.max(requiredTrucks || 1, 1);
  const formatted = _formatTons(totalWeightKg ? totalWeightKg / trucks : 0);
  if (trucks > 1) {
    return `${formatted} /carreta`;
  }
  return formatted;
};

// ============= CÁLCULO DE PREÇO FINAL =============

export type PricingType = 'FIXED' | 'PER_KM' | 'PER_TON';

export interface ComputeFinalPriceParams {
  pricingType: PricingType;
  fixedPrice?: number;
  pricePerKm?: number;
  pricePerTon?: number;
  distanceKm: number;
  weightTons: number; // ✅ Peso em toneladas POR CARRETA (já dividido)
}

/**
 * Calcula o preço final da proposta baseado no tipo de precificação
 * IMPORTANTE: weightTons deve ser o peso POR CARRETA, não o total
 * 
 * @returns Preço final POR CARRETA
 */
export const computeFinalPrice = ({
  pricingType,
  fixedPrice = 0,
  pricePerKm = 0,
  pricePerTon = 0,
  distanceKm,
  weightTons,
}: ComputeFinalPriceParams): number => {
  switch (pricingType) {
    case 'PER_KM':
      return pricePerKm * distanceKm;
    case 'PER_TON':
      return pricePerTon * weightTons;
    case 'FIXED':
    default:
      return fixedPrice;
  }
};

// ============= VALIDAÇÕES =============

export interface PricingValidation {
  isValid: boolean;
  errorMessage?: string;
}

/**
 * Valida se o tipo de precificação pode ser usado com os dados disponíveis
 */
export const validatePricingType = (
  pricingType: PricingType,
  distanceKm: number,
  weightTons: number
): PricingValidation => {
  if (pricingType === 'PER_KM' && distanceKm <= 0) {
    return {
      isValid: false,
      errorMessage: 'Para proposta por KM, o frete precisa ter a distância configurada.'
    };
  }
  
  if (pricingType === 'PER_TON' && weightTons <= 0) {
    return {
      isValid: false,
      errorMessage: 'Para proposta por tonelada, o frete precisa ter o peso configurado.'
    };
  }
  
  return { isValid: true };
};

// ============= MENSAGEM DE PROPOSTA =============

export interface ProposalMessageParams {
  pricingType: PricingType;
  finalPrice: number;
  pricePerKm?: number;
  pricePerTon?: number;
  distanceKm?: number;
  weightTons?: number;
  requiredTrucks: number;
  customMessage?: string;
  isCounterProposal?: boolean;
}

/**
 * Gera a mensagem formatada para proposta/contra-proposta
 */
export const generateProposalMessage = ({
  pricingType,
  finalPrice,
  pricePerKm,
  pricePerTon,
  distanceKm,
  weightTons,
  requiredTrucks,
  customMessage,
  isCounterProposal = false,
}: ProposalMessageParams): string => {
  const hasMultipleTrucks = requiredTrucks > 1;
  const prefix = hasMultipleTrucks ? `[Proposta para 1 carreta] ` : '';
  const type = isCounterProposal ? 'CONTRA-PROPOSTA' : 'PROPOSTA';
  
  let priceInfo = formatBRL(finalPrice, true);
  
  if (pricingType === 'PER_KM' && pricePerKm) {
    priceInfo = `R$ ${pricePerKm.toLocaleString('pt-BR')}/km (Total: ${formatBRL(finalPrice, true)} para ${distanceKm} km)`;
  } else if (pricingType === 'PER_TON' && pricePerTon) {
    priceInfo = `R$ ${pricePerTon.toLocaleString('pt-BR')}/ton (Total: ${formatBRL(finalPrice, true)} para ${weightTons?.toFixed(1)} ton)`;
  }
  
  const message = `${prefix}${type}: ${priceInfo}`;
  
  if (customMessage?.trim()) {
    return `${message}\n\n${customMessage.trim()}`;
  }
  
  return message;
};

// ============= VERIFICAÇÃO DE MÚLTIPLAS CARRETAS =============

/**
 * Verifica se o frete tem múltiplas carretas
 */
export const hasMultipleTrucks = (freight: { required_trucks?: number } | null | undefined): boolean => {
  return getRequiredTrucks(freight) > 1;
};
