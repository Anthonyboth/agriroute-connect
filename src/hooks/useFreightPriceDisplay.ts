/**
 * Hook centralizado para exibição de preços nos cards de frete.
 * 
 * REGRA CRÍTICA — PREÇO POR VEÍCULO:
 * O motorista/transportadora sempre vê o preço UNITÁRIO por veículo.
 * - PER_KM → "R$ X,XX/km" (taxa unitária do produtor)
 * - PER_TON → "R$ X,XX/ton" (taxa unitária do produtor)
 * - FIXED → "R$ X.XXX,XX/carreta" (price / required_trucks)
 * 
 * PROIBIÇÕES:
 * - NUNCA exibir total agregado ("Total (N carretas): R$ X") em cards
 * - NUNCA exibir "R$ total /carreta" — sempre derivar unitário
 * - NUNCA assumir PER_KM quando pricing_type ausente
 * 
 * O campo price_per_km armazena o valor unitário para PER_KM e PER_TON.
 */

import { useMemo } from 'react';
import { formatBRL } from '@/lib/formatters';

export type PricingType = 'FIXED' | 'PER_KM' | 'PER_TON';

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
  price_per_km?: number | null;  // Stores unit rate for PER_KM and PER_TON
  required_trucks?: number;
  accepted_trucks?: number;
  distance_km?: number;
  weight?: number;  // in kg
}

export interface FreightPriceDisplay {
  /** Primary display: the exact value the producer entered */
  primaryValue: number;
  /** Formatted primary value */
  primaryFormatted: string;
  /** Unit suffix: "/km", "/ton", "/carreta", "" */
  primarySuffix: string;
  /** Full primary label: "R$ 80,00/ton" */
  primaryLabel: string;
  /** Secondary info: total calculated or per-truck breakdown */
  secondaryLabel: string | null;
  /** The unit rate label for the grid cell */
  unitRateLabel: string;
  /** The unit rate value */
  unitRateValue: number | null;
  /** The unit rate formatted */
  unitRateFormatted: string;
  /** Profitability color class */
  unitRateColorClass: string;
  /** Whether the pricing is unit-based (PER_KM or PER_TON) */
  isUnitPricing: boolean;
  /** Pricing type resolved */
  pricingType: PricingType;
  /** Whether pricing_type was missing/invalid (data quality issue) */
  isPricingTypeInvalid: boolean;
}

/**
 * Sentinel result for when pricing_type is missing/invalid.
 * Shows "Preço indisponível" instead of guessing wrong unit.
 */
function createInvalidPricingResult(freight: FreightPriceDisplayInput): FreightPriceDisplay {
  return {
    primaryValue: freight.price,
    primaryFormatted: freight.price > 0 ? formatBRL(freight.price, true) : '—',
    primarySuffix: '',
    primaryLabel: freight.price > 0 ? formatBRL(freight.price, true) : 'Preço indisponível',
    secondaryLabel: '⚠️ Tipo de precificação não informado',
    unitRateLabel: '—',
    unitRateValue: null,
    unitRateFormatted: '—',
    unitRateColorClass: 'text-muted-foreground',
    isUnitPricing: false,
    pricingType: 'FIXED',
    isPricingTypeInvalid: true,
  };
}

export function getFreightPriceDisplay(freight: FreightPriceDisplayInput): FreightPriceDisplay {
  // ✅ ANTI-REGRESSÃO: validar pricing_type rigorosamente
  const validatedType = validatePricingType(freight.pricing_type);
  
  if (!validatedType) {
    console.warn(
      `[PriceDisplay] ⚠️ pricing_type AUSENTE ou INVÁLIDO para frete com price=${freight.price}, ` +
      `pricing_type="${freight.pricing_type}". NÃO será assumido PER_KM. Exibindo como dado incompleto.`
    );
    return createInvalidPricingResult(freight);
  }

  const pricingType = validatedType;
  const unitRate = freight.price_per_km; // Stores unit value for both PER_KM and PER_TON
  const requiredTrucks = Math.max(freight.required_trucks || 1, 1);
  const hasMultipleTrucks = requiredTrucks > 1;
  const distKm = freight.distance_km || 0;

  // === PER_KM: show exactly the R$/km the producer entered ===
  if (pricingType === 'PER_KM') {
    const effectiveUnitRate = (unitRate && unitRate > 0)
      ? unitRate
      : (distKm > 0 ? freight.price / distKm : null);

    if (effectiveUnitRate !== null && effectiveUnitRate > 0) {
      // Secondary: distance info only, NEVER aggregate total
      let secondary: string | null = null;
      if (distKm > 0) {
        secondary = `${Math.round(distKm)} km`;
      }
      if (hasMultipleTrucks) {
        secondary = secondary
          ? `${secondary} · ${requiredTrucks} carretas`
          : `${requiredTrucks} carretas`;
      }

      return {
        primaryValue: effectiveUnitRate,
        primaryFormatted: formatBRL(effectiveUnitRate, true),
        primarySuffix: '/km',
        primaryLabel: `${formatBRL(effectiveUnitRate, true)}/km`,
        secondaryLabel: secondary,
        unitRateLabel: 'R$/km',
        unitRateValue: effectiveUnitRate,
        unitRateFormatted: `R$${effectiveUnitRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        unitRateColorClass: getUnitRateColor(effectiveUnitRate, 'PER_KM'),
        isUnitPricing: true,
        pricingType: 'PER_KM',
        isPricingTypeInvalid: false,
      };
    }
  }

  // === PER_TON: show exactly the R$/ton the producer entered ===
  if (pricingType === 'PER_TON') {
    const weightTons = (freight.weight || 0) / 1000;
    const effectiveUnitRate = (unitRate && unitRate > 0) 
      ? unitRate 
      : (weightTons > 0 ? freight.price / weightTons : null);
    
    if (effectiveUnitRate !== null && effectiveUnitRate > 0) {
      // Secondary: weight/truck info only, NEVER aggregate total
      let secondary: string | null = null;
      if (weightTons > 0) {
        secondary = `${weightTons.toFixed(1)} ton`;
      }
      if (hasMultipleTrucks) {
        secondary = secondary
          ? `${secondary} · ${requiredTrucks} carretas`
          : `${requiredTrucks} carretas`;
      }

      return {
        primaryValue: effectiveUnitRate,
        primaryFormatted: formatBRL(effectiveUnitRate, true),
        primarySuffix: '/ton',
        primaryLabel: `${formatBRL(effectiveUnitRate, true)}/ton`,
        secondaryLabel: secondary,
        unitRateLabel: 'R$/ton',
        unitRateValue: effectiveUnitRate,
        unitRateFormatted: `R$${effectiveUnitRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        unitRateColorClass: getUnitRateColor(effectiveUnitRate, 'PER_TON'),
        isUnitPricing: true,
        pricingType: 'PER_TON',
        isPricingTypeInvalid: false,
      };
    }
  }

  // === FIXED: always per-vehicle unit price ===
  const perTruck = hasMultipleTrucks ? freight.price / requiredTrucks : freight.price;
  const derivedPerKm = distKm > 0 ? perTruck / distKm : null;

  return {
    primaryValue: hasMultipleTrucks ? perTruck : freight.price,
    primaryFormatted: formatBRL(hasMultipleTrucks ? perTruck : freight.price, true),
    primarySuffix: hasMultipleTrucks ? '/carreta' : '',
    primaryLabel: hasMultipleTrucks
      ? `${formatBRL(perTruck, true)}/carreta`
      : formatBRL(freight.price, true),
    secondaryLabel: hasMultipleTrucks
      ? `${requiredTrucks} carretas`
      : null,
    unitRateLabel: 'R$/km',
    unitRateValue: derivedPerKm,
    unitRateFormatted: derivedPerKm !== null
      ? `R$${derivedPerKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—',
    unitRateColorClass: derivedPerKm !== null ? getUnitRateColor(derivedPerKm, 'PER_KM') : 'text-muted-foreground',
    isUnitPricing: false,
    pricingType: 'FIXED',
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
  }, [freight?.price, freight?.pricing_type, freight?.price_per_km, freight?.required_trucks, freight?.distance_km, freight?.weight]);
}
