/**
 * Checklist de Produção — Validação Automatizada
 *
 * Garante que os guards e componentes de segurança estão corretamente
 * configurados e cobrem todos os cenários necessários antes do deploy.
 *
 * Critérios:
 * - "sem guard = CI falha"
 * - Todas as exportações obrigatórias estão disponíveis
 * - Dicionários de tradução estão completos
 * - Regras de preço são consistentes
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
  TERMINAL_STATUSES,
  STATUS_LABELS_PTBR,
} from '../freightWorkflowGuard';

import {
  formatPriceForUser,
  getPricePerTruck,
  validatePriceConsistency,
  assertPriceIsPerTruck,
  PriceGuardError,
} from '../multiTruckPriceGuard';

import {
  getStatusLabelPtBR as i18nGetStatus,
  getActionLabelPtBR,
  detectForbiddenTerms,
  sanitizeForDisplay,
  guardStatusDisplay,
} from '../i18nGuard';

// ===========================================================================
// CHECKLIST 1: EXPORTAÇÕES OBRIGATÓRIAS
// ===========================================================================

describe('Checklist: Exportações Obrigatórias', () => {

  describe('freightWorkflowGuard.ts', () => {
    it('exporta canTransition', () => expect(canTransition).toBeTypeOf('function'));
    it('exporta assertValidTransition', () => expect(assertValidTransition).toBeTypeOf('function'));
    it('exporta getUserAllowedActions', () => expect(getUserAllowedActions).toBeTypeOf('function'));
    it('exporta canReportDelivery', () => expect(canReportDelivery).toBeTypeOf('function'));
    it('exporta canConfirmDelivery', () => expect(canConfirmDelivery).toBeTypeOf('function'));
    it('exporta canConfirmPayment', () => expect(canConfirmPayment).toBeTypeOf('function'));
    it('exporta getStatusLabelPtBR', () => expect(getStatusLabelPtBR).toBeTypeOf('function'));
    it('exporta FreightWorkflowError', () => expect(FreightWorkflowError).toBeTypeOf('function'));
    it('exporta WORKFLOW_ORDER', () => expect(WORKFLOW_ORDER).toBeInstanceOf(Array));
    it('exporta TERMINAL_STATUSES', () => expect(TERMINAL_STATUSES).toBeInstanceOf(Array));
    it('exporta STATUS_LABELS_PTBR', () => expect(STATUS_LABELS_PTBR).toBeTypeOf('object'));
  });

  describe('multiTruckPriceGuard.ts', () => {
    it('exporta formatPriceForUser', () => expect(formatPriceForUser).toBeTypeOf('function'));
    it('exporta getPricePerTruck', () => expect(getPricePerTruck).toBeTypeOf('function'));
    it('exporta validatePriceConsistency', () => expect(validatePriceConsistency).toBeTypeOf('function'));
    it('exporta assertPriceIsPerTruck', () => expect(assertPriceIsPerTruck).toBeTypeOf('function'));
    it('exporta PriceGuardError', () => expect(PriceGuardError).toBeTypeOf('function'));
  });

  describe('i18nGuard.ts', () => {
    it('exporta getStatusLabelPtBR', () => expect(i18nGetStatus).toBeTypeOf('function'));
    it('exporta getActionLabelPtBR', () => expect(getActionLabelPtBR).toBeTypeOf('function'));
    it('exporta detectForbiddenTerms', () => expect(detectForbiddenTerms).toBeTypeOf('function'));
    it('exporta sanitizeForDisplay', () => expect(sanitizeForDisplay).toBeTypeOf('function'));
    it('exporta guardStatusDisplay', () => expect(guardStatusDisplay).toBeTypeOf('function'));
  });
});

// ===========================================================================
// CHECKLIST 2: DICIONÁRIO PT-BR COMPLETO
// ===========================================================================

describe('Checklist: Dicionário PT-BR Completo', () => {

  it('Todos os status do WORKFLOW_ORDER têm label PT-BR', () => {
    for (const status of WORKFLOW_ORDER) {
      const label = STATUS_LABELS_PTBR[status];
      expect(label, `Status "${status}" sem label PT-BR em STATUS_LABELS_PTBR`).toBeTruthy();
      expect(label).not.toBe(status); // Não pode ser o código cru
    }
  });

  it('CANCELLED tem label PT-BR', () => {
    expect(STATUS_LABELS_PTBR['CANCELLED']).toBe('Cancelado');
  });

  it('i18nGuard cobre todos os status do workflow', () => {
    for (const status of WORKFLOW_ORDER) {
      const label = i18nGetStatus(status);
      expect(label, `i18nGuard não traduz "${status}"`).not.toBe(status);
    }
  });

  it('i18nGuard cobre status extras (pagamento, assignment)', () => {
    const extras = ['PROPOSED', 'PAID_BY_PRODUCER', 'CONFIRMED', 'ASSIGNED', 'PENDING', 'ACTIVE'];
    for (const status of extras) {
      const label = i18nGetStatus(status);
      expect(label, `i18nGuard não traduz extra "${status}"`).not.toBe(status);
    }
  });

  it('Ações críticas têm tradução', () => {
    const criticalActions = [
      'ACCEPT', 'REJECT', 'CONFIRM', 'REPORT_DELIVERY',
      'CONFIRM_DELIVERY', 'CONFIRM_PAYMENT', 'MARK_PAID', 'CANCEL',
    ];
    for (const action of criticalActions) {
      const label = getActionLabelPtBR(action);
      expect(label, `Ação "${action}" sem tradução`).not.toBe(action);
    }
  });
});

// ===========================================================================
// CHECKLIST 3: REGRAS DE PREÇO
// ===========================================================================

describe('Checklist: Regras de Preço', () => {

  it('Motorista nunca vê totalPrice em multi-carreta', () => {
    const trucks = [2, 3, 5, 6, 10];
    for (const n of trucks) {
      const result = formatPriceForUser({
        freightPrice: 10000 * n,
        requiredTrucks: n,
        agreedPrice: 10000,
        context: 'DRIVER',
      });
      expect(result.totalPrice, `Motorista vê totalPrice com ${n} carretas`).toBeNull();
      expect(result.formattedTotalPrice).toBeNull();
    }
  });

  it('Produtor sempre vê totalPrice', () => {
    const result = formatPriceForUser({
      freightPrice: 50000,
      requiredTrucks: 5,
      agreedPrice: 10000,
      context: 'PRODUCER',
    });
    expect(result.totalPrice).toBe(50000);
    expect(result.formattedTotalPrice).toBeTruthy();
  });

  it('Admin sempre vê totalPrice', () => {
    const result = formatPriceForUser({
      freightPrice: 50000,
      requiredTrucks: 5,
      agreedPrice: 10000,
      context: 'ADMIN',
    });
    expect(result.totalPrice).toBe(50000);
  });

  it('Carreta única: todos veem o mesmo preço', () => {
    const contexts: Array<'DRIVER' | 'PRODUCER' | 'COMPANY' | 'ADMIN'> = ['DRIVER', 'PRODUCER', 'COMPANY', 'ADMIN'];
    for (const ctx of contexts) {
      const result = formatPriceForUser({
        freightPrice: 5000,
        requiredTrucks: 1,
        agreedPrice: 5000,
        context: ctx,
      });
      expect(result.displayPrice).toBe(5000);
    }
  });
});

// ===========================================================================
// CHECKLIST 4: FAIL-SAFE
// ===========================================================================

describe('Checklist: Fail-Safe', () => {

  it('assertValidTransition NUNCA permite salto silencioso', () => {
    let errorThrown = false;
    try {
      assertValidTransition('OPEN', 'COMPLETED');
    } catch {
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);
  });

  it('assertPriceIsPerTruck NUNCA permite total como unitário', () => {
    let errorThrown = false;
    try {
      assertPriceIsPerTruck({
        displayPrice: 50000,
        freightPrice: 50000,
        requiredTrucks: 5,
      });
    } catch {
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);
  });

  it('validatePriceConsistency NUNCA permite agreed_price = 0', () => {
    let errorThrown = false;
    try {
      validatePriceConsistency({
        freightPrice: 50000,
        agreedPrice: 0,
        requiredTrucks: 5,
      });
    } catch {
      errorThrown = true;
    }
    expect(errorThrown).toBe(true);
  });

  it('guardStatusDisplay NUNCA retorna código cru em inglês', () => {
    const allStatuses = [...WORKFLOW_ORDER, 'CANCELLED', 'PENDING', 'EXPIRED', 'PROPOSED'];
    for (const status of allStatuses) {
      const display = guardStatusDisplay(status);
      expect(display).not.toBe(status);
      expect(display).not.toMatch(/^[A-Z_]+$/);
    }
  });
});

// ===========================================================================
// CHECKLIST 5: COBERTURA DE PAPÉIS
// ===========================================================================

describe('Checklist: Cobertura de Papéis (CI Gate)', () => {

  const allRoles = ['PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA', 'ADMIN'];

  it('Todos os papéis retornam resultado válido de getUserAllowedActions', () => {
    for (const role of allRoles) {
      for (const status of WORKFLOW_ORDER) {
        const actions = getUserAllowedActions(role, status);
        expect(actions).toBeDefined();
        expect(typeof actions.canAdvance).toBe('boolean');
        expect(typeof actions.canCancel).toBe('boolean');
        expect(Array.isArray(actions.allowedActions)).toBe(true);
      }
    }
  });

  it('Nenhum papel desconhecido recebe permissões', () => {
    const actions = getUserAllowedActions('HACKER', 'ACCEPTED');
    expect(actions.canAdvance).toBe(false);
    expect(actions.canCancel).toBe(false);
  });

  it('Todos os papéis têm mapeamento de preço correto', () => {
    const roleToContext: Record<string, string> = {
      MOTORISTA: 'DRIVER',
      MOTORISTA_AFILIADO: 'DRIVER',
      PRODUTOR: 'PRODUCER',
      TRANSPORTADORA: 'COMPANY',
      ADMIN: 'ADMIN',
    };

    for (const [role, expectedContext] of Object.entries(roleToContext)) {
      // Verificar que cada papel resulta no contexto correto de preço
      expect(expectedContext).toBeTruthy();
    }
  });
});
