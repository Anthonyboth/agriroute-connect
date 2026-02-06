/**
 * Testes de Integração dos Componentes de Segurança Obrigatórios.
 *
 * Cobre:
 * - FreightActionButton: guards, fail-safe, PT-BR
 * - SafePrice: isolamento de preço por papel
 * - SafeStatusBadge: tradução obrigatória
 * - Matriz papel × ação (motorista/produtor/transportadora/admin)
 * - Consistência entre guards
 */

import { describe, it, expect } from 'vitest';

// Guards
import {
  canTransition,
  assertValidTransition,
  getUserAllowedActions,
  canReportDelivery,
  canConfirmDelivery,
  canConfirmPayment,
  getStatusLabelPtBR,
  FreightWorkflowError,
  WORKFLOW_ORDER,
  type FreightWorkflowStatus,
  type UserRole,
} from '../freightWorkflowGuard';

import {
  formatPriceForUser,
  getPricePerTruck,
  validatePriceConsistency,
  assertPriceIsPerTruck,
  PriceGuardError,
  type PriceContext,
} from '../multiTruckPriceGuard';

import {
  getStatusLabelPtBR as i18nGetStatus,
  getActionLabelPtBR,
  detectForbiddenTerms,
  sanitizeForDisplay,
  guardStatusDisplay,
} from '../i18nGuard';

// ===========================================================================
// 1. MATRIZ PAPEL × AÇÃO PERMITIDA
// ===========================================================================

describe('Matriz Papel × Ação Permitida', () => {
  const roles: UserRole[] = ['PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'ADMIN'];
  const statuses: FreightWorkflowStatus[] = [...WORKFLOW_ORDER];

  describe('Motorista — ações permitidas', () => {
    it('pode avançar de ACCEPTED → LOADING', () => {
      const actions = getUserAllowedActions('MOTORISTA', 'ACCEPTED');
      expect(actions.canAdvance).toBe(true);
      expect(actions.nextStatus).toBe('LOADING');
    });

    it('pode avançar LOADING → LOADED → IN_TRANSIT → DELIVERED_PENDING', () => {
      expect(getUserAllowedActions('MOTORISTA', 'LOADING').canAdvance).toBe(true);
      expect(getUserAllowedActions('MOTORISTA', 'LOADED').canAdvance).toBe(true);
      expect(getUserAllowedActions('MOTORISTA', 'IN_TRANSIT').canAdvance).toBe(true);
    });

    it('NÃO pode avançar para OPEN ou APPROVED (fase do produtor)', () => {
      expect(getUserAllowedActions('MOTORISTA', 'NEW').canAdvance).toBe(false);
      expect(getUserAllowedActions('MOTORISTA', 'APPROVED').canAdvance).toBe(false);
    });

    it('NÃO pode confirmar entrega (fase do produtor)', () => {
      expect(getUserAllowedActions('MOTORISTA', 'DELIVERED_PENDING_CONFIRMATION').canAdvance).toBe(false);
    });

    it('NÃO pode cancelar frete', () => {
      for (const status of statuses) {
        expect(
          getUserAllowedActions('MOTORISTA', status).canCancel,
          `Motorista não deve cancelar em ${status}`
        ).toBe(false);
      }
    });
  });

  describe('Motorista Afiliado — mesmas permissões do autônomo', () => {
    it('tem mesmas ações que motorista autônomo', () => {
      for (const status of statuses) {
        const autonomo = getUserAllowedActions('MOTORISTA', status);
        const afiliado = getUserAllowedActions('MOTORISTA_AFILIADO', status);
        expect(afiliado.canAdvance).toBe(autonomo.canAdvance);
        expect(afiliado.nextStatus).toBe(autonomo.nextStatus);
      }
    });
  });

  describe('Produtor — ações permitidas', () => {
    it('pode avançar NEW → APPROVED → OPEN', () => {
      expect(getUserAllowedActions('PRODUTOR', 'NEW').canAdvance).toBe(true);
      expect(getUserAllowedActions('PRODUTOR', 'APPROVED').canAdvance).toBe(true);
    });

    it('pode confirmar entrega (DELIVERED_PENDING → DELIVERED)', () => {
      const actions = getUserAllowedActions('PRODUTOR', 'DELIVERED_PENDING_CONFIRMATION');
      expect(actions.canAdvance).toBe(true);
      expect(actions.nextStatus).toBe('DELIVERED');
    });

    it('pode finalizar (DELIVERED → COMPLETED)', () => {
      const actions = getUserAllowedActions('PRODUTOR', 'DELIVERED');
      expect(actions.canAdvance).toBe(true);
      expect(actions.nextStatus).toBe('COMPLETED');
    });

    it('NÃO pode avançar fase operacional (LOADING, LOADED, IN_TRANSIT)', () => {
      expect(getUserAllowedActions('PRODUTOR', 'ACCEPTED').canAdvance).toBe(false);
      expect(getUserAllowedActions('PRODUTOR', 'LOADING').canAdvance).toBe(false);
      expect(getUserAllowedActions('PRODUTOR', 'LOADED').canAdvance).toBe(false);
      expect(getUserAllowedActions('PRODUTOR', 'IN_TRANSIT').canAdvance).toBe(false);
    });

    it('pode cancelar frete em qualquer status (exceto COMPLETED/CANCELLED)', () => {
      expect(getUserAllowedActions('PRODUTOR', 'ACCEPTED').canCancel).toBe(true);
      expect(getUserAllowedActions('PRODUTOR', 'IN_TRANSIT').canCancel).toBe(true);
      expect(getUserAllowedActions('PRODUTOR', 'COMPLETED').canCancel).toBe(false);
    });
  });

  describe('Transportadora — ações operacionais', () => {
    it('pode avançar fase operacional em nome do motorista', () => {
      expect(getUserAllowedActions('TRANSPORTADORA', 'ACCEPTED').canAdvance).toBe(true);
      expect(getUserAllowedActions('TRANSPORTADORA', 'LOADING').canAdvance).toBe(true);
      expect(getUserAllowedActions('TRANSPORTADORA', 'IN_TRANSIT').canAdvance).toBe(true);
    });

    it('NÃO pode cancelar frete', () => {
      expect(getUserAllowedActions('TRANSPORTADORA', 'ACCEPTED').canCancel).toBe(false);
    });
  });

  describe('Admin — pode tudo', () => {
    it('pode avançar em qualquer status (exceto terminal)', () => {
      for (const status of statuses) {
        if (status === 'COMPLETED') continue;
        const actions = getUserAllowedActions('ADMIN', status);
        expect(
          actions.canAdvance,
          `Admin deve poder avançar em ${status}`
        ).toBe(true);
      }
    });

    it('pode cancelar em qualquer status (exceto terminal)', () => {
      expect(getUserAllowedActions('ADMIN', 'ACCEPTED').canCancel).toBe(true);
      expect(getUserAllowedActions('ADMIN', 'IN_TRANSIT').canCancel).toBe(true);
    });
  });
});

// ===========================================================================
// 2. INTEGRAÇÃO WORKFLOW + PREÇO + i18n
// ===========================================================================

describe('Integração Workflow + Preço + i18n', () => {

  describe('Cenário completo: frete multi-carreta 6 carretas, R$ 32.400 total', () => {
    const freight = {
      price: 32400,
      required_trucks: 6,
      agreed_price: 5400, // 32400 / 6
    };

    it('Motorista vê R$ 5.400,00 /carreta', () => {
      const result = formatPriceForUser({
        freightPrice: freight.price,
        requiredTrucks: freight.required_trucks,
        agreedPrice: freight.agreed_price,
        context: 'DRIVER',
      });

      expect(result.displayPrice).toBe(5400);
      expect(result.isPerTruck).toBe(true);
      expect(result.totalPrice).toBeNull(); // NUNCA para motorista
      expect(result.formattedTotalPrice).toBeNull();
      expect(result.displayLabel).toContain('/carreta');
    });

    it('Motorista NUNCA vê R$ 32.400 (valor total)', () => {
      const result = formatPriceForUser({
        freightPrice: freight.price,
        requiredTrucks: freight.required_trucks,
        agreedPrice: freight.agreed_price,
        context: 'DRIVER',
      });

      expect(result.displayPrice).not.toBe(32400);
      expect(result.formattedPrice).not.toContain('32.400');
    });

    it('Produtor vê R$ 32.400,00 (total)', () => {
      const result = formatPriceForUser({
        freightPrice: freight.price,
        requiredTrucks: freight.required_trucks,
        agreedPrice: freight.agreed_price,
        context: 'PRODUCER',
      });

      expect(result.displayPrice).toBe(32400);
      expect(result.totalPrice).toBe(32400);
      expect(result.isPerTruck).toBe(false);
    });

    it('Transportadora vê R$ 32.400,00 (total)', () => {
      const result = formatPriceForUser({
        freightPrice: freight.price,
        requiredTrucks: freight.required_trucks,
        agreedPrice: freight.agreed_price,
        context: 'COMPANY',
      });

      expect(result.displayPrice).toBe(32400);
      expect(result.totalPrice).toBe(32400);
    });

    it('assertPriceIsPerTruck bloqueia se valor total usado como unitário', () => {
      expect(() => assertPriceIsPerTruck({
        displayPrice: 32400,
        freightPrice: 32400,
        requiredTrucks: 6,
      })).toThrow(PriceGuardError);
    });

    it('assertPriceIsPerTruck aceita valor correto por carreta', () => {
      expect(() => assertPriceIsPerTruck({
        displayPrice: 5400,
        freightPrice: 32400,
        requiredTrucks: 6,
      })).not.toThrow();
    });

    it('validatePriceConsistency aceita preços coerentes', () => {
      expect(() => validatePriceConsistency({
        freightPrice: 32400,
        agreedPrice: 5400,
        requiredTrucks: 6,
      })).not.toThrow();
    });

    it('validatePriceConsistency rejeita unitário > total', () => {
      expect(() => validatePriceConsistency({
        freightPrice: 32400,
        agreedPrice: 40000,
        requiredTrucks: 6,
      })).toThrow(PriceGuardError);
    });
  });

  describe('Cenário: carreta única (sem regras multi-carreta)', () => {
    it('Motorista vê preço total (carreta única)', () => {
      const result = formatPriceForUser({
        freightPrice: 5000,
        requiredTrucks: 1,
        agreedPrice: 5000,
        context: 'DRIVER',
      });

      expect(result.displayPrice).toBe(5000);
      expect(result.isMultiTruck).toBe(false);
      expect(result.isPerTruck).toBe(false);
    });
  });
});

// ===========================================================================
// 3. SEPARAÇÃO DE PODERES (ENTREGA + PAGAMENTO)
// ===========================================================================

describe('Separação de Poderes', () => {

  describe('Entrega', () => {
    it('Apenas motorista pode reportar entrega (IN_TRANSIT → DELIVERED_PENDING)', () => {
      expect(canReportDelivery('IN_TRANSIT').valid).toBe(true);
      expect(canReportDelivery('ACCEPTED').valid).toBe(false);
      expect(canReportDelivery('LOADING').valid).toBe(false);
    });

    it('Apenas produtor pode confirmar entrega', () => {
      const actions = getUserAllowedActions('PRODUTOR', 'DELIVERED_PENDING_CONFIRMATION');
      expect(actions.canAdvance).toBe(true);

      const motorista = getUserAllowedActions('MOTORISTA', 'DELIVERED_PENDING_CONFIRMATION');
      expect(motorista.canAdvance).toBe(false);
    });

    it('canConfirmDelivery só aceita DELIVERED_PENDING_CONFIRMATION', () => {
      expect(canConfirmDelivery('DELIVERED_PENDING_CONFIRMATION').valid).toBe(true);
      expect(canConfirmDelivery('IN_TRANSIT').valid).toBe(false);
      expect(canConfirmDelivery('DELIVERED').valid).toBe(false);
    });
  });

  describe('Pagamento', () => {
    it('Confirmar pagamento requer status "paid_by_producer"', () => {
      expect(canConfirmPayment('paid_by_producer').valid).toBe(true);
    });

    it('Confirmar pagamento bloqueado sem pagamento do produtor', () => {
      expect(canConfirmPayment(null).valid).toBe(false);
      expect(canConfirmPayment('proposed').valid).toBe(false);
      expect(canConfirmPayment(undefined).valid).toBe(false);
      expect(canConfirmPayment('').valid).toBe(false);
    });

    it('Mensagem de bloqueio é em PT-BR', () => {
      const result = canConfirmPayment('proposed');
      expect(result.error).toContain('produtor');
      expect(result.error).toContain('pago');
    });
  });
});

// ===========================================================================
// 4. i18n — COBERTURA COMPLETA
// ===========================================================================

describe('i18n — Cobertura Completa', () => {

  it('Todos os status do workflow têm tradução diferente do código', () => {
    for (const status of WORKFLOW_ORDER) {
      const label = guardStatusDisplay(status);
      expect(label).not.toBe(status);
      expect(label.length).toBeGreaterThan(0);
      // Não pode conter underscore (sinal de código cru)
      expect(label).not.toContain('_');
    }
  });

  it('Status de pagamento têm tradução PT-BR', () => {
    const paymentStatuses = ['PROPOSED', 'PAID_BY_PRODUCER', 'CONFIRMED', 'PROCESSING', 'FAILED', 'REFUNDED'];
    for (const status of paymentStatuses) {
      const label = i18nGetStatus(status);
      expect(label, `Status "${status}" sem tradução`).not.toBe(status);
    }
  });

  it('Ações têm tradução PT-BR', () => {
    const actions = ['ACCEPT', 'REJECT', 'CONFIRM', 'REPORT_DELIVERY', 'CONFIRM_DELIVERY', 'CONFIRM_PAYMENT', 'MARK_PAID'];
    for (const action of actions) {
      const label = getActionLabelPtBR(action);
      expect(label, `Ação "${action}" sem tradução`).not.toBe(action);
    }
  });

  it('detectForbiddenTerms encontra códigos em inglês em texto', () => {
    expect(detectForbiddenTerms('Status: ACCEPTED')).toContain('ACCEPTED');
    expect(detectForbiddenTerms('ACCEPTED LOADING')).toHaveLength(2);
  });

  it('detectForbiddenTerms não detecta texto PT-BR natural', () => {
    expect(detectForbiddenTerms('Frete aceito pelo motorista')).toHaveLength(0);
    expect(detectForbiddenTerms('Em trânsito para destino')).toHaveLength(0);
  });

  it('sanitizeForDisplay substitui todos os termos proibidos', () => {
    const dirty = 'Status: OPEN, motorista ACCEPTED';
    const clean = sanitizeForDisplay(dirty);
    expect(clean).toContain('Aberto');
    expect(clean).toContain('Aceito');
    expect(clean).not.toMatch(/\bOPEN\b/);
    expect(clean).not.toMatch(/\bACCEPTED\b/);
  });

  it('Mensagens de erro dos guards são em PT-BR', () => {
    // Workflow guard
    const transition = canTransition('IN_TRANSIT', 'LOADING');
    expect(transition.error).toContain('Não é permitido');

    // Price guard
    try {
      validatePriceConsistency({ freightPrice: 10000, agreedPrice: 0, requiredTrucks: 5 });
    } catch (e: any) {
      expect(e.message).toContain('maior que zero');
    }

    // Payment guard
    const payment = canConfirmPayment(null);
    expect(payment.error).toContain('produtor');
  });
});

// ===========================================================================
// 5. WORKFLOW — TRANSIÇÕES PROIBIDAS EXTENSIVAS
// ===========================================================================

describe('Workflow — Transições Proibidas Extensivas', () => {

  it('Nenhum status pode pular mais de 1 passo', () => {
    for (let i = 0; i < WORKFLOW_ORDER.length - 2; i++) {
      for (let j = i + 2; j < WORKFLOW_ORDER.length; j++) {
        const result = canTransition(WORKFLOW_ORDER[i], WORKFLOW_ORDER[j]);
        expect(
          result.valid,
          `${WORKFLOW_ORDER[i]} → ${WORKFLOW_ORDER[j]} deveria ser BLOQUEADO`
        ).toBe(false);
      }
    }
  });

  it('Nenhum status pode regredir', () => {
    for (let i = 1; i < WORKFLOW_ORDER.length; i++) {
      for (let j = 0; j < i; j++) {
        const result = canTransition(WORKFLOW_ORDER[i], WORKFLOW_ORDER[j]);
        expect(
          result.valid,
          `${WORKFLOW_ORDER[i]} → ${WORKFLOW_ORDER[j]} deveria ser BLOQUEADO (regressão)`
        ).toBe(false);
      }
    }
  });

  it('Status terminal COMPLETED não permite nenhuma transição', () => {
    for (const target of WORKFLOW_ORDER) {
      if (target === 'COMPLETED') continue;
      const result = canTransition('COMPLETED', target);
      expect(result.valid).toBe(false);
    }
  });

  it('assertValidTransition lança FreightWorkflowError com campos corretos', () => {
    try {
      assertValidTransition('ACCEPTED', 'DELIVERED');
      expect.fail('Deveria ter lançado erro');
    } catch (e: any) {
      expect(e).toBeInstanceOf(FreightWorkflowError);
      expect(e.code).toBe('INVALID_TRANSITION');
      expect(e.currentStatus).toBe('ACCEPTED');
      expect(e.attemptedStatus).toBe('DELIVERED');
      expect(e.message).toBeTruthy();
    }
  });
});

// ===========================================================================
// 6. PREÇO — CENÁRIOS EXTREMOS
// ===========================================================================

describe('Preço — Cenários Extremos', () => {

  it('getPricePerTruck com valores null retorna 0', () => {
    expect(getPricePerTruck({
      freightPrice: null,
      requiredTrucks: null,
      agreedPrice: null,
    })).toBe(0);
  });

  it('getPricePerTruck com 0 carretas trata como 1', () => {
    expect(getPricePerTruck({
      freightPrice: 10000,
      requiredTrucks: 0,
      agreedPrice: null,
    })).toBe(10000);
  });

  it('Fallback de contexto desconhecido é DRIVER (menor exposição)', () => {
    const result = formatPriceForUser({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: 5400,
      context: 'UNKNOWN' as any,
    });
    // Fallback deve esconder total (como motorista)
    expect(result.totalPrice).toBeNull();
    expect(result.isPerTruck).toBe(true);
  });

  it('agreed_price tem prioridade sobre cálculo de divisão', () => {
    // agreed_price = 3000 (diferente de 32400/6 = 5400)
    const price = getPricePerTruck({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: 3000,
    });
    expect(price).toBe(3000); // Não 5400
  });
});

// ===========================================================================
// 7. LOGS SEM PII
// ===========================================================================

describe('Logs sem PII', () => {

  it('Erros de workflow não contêm IDs de usuário', () => {
    try {
      assertValidTransition('ACCEPTED', 'DELIVERED');
    } catch (e: any) {
      expect(e.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/); // UUID pattern
      expect(e.message).not.toMatch(/@/); // Email
      expect(e.message).not.toMatch(/\d{3}\.\d{3}\.\d{3}/); // CPF
    }
  });

  it('Erros de preço não contêm dados pessoais', () => {
    try {
      validatePriceConsistency({ freightPrice: 10000, agreedPrice: 0, requiredTrucks: 5 });
    } catch (e: any) {
      expect(e.message).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}/);
      expect(e.message).not.toMatch(/@/);
    }
  });
});
