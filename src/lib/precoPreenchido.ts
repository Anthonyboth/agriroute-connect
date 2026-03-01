/**
 * src/lib/precoPreenchido.ts
 * 
 * FONTE ÚNICA DE VERDADE para exibição do preço de um frete.
 * 
 * REGRA IMUTÁVEL (3 tipos):
 * 1) PER_VEHICLE → R$ X/veíc (unit_rate cheio, NUNCA dividir por carretas)
 * 2) PER_KM     → R$ X/km
 * 3) PER_TON    → R$ X/ton
 * 
 * TODA tela/card que exibe preço de frete DEVE chamar:
 *   precoPreenchidoDoFrete(freight.id, freight)
 */

import { normalizeFreightPricing, normalizePricingType, type RawFreightPricingData } from '@/lib/normalizeFreightPricing';
import type { PricingType, FreightPricingDisplay } from '@/contracts/freightPricing';
import { PRICING_SUFFIX } from '@/contracts/freightPricing';

// ─── Types ───────────────────────────────────────────────────

export interface PrecoPreenchidoInput {
  id: string;
  price?: number | null;
  pricing_type?: string | null;
  price_per_km?: number | null;
  price_per_ton?: number | null;
  required_trucks?: number | null;
  weight?: number | null;
  distance_km?: number | null;
}

export interface PrecoPreenchido {
  /** "R$ 80,00/ton", "R$ 12,00/km", "R$ 4.500,00/veíc", or "Preço indisponível" */
  primaryText: string;
  /** Optional secondary info: "500,0 ton · 12 carretas" — NEVER monetary */
  secondaryText: string | null;
  /** Numeric unit value for sorting/comparison */
  unitValue: number;
  /** Suffix only: "/ton", "/km", "/veíc", or "" */
  suffix: string;
  /** Resolved type */
  pricingType: PricingType | null;
  /** true when pricing_type was missing/invalid or unit_rate absent */
  invalid: boolean;
}

// ─── Cache ───────────────────────────────────────────────────

const cache = new Map<string, PrecoPreenchido>();

export function limparCachePrecoPreenchido(freightId?: string): void {
  if (freightId) {
    cache.delete(freightId);
  } else {
    cache.clear();
  }
}

// ─── Format helper (ONLY allowed here) ──────────────────────

function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Secondary builder ──────────────────────────────────────

function buildSecondary(type: PricingType, raw: PrecoPreenchidoInput): string | null {
  const parts: string[] = [];

  if (type === 'PER_KM' && raw.distance_km && raw.distance_km > 0) {
    parts.push(`${Math.round(raw.distance_km)} km`);
  }
  if (type === 'PER_TON' && raw.weight && raw.weight > 0) {
    const tons = raw.weight / 1000;
    parts.push(`${tons.toFixed(1)} ton`);
  }
  const trucks = Math.max(Number(raw.required_trucks ?? 1) || 1, 1);
  if (trucks > 1) {
    parts.push(`${trucks} carretas`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}

// ─── Main function ───────────────────────────────────────────

export interface PrecoPreenchidoOptions {
  /**
   * REGRA UNIVERSAL: Se true, secondaryText será SEMPRE null.
   * Usar para viewers que NÃO são o solicitante (motorista, transportadora, etc.)
   * Isso impede que cálculos/totais/metadata ("12 carretas", "500 ton") vazem.
   */
  unitOnly?: boolean;
}

export function precoPreenchidoDoFrete(
  freightId: string,
  freight: Omit<PrecoPreenchidoInput, 'id'>,
  options?: PrecoPreenchidoOptions,
): PrecoPreenchido {
  const unitOnly = options?.unitOnly ?? false;
  const cacheKey = unitOnly ? `${freightId}__unit` : freightId;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Normalize via centralizer
  const normalized = normalizeFreightPricing({
    id: freightId,
    pricing_type: freight.pricing_type,
    price: freight.price,
    price_per_km: freight.price_per_km,
    price_per_ton: freight.price_per_ton,
    required_trucks: freight.required_trucks,
    weight: freight.weight,
    distance_km: freight.distance_km,
  });

  if (!normalized) {
    const result: PrecoPreenchido = {
      primaryText: 'Preço indisponível',
      secondaryText: null,
      unitValue: 0,
      suffix: '',
      pricingType: null,
      invalid: true,
    };
    cache.set(cacheKey, result);
    return result;
  }

  const { pricing_type: type, unit_rate } = normalized;
  const suffix = PRICING_SUFFIX[type];
  const rawInput = { id: freightId, ...freight };

  const result: PrecoPreenchido = {
    primaryText: `${formatBRL(unit_rate)}${suffix}`,
    // ✅ REGRA UNIVERSAL: unitOnly → NUNCA mostrar secondary (totais/metadata)
    secondaryText: unitOnly ? null : buildSecondary(type, rawInput),
    unitValue: unit_rate,
    suffix,
    pricingType: type,
    invalid: false,
  };

  cache.set(cacheKey, result);
  return result;
}
