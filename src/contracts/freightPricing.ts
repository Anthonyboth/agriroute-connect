/**
 * src/contracts/freightPricing.ts
 * 
 * CONTRATO IMUTÁVEL DE TIPOS DE PRECIFICAÇÃO DO AGRIROUTE.
 * 
 * 3 TIPOS — REGRA IMUTÁVEL:
 * 1) PER_VEHICLE → exibir SEMPRE R$ X/veíc (unit_rate cheio). NUNCA dividir por carretas.
 * 2) PER_KM     → exibir SEMPRE R$ X/km como principal.
 * 3) PER_TON    → exibir SEMPRE R$ X/ton como principal.
 */

export type PricingType = 'PER_VEHICLE' | 'PER_KM' | 'PER_TON';

export interface FreightPricingInput {
  id: string;
  pricing_type: PricingType;
  /** Valor unitário: R$/veíc, R$/km, ou R$/ton — conforme pricing_type */
  unit_rate: number;
  /** Distância em km (opcional, para info secundária) */
  distance_km?: number | null;
  /** Peso em toneladas (opcional, para info secundária) */
  weight_ton?: number | null;
  /** Número de veículos (opcional, para info secundária) */
  required_trucks?: number | null;
}

export interface FreightPricingDisplay {
  ok: boolean;
  primaryText: string;
  secondaryText: string | null;
  type: PricingType | null;
  unitRate: number;
}

/** Sufixos canônicos por tipo */
export const PRICING_SUFFIX: Record<PricingType, string> = {
  PER_VEHICLE: '/veíc',
  PER_KM: '/km',
  PER_TON: '/ton',
};
