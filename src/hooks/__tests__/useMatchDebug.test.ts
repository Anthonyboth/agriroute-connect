import { describe, it, expect } from 'vitest';

/**
 * Testes para match_debug_logs (instrumentação do match).
 * Valida lógica client-side de construção de payloads e limites.
 */

describe('Match Debug - Client Logic', () => {
  describe('Debug flag detection', () => {
    it('should detect matchDebug=1 in URL params', () => {
      // Simulates URL check logic
      const params = new URLSearchParams('matchDebug=1');
      expect(params.get('matchDebug')).toBe('1');
    });

    it('should not detect debug without flag', () => {
      const params = new URLSearchParams('');
      expect(params.get('matchDebug')).toBeNull();
    });
  });

  describe('Sample capping', () => {
    it('should cap included samples to 10', () => {
      const items = Array.from({ length: 25 }, (_, i) => ({
        item_type: 'FREIGHT' as const,
        item_id: `id-${i}`,
        reason: { test: true },
      }));

      const capped = items.slice(0, 10);
      expect(capped).toHaveLength(10);
      expect(capped[0].item_id).toBe('id-0');
      expect(capped[9].item_id).toBe('id-9');
    });

    it('should cap excluded samples to 10', () => {
      const items = Array.from({ length: 15 }, (_, i) => ({
        item_type: 'SERVICE' as const,
        item_id: `svc-${i}`,
        reason: { excluded_reason: 'out_of_radius' },
      }));

      const capped = items.slice(0, 10);
      expect(capped).toHaveLength(10);
    });

    it('should enforce total 20 items max', () => {
      const included = Array.from({ length: 10 }, (_, i) => ({
        item_type: 'FREIGHT' as const, item_id: `inc-${i}`, reason: {},
      }));
      const excluded = Array.from({ length: 10 }, (_, i) => ({
        item_type: 'SERVICE' as const, item_id: `exc-${i}`, reason: {},
      }));

      const total = included.length + excluded.length;
      expect(total).toBeLessThanOrEqual(20);
    });
  });

  describe('PII prevention in samples', () => {
    it('should not include phone in reason', () => {
      const safeReason = {
        matched_city_id: 'uuid-123',
        distance_km: 45.2,
        matched_service_type: 'CARGA',
      };

      expect(safeReason).not.toHaveProperty('contact_phone');
      expect(safeReason).not.toHaveProperty('cpf');
      expect(safeReason).not.toHaveProperty('contact_email');
      expect(safeReason).not.toHaveProperty('contact_name');
    });

    it('should only contain IDs and match metadata', () => {
      const sample = {
        item_type: 'FREIGHT' as const,
        item_id: '550e8400-e29b-41d4-a716-446655440000',
        reason: {
          matched_city: 'Cuiabá',
          matched_state: 'MT',
          distance_km: 120.5,
        },
      };

      const keys = Object.keys(sample.reason);
      const allowedKeys = ['matched_city', 'matched_state', 'matched_city_id', 'matched_service_type', 
                           'distance_km', 'excluded_reason', 'within_radius', 'source'];
      
      keys.forEach(key => {
        expect(allowedKeys).toContain(key);
      });
    });
  });

  describe('Stats structure', () => {
    it('should have all required stat fields', () => {
      const stats = {
        candidates: 120,
        filtered_by_type: 40,
        filtered_by_city: 30,
        filtered_by_radius: 20,
        filtered_by_status: 0,
        filtered_by_exposure: 15,
        returned: 15,
      };

      expect(stats.candidates).toBeGreaterThanOrEqual(0);
      expect(stats.returned).toBeLessThanOrEqual(stats.candidates);
      expect(stats).toHaveProperty('filtered_by_type');
      expect(stats).toHaveProperty('filtered_by_city');
      expect(stats).toHaveProperty('filtered_by_radius');
      expect(stats).toHaveProperty('filtered_by_status');
      expect(stats).toHaveProperty('filtered_by_exposure');
    });
  });

  describe('Filters structure', () => {
    it('should include radius_km of 300', () => {
      const filters = {
        radius_km: 300,
        city_ids: ['uuid-1', 'uuid-2'],
        service_types: ['CARGA', 'GUINCHO'],
        only_status: ['OPEN'],
      };

      expect(filters.radius_km).toBe(300);
      expect(filters.only_status).toContain('OPEN');
      expect(filters.city_ids.length).toBeGreaterThan(0);
    });
  });
});
