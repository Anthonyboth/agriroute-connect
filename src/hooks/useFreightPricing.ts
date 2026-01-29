/**
 * Hook centralizado para cálculos de preços de frete
 * 
 * REGRA DE NEGÓCIO CRÍTICA:
 * - O valor acordado entre motorista e produtor (agreed_price) em freight_assignments
 *   é a fonte da verdade para pagamentos, cards, histórico e relatórios.
 * - Para fretes multi-carreta, cada motorista tem seu próprio agreed_price no assignment.
 * - O campo freights.price é apenas o valor base/proposto pelo produtor.
 * - NUNCA divida freights.price por required_trucks para obter o valor do motorista.
 * - USE freight_assignments.agreed_price diretamente.
 */

export interface FreightPricingData {
  // Valor base do frete (proposto pelo produtor)
  basePrice: number;
  // Número de carretas necessárias
  requiredTrucks: number;
  // Valor acordado com o motorista (do assignment) - FONTE DA VERDADE
  agreedPrice: number | null;
  // Distância em km (para cálculos por km)
  distanceKm: number | null;
  // Peso em toneladas (para cálculos por tonelada)
  weightTons: number | null;
}

export interface PricingResult {
  // Valor a ser exibido para o motorista
  driverPrice: number;
  // Valor total do frete (para o produtor)
  totalPrice: number;
  // Preço por km (se aplicável)
  pricePerKm: number | null;
  // Preço por tonelada (se aplicável)
  pricePerTon: number | null;
  // Se é multi-carreta
  isMultiTruck: boolean;
  // Label formatado para exibição
  formattedDriverPrice: string;
  formattedTotalPrice: string;
}

/**
 * Calcula os preços de um frete
 * 
 * @param data Dados do frete e assignment
 * @returns Resultado com todos os valores calculados
 */
export function calculateFreightPricing(data: FreightPricingData): PricingResult {
  const {
    basePrice,
    requiredTrucks,
    agreedPrice,
    distanceKm,
    weightTons
  } = data;

  const isMultiTruck = (requiredTrucks || 1) > 1;
  
  // REGRA CRÍTICA: O valor do motorista é o agreed_price do assignment
  // Se não tiver assignment, usa o basePrice dividido (fallback)
  const driverPrice = agreedPrice !== null && agreedPrice > 0
    ? agreedPrice
    : basePrice / Math.max(requiredTrucks || 1, 1);

  const totalPrice = basePrice;

  const pricePerKm = distanceKm && distanceKm > 0
    ? driverPrice / distanceKm
    : null;

  const pricePerTon = weightTons && weightTons > 0
    ? driverPrice / weightTons
    : null;

  const formatBRL = (value: number): string => {
    return `R$ ${value.toLocaleString('pt-BR', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  };

  return {
    driverPrice,
    totalPrice,
    pricePerKm,
    pricePerTon,
    isMultiTruck,
    formattedDriverPrice: formatBRL(driverPrice),
    formattedTotalPrice: formatBRL(totalPrice)
  };
}

/**
 * Hook para usar o cálculo de preços em componentes React
 */
export function useFreightPricing(data: FreightPricingData | null): PricingResult | null {
  if (!data) return null;
  return calculateFreightPricing(data);
}

/**
 * Extrai dados de pricing de um objeto de frete com assignment
 */
export function extractPricingData(
  freight: {
    price?: number;
    required_trucks?: number;
    distance_km?: number;
    weight?: number;
  },
  assignment?: {
    agreed_price?: number;
  } | null
): FreightPricingData {
  return {
    basePrice: freight.price || 0,
    requiredTrucks: freight.required_trucks || 1,
    agreedPrice: assignment?.agreed_price ?? null,
    distanceKm: freight.distance_km ?? null,
    weightTons: freight.weight ?? null
  };
}

/**
 * Retorna o valor correto para criar um external_payment
 * 
 * DEVE SER USADO NO TRIGGER DO BANCO E EM QUALQUER LUGAR QUE CRIE PAGAMENTOS
 */
export function getPaymentAmount(
  agreedPrice: number | null,
  freightPrice: number,
  requiredTrucks: number
): number {
  // Prioridade 1: agreed_price do assignment
  if (agreedPrice !== null && agreedPrice > 0) {
    return agreedPrice;
  }
  
  // Fallback: divide o preço base pelo número de carretas
  return freightPrice / Math.max(requiredTrucks || 1, 1);
}
