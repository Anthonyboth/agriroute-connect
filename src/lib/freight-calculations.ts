// Funções centralizadas para cálculo de fretes

export interface FreightCalculationInput {
  pricePerKm?: number;
  fixedPrice?: number;
  distanceKm: number;
  requiredTrucks: number;
  pricingType: 'FIXED' | 'PER_KM';
  anttMinimumPrice?: number;
}

export interface FreightCalculationResult {
  pricePerTruck: number;        // Preço por carreta
  totalPrice: number;            // Preço total (todas as carretas)
  anttMinimumPerTruck?: number;  // ANTT mínimo por carreta
  anttMinimumTotal?: number;     // ANTT mínimo total
  isAboveAnttMinimum: boolean;   // Se está acima do mínimo ANTT
}

/**
 * Converte peso digitado (em toneladas) para kg
 * Ex: 300 toneladas = 300.000 kg
 */
export const convertWeightToKg = (weightInTonnes: number): number => {
  return weightInTonnes * 1000;
};

/**
 * Calcula preço total considerando múltiplas carretas
 * Valores informados são sempre POR CARRETA e multiplicados pelo número de carretas
 */
export const calculateFreightPrice = (input: FreightCalculationInput): FreightCalculationResult => {
  let pricePerTruck: number;
  
  if (input.pricingType === 'FIXED') {
    pricePerTruck = input.fixedPrice || 0;
  } else {
    pricePerTruck = (input.pricePerKm || 0) * input.distanceKm;
  }
  
  const totalPrice = pricePerTruck * input.requiredTrucks;
  
  const result: FreightCalculationResult = {
    pricePerTruck,
    totalPrice,
    isAboveAnttMinimum: true
  };
  
  // Se houver ANTT, validar
  if (input.anttMinimumPrice) {
    result.anttMinimumPerTruck = input.anttMinimumPrice;
    result.anttMinimumTotal = input.anttMinimumPrice * input.requiredTrucks;
    result.isAboveAnttMinimum = totalPrice >= result.anttMinimumTotal;
  }
  
  return result;
};
