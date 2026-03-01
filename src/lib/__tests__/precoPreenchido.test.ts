import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  precoPreenchidoDoFrete,
  limparCachePrecoPreenchido,
} from '../precoPreenchido';

beforeEach(() => {
  limparCachePrecoPreenchido();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('precoPreenchidoDoFrete', () => {
  describe('PER_TON (POR_TONELADA)', () => {
    it('exibe R$ 80,00/ton — NUNCA /veículo — com 12 carretas', () => {
      const result = precoPreenchidoDoFrete('frete-001', {
        pricing_type: 'PER_TON',
        price_per_km: 80, // campo sobrecarregado = rate por tonelada
        price: 40000,
        required_trucks: 12,
        weight: 500000, // 500 ton
        distance_km: 130,
      });

      expect(result.primaryText).toBe('R$ 80,00/ton');
      expect(result.suffix).toBe('/ton');
      expect(result.unitValue).toBe(80);
      expect(result.pricingType).toBe('PER_TON');
      expect(result.invalid).toBe(false);
      // NUNCA /veículo
      expect(result.primaryText).not.toContain('/veículo');
      expect(result.primaryText).not.toContain('277');
    });

    it('usa price_per_ton quando disponível', () => {
      const result = precoPreenchidoDoFrete('frete-002', {
        pricing_type: 'PER_TON',
        price_per_ton: 95,
        price: 47500,
        required_trucks: 5,
        weight: 500000,
      });

      expect(result.primaryText).toBe('R$ 95,00/ton');
      expect(result.unitValue).toBe(95);
    });

    it('aceita aliases: POR_TONELADA', () => {
      const result = precoPreenchidoDoFrete('frete-003', {
        pricing_type: 'POR_TONELADA',
        price_per_km: 80,
        price: 40000,
        required_trucks: 12,
      });

      expect(result.suffix).toBe('/ton');
      expect(result.unitValue).toBe(80);
    });

    it('nunca divide por required_trucks', () => {
      [1, 3, 12, 50].forEach((trucks) => {
        limparCachePrecoPreenchido();
        const result = precoPreenchidoDoFrete(`ton-${trucks}`, {
          pricing_type: 'PER_TON',
          price_per_km: 80,
          price: 80 * 500,
          required_trucks: trucks,
          weight: 500000,
        });
        expect(result.unitValue).toBe(80);
        expect(result.suffix).toBe('/ton');
      });
    });
  });

  describe('PER_KM', () => {
    it('exibe R$ 3,00/km', () => {
      const result = precoPreenchidoDoFrete('frete-km-1', {
        pricing_type: 'PER_KM',
        price_per_km: 3,
        price: 900,
        distance_km: 300,
        required_trucks: 2,
      });

      expect(result.primaryText).toBe('R$ 3,00/km');
      expect(result.suffix).toBe('/km');
      expect(result.unitValue).toBe(3);
    });
  });

  describe('FIXED', () => {
    it('exibe /veículo com 12 carretas', () => {
      const result = precoPreenchidoDoFrete('frete-fixed-1', {
        pricing_type: 'FIXED',
        price: 40000,
        required_trucks: 12,
        distance_km: 130,
      });

      expect(result.suffix).toBe('/veículo');
      expect(result.unitValue).toBeCloseTo(3333.33, 0);
      expect(result.primaryText).toContain('/veículo');
    });

    it('exibe valor total sem sufixo para 1 carreta', () => {
      const result = precoPreenchidoDoFrete('frete-fixed-solo', {
        pricing_type: 'FIXED',
        price: 5000,
        required_trucks: 1,
      });

      expect(result.unitValue).toBe(5000);
    });
  });

  describe('pricing_type ausente/inválido', () => {
    it('retorna "Preço indisponível"', () => {
      const result = precoPreenchidoDoFrete('frete-invalid', {
        pricing_type: null,
        price: 1000,
      });

      expect(result.primaryText).toBe('Preço indisponível');
      expect(result.invalid).toBe(true);
    });
  });

  describe('cache', () => {
    it('retorna resultado cacheado para mesmo ID', () => {
      const input = {
        pricing_type: 'PER_TON' as const,
        price_per_km: 80,
        price: 40000,
        required_trucks: 12,
      };

      const r1 = precoPreenchidoDoFrete('cache-test', input);
      const r2 = precoPreenchidoDoFrete('cache-test', input);
      expect(r1).toBe(r2); // same reference
    });

    it('limpa cache específico', () => {
      const input = { pricing_type: 'FIXED' as const, price: 1000, required_trucks: 1 };
      const r1 = precoPreenchidoDoFrete('clear-test', input);
      limparCachePrecoPreenchido('clear-test');
      const r2 = precoPreenchidoDoFrete('clear-test', input);
      expect(r1).not.toBe(r2);
      expect(r1.primaryText).toBe(r2.primaryText);
    });
  });
});
