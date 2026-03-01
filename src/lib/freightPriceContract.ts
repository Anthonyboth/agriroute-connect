/**
 * src/lib/freightPriceContract.ts
 * 
 * CONTRATO CANÔNICO DE EXIBIÇÃO DE PREÇO DE FRETE.
 * 
 * REGRA DE OURO:
 * - PER_TON → SEMPRE exibe R$ X,XX/ton (X = valor unitário preenchido pelo produtor)
 * - PER_KM  → SEMPRE exibe R$ X,XX/km  (X = valor unitário preenchido pelo produtor)
 * - FIXED   → SEMPRE exibe valor unitário por veículo: total / required_trucks
 * - pricing_type ausente/inválido → "Preço indisponível" (NUNCA assume /km)
 * 
 * PROIBIÇÕES ABSOLUTAS:
 * - NUNCA exibir total agregado ("Total (N carretas): R$ X") em cards
 * - NUNCA inventar unidade quando pricing_type está ausente
 * - NUNCA dividir PER_TON por required_trucks
 * 
 * TODOS os componentes DEVEM usar este helper. Formatação manual de preço é PROIBIDA.
 */

export type PricingType = 'PER_TON' | 'PER_KM' | 'FIXED';

export interface FreightPricingInput {
  pricing_type?: string | null;

  /** Valor unitário por tonelada (canônico para PER_TON) */
  price_per_ton?: number | null;
  /** Valor unitário por km (canônico para PER_KM; fallback legado para PER_TON) */
  price_per_km?: number | null;

  /** Preço total (FIXED) ou legado */
  price?: number | null;
  required_trucks?: number | null;

  /** Opcionais para derivação de fallback */
  weight?: number | null;       // em kg
  distance_km?: number | null;
}

export interface FreightPriceDisplay {
  /** Whether the display resolved successfully */
  ok: boolean;
  /** Primary label: "R$ 80,00/ton", "R$ 2,00/km", "R$ 3.333,33/veículo", or "Preço indisponível" */
  primaryLabel: string;
  /** Unit type resolved */
  unit?: 'ton' | 'km' | 'veiculo';
  /** Numeric unit value */
  unitValue?: number;
  /** Secondary context: distance, weight, truck count — NEVER monetary values */
  secondaryLabel?: string | null;
  /** Resolved pricing type */
  pricingType?: PricingType;
  /** Whether pricing_type was missing/invalid */
  isPricingTypeInvalid: boolean;
  /** Debug info for DEV logging */
  debug?: { reason: string };
}

// ─── Internal helpers ────────────────────────────────────────

function formatBRLContract(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PRICING_TYPE_MAP: Record<string, PricingType> = {
  PER_TON: 'PER_TON',
  POR_TON: 'PER_TON',
  POR_TONELADA: 'PER_TON',
  TON: 'PER_TON',
  PER_TONELADA: 'PER_TON',
  PER_KM: 'PER_KM',
  POR_KM: 'PER_KM',
  KM: 'PER_KM',
  FIXED: 'FIXED',
  FIXO: 'FIXED',
  TOTAL: 'FIXED',
};

export function normalizePricingType(raw?: string | null): PricingType | null {
  if (!raw) return null;
  return PRICING_TYPE_MAP[String(raw).toUpperCase()] ?? null;
}

// ─── Main contract ───────────────────────────────────────────

export function getCanonicalFreightPrice(input: FreightPricingInput): FreightPriceDisplay {
  const type = normalizePricingType(input.pricing_type);

  // FAIL CLOSED: never invent a unit
  if (!type) {
    if (import.meta.env.DEV) {
      console.warn(
        `[PRICE_CONTRACT_FAIL] pricing_type AUSENTE ou INVÁLIDO: "${input.pricing_type}", price=${input.price}. Exibindo "Preço indisponível".`
      );
    }
    return {
      ok: false,
      primaryLabel: 'Preço indisponível',
      isPricingTypeInvalid: true,
      debug: { reason: 'missing_or_invalid_pricing_type' },
    };
  }

  // === PER_TON ===
  if (type === 'PER_TON') {
    // Priority: explicit price_per_ton > legacy price_per_km > derive from total/weight
    const unitRate = resolvePositive(input.price_per_ton)
      ?? resolvePositive(input.price_per_km)
      ?? derivePerTon(input.price, input.weight);

    if (unitRate == null) {
      return {
        ok: false,
        primaryLabel: 'Preço indisponível',
        isPricingTypeInvalid: false,
        pricingType: 'PER_TON',
        debug: { reason: 'missing_price_per_ton' },
      };
    }

    return {
      ok: true,
      primaryLabel: `${formatBRLContract(unitRate)}/ton`,
      unit: 'ton',
      unitValue: unitRate,
      pricingType: 'PER_TON',
      secondaryLabel: buildSecondary(input, 'PER_TON'),
      isPricingTypeInvalid: false,
    };
  }

  // === PER_KM ===
  if (type === 'PER_KM') {
    const unitRate = resolvePositive(input.price_per_km)
      ?? derivePerKm(input.price, input.distance_km);

    if (unitRate == null) {
      return {
        ok: false,
        primaryLabel: 'Preço indisponível',
        isPricingTypeInvalid: false,
        pricingType: 'PER_KM',
        debug: { reason: 'missing_price_per_km' },
      };
    }

    return {
      ok: true,
      primaryLabel: `${formatBRLContract(unitRate)}/km`,
      unit: 'km',
      unitValue: unitRate,
      pricingType: 'PER_KM',
      secondaryLabel: buildSecondary(input, 'PER_KM'),
      isPricingTypeInvalid: false,
    };
  }

  // === FIXED ===
  const total = resolvePositive(input.price);
  if (total == null) {
    return {
      ok: false,
      primaryLabel: 'Preço indisponível',
      isPricingTypeInvalid: false,
      pricingType: 'FIXED',
      debug: { reason: 'missing_total_price_fixed' },
    };
  }

  const trucks = Math.max(Number(input.required_trucks ?? 1) || 1, 1);
  const hasMultiple = trucks > 1;

  // Cent-based division to avoid floating point errors
  const totalCents = Math.round(total * 100);
  const unitCents = Math.round(totalCents / trucks);
  const unitPrice = unitCents / 100;

  return {
    ok: true,
    primaryLabel: hasMultiple
      ? `${formatBRLContract(unitPrice)}/veículo`
      : formatBRLContract(total),
    unit: 'veiculo',
    unitValue: unitPrice,
    pricingType: 'FIXED',
    secondaryLabel: buildSecondary(input, 'FIXED'),
    isPricingTypeInvalid: false,
  };
}

// ─── Derivation helpers ──────────────────────────────────────

function resolvePositive(v: number | null | undefined): number | null {
  if (typeof v === 'number' && Number.isFinite(v) && v > 0) return v;
  return null;
}

function derivePerTon(price: number | null | undefined, weightKg: number | null | undefined): number | null {
  const p = resolvePositive(price);
  const w = resolvePositive(weightKg);
  if (p == null || w == null) return null;
  const tons = w / 1000;
  if (tons <= 0) return null;
  return p / tons;
}

function derivePerKm(price: number | null | undefined, distKm: number | null | undefined): number | null {
  const p = resolvePositive(price);
  const d = resolvePositive(distKm);
  if (p == null || d == null) return null;
  return p / d;
}

function buildSecondary(input: FreightPricingInput, type: PricingType): string | null {
  const parts: string[] = [];
  const trucks = Math.max(Number(input.required_trucks ?? 1) || 1, 1);

  if (type === 'PER_KM' && input.distance_km && input.distance_km > 0) {
    parts.push(`${Math.round(input.distance_km)} km`);
  }
  if (type === 'PER_TON' && input.weight && input.weight > 0) {
    parts.push(`${(input.weight / 1000).toFixed(1)} ton`);
  }
  if (trucks > 1) {
    parts.push(`${trucks} carretas`);
  }

  return parts.length > 0 ? parts.join(' · ') : null;
}
