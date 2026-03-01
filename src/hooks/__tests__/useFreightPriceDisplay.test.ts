import { describe, it, expect, vi } from 'vitest';
import { getFreightPriceDisplay, validatePricingType } from '../useFreightPriceDisplay';

describe('validatePricingType', () => {
  it('returns PER_KM for valid string', () => {
    expect(validatePricingType('PER_KM')).toBe('PER_KM');
  });
  it('returns PER_TON for valid string', () => {
    expect(validatePricingType('PER_TON')).toBe('PER_TON');
  });
  it('returns FIXED for valid string', () => {
    expect(validatePricingType('FIXED')).toBe('FIXED');
  });
  it('returns null for undefined', () => {
    expect(validatePricingType(undefined)).toBeNull();
  });
  it('returns null for null', () => {
    expect(validatePricingType(null)).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(validatePricingType('')).toBeNull();
  });
  it('returns null for invalid string', () => {
    expect(validatePricingType('POR_KM')).toBeNull();
  });
});

describe('getFreightPriceDisplay', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // =========================================================================
  // PER_TON
  // =========================================================================
  describe('PER_TON', () => {
    it('shows /ton suffix — NEVER /km', () => {
      const result = getFreightPriceDisplay({
        price: 40000,
        pricing_type: 'PER_TON',
        price_per_km: 80,
        weight: 500000,
        distance_km: 300,
      });
      expect(result.primarySuffix).toBe('/ton');
      expect(result.pricingType).toBe('PER_TON');
      expect(result.primaryLabel).toContain('/ton');
      expect(result.primaryLabel).not.toContain('/km');
      expect(result.isPricingTypeInvalid).toBe(false);
    });

    it('uses price_per_km as the unit rate for PER_TON', () => {
      const result = getFreightPriceDisplay({
        price: 40000,
        pricing_type: 'PER_TON',
        price_per_km: 80,
        weight: 500000,
      });
      expect(result.primaryValue).toBe(80);
      expect(result.unitRateLabel).toBe('R$/ton');
    });

    /**
     * CONTRACT: PER_TON multi-truck — NEVER show aggregate total
     * Primary: R$ 80,00/ton (unit rate)
     * Secondary: weight + truck count only
     */
    it('PER_TON 500t R$80/ton 12 trucks: unit primary, NO aggregate total', () => {
      const result = getFreightPriceDisplay({
        price: 40000,
        pricing_type: 'PER_TON',
        price_per_km: 80,
        weight: 500000,
        required_trucks: 12,
        distance_km: 130,
      });
      expect(result.primarySuffix).toBe('/ton');
      expect(result.primaryValue).toBe(80);
      // NEVER show aggregate total
      expect(result.secondaryLabel).not.toContain('Total');
      expect(result.secondaryLabel).not.toContain('R$');
      expect(result.secondaryLabel).toContain('12 carretas');
      // NEVER show total as primary
      expect(result.primaryValue).not.toBe(40000);
    });

    /**
     * CONTRACT: PER_TON R$80 must show "R$ 80,00/ton" in ALL screens
     * (cards, details modal, scheduled list, proposals)
     * NEVER divide by required_trucks for PER_TON.
     */
    it('PER_TON R$80 must show exactly R$ 80,00/ton regardless of truck count', () => {
      [1, 3, 12].forEach(trucks => {
        const result = getFreightPriceDisplay({
          price: 80 * 500, // total price = rate * tons
          pricing_type: 'PER_TON',
          price_per_km: 80,
          weight: 500000,
          required_trucks: trucks,
        });
        expect(result.primaryValue).toBe(80);
        expect(result.primaryLabel).toBe('R$ 80,00/ton');
        expect(result.primarySuffix).toBe('/ton');
      });
    });
  });

  // =========================================================================
  // PER_KM
  // =========================================================================
  describe('PER_KM', () => {
    it('shows /km suffix', () => {
      const result = getFreightPriceDisplay({
        price: 900,
        pricing_type: 'PER_KM',
        price_per_km: 3,
        distance_km: 300,
      });
      expect(result.primarySuffix).toBe('/km');
      expect(result.pricingType).toBe('PER_KM');
      expect(result.primaryValue).toBe(3);
      expect(result.isPricingTypeInvalid).toBe(false);
    });

    /**
     * CONTRACT: PER_KM — primary is unit rate, NO aggregate total
     */
    it('PER_KM R$2/km 100km: R$2/km primary, NO total in secondary', () => {
      const result = getFreightPriceDisplay({
        price: 200,
        pricing_type: 'PER_KM',
        price_per_km: 2,
        distance_km: 100,
      });
      expect(result.primaryValue).toBe(2);
      expect(result.primarySuffix).toBe('/km');
      // Secondary shows distance, NOT "Total: R$ 200"
      expect(result.secondaryLabel).toContain('100');
      expect(result.secondaryLabel).not.toContain('Total');
      expect(result.secondaryLabel).not.toContain('R$');
      expect(result.primaryValue).not.toBe(200);
    });

    it('PER_KM multi-truck: shows truck count, NO aggregate total', () => {
      const result = getFreightPriceDisplay({
        price: 600,
        pricing_type: 'PER_KM',
        price_per_km: 2,
        distance_km: 100,
        required_trucks: 3,
      });
      expect(result.primaryValue).toBe(2);
      expect(result.secondaryLabel).toContain('3 carretas');
      expect(result.secondaryLabel).not.toContain('Total');
      expect(result.secondaryLabel).not.toContain('R$');
    });
  });

  // =========================================================================
  // FIXED
  // =========================================================================
  describe('FIXED', () => {
    it('shows no unit suffix for single truck', () => {
      const result = getFreightPriceDisplay({
        price: 1200,
        pricing_type: 'FIXED',
        distance_km: 200,
      });
      expect(result.primarySuffix).toBe('/veículo');
      expect(result.pricingType).toBe('FIXED');
      expect(result.primaryValue).toBe(1200);
      expect(result.isPricingTypeInvalid).toBe(false);
    });

    it('shows /veículo for multi-truck', () => {
      const result = getFreightPriceDisplay({
        price: 12000,
        pricing_type: 'FIXED',
        required_trucks: 3,
      });
      expect(result.primarySuffix).toBe('/veículo');
      expect(result.primaryValue).toBe(4000);
    });

    /**
     * CONTRACT: FIXED multi-truck — per-vehicle primary, NO aggregate total
     */
    it('FIXED R$40.000 12 trucks: per-veículo primary, NO aggregate total', () => {
      const result = getFreightPriceDisplay({
        price: 40000,
        pricing_type: 'FIXED',
        required_trucks: 12,
        distance_km: 130,
      });
      expect(result.primarySuffix).toBe('/veículo');
      const perCarreta = 40000 / 12;
      expect(result.primaryValue).toBeCloseTo(perCarreta, 0);
      // NEVER show aggregate total
      expect(result.secondaryLabel).not.toContain('Total');
      expect(result.secondaryLabel).not.toContain('R$');
      expect(result.secondaryLabel).toContain('12');
      expect(result.primaryValue).not.toBe(40000);
    });
  });

  // =========================================================================
  // GLOBAL ANTI-REGRESSION: no aggregate total anywhere
  // =========================================================================
  describe('GLOBAL: no aggregate total in any pricing type', () => {
    const cases = [
      { pricing_type: 'PER_TON' as const, price: 40000, price_per_km: 80, weight: 500000, required_trucks: 12 },
      { pricing_type: 'PER_KM' as const, price: 600, price_per_km: 2, distance_km: 100, required_trucks: 3 },
      { pricing_type: 'FIXED' as const, price: 40000, required_trucks: 12 },
    ];

    cases.forEach(({ pricing_type, ...rest }) => {
      it(`${pricing_type} multi-truck: secondaryLabel NEVER contains "Total:" or "R$"`, () => {
        const result = getFreightPriceDisplay({ pricing_type, ...rest });
        if (result.secondaryLabel) {
          expect(result.secondaryLabel).not.toMatch(/Total/i);
          expect(result.secondaryLabel).not.toContain('R$');
        }
      });
    });
  });

  // =========================================================================
  // MISSING pricing_type (anti-regression)
  // =========================================================================
  describe('MISSING pricing_type (anti-regression)', () => {
    it('NEVER defaults to PER_KM when pricing_type is undefined', () => {
      const result = getFreightPriceDisplay({
        price: 40000,
        pricing_type: undefined,
        price_per_km: 80,
        distance_km: 300,
      });
      expect(result.primarySuffix).not.toBe('/km');
      expect(result.isPricingTypeInvalid).toBe(true);
      expect(result.secondaryLabel).toContain('não informado');
    });

    it('NEVER defaults to PER_KM when pricing_type is null', () => {
      const result = getFreightPriceDisplay({
        price: 40000,
        pricing_type: null,
        price_per_km: 80,
      });
      expect(result.primarySuffix).not.toBe('/km');
      expect(result.isPricingTypeInvalid).toBe(true);
    });

    it('NEVER defaults to PER_KM when pricing_type is empty string', () => {
      const result = getFreightPriceDisplay({
        price: 40000,
        pricing_type: '',
        price_per_km: 80,
      });
      expect(result.primarySuffix).not.toBe('/km');
      expect(result.isPricingTypeInvalid).toBe(true);
    });

    it('logs warning when pricing_type is missing', () => {
      getFreightPriceDisplay({ price: 100, pricing_type: undefined });
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('pricing_type AUSENTE')
      );
    });
  });
});
