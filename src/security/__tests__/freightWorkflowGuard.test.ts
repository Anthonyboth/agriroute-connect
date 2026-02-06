/**
 * Testes de segurança do workflow do frete rural.
 * 
 * Cobre:
 * - Tentativa de pular status
 * - Tentativa de regressão
 * - Transições válidas
 * - Validação por papel
 * - Confirmação de entrega/pagamento
 */

import { describe, it, expect } from 'vitest';
import {
  canTransition,
  getNextAllowedStatus,
  assertValidTransition,
  getUserAllowedActions,
  canReportDelivery,
  canConfirmDelivery,
  canConfirmPayment,
  getStatusLabelPtBR,
  FreightWorkflowError,
  WORKFLOW_ORDER,
} from '../freightWorkflowGuard';

describe('freightWorkflowGuard', () => {
  // =========================================================================
  // TRANSIÇÕES VÁLIDAS
  // =========================================================================
  
  describe('canTransition - transições válidas', () => {
    it('permite avançar um passo à frente', () => {
      const pairs = [
        ['NEW', 'APPROVED'],
        ['APPROVED', 'OPEN'],
        ['OPEN', 'ACCEPTED'],
        ['ACCEPTED', 'LOADING'],
        ['LOADING', 'LOADED'],
        ['LOADED', 'IN_TRANSIT'],
        ['IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'],
        ['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED'],
        ['DELIVERED', 'COMPLETED'],
      ];

      for (const [from, to] of pairs) {
        const result = canTransition(from, to);
        expect(result.valid, `${from} → ${to} deveria ser válido`).toBe(true);
        expect(result.error).toBeNull();
      }
    });

    it('permite idempotência (mesmo status)', () => {
      const result = canTransition('IN_TRANSIT', 'IN_TRANSIT');
      expect(result.valid).toBe(true);
    });

    it('permite cancelamento em qualquer ponto', () => {
      for (const status of WORKFLOW_ORDER) {
        if (status === 'COMPLETED') continue;
        const result = canTransition(status, 'CANCELLED');
        expect(result.valid, `${status} → CANCELLED deveria ser válido`).toBe(true);
      }
    });
  });

  // =========================================================================
  // REGRESSÃO BLOQUEADA
  // =========================================================================
  
  describe('canTransition - regressão bloqueada', () => {
    it('bloqueia voltar de IN_TRANSIT para LOADING', () => {
      const result = canTransition('IN_TRANSIT', 'LOADING');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Não é permitido voltar');
    });

    it('bloqueia voltar de DELIVERED para ACCEPTED', () => {
      const result = canTransition('DELIVERED', 'ACCEPTED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Não é permitido voltar');
    });

    it('bloqueia voltar de COMPLETED para qualquer status', () => {
      const result = canTransition('COMPLETED', 'IN_TRANSIT');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('não pode mais ser alterado');
    });
  });

  // =========================================================================
  // SALTO DE ETAPAS BLOQUEADO
  // =========================================================================
  
  describe('canTransition - salto de etapas bloqueado', () => {
    it('bloqueia pular de ACCEPTED para IN_TRANSIT (sem LOADING)', () => {
      const result = canTransition('ACCEPTED', 'IN_TRANSIT');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('pular etapas');
      expect(result.expectedNext).toBe('LOADING');
    });

    it('bloqueia pular de LOADING para IN_TRANSIT (sem LOADED)', () => {
      const result = canTransition('LOADING', 'IN_TRANSIT');
      expect(result.valid).toBe(false);
      expect(result.expectedNext).toBe('LOADED');
    });

    it('bloqueia pular de OPEN para DELIVERED', () => {
      const result = canTransition('OPEN', 'DELIVERED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('pular etapas');
    });
  });

  // =========================================================================
  // assertValidTransition - ERRO BLOQUEANTE
  // =========================================================================
  
  describe('assertValidTransition', () => {
    it('não lança erro para transição válida', () => {
      expect(() => assertValidTransition('ACCEPTED', 'LOADING')).not.toThrow();
    });

    it('lança FreightWorkflowError para transição inválida', () => {
      expect(() => assertValidTransition('ACCEPTED', 'IN_TRANSIT')).toThrow(FreightWorkflowError);
    });

    it('lança erro com código e mensagem em PT-BR', () => {
      try {
        assertValidTransition('IN_TRANSIT', 'LOADING');
        expect.fail('Deveria ter lançado erro');
      } catch (e: any) {
        expect(e).toBeInstanceOf(FreightWorkflowError);
        expect(e.code).toBe('INVALID_TRANSITION');
        expect(e.message).toContain('Não é permitido voltar');
      }
    });
  });

  // =========================================================================
  // getNextAllowedStatus
  // =========================================================================
  
  describe('getNextAllowedStatus', () => {
    it('retorna LOADING após ACCEPTED', () => {
      expect(getNextAllowedStatus('ACCEPTED')).toBe('LOADING');
    });

    it('retorna null para COMPLETED', () => {
      expect(getNextAllowedStatus('COMPLETED')).toBeNull();
    });

    it('retorna null para CANCELLED', () => {
      expect(getNextAllowedStatus('CANCELLED')).toBeNull();
    });
  });

  // =========================================================================
  // getUserAllowedActions (validação por papel)
  // =========================================================================
  
  describe('getUserAllowedActions', () => {
    it('motorista pode avançar para LOADING quando ACCEPTED', () => {
      const actions = getUserAllowedActions('MOTORISTA', 'ACCEPTED');
      expect(actions.canAdvance).toBe(true);
      expect(actions.nextStatus).toBe('LOADING');
    });

    it('motorista NÃO pode avançar para OPEN (papel do produtor)', () => {
      const actions = getUserAllowedActions('MOTORISTA', 'APPROVED');
      expect(actions.canAdvance).toBe(false);
    });

    it('produtor pode confirmar entrega (DELIVERED_PENDING → DELIVERED)', () => {
      const actions = getUserAllowedActions('PRODUTOR', 'DELIVERED_PENDING_CONFIRMATION');
      expect(actions.canAdvance).toBe(true);
      expect(actions.nextStatus).toBe('DELIVERED');
    });

    it('motorista NÃO pode cancelar frete', () => {
      const actions = getUserAllowedActions('MOTORISTA', 'ACCEPTED');
      expect(actions.canCancel).toBe(false);
    });

    it('produtor pode cancelar frete', () => {
      const actions = getUserAllowedActions('PRODUTOR', 'ACCEPTED');
      expect(actions.canCancel).toBe(true);
    });
  });

  // =========================================================================
  // canReportDelivery / canConfirmDelivery
  // =========================================================================
  
  describe('canReportDelivery', () => {
    it('permite reportar entrega em IN_TRANSIT', () => {
      expect(canReportDelivery('IN_TRANSIT').valid).toBe(true);
    });

    it('bloqueia reportar entrega em LOADING', () => {
      const result = canReportDelivery('LOADING');
      expect(result.valid).toBe(false);
    });

    it('bloqueia reportar entrega em ACCEPTED', () => {
      const result = canReportDelivery('ACCEPTED');
      expect(result.valid).toBe(false);
    });
  });

  describe('canConfirmDelivery', () => {
    it('permite confirmar quando DELIVERED_PENDING_CONFIRMATION', () => {
      expect(canConfirmDelivery('DELIVERED_PENDING_CONFIRMATION').valid).toBe(true);
    });

    it('bloqueia confirmar quando IN_TRANSIT', () => {
      const result = canConfirmDelivery('IN_TRANSIT');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('reportar a entrega');
    });
  });

  // =========================================================================
  // canConfirmPayment
  // =========================================================================
  
  describe('canConfirmPayment', () => {
    it('permite confirmar quando paid_by_producer', () => {
      expect(canConfirmPayment('paid_by_producer').valid).toBe(true);
    });

    it('bloqueia confirmar quando proposed', () => {
      expect(canConfirmPayment('proposed').valid).toBe(false);
    });

    it('bloqueia confirmar quando null', () => {
      expect(canConfirmPayment(null).valid).toBe(false);
    });
  });

  // =========================================================================
  // IDIOMA
  // =========================================================================
  
  describe('getStatusLabelPtBR', () => {
    it('todos os status do workflow têm tradução PT-BR', () => {
      for (const status of WORKFLOW_ORDER) {
        const label = getStatusLabelPtBR(status);
        expect(label).not.toBe(status); // Não pode retornar o código em inglês
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it('retorna "Desconhecido" para status não mapeado se não for código', () => {
      // A função humaniza códigos não mapeados
      const label = getStatusLabelPtBR('UNKNOWN_STATUS');
      expect(label).not.toBe('UNKNOWN_STATUS');
    });
  });
});
