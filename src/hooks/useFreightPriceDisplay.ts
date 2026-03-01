/**
 * Hook/helper centralizado para exibição de preços nos cards de frete.
 * 
 * DELEGA ao contrato canônico em src/lib/freightPriceContract.ts
 * Mantém a interface existente para compatibilidade com componentes que já usam.
 * 
 * REGRA CRÍTICA — PREÇO POR VEÍCULO:
 * O motorista/transportadora sempre vê o preço UNITÁRIO por veículo.
 * - PER_KM → "R$ X,XX/km" (taxa unitária do produtor)
 * - PER_TON → "R$ X,XX/ton" (taxa unitária do produtor)
 * - FIXED → "R$ X.XXX,XX/veículo" (price / required_trucks)
 * 
 * PROIBIÇÕES:
 * - NUNCA exibir total agregado ("Total (N carretas): R$ X") em cards
 * - NUNCA inventar unidade quando pricing_type ausente
 */

import { useMemo } from 'react';
import {
  getCanonicalFreightPrice,
  normalizePricingType,
  type FreightPricingInput,
  type PricingType,
} from '@/lib/freightPriceContract';
import { formatBRL } from '@/lib/formatters';

export type { PricingType } from '@/lib/freightPriceContract';
export { normalizePricingType };

const VALID_PRICING_TYPES: readonly string[] = ['FIXED', 'PER_KM', 'PER_TON'] as const;

/** Validates and returns a PricingType or null if invalid/missing */
export function validatePricingType(value: unknown): PricingType | null {
  if (typeof value === 'string' && VALID_PRICING_TYPES.includes(value)) {
    return value as PricingType;
  }
  return null;
}

export interface FreightPriceDisplayInput {
  price: number;
  pricing_type?: PricingType | string | null;
  price_per_km?: number | null;
  price_per_ton?: number | null;
  required_trucks?: number;
  accepted_trucks?: number;
  distance_km?: number;
  weight?: number;
}

export interface FreightPriceDisplay {
  primaryValue: number;
  primaryFormatted: string;
  primarySuffix: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  unitRateLabel: string;
  unitRateValue: number | null;
  unitRateFormatted: string;
  unitRateColorClass: string;
  isUnitPricing: boolean;
  pricingType: PricingType;
  isPricingTypeInvalid: boolean;
}

/**
 * Bridge: converts canonical contract result to legacy FreightPriceDisplay shape.
 * This ensures ALL components get the same canonical output.
 */
export function getFreightPriceDisplay(freight: FreightPriceDisplayInput): FreightPriceDisplay {
  const canonical = getCanonicalFreightPrice({
    pricing_type: freight.pricing_type,
    price_per_ton: freight.price_per_ton,
    price_per_km: freight.price_per_km,
    price: freight.price,
    required_trucks: freight.required_trucks,
    weight: freight.weight,
    distance_km: freight.distance_km,
  });

  if (!canonical.ok || canonical.isPricingTypeInvalid) {
    return {
      primaryValue: freight.price || 0,
      primaryFormatted: freight.price > 0 ? formatBRL(freight.price, true) : '—',
      primarySuffix: '',
      primaryLabel: canonical.primaryLabel,
      secondaryLabel: canonical.isPricingTypeInvalid ? '⚠️ Tipo de precificação não informado' : null,
      unitRateLabel: '—',
      unitRateValue: null,
      unitRateFormatted: '—',
      unitRateColorClass: 'text-muted-foreground',
      isUnitPricing: false,
      pricingType: 'FIXED',
      isPricingTypeInvalid: true,
    };
  }

  const unitValue = canonical.unitValue ?? 0;
  const pricingType = canonical.pricingType!;
  const suffixMap: Record<string, string> = { ton: '/ton', km: '/km', veiculo: '/veículo' };
  const suffix = canonical.unit ? suffixMap[canonical.unit] || '' : '';

  // Derive R$/km for FIXED (for unit rate display)
  const distKm = freight.distance_km || 0;
  let derivedPerKm: number | null = null;
  if (pricingType === 'FIXED' && distKm > 0) {
    derivedPerKm = unitValue / distKm;
  }

  return {
    primaryValue: unitValue,
    primaryFormatted: formatBRL(unitValue, true),
    primarySuffix: suffix,
    primaryLabel: canonical.primaryLabel,
    secondaryLabel: canonical.secondaryLabel ?? null,
    unitRateLabel: pricingType === 'PER_TON' ? 'R$/ton' : 'R$/km',
    unitRateValue: pricingType === 'PER_TON' ? unitValue
      : pricingType === 'PER_KM' ? unitValue
      : derivedPerKm,
    unitRateFormatted: (() => {
      const v = pricingType === 'PER_TON' ? unitValue
        : pricingType === 'PER_KM' ? unitValue
        : derivedPerKm;
      return v != null
        ? `R$${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—';
    })(),
    unitRateColorClass: (() => {
      const v = pricingType === 'PER_TON' ? unitValue : (pricingType === 'PER_KM' ? unitValue : derivedPerKm);
      if (v == null) return 'text-muted-foreground';
      return getUnitRateColor(v, pricingType);
    })(),
    isUnitPricing: pricingType === 'PER_KM' || pricingType === 'PER_TON',
    pricingType,
    isPricingTypeInvalid: false,
  };
}

function getUnitRateColor(value: number, type: PricingType): string {
  if (type === 'PER_TON') {
    return value >= 80 ? 'text-primary' : value >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive';
  }
  return value >= 6 ? 'text-primary' : value >= 4 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive';
}

/**
 * React hook version for use in components.
 */
export function useFreightPriceDisplay(freight: FreightPriceDisplayInput | null): FreightPriceDisplay | null {
  return useMemo(() => {
    if (!freight) return null;
    return getFreightPriceDisplay(freight);
  }, [freight?.price, freight?.pricing_type, freight?.price_per_km, freight?.price_per_ton, freight?.required_trucks, freight?.distance_km, freight?.weight]);
}
