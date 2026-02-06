/**
 * src/security/multiTruckPriceGuard.ts
 *
 * Módulo de segurança financeira para fretes multi-carreta.
 * Garante que valores nunca sejam misturados ou exibidos incorretamente.
 *
 * Regras:
 * - freights.price = valor TOTAL do contrato
 * - freight_assignments.agreed_price = valor POR CARRETA (fonte da verdade)
 * - UI do motorista NUNCA vê o valor total em multi-carreta
 * - Qualquer inconsistência é bloqueada com erro
 */

// =============================================================================
// TIPOS
// =============================================================================

export type PriceContext = 'DRIVER' | 'PRODUCER' | 'COMPANY' | 'ADMIN';

export interface PriceGuardInput {
  /** Preço total do frete (freights.price) */
  freightPrice: number | null | undefined;
  /** Número de carretas requeridas */
  requiredTrucks: number | null | undefined;
  /** Preço acordado individual (freight_assignments.agreed_price) */
  agreedPrice: number | null | undefined;
  /** Contexto de quem está visualizando */
  context: PriceContext;
}

export interface PriceGuardResult {
  /** Valor seguro para exibição */
  displayPrice: number;
  /** Label do preço (ex: "por carreta", "total") */
  displayLabel: string;
  /** Se é multi-carreta */
  isMultiTruck: boolean;
  /** Preço formatado em BRL */
  formattedPrice: string;
  /** Se o valor exibido é por carreta */
  isPerTruck: boolean;
  /** Preço total (só para PRODUCER/COMPANY/ADMIN) */
  totalPrice: number | null;
  /** Preço total formatado (null para motoristas em multi-carreta) */
  formattedTotalPrice: string | null;
}

export class PriceGuardError extends Error {
  public readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'PriceGuardError';
    this.code = code;
  }
}

// =============================================================================
// FUNÇÕES
// =============================================================================

/**
 * Formata valor em BRL.
 */
function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Valida que o preço exibido é por carreta para motoristas em multi-carreta.
 * LANÇA ERRO se detectar valor total sendo usado onde deveria ser unitário.
 */
export function assertPriceIsPerTruck(input: {
  displayPrice: number;
  freightPrice: number;
  requiredTrucks: number;
}): void {
  const { displayPrice, freightPrice, requiredTrucks } = input;

  if (requiredTrucks <= 1) return; // Não se aplica a carreta única

  // Se o preço exibido é igual ao preço total do frete, é um erro
  const tolerance = 0.01;
  if (Math.abs(displayPrice - freightPrice) <= tolerance && freightPrice > 0) {
    throw new PriceGuardError(
      `Erro de segurança financeira: valor total (${formatBRL(freightPrice)}) está sendo exibido como unitário em frete multi-carreta (${requiredTrucks} carretas). O valor por carreta deveria ser ${formatBRL(freightPrice / requiredTrucks)}.`,
      'TOTAL_AS_UNIT_PRICE'
    );
  }
}

/**
 * Calcula o preço por carreta de forma segura.
 */
export function getPricePerTruck(input: {
  freightPrice: number | null | undefined;
  requiredTrucks: number | null | undefined;
  agreedPrice: number | null | undefined;
}): number {
  const trucks = Math.max(input.requiredTrucks || 1, 1);

  // Prioridade 1: agreed_price do assignment (fonte da verdade)
  if (typeof input.agreedPrice === 'number' && input.agreedPrice > 0) {
    return input.agreedPrice;
  }

  // Fallback: dividir preço total
  const total = typeof input.freightPrice === 'number' && Number.isFinite(input.freightPrice)
    ? input.freightPrice
    : 0;

  return trucks > 1 ? total / trucks : total;
}

/**
 * Formata o preço para exibição ao usuário correto.
 * Aplica regras de visibilidade por papel.
 */
export function formatPriceForUser(input: PriceGuardInput): PriceGuardResult {
  const trucks = Math.max(input.requiredTrucks || 1, 1);
  const isMultiTruck = trucks > 1;
  const freightPrice = typeof input.freightPrice === 'number' && Number.isFinite(input.freightPrice)
    ? input.freightPrice
    : 0;

  const perTruckPrice = getPricePerTruck({
    freightPrice: input.freightPrice,
    requiredTrucks: input.requiredTrucks,
    agreedPrice: input.agreedPrice,
  });

  switch (input.context) {
    case 'DRIVER': {
      // Motorista NUNCA vê o valor total em multi-carreta
      return {
        displayPrice: perTruckPrice,
        displayLabel: isMultiTruck ? '/carreta' : '',
        isMultiTruck,
        formattedPrice: formatBRL(perTruckPrice),
        isPerTruck: isMultiTruck,
        totalPrice: null, // Escondido do motorista
        formattedTotalPrice: null,
      };
    }

    case 'PRODUCER':
    case 'ADMIN': {
      // Produtor e Admin veem o valor total como primário
      return {
        displayPrice: freightPrice,
        displayLabel: isMultiTruck ? '(total)' : '',
        isMultiTruck,
        formattedPrice: formatBRL(freightPrice),
        isPerTruck: false,
        totalPrice: freightPrice,
        formattedTotalPrice: formatBRL(freightPrice),
      };
    }

    case 'COMPANY': {
      // Transportadora vê total como primário, unitário como secundário
      return {
        displayPrice: freightPrice,
        displayLabel: isMultiTruck ? '(total)' : '',
        isMultiTruck,
        formattedPrice: formatBRL(freightPrice),
        isPerTruck: false,
        totalPrice: freightPrice,
        formattedTotalPrice: formatBRL(freightPrice),
      };
    }

    default: {
      // Fallback seguro: mostrar por carreta (menor exposição)
      return {
        displayPrice: perTruckPrice,
        displayLabel: isMultiTruck ? '/carreta' : '',
        isMultiTruck,
        formattedPrice: formatBRL(perTruckPrice),
        isPerTruck: isMultiTruck,
        totalPrice: null,
        formattedTotalPrice: null,
      };
    }
  }
}

/**
 * Valida consistência de preços antes de salvar/enviar.
 * LANÇA ERRO se detectar inconsistência.
 */
export function validatePriceConsistency(input: {
  freightPrice: number;
  agreedPrice: number;
  requiredTrucks: number;
}): void {
  const { freightPrice, agreedPrice, requiredTrucks } = input;

  if (agreedPrice <= 0) {
    throw new PriceGuardError(
      'O valor acordado por carreta deve ser maior que zero.',
      'AGREED_PRICE_ZERO'
    );
  }

  if (freightPrice <= 0) {
    throw new PriceGuardError(
      'O valor total do frete deve ser maior que zero.',
      'FREIGHT_PRICE_ZERO'
    );
  }

  // Em multi-carreta, o agreed_price não pode ser maior que o total
  if (requiredTrucks > 1 && agreedPrice > freightPrice) {
    throw new PriceGuardError(
      `O valor por carreta (${formatBRL(agreedPrice)}) não pode exceder o valor total do frete (${formatBRL(freightPrice)}).`,
      'UNIT_EXCEEDS_TOTAL'
    );
  }
}
