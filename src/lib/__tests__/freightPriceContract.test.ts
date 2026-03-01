import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCanonicalFreightPrice, normalizePricingType } from '../freightPriceContract';

describe('normalizePricingType', () => {
  it.each([
    ['PER_TON', 'PER_TON'],
    ['POR_TON', 'PER_TON'],
    ['POR_TONELADA', 'PER_TON'],
    ['TON', 'PER_TON'],
    ['PER_KM', 'PER_KM'],
    ['POR_KM', 'PER_KM'],
    ['KM', 'PER_KM'],
    ['FIXED', 'FIXED'],
    ['FIXO', 'FIXED'],
    ['TOTAL', 'FIXED'],
  ])('maps "%s" → "%s"', (input, expected) => {
    expect(normalizePricingType(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'INVALID', 'abc'])('returns null for "%s"', (v) => {
    expect(normalizePricingType(v as any)).toBeNull();
  });
});

describe('getCanonicalFreightPrice — Contract Tests', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // ═══ PER_TON ═══
  describe('PER_TON', () => {
    it('R$80/ton must ALWAYS show "R$ 80,00/ton"', () => {
      const result = getCanonicalFreightPrice({
        pricing_type: 'PER_TON',
        price_per_ton: 80,
        price: 40000,
        weight: 500000,
        required_trucks: 12,
      });
      expect(result.ok).toBe(true);
      expect(result.primaryLabel).toBe('R$ 80,00/ton');
      expect(result.unit).toBe('ton');
      expect(result.unitValue).toBe(80);
    });

    it('NEVER divides by required_trucks', () => {
      [1, 3, 12, 50].forEach(trucks => {
        const r = getCanonicalFreightPrice({
          pricing_type: 'PER_TON',
          price_per_ton: 80,
          price: 80 * 500,
          weight: 500000,
          required_trucks: trucks,
        });
        expect(r.primaryLabel).toBe('R$ 80,00/ton');
        expect(r.unitValue).toBe(80);
      });
    });

    it('falls back to price_per_km for legacy PER_TON data', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'PER_TON',
        price_per_km: 80,
        price: 40000,
        weight: 500000,
      });
      expect(r.primaryLabel).toBe('R$ 80,00/ton');
    });

    it('derives from price/weight when no explicit unit rate', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'PER_TON',
        price: 40000,
        weight: 500000, // 500 ton
      });
      expect(r.primaryLabel).toBe('R$ 80,00/ton');
    });

    it('returns "Preço indisponível" when no rate and no derivable data', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'PER_TON',
        price: 0,
      });
      expect(r.ok).toBe(false);
      expect(r.primaryLabel).toBe('Preço indisponível');
    });

    it('secondary shows weight and truck count, NEVER monetary values', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'PER_TON',
        price_per_ton: 80,
        weight: 500000,
        required_trucks: 12,
      });
      expect(r.secondaryLabel).toContain('500.0 ton');
      expect(r.secondaryLabel).toContain('12 carretas');
      expect(r.secondaryLabel).not.toMatch(/R\$/);
      expect(r.secondaryLabel).not.toMatch(/Total/i);
    });
  });

  // ═══ PER_KM ═══
  describe('PER_KM', () => {
    it('R$2/km must show "R$ 2,00/km"', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'PER_KM',
        price_per_km: 2,
        price: 200,
        distance_km: 100,
      });
      expect(r.ok).toBe(true);
      expect(r.primaryLabel).toBe('R$ 2,00/km');
      expect(r.unitValue).toBe(2);
    });

    it('derives from price/distance when no explicit rate', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'PER_KM',
        price: 200,
        distance_km: 100,
      });
      expect(r.primaryLabel).toBe('R$ 2,00/km');
    });

    it('secondary shows distance, NEVER monetary values', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'PER_KM',
        price_per_km: 6.5,
        distance_km: 300,
        required_trucks: 3,
      });
      expect(r.secondaryLabel).toContain('300 km');
      expect(r.secondaryLabel).toContain('3 carretas');
      expect(r.secondaryLabel).not.toMatch(/R\$/);
    });
  });

  // ═══ FIXED ═══
  describe('FIXED', () => {
    it('single truck shows total price without suffix', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'FIXED',
        price: 5000,
        required_trucks: 1,
      });
      expect(r.ok).toBe(true);
      expect(r.primaryLabel).toBe('R$ 5.000,00');
      expect(r.unitValue).toBe(5000);
    });

    it('R$40.000 with 12 trucks → R$ 3.333,33/veículo', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'FIXED',
        price: 40000,
        required_trucks: 12,
      });
      expect(r.ok).toBe(true);
      expect(r.primaryLabel).toBe('R$ 3.333,33/veículo');
      expect(r.unitValue).toBe(3333.33);
    });

    it('secondary shows truck count, NEVER total price', () => {
      const r = getCanonicalFreightPrice({
        pricing_type: 'FIXED',
        price: 40000,
        required_trucks: 12,
      });
      expect(r.secondaryLabel).toContain('12 carretas');
      expect(r.secondaryLabel).not.toMatch(/R\$/);
      expect(r.secondaryLabel).not.toMatch(/Total/i);
    });
  });

  // ═══ MISSING / INVALID pricing_type ═══
  describe('MISSING pricing_type (fail closed)', () => {
    it.each([undefined, null, '', 'INVALID', 'POR_LITRO'])(
      'pricing_type="%s" → "Preço indisponível" (never /km)',
      (pt) => {
        const r = getCanonicalFreightPrice({
          pricing_type: pt as any,
          price: 40000,
          price_per_km: 6.5,
          distance_km: 300,
        });
        expect(r.ok).toBe(false);
        expect(r.primaryLabel).toBe('Preço indisponível');
        expect(r.isPricingTypeInvalid).toBe(true);
        expect(r.primaryLabel).not.toContain('/km');
        expect(r.primaryLabel).not.toContain('/ton');
        expect(r.primaryLabel).not.toContain('/veículo');
      }
    );
  });

  // ═══ GLOBAL ANTI-REGRESSION ═══
  describe('Global anti-regression', () => {
    const cases = [
      { pricing_type: 'PER_TON', price_per_ton: 80, price: 40000, weight: 500000, required_trucks: 12 },
      { pricing_type: 'PER_KM', price_per_km: 6.5, price: 1950, distance_km: 300, required_trucks: 3 },
      { pricing_type: 'FIXED', price: 40000, required_trucks: 12 },
    ];

    cases.forEach(c => {
      it(`${c.pricing_type}: secondaryLabel NEVER contains "Total:" or "R$"`, () => {
        const r = getCanonicalFreightPrice(c);
        if (r.secondaryLabel) {
          expect(r.secondaryLabel).not.toMatch(/Total/i);
          expect(r.secondaryLabel).not.toMatch(/R\$/);
        }
      });
    });
  });
});
