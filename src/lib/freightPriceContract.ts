/**
 * src/lib/freightPriceContract.ts
 * 
 * CONTRATO CANÔNICO DE EXIBIÇÃO DE PREÇO DE FRETE.
 * 
 * REGRA IMUTÁVEL (3 tipos):
 * 1) PER_VEHICLE → exibir SEMPRE R$ X/veíc (unit_rate cheio). NUNCA dividir por carretas.
 * 2) PER_KM     → exibir SEMPRE R$ X/km como principal.
 * 3) PER_TON    → exibir SEMPRE R$ X/ton como principal.
 * 
 * PROIBIÇÕES ABSOLUTAS:
 * - NUNCA dividir unit_rate PER_VEHICLE por required_trucks
 * - NUNCA dividir unit_rate PER_TON por required_trucks  
 * - NUNCA inventar unidade quando pricing_type está ausente
 * - NUNCA exibir total agregado em cards
 * 
 * TODOS os componentes DEVEM usar este helper. Formatação manual de preço é PROIBIDA.
 */

import type { PricingType as ContractPricingType } from '@/contracts/freightPricing';
import { PRICING_SUFFIX } from '@/contracts/freightPricing';
import { normalizeFreightPricing, normalizePricingType, type RawFreightPricingData } from '@/lib/normalizeFreightPricing';

// Re-export for backward compat
export type PricingType = ContractPricingType;
export { normalizePricingType };

export interface FreightPricingInput {
  pricing_type?: string | null;
  price_per_ton?: number | null;
  price_per_km?: number | null;
  price?: number | null;
  required_trucks?: number | null;
  weight?: number | null;
  distance_km?: number | null;
}

export interface FreightPriceDisplay {
  ok: boolean;
  primaryLabel: string;
  unit?: 'ton' | 'km' | 'veiculo';
  unitValue?: number;
  secondaryLabel?: string | null;
  pricingType?: PricingType;
  isPricingTypeInvalid: boolean;
  debug?: { reason: string };
}

// ─── Internal helpers ────────────────────────────────────────

function formatBRLContract(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const UNIT_MAP: Record<PricingType, 'ton' | 'km' | 'veiculo'> = {
  PER_TON: 'ton',
  PER_KM: 'km',
  PER_VEHICLE: 'veiculo',
};

// ─── Main contract ───────────────────────────────────────────

export function getCanonicalFreightPrice(input: FreightPricingInput): FreightPriceDisplay {
  // Use normalizer to get clean input
  const normalized = normalizeFreightPricing({
    id: 'canonical',
    pricing_type: input.pricing_type,
    price: input.price,
    price_per_km: input.price_per_km,
    price_per_ton: input.price_per_ton,
    required_trucks: input.required_trucks,
    weight: input.weight,
    distance_km: input.distance_km,
  });

  if (!normalized) {
    if (import.meta.env.DEV) {
      console.warn(
        `[PRICE_CONTRACT_FAIL] pricing_type AUSENTE/INVÁLIDO ou unit_rate ausente: "${input.pricing_type}". Exibindo "Preço indisponível".`
      );
    }
    const type = normalizePricingType(input.pricing_type);
    return {
      ok: false,
      primaryLabel: 'Preço indisponível',
      isPricingTypeInvalid: !type,
      pricingType: type ?? undefined,
      debug: { reason: type ? 'missing_unit_rate' : 'missing_or_invalid_pricing_type' },
    };
  }

  const { pricing_type: type, unit_rate } = normalized;
  const suffix = PRICING_SUFFIX[type];
  const unit = UNIT_MAP[type];

  return {
    ok: true,
    primaryLabel: `${formatBRLContract(unit_rate)}${suffix}`,
    unit,
    unitValue: unit_rate,
    pricingType: type,
    secondaryLabel: buildSecondary(normalized),
    isPricingTypeInvalid: false,
  };
}

// ─── Secondary label builder ─────────────────────────────────

function buildSecondary(input: { pricing_type: PricingType; distance_km?: number | null; weight_ton?: number | null; required_trucks?: number | null }): string | null {
  const parts: string[] = [];

  if (input.pricing_type === 'PER_KM' && input.distance_km && input.distance_km > 0) {
    parts.push(`${Math.round(input.distance_km)} km`);
  }
  if (input.pricing_type === 'PER_TON' && input.weight_ton && input.weight_ton > 0) {
    parts.push(`${input.weight_ton.toFixed(1)} ton`);
  }
  const trucks = Math.max(Number(input.required_trucks ?? 1) || 1, 1);
  if (trucks > 1) {
    parts.push(`${trucks} carretas`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

// ─── Helper: convert ANY total price to canonical display ────

export function getCanonicalPriceFromTotal(
  totalPrice: number,
  freightContext: {
    pricing_type?: string | null;
    weight?: number | null;
    distance_km?: number | null;
    required_trucks?: number | null;
  }
): FreightPriceDisplay {
  const type = normalizePricingType(freightContext.pricing_type);

  let price_per_ton: number | null = null;
  let price_per_km: number | null = null;

  if (type === 'PER_TON' && freightContext.weight && freightContext.weight > 0) {
    const tons = freightContext.weight / 1000;
    if (tons > 0) price_per_ton = totalPrice / tons;
  }
  if (type === 'PER_KM' && freightContext.distance_km && freightContext.distance_km > 0) {
    price_per_km = totalPrice / freightContext.distance_km;
  }

  return getCanonicalFreightPrice({
    pricing_type: freightContext.pricing_type,
    price_per_ton,
    price_per_km,
    price: totalPrice,
    required_trucks: freightContext.required_trucks,
    weight: freightContext.weight,
    distance_km: freightContext.distance_km,
  });
}
