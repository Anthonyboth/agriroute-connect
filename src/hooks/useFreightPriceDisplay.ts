/**
 * Hook centralizado para exibição de preços nos cards de frete.
 * 
 * REGRA CRÍTICA: Exibir EXATAMENTE o valor e unidade que o produtor preencheu.
 * - PER_KM → "R$ X,XX/km"
 * - PER_TON → "R$ X,XX/ton"  
 * - FIXED → "R$ X.XXX,XX" (ou /carreta se multi-truck)
 * 
 * NUNCA derive um valor diferente do que o produtor digitou.
 * O campo price_per_km armazena o valor unitário para PER_KM e PER_TON.
 */

import { useMemo } from 'react';
import { formatBRL } from '@/lib/formatters';

export type PricingType = 'FIXED' | 'PER_KM' | 'PER_TON';

export interface FreightPriceDisplayInput {
  price: number;
  pricing_type?: PricingType | string;
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
  /** Unit suffix: "/km", "/ton", "/carreta", "fixo" */
  primarySuffix: string;
  /** Full primary label: "R$ 80,00/ton" */
  primaryLabel: string;
  /** Secondary info: total calculated or per-truck breakdown */
  secondaryLabel: string | null;
  /** The unit rate label for the grid cell (replaces hardcoded R$/km) */
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
}

export function getFreightPriceDisplay(freight: FreightPriceDisplayInput): FreightPriceDisplay {
  // ✅ ANTI-REGRESSÃO: se pricing_type estiver ausente, logar warning (nunca assumir PER_KM)
  if (!freight.pricing_type) {
    console.warn(`[PriceDisplay] pricing_type ausente para frete com price=${freight.price}. Fallback: FIXED.`);
  }
  const pricingType = (freight.pricing_type || 'FIXED') as PricingType;
  const unitRate = freight.price_per_km; // Stores unit value for both PER_KM and PER_TON
  const requiredTrucks = Math.max(freight.required_trucks || 1, 1);
  const hasMultipleTrucks = requiredTrucks > 1;
  const distKm = freight.distance_km || 0;

  // === PER_KM: show exactly the R$/km the producer entered ===
  // Fallback: if price_per_km is null, derive from price / distance
  if (pricingType === 'PER_KM') {
    const effectiveUnitRate = (unitRate && unitRate > 0)
      ? unitRate
      : (distKm > 0 ? freight.price / distKm : null);

    if (effectiveUnitRate !== null && effectiveUnitRate > 0) {
      const totalCalc = distKm > 0 ? effectiveUnitRate * distKm : freight.price;
      return {
        primaryValue: effectiveUnitRate,
        primaryFormatted: formatBRL(effectiveUnitRate, true),
        primarySuffix: '/km',
        primaryLabel: `${formatBRL(effectiveUnitRate, true)}/km`,
        secondaryLabel: distKm > 0
          ? `Total: ${formatBRL(totalCalc, true)} (${Math.round(distKm)} km)`
          : hasMultipleTrucks
            ? `${formatBRL(freight.price / requiredTrucks, true)}/carreta`
            : null,
        unitRateLabel: 'R$/km',
        unitRateValue: effectiveUnitRate,
        unitRateFormatted: `R$${effectiveUnitRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        unitRateColorClass: getUnitRateColor(effectiveUnitRate, 'PER_KM'),
        isUnitPricing: true,
        pricingType: 'PER_KM',
      };
    }
  }

  // === PER_TON: show exactly the R$/ton the producer entered ===
  // Fallback: if price_per_km is null, derive from price / weight_tons
  if (pricingType === 'PER_TON') {
    const weightTons = (freight.weight || 0) / 1000;
    const effectiveUnitRate = (unitRate && unitRate > 0) 
      ? unitRate 
      : (weightTons > 0 ? freight.price / weightTons : null);
    
    if (effectiveUnitRate !== null && effectiveUnitRate > 0) {
      const totalCalc = weightTons > 0 ? effectiveUnitRate * weightTons : freight.price;
      return {
        primaryValue: effectiveUnitRate,
        primaryFormatted: formatBRL(effectiveUnitRate, true),
        primarySuffix: '/ton',
        primaryLabel: `${formatBRL(effectiveUnitRate, true)}/ton`,
        secondaryLabel: hasMultipleTrucks
          ? `${formatBRL(freight.price / requiredTrucks, true)}/carreta`
          : weightTons > 0
            ? `Total: ${formatBRL(totalCalc, true)} (${weightTons.toFixed(1)} ton)`
            : null,
        unitRateLabel: 'R$/ton',
        unitRateValue: effectiveUnitRate,
        unitRateFormatted: `R$${effectiveUnitRate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        unitRateColorClass: getUnitRateColor(effectiveUnitRate, 'PER_TON'),
        isUnitPricing: true,
        pricingType: 'PER_TON',
      };
    }
  }

  // === FIXED: show total or per-truck ===
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
      ? `Total (${requiredTrucks} carretas): ${formatBRL(freight.price, true)}`
      : null,
    unitRateLabel: 'R$/km',
    unitRateValue: derivedPerKm,
    unitRateFormatted: derivedPerKm !== null
      ? `R$${derivedPerKm.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—',
    unitRateColorClass: derivedPerKm !== null ? getUnitRateColor(derivedPerKm, 'PER_KM') : 'text-muted-foreground',
    isUnitPricing: false,
    pricingType: 'FIXED',
  };
}

function getUnitRateColor(value: number, type: PricingType): string {
  if (type === 'PER_TON') {
    // For PER_TON, different thresholds
    return value >= 80 ? 'text-primary' : value >= 50 ? 'text-yellow-600 dark:text-yellow-400' : 'text-destructive';
  }
  // PER_KM thresholds
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
