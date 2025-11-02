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

export interface WeightValidationResult {
  isValid: boolean;
  weightKg: number;
  weightTonnes: number;
  formatted: string;
  errors: string[];
  warnings: string[];
}

/**
 * Converte peso digitado (em toneladas) para kg
 * Ex: 300 toneladas = 300.000 kg
 */
export const convertWeightToKg = (weightInTonnes: number): number => {
  return weightInTonnes * 1000;
};

/**
 * Valida e formata peso com limites realistas
 * Input: toneladas (como o sistema atual espera)
 */
export const validateWeight = (
  weightInput: number | string
): WeightValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  const weightTonnes = parseFloat(String(weightInput));
  
  // Validações
  if (isNaN(weightTonnes)) {
    errors.push('Peso inválido. Digite apenas números.');
  }
  
  if (weightTonnes <= 0) {
    errors.push('Peso deve ser maior que zero.');
  }
  
  // Limites realistas para carretas brasileiras
  const MIN_WEIGHT_TONNES = 0.1;  // 100kg mínimo
  const MAX_WEIGHT_TONNES = 50;   // 50 toneladas máximo por carreta
  
  if (weightTonnes < MIN_WEIGHT_TONNES && weightTonnes > 0) {
    errors.push(`Peso mínimo: ${MIN_WEIGHT_TONNES} toneladas (100kg).`);
  }
  
  if (weightTonnes > MAX_WEIGHT_TONNES) {
    errors.push(`Peso máximo: ${MAX_WEIGHT_TONNES} toneladas (50.000kg) por carreta.`);
  }
  
  // Warnings para valores suspeitos
  if (weightTonnes > 1000 && weightTonnes <= MAX_WEIGHT_TONNES * 1000) {
    warnings.push('⚠️ Você digitou TONELADAS? Este valor parece muito alto.');
  }
  
  if (weightTonnes < 1 && weightTonnes > 0) {
    warnings.push(`💡 Peso baixo (${weightTonnes} ton = ${weightTonnes * 1000}kg). Confirme se está correto.`);
  }
  
  const weightKg = convertWeightToKg(weightTonnes);
  
  return {
    isValid: errors.length === 0,
    weightKg,
    weightTonnes,
    formatted: formatWeight(weightKg),
    errors,
    warnings
  };
};

/**
 * Formata peso de forma consistente
 */
export const formatWeight = (weightKg: number): string => {
  if (weightKg >= 1000) {
    const tonnes = weightKg / 1000;
    return `${tonnes.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ton`;
  }
  return `${weightKg.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} kg`;
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
