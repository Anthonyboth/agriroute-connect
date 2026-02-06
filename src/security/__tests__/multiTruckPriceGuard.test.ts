/**
 * Testes de segurança financeira multi-carreta.
 * 
 * Cobre:
 * - Valor errado exibido para motorista
 * - Consistência de preços
 * - Contextos diferentes (motorista vs produtor)
 */

import { describe, it, expect } from 'vitest';
import {
  assertPriceIsPerTruck,
  getPricePerTruck,
  formatPriceForUser,
  validatePriceConsistency,
  PriceGuardError,
} from '../multiTruckPriceGuard';

describe('multiTruckPriceGuard', () => {
  // =========================================================================
  // assertPriceIsPerTruck
  // =========================================================================
  
  describe('assertPriceIsPerTruck', () => {
    it('lança erro quando valor total é exibido como unitário em multi-carreta', () => {
      expect(() => assertPriceIsPerTruck({
        displayPrice: 10000,
        freightPrice: 10000,
        requiredTrucks: 5,
      })).toThrow(PriceGuardError);
    });

    it('não lança erro quando valor é corretamente por carreta', () => {
      expect(() => assertPriceIsPerTruck({
        displayPrice: 2000,
        freightPrice: 10000,
        requiredTrucks: 5,
      })).not.toThrow();
    });

    it('não se aplica a carreta única', () => {
      expect(() => assertPriceIsPerTruck({
        displayPrice: 10000,
        freightPrice: 10000,
        requiredTrucks: 1,
      })).not.toThrow();
    });
  });

  // =========================================================================
  // getPricePerTruck
  // =========================================================================
  
  describe('getPricePerTruck', () => {
    it('usa agreed_price como fonte da verdade', () => {
      const price = getPricePerTruck({
        freightPrice: 10000,
        requiredTrucks: 5,
        agreedPrice: 2500,
      });
      expect(price).toBe(2500);
    });

    it('divide preço total quando agreed_price não disponível', () => {
      const price = getPricePerTruck({
        freightPrice: 10000,
        requiredTrucks: 5,
        agreedPrice: null,
      });
      expect(price).toBe(2000);
    });

    it('retorna preço total para carreta única', () => {
      const price = getPricePerTruck({
        freightPrice: 10000,
        requiredTrucks: 1,
        agreedPrice: null,
      });
      expect(price).toBe(10000);
    });

    it('trata valores null/undefined com segurança', () => {
      const price = getPricePerTruck({
        freightPrice: null,
        requiredTrucks: undefined,
        agreedPrice: undefined,
      });
      expect(price).toBe(0);
    });
  });

  // =========================================================================
  // formatPriceForUser
  // =========================================================================
  
  describe('formatPriceForUser', () => {
    it('motorista em multi-carreta vê apenas valor por carreta', () => {
      const result = formatPriceForUser({
        freightPrice: 10000,
        requiredTrucks: 5,
        agreedPrice: 2500,
        context: 'DRIVER',
      });

      expect(result.displayPrice).toBe(2500);
      expect(result.isPerTruck).toBe(true);
      expect(result.totalPrice).toBeNull(); // Escondido do motorista
      expect(result.formattedTotalPrice).toBeNull();
      expect(result.displayLabel).toContain('carreta');
    });

    it('produtor vê valor total', () => {
      const result = formatPriceForUser({
        freightPrice: 10000,
        requiredTrucks: 5,
        agreedPrice: 2500,
        context: 'PRODUCER',
      });

      expect(result.displayPrice).toBe(10000);
      expect(result.isPerTruck).toBe(false);
      expect(result.totalPrice).toBe(10000);
    });

    it('motorista em carreta única vê valor total', () => {
      const result = formatPriceForUser({
        freightPrice: 5000,
        requiredTrucks: 1,
        agreedPrice: 5000,
        context: 'DRIVER',
      });

      expect(result.displayPrice).toBe(5000);
      expect(result.isMultiTruck).toBe(false);
    });
  });

  // =========================================================================
  // validatePriceConsistency
  // =========================================================================
  
  describe('validatePriceConsistency', () => {
    it('preços válidos não lançam erro', () => {
      expect(() => validatePriceConsistency({
        freightPrice: 10000,
        agreedPrice: 2000,
        requiredTrucks: 5,
      })).not.toThrow();
    });

    it('agreed_price zero lança erro', () => {
      expect(() => validatePriceConsistency({
        freightPrice: 10000,
        agreedPrice: 0,
        requiredTrucks: 5,
      })).toThrow(PriceGuardError);
    });

    it('unitário maior que total lança erro em multi-carreta', () => {
      expect(() => validatePriceConsistency({
        freightPrice: 10000,
        agreedPrice: 15000,
        requiredTrucks: 5,
      })).toThrow(PriceGuardError);
    });

    it('unitário pode ser igual ao total em carreta única', () => {
      expect(() => validatePriceConsistency({
        freightPrice: 5000,
        agreedPrice: 5000,
        requiredTrucks: 1,
      })).not.toThrow();
    });
  });
});
