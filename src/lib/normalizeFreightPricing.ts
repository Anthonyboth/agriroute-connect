/**
 * src/lib/normalizeFreightPricing.ts
 * 
 * Normalizador: transforma o schema atual do banco (com campos sobrecarregados)
 * em um FreightPricingInput limpo.
 * 
 * REGRA CRÍTICA:
 * - PROIBIDO derivar unit_rate no PER_VEHICLE usando total/quantidade de veículos.
 * - unit_rate PER_VEHICLE = price (valor cheio por veículo preenchido pelo produtor).
 * - unit_rate PER_TON = price_per_ton ?? price_per_km (campo sobrecarregado).
 * - unit_rate PER_KM = price_per_km.
 */

import type { PricingType, FreightPricingInput } from '@/contracts/freightPricing';

/** Shape do raw freight vindo do banco / queries */
export interface RawFreightPricingData {
  id: string;
  pricing_type?: string | null;
  price?: number | null;
  price_per_km?: number | null;
  price_per_ton?: number | null;
  required_trucks?: number | null;
  weight?: number | null;       // em kg no banco
  distance_km?: number | null;
}

// ─── Mapping aliases ──────────────────────────────────────────

const PRICING_TYPE_MAP: Record<string, PricingType> = {
  PER_VEHICLE: 'PER_VEHICLE',
  PER_TON: 'PER_TON',
  POR_TON: 'PER_TON',
  POR_TONELADA: 'PER_TON',
  TON: 'PER_TON',
  PER_TONELADA: 'PER_TON',
  PER_KM: 'PER_KM',
  POR_KM: 'PER_KM',
  KM: 'PER_KM',
  // Legacy FIXED → PER_VEHICLE
  FIXED: 'PER_VEHICLE',
  FIXO: 'PER_VEHICLE',
  TOTAL: 'PER_VEHICLE',
};

export function normalizePricingType(raw?: string | null): PricingType | null {
  if (!raw) return null;
  return PRICING_TYPE_MAP[String(raw).toUpperCase()] ?? null;
}

// ─── Main normalizer ─────────────────────────────────────────

export function normalizeFreightPricing(raw: RawFreightPricingData): FreightPricingInput | null {
  const type = normalizePricingType(raw.pricing_type);
  if (!type) return null;

  let unit_rate: number | null = null;

  switch (type) {
    case 'PER_TON':
      // Priority: explicit price_per_ton > legacy price_per_km (campo sobrecarregado)
      unit_rate = positiveOrNull(raw.price_per_ton) ?? positiveOrNull(raw.price_per_km);
      break;

    case 'PER_KM':
      unit_rate = positiveOrNull(raw.price_per_km);
      break;

    case 'PER_VEHICLE':
      // O price É o valor por veículo. NUNCA dividir por required_trucks.
      unit_rate = positiveOrNull(raw.price);
      break;
  }

  if (unit_rate == null) return null;

  return {
    id: raw.id,
    pricing_type: type,
    unit_rate,
    distance_km: raw.distance_km ?? null,
    weight_ton: raw.weight ? raw.weight / 1000 : null,
    required_trucks: raw.required_trucks ?? null,
  };
}

function positiveOrNull(v: number | null | undefined): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  return null;
}
