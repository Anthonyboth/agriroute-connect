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

  describe('PER_TON', () => {
    it('shows /ton suffix — NEVER /km', () => {
      const result = getFreightPriceDisplay({
        price: 40000,
        pricing_type: 'PER_TON',
        price_per_km: 80,
        weight: 500000, // 500 tons
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
  });

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
  });

  describe('FIXED', () => {
    it('shows no unit suffix', () => {
      const result = getFreightPriceDisplay({
        price: 1200,
        pricing_type: 'FIXED',
        distance_km: 200,
      });
      expect(result.primarySuffix).toBe('');
      expect(result.pricingType).toBe('FIXED');
      expect(result.primaryValue).toBe(1200);
      expect(result.isPricingTypeInvalid).toBe(false);
    });

    it('shows /carreta for multi-truck', () => {
      const result = getFreightPriceDisplay({
        price: 12000,
        pricing_type: 'FIXED',
        required_trucks: 3,
      });
      expect(result.primarySuffix).toBe('/carreta');
      expect(result.primaryValue).toBe(4000);
    });
  });

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
