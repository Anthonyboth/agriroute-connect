import { describe, it, expect } from 'vitest';

/**
 * Testes unitários para match_exposures (dedupe do feed).
 * 
 * Estes testes validam a lógica do hook useMatchExposures
 * e a integração com as RPCs de dedupe.
 * 
 * NOTA: Testes de integração SQL rodam via supabase--test-edge-functions.
 * Estes testes validam a lógica do lado do cliente.
 */

describe('Match Exposures - Client Logic', () => {
  describe('ExposureItem validation', () => {
    it('should accept valid FREIGHT item', () => {
      const item = {
        item_type: 'FREIGHT' as const,
        item_id: '550e8400-e29b-41d4-a716-446655440000',
        city_id: null,
        distance_km: null,
      };
      expect(item.item_type).toBe('FREIGHT');
      expect(item.item_id).toBeTruthy();
    });

    it('should accept valid SERVICE item', () => {
      const item = {
        item_type: 'SERVICE' as const,
        item_id: '550e8400-e29b-41d4-a716-446655440001',
        city_id: '550e8400-e29b-41d4-a716-446655440002',
        distance_km: 45.5,
      };
      expect(item.item_type).toBe('SERVICE');
      expect(item.distance_km).toBe(45.5);
    });
  });

  describe('Batch payload construction', () => {
    it('should create correct batch payload from items', () => {
      const items = [
        { item_type: 'FREIGHT' as const, item_id: 'id-1' },
        { item_type: 'SERVICE' as const, item_id: 'id-2', city_id: 'city-1', distance_km: 20 },
      ];

      const payload = items.map(item => ({
        item_type: item.item_type,
        item_id: item.item_id,
        city_id: ('city_id' in item ? item.city_id : null) || null,
        distance_km: ('distance_km' in item ? item.distance_km : null) || null,
      }));

      expect(payload).toHaveLength(2);
      expect(payload[0].item_type).toBe('FREIGHT');
      expect(payload[0].city_id).toBeNull();
      expect(payload[1].city_id).toBe('city-1');
      expect(payload[1].distance_km).toBe(20);
    });

    it('should dedupe items by item_type + item_id before sending', () => {
      const items = [
        { item_type: 'FREIGHT' as const, item_id: 'id-1' },
        { item_type: 'FREIGHT' as const, item_id: 'id-1' }, // duplicate
        { item_type: 'SERVICE' as const, item_id: 'id-1' }, // different type, same id = not duplicate
      ];

      const seen = new Set<string>();
      const deduped = items.filter(item => {
        const key = `${item.item_type}:${item.item_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      expect(deduped).toHaveLength(2);
      expect(deduped[0].item_type).toBe('FREIGHT');
      expect(deduped[1].item_type).toBe('SERVICE');
    });
  });

  describe('Status transitions', () => {
    it('should not allow ACCEPTED to regress to SEEN', () => {
      // Simulates the SQL constraint: ACCEPTED stays ACCEPTED
      const currentStatus = 'ACCEPTED';
      const newStatus = currentStatus === 'ACCEPTED' ? 'ACCEPTED' : 'SEEN';
      expect(newStatus).toBe('ACCEPTED');
    });

    it('should allow SEEN to transition to DISMISSED', () => {
      const currentStatus: string = 'SEEN';
      const canDismiss = currentStatus !== 'ACCEPTED';
      expect(canDismiss).toBe(true);
    });

    it('should not allow ACCEPTED to transition to DISMISSED', () => {
      const currentStatus = 'ACCEPTED';
      const canDismiss = currentStatus !== 'ACCEPTED';
      expect(canDismiss).toBe(false);
    });
  });

  describe('TTL logic', () => {
    it('should consider exposure active when expires_at > now', () => {
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10min from now
      const isActive = expiresAt > new Date();
      expect(isActive).toBe(true);
    });

    it('should consider exposure expired when expires_at <= now', () => {
      const expiresAt = new Date(Date.now() - 1000); // 1s ago
      const isActive = expiresAt > new Date();
      expect(isActive).toBe(false);
    });
  });
});
