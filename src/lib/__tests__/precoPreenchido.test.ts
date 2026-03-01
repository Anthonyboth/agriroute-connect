import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  precoPreenchidoDoFrete,
  limparCachePrecoPreenchido,
} from '../precoPreenchido';

beforeEach(() => {
  limparCachePrecoPreenchido();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('precoPreenchidoDoFrete — PADRÃO GLOBAL', () => {
  
  // ─── PER_TON ───────────────────────────────────────────────
  
  describe('PER_TON', () => {
    it('unit_rate 130 → "R$ 130,00/ton"', () => {
      const r = precoPreenchidoDoFrete('ton-130', {
        pricing_type: 'PER_TON',
        price_per_km: 130, // campo sobrecarregado
        price: 65000,
        required_trucks: 12,
        weight: 500000,
      });
      expect(r.primaryText).toBe('R$ 130,00/ton');
      expect(r.unitValue).toBe(130);
      expect(r.suffix).toBe('/ton');
      expect(r.pricingType).toBe('PER_TON');
      expect(r.invalid).toBe(false);
    });

    it('unit_rate 80 com 12 carretas → NUNCA /veíc ou /veículo', () => {
      const r = precoPreenchidoDoFrete('ton-80', {
        pricing_type: 'PER_TON',
        price_per_km: 80,
        price: 40000,
        required_trucks: 12,
        weight: 500000,
      });
      expect(r.primaryText).toBe('R$ 80,00/ton');
      expect(r.primaryText).not.toContain('/veíc');
      expect(r.primaryText).not.toContain('/veículo');
      expect(r.primaryText).not.toContain('277');
    });

    it('usa price_per_ton quando disponível', () => {
      const r = precoPreenchidoDoFrete('ton-ppt', {
        pricing_type: 'PER_TON',
        price_per_ton: 95,
        price_per_km: 80,
        price: 47500,
        required_trucks: 5,
      });
      expect(r.primaryText).toBe('R$ 95,00/ton');
      expect(r.unitValue).toBe(95);
    });

    it('aceita alias POR_TONELADA', () => {
      const r = precoPreenchidoDoFrete('ton-alias', {
        pricing_type: 'POR_TONELADA',
        price_per_km: 80,
        price: 40000,
        required_trucks: 12,
      });
      expect(r.suffix).toBe('/ton');
      expect(r.unitValue).toBe(80);
    });

    it('NUNCA divide por required_trucks', () => {
      [1, 3, 12, 50].forEach((trucks) => {
        limparCachePrecoPreenchido();
        const r = precoPreenchidoDoFrete(`ton-trucks-${trucks}`, {
          pricing_type: 'PER_TON',
          price_per_km: 80,
          price: 80 * 500,
          required_trucks: trucks,
          weight: 500000,
        });
        expect(r.unitValue).toBe(80);
        expect(r.suffix).toBe('/ton');
      });
    });
  });

  // ─── PER_KM ────────────────────────────────────────────────

  describe('PER_KM', () => {
    it('unit_rate 12 → "R$ 12,00/km"', () => {
      const r = precoPreenchidoDoFrete('km-12', {
        pricing_type: 'PER_KM',
        price_per_km: 12,
        price: 3600,
        distance_km: 300,
        required_trucks: 2,
      });
      expect(r.primaryText).toBe('R$ 12,00/km');
      expect(r.unitValue).toBe(12);
      expect(r.suffix).toBe('/km');
      expect(r.pricingType).toBe('PER_KM');
    });

    it('NUNCA exibe /veíc', () => {
      const r = precoPreenchidoDoFrete('km-no-veic', {
        pricing_type: 'PER_KM',
        price_per_km: 3,
        price: 900,
        distance_km: 300,
        required_trucks: 5,
      });
      expect(r.primaryText).not.toContain('/veíc');
    });
  });

  // ─── PER_VEHICLE (ex-FIXED) ────────────────────────────────

  describe('PER_VEHICLE', () => {
    it('unit_rate 4500 com required_trucks 12 → "R$ 4.500,00/veíc" (NUNCA 375 ou 277)', () => {
      const r = precoPreenchidoDoFrete('veic-4500', {
        pricing_type: 'FIXED', // legacy DB value
        price: 4500,
        required_trucks: 12,
        distance_km: 130,
      });
      expect(r.primaryText).toBe('R$ 4.500,00/veíc');
      expect(r.unitValue).toBe(4500);
      expect(r.suffix).toBe('/veíc');
      expect(r.pricingType).toBe('PER_VEHICLE');
      expect(r.primaryText).not.toContain('375');
      expect(r.primaryText).not.toContain('277');
    });

    it('NUNCA divide price por required_trucks', () => {
      [1, 5, 12, 100].forEach((trucks) => {
        limparCachePrecoPreenchido();
        const r = precoPreenchidoDoFrete(`veic-trucks-${trucks}`, {
          pricing_type: 'FIXED',
          price: 4500,
          required_trucks: trucks,
        });
        expect(r.unitValue).toBe(4500);
        expect(r.suffix).toBe('/veíc');
      });
    });

    it('aceita pricing_type PER_VEHICLE diretamente', () => {
      const r = precoPreenchidoDoFrete('veic-direct', {
        pricing_type: 'PER_VEHICLE',
        price: 3000,
        required_trucks: 3,
      });
      expect(r.primaryText).toBe('R$ 3.000,00/veíc');
      expect(r.unitValue).toBe(3000);
    });
  });

  // ─── FALLBACK ──────────────────────────────────────────────

  describe('pricing_type ausente/inválido', () => {
    it('retorna "Preço indisponível" se pricing_type null', () => {
      const r = precoPreenchidoDoFrete('invalid-null', {
        pricing_type: null,
        price: 1000,
      });
      expect(r.primaryText).toBe('Preço indisponível');
      expect(r.invalid).toBe(true);
    });

    it('retorna "Preço indisponível" se unit_rate ausente', () => {
      const r = precoPreenchidoDoFrete('invalid-no-rate', {
        pricing_type: 'PER_TON',
        price: null,
        price_per_km: null,
        price_per_ton: null,
      });
      expect(r.primaryText).toBe('Preço indisponível');
      expect(r.invalid).toBe(true);
    });
  });

  // ─── CACHE ─────────────────────────────────────────────────

  describe('cache', () => {
    it('retorna mesma referência para mesmo ID', () => {
      const input = { pricing_type: 'PER_TON', price_per_km: 80, price: 40000, required_trucks: 12 };
      const r1 = precoPreenchidoDoFrete('cache-1', input);
      const r2 = precoPreenchidoDoFrete('cache-1', input);
      expect(r1).toBe(r2);
    });

    it('limpa cache por freightId', () => {
      const input = { pricing_type: 'FIXED', price: 5000, required_trucks: 1 };
      const r1 = precoPreenchidoDoFrete('cache-clear', input);
      limparCachePrecoPreenchido('cache-clear');
      const r2 = precoPreenchidoDoFrete('cache-clear', input);
      expect(r1).not.toBe(r2);
      expect(r1.primaryText).toBe(r2.primaryText);
    });
  });

  // ─── SECONDARY TEXT ────────────────────────────────────────

  describe('secondaryText', () => {
    it('PER_TON inclui peso e carretas', () => {
      const r = precoPreenchidoDoFrete('sec-ton', {
        pricing_type: 'PER_TON',
        price_per_km: 80,
        weight: 500000,
        required_trucks: 12,
      });
      expect(r.secondaryText).toContain('500.0 ton');
      expect(r.secondaryText).toContain('12 carretas');
    });

    it('PER_KM inclui distância', () => {
      const r = precoPreenchidoDoFrete('sec-km', {
        pricing_type: 'PER_KM',
        price_per_km: 3,
        distance_km: 300,
        required_trucks: 2,
      });
      expect(r.secondaryText).toContain('300 km');
    });

    it('secondaryText NUNCA contém R$', () => {
      const r = precoPreenchidoDoFrete('sec-no-money', {
        pricing_type: 'PER_TON',
        price_per_km: 80,
        price: 40000,
        weight: 500000,
        required_trucks: 12,
      });
      expect(r.secondaryText).not.toContain('R$');
    });
  });

  // ─── unitOnly GATING ───────────────────────────────────────

  describe('unitOnly gating', () => {
    it('unitOnly=true strips secondaryText for PER_TON', () => {
      const r = precoPreenchidoDoFrete('uo-ton', {
        pricing_type: 'PER_TON',
        price_per_km: 80,
        weight: 500000,
        required_trucks: 12,
      }, { unitOnly: true });
      expect(r.primaryText).toBe('R$ 80,00/ton');
      expect(r.secondaryText).toBeNull();
    });

    it('unitOnly=true strips secondaryText for PER_KM', () => {
      const r = precoPreenchidoDoFrete('uo-km', {
        pricing_type: 'PER_KM',
        price_per_km: 12,
        distance_km: 300,
        required_trucks: 2,
      }, { unitOnly: true });
      expect(r.primaryText).toBe('R$ 12,00/km');
      expect(r.secondaryText).toBeNull();
    });

    it('unitOnly does NOT affect primaryText', () => {
      limparCachePrecoPreenchido();
      const full = precoPreenchidoDoFrete('uo-compare-full', {
        pricing_type: 'PER_TON',
        price_per_km: 80,
        weight: 500000,
      });
      limparCachePrecoPreenchido();
      const unit = precoPreenchidoDoFrete('uo-compare-unit', {
        pricing_type: 'PER_TON',
        price_per_km: 80,
        weight: 500000,
      }, { unitOnly: true });
      expect(full.primaryText).toBe(unit.primaryText);
    });

    it('PER_TON with price=40000 and trucks=12: unitOnly NEVER shows 3333 or 40000', () => {
      const r = precoPreenchidoDoFrete('uo-never-total', {
        pricing_type: 'PER_TON',
        price: 40000,
        price_per_km: 80,
        required_trucks: 12,
        weight: 500000,
      }, { unitOnly: true });
      expect(r.primaryText).toBe('R$ 80,00/ton');
      expect(r.primaryText).not.toContain('40.000');
      expect(r.primaryText).not.toContain('3.333');
    });
  });
});
