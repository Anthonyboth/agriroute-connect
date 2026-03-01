/**
 * src/lib/precoPreenchido.ts
 * 
 * FONTE ÚNICA DE VERDADE para exibição do preço de um frete.
 * 
 * TODA tela/card que exibe preço de frete DEVE chamar:
 *   precoPreenchidoDoFrete(freight.id, freight)
 * 
 * REGRAS:
 * - PER_TON  → R$ X,XX/ton  (rate unitário do produtor, campo price_per_ton ou price_per_km)
 * - PER_KM   → R$ X,XX/km   (rate unitário do produtor)
 * - FIXED    → R$ X,XX/veículo (total / required_trucks)
 * - NUNCA dividir PER_TON por required_trucks
 * - NUNCA inventar unidade quando pricing_type ausente
 * 
 * CACHE: resultados são armazenados por freightId para evitar recálculos.
 */

import {
  getCanonicalFreightPrice,
  normalizePricingType,
  type PricingType,
  type FreightPriceDisplay as CanonicalResult,
} from '@/lib/freightPriceContract';

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
  /** "R$ 80,00/ton", "R$ 2,00/km", "R$ 3.333,33/veículo", or "Preço indisponível" */
  primaryText: string;
  /** Numeric unit value for sorting/comparison */
  unitValue: number;
  /** Suffix only: "/ton", "/km", "/veículo", or "" */
  suffix: string;
  /** Context line: "500,0 ton · 12 carretas" — NEVER monetary */
  secondaryText: string | null;
  /** Resolved type */
  pricingType: PricingType | null;
  /** true when pricing_type was missing/invalid */
  invalid: boolean;
  /** Full canonical result for advanced consumers */
  _canonical: CanonicalResult;
}

// ─── Cache ───────────────────────────────────────────────────

const cache = new Map<string, PrecoPreenchido>();

/** Limpa todo o cache ou apenas um freightId específico */
export function limparCachePrecoPreenchido(freightId?: string): void {
  if (freightId) {
    cache.delete(freightId);
  } else {
    cache.clear();
  }
}

// ─── Main function ───────────────────────────────────────────

/**
 * Retorna o preço preenchido canônico para exibição.
 * Cacheia por freightId para evitar recálculos em re-renders.
 */
export function precoPreenchidoDoFrete(
  freightId: string,
  freight: Omit<PrecoPreenchidoInput, 'id'>,
): PrecoPreenchido {
  // Check cache
  const cached = cache.get(freightId);
  if (cached) return cached;

  // Delegate to canonical contract
  const canonical = getCanonicalFreightPrice({
    pricing_type: freight.pricing_type,
    price_per_ton: freight.price_per_ton,
    price_per_km: freight.price_per_km,
    price: freight.price,
    required_trucks: freight.required_trucks,
    weight: freight.weight,
    distance_km: freight.distance_km,
  });

  const suffixMap: Record<string, string> = {
    ton: '/ton',
    km: '/km',
    veiculo: '/veículo',
  };

  const result: PrecoPreenchido = {
    primaryText: canonical.primaryLabel,
    unitValue: canonical.unitValue ?? 0,
    suffix: canonical.unit ? (suffixMap[canonical.unit] || '') : '',
    secondaryText: canonical.secondaryLabel ?? null,
    pricingType: canonical.pricingType ?? null,
    invalid: canonical.isPricingTypeInvalid || !canonical.ok,
    _canonical: canonical,
  };

  // Store in cache
  cache.set(freightId, result);

  return result;
}
