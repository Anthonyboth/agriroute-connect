/**
 * src/security/__tests__/freightActionMatrix.test.ts
 *
 * Testes de segurança para a matriz de ações do frete rural.
 *
 * Cobertura:
 * 1. Workflow visual: nenhuma ação fora do status correto
 * 2. Restrições por papel (motorista/produtor/transportadora)
 * 3. Modo seguro em inconsistências
 * 4. Multi-carreta: transportadora não avança status
 * 5. PT-BR: todas as labels são em português
 * 6. Preço: multi-carreta exibe corretamente por papel
 * 7. Status terminal: apenas view/rate
 */

import { describe, it, expect } from 'vitest';
import {
  queryActionMatrix,
  isActionAllowed,
  getRolesWithActions,
  shouldEnterSafeMode,
  type MatrixAction,
  type MatrixQuery,
} from '../freightActionMatrix';
import { WORKFLOW_ORDER, TERMINAL_STATUSES } from '../freightWorkflowGuard';
import { formatPriceForUser } from '../multiTruckPriceGuard';
import { detectForbiddenTerms, guardStatusDisplay } from '../i18nGuard';

// =============================================================================
// 1. WORKFLOW VISUAL — Nenhuma ação fora do status correto
// =============================================================================

describe('Workflow Visual — Ações por Status', () => {
  it('motorista NÃO tem ação ADVANCE em NEW, APPROVED, OPEN', () => {
    for (const status of ['NEW', 'APPROVED', 'OPEN']) {
      const result = queryActionMatrix({ freightStatus: status, actorRole: 'MOTORISTA' });
      const hasAdvance = result.actions.some(a => a.action === 'ADVANCE');
      expect(hasAdvance, `Motorista não deve ter ADVANCE em ${status}`).toBe(false);
    }
  });

  it('motorista tem ADVANCE em ACCEPTED (A Caminho da Coleta)', () => {
    const result = queryActionMatrix({ freightStatus: 'ACCEPTED', actorRole: 'MOTORISTA' });
    const advance = result.actions.find(a => a.action === 'ADVANCE');
    expect(advance).toBeDefined();
    expect(advance!.targetStatus).toBe('LOADING');
  });

  it('motorista tem REPORT_DELIVERY em IN_TRANSIT', () => {
    const result = queryActionMatrix({ freightStatus: 'IN_TRANSIT', actorRole: 'MOTORISTA' });
    expect(result.actions.some(a => a.action === 'REPORT_DELIVERY')).toBe(true);
  });

  it('motorista NÃO tem CONFIRM_DELIVERY (é do produtor)', () => {
    const result = queryActionMatrix({ freightStatus: 'DELIVERED_PENDING_CONFIRMATION', actorRole: 'MOTORISTA' });
    expect(result.actions.some(a => a.action === 'CONFIRM_DELIVERY')).toBe(false);
  });

  it('produtor tem CONFIRM_DELIVERY em DELIVERED_PENDING_CONFIRMATION', () => {
    const result = queryActionMatrix({ freightStatus: 'DELIVERED_PENDING_CONFIRMATION', actorRole: 'PRODUTOR' });
    expect(result.actions.some(a => a.action === 'CONFIRM_DELIVERY')).toBe(true);
  });

  it('nenhuma ação de workflow em status COMPLETED', () => {
    const result = queryActionMatrix({ freightStatus: 'COMPLETED', actorRole: 'MOTORISTA' });
    expect(result.isTerminal).toBe(true);
    const workflowActions = result.actions.filter(a => 
      ['ADVANCE', 'REPORT_DELIVERY', 'CONFIRM_DELIVERY', 'CANCEL'].includes(a.action)
    );
    expect(workflowActions).toHaveLength(0);
  });

  it('nenhuma ação de workflow em status CANCELLED', () => {
    const result = queryActionMatrix({ freightStatus: 'CANCELLED', actorRole: 'PRODUTOR' });
    expect(result.isTerminal).toBe(true);
    const workflowActions = result.actions.filter(a => 
      ['ADVANCE', 'REPORT_DELIVERY', 'CONFIRM_DELIVERY'].includes(a.action)
    );
    expect(workflowActions).toHaveLength(0);
  });
});

// =============================================================================
// 2. BOTÕES FANTASMA — Nenhum botão inútil
// =============================================================================

describe('Botões Fantasma — Nenhum botão inválido', () => {
  it('para cada status do workflow, ações são válidas via canTransition', () => {
    const roles = ['MOTORISTA', 'PRODUTOR', 'TRANSPORTADORA'];
    
    for (const status of WORKFLOW_ORDER) {
      for (const role of roles) {
        const result = queryActionMatrix({ freightStatus: status, actorRole: role });
        
        for (const action of result.actions) {
          // Se tem targetStatus, a transição deve ser válida
          if (action.targetStatus) {
            const { canTransition } = require('../freightWorkflowGuard');
            const check = canTransition(status, action.targetStatus);
            expect(
              check.valid,
              `Botão "${action.label}" (${status} → ${action.targetStatus}) para ${role} deveria ser válido`
            ).toBe(true);
          }
        }
      }
    }
  });
});

// =============================================================================
// 3. TRANSPORTADORA — Só monitora, nunca avança
// =============================================================================

describe('Transportadora — Restrições de Papel', () => {
  it('transportadora NUNCA tem ação ADVANCE', () => {
    for (const status of WORKFLOW_ORDER) {
      const result = queryActionMatrix({ freightStatus: status, actorRole: 'TRANSPORTADORA' });
      const hasAdvance = result.actions.some(a => a.action === 'ADVANCE');
      expect(hasAdvance, `Transportadora não deve ter ADVANCE em ${status}`).toBe(false);
    }
  });

  it('transportadora NUNCA tem REPORT_DELIVERY', () => {
    const result = queryActionMatrix({ freightStatus: 'IN_TRANSIT', actorRole: 'TRANSPORTADORA' });
    expect(result.actions.some(a => a.action === 'REPORT_DELIVERY')).toBe(false);
  });

  it('transportadora NUNCA tem CONFIRM_DELIVERY', () => {
    const result = queryActionMatrix({ freightStatus: 'DELIVERED_PENDING_CONFIRMATION', actorRole: 'TRANSPORTADORA' });
    expect(result.actions.some(a => a.action === 'CONFIRM_DELIVERY')).toBe(false);
  });

  it('transportadora tem MONITOR em status ativos', () => {
    for (const status of ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION', 'DELIVERED']) {
      const result = queryActionMatrix({ freightStatus: status, actorRole: 'TRANSPORTADORA' });
      expect(
        result.actions.some(a => a.action === 'MONITOR'),
        `Transportadora deve ter MONITOR em ${status}`
      ).toBe(true);
    }
  });
});

// =============================================================================
// 4. MODO SEGURO — Estado inconsistente
// =============================================================================

describe('Modo Seguro — Estado Inconsistente', () => {
  it('ativa modo seguro quando accepted_trucks > required_trucks', () => {
    const result = queryActionMatrix({
      freightStatus: 'OPEN',
      actorRole: 'MOTORISTA',
      requiredTrucks: 2,
      acceptedTrucks: 5,
    });
    expect(result.safeMode).toBe(true);
    expect(result.actions).toHaveLength(0);
    expect(result.safeModeMessage).toBeTruthy();
  });

  it('ativa modo seguro quando progress e assignment divergem muito', () => {
    const result = queryActionMatrix({
      freightStatus: 'IN_TRANSIT',
      actorRole: 'MOTORISTA',
      progressStatus: 'IN_TRANSIT',
      assignmentStatus: 'ACCEPTED',
    });
    expect(result.safeMode).toBe(true);
    expect(result.actions).toHaveLength(0);
  });

  it('NÃO ativa modo seguro com dados normais', () => {
    const result = queryActionMatrix({
      freightStatus: 'ACCEPTED',
      actorRole: 'MOTORISTA',
      requiredTrucks: 3,
      acceptedTrucks: 2,
    });
    expect(result.safeMode).toBe(false);
  });

  it('shouldEnterSafeMode retorna corretamente', () => {
    const normal = shouldEnterSafeMode({ freightStatus: 'OPEN', actorRole: 'MOTORISTA' });
    expect(normal.safeMode).toBe(false);

    const inconsistent = shouldEnterSafeMode({
      freightStatus: 'OPEN',
      actorRole: 'MOTORISTA',
      requiredTrucks: 1,
      acceptedTrucks: 10,
    });
    expect(inconsistent.safeMode).toBe(true);
  });
});

// =============================================================================
// 5. PT-BR — Nenhum status em inglês
// =============================================================================

describe('PT-BR — Todos os Labels em Português', () => {
  it('todas as ações na matriz têm labels em PT-BR', () => {
    const roles = ['MOTORISTA', 'PRODUTOR', 'TRANSPORTADORA', 'ADMIN'];
    
    for (const status of [...WORKFLOW_ORDER, 'CANCELLED']) {
      for (const role of roles) {
        const result = queryActionMatrix({ freightStatus: status, actorRole: role });
        
        for (const action of result.actions) {
          // Label não pode ser código em inglês uppercase
          expect(action.label).not.toMatch(/^[A-Z_]{3,}$/);
          // Label não pode conter termos proibidos
          const forbidden = detectForbiddenTerms(action.label);
          expect(forbidden, `Label "${action.label}" contém termos em inglês: ${forbidden.join(', ')}`).toHaveLength(0);
        }
      }
    }
  });

  it('statusLabel é sempre PT-BR', () => {
    for (const status of [...WORKFLOW_ORDER, 'CANCELLED']) {
      const result = queryActionMatrix({ freightStatus: status, actorRole: 'MOTORISTA' });
      expect(result.statusLabel).not.toBe(status);
      const forbidden = detectForbiddenTerms(result.statusLabel);
      expect(forbidden).toHaveLength(0);
    }
  });

  it('guardStatusDisplay nunca retorna código uppercase puro', () => {
    const statuses = ['NEW', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'PENDING', 'EXPIRED'];
    
    for (const status of statuses) {
      const displayed = guardStatusDisplay(status);
      expect(displayed).not.toBe(status);
      expect(displayed).not.toMatch(/^[A-Z_]{3,}$/);
    }
  });
});

// =============================================================================
// 6. PREÇO — Multi-carreta exibe corretamente por papel
// =============================================================================

describe('Preço — Multi-carreta Segurança Financeira', () => {
  it('motorista NUNCA vê valor total em multi-carreta', () => {
    const result = formatPriceForUser({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: 5400,
      context: 'DRIVER',
    });
    expect(result.displayPrice).toBe(5400);
    expect(result.totalPrice).toBeNull();
    expect(result.formattedTotalPrice).toBeNull();
  });

  it('motorista vê valor do agreed_price (não total/trucks)', () => {
    const result = formatPriceForUser({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: 5400,
      context: 'DRIVER',
    });
    expect(result.displayPrice).toBe(5400);
    expect(result.formattedPrice).toContain('5.400');
  });

  it('produtor vê valor total como primário', () => {
    const result = formatPriceForUser({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: 5400,
      context: 'PRODUCER',
    });
    expect(result.displayPrice).toBe(32400);
    expect(result.formattedPrice).toContain('32.400');
  });

  it('transportadora vê valor total', () => {
    const result = formatPriceForUser({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: null,
      context: 'COMPANY',
    });
    expect(result.displayPrice).toBe(32400);
  });

  it('carreta única: motorista vê preço total (é o unitário)', () => {
    const result = formatPriceForUser({
      freightPrice: 5400,
      requiredTrucks: 1,
      agreedPrice: null,
      context: 'DRIVER',
    });
    expect(result.displayPrice).toBe(5400);
    expect(result.isPerTruck).toBe(false);
  });
});

// =============================================================================
// 7. RATING — Condicional
// =============================================================================

describe('Rating — Condicional', () => {
  it('rating aparece em COMPLETED para motorista', () => {
    const result = queryActionMatrix({ freightStatus: 'COMPLETED', actorRole: 'MOTORISTA' });
    expect(result.actions.some(a => a.action === 'RATE')).toBe(true);
  });

  it('rating NÃO aparece se já avaliou', () => {
    const result = queryActionMatrix({ freightStatus: 'COMPLETED', actorRole: 'MOTORISTA', hasRated: true });
    expect(result.actions.some(a => a.action === 'RATE')).toBe(false);
  });
});

// =============================================================================
// 8. COBERTURA COMPLETA — Todos os status × roles
// =============================================================================

describe('Cobertura Completa — getRolesWithActions', () => {
  it('todo status tem pelo menos um papel com ações', () => {
    for (const status of [...WORKFLOW_ORDER, 'CANCELLED']) {
      const roles = getRolesWithActions(status);
      expect(Object.keys(roles).length, `Status ${status} deve ter pelo menos um papel com ações`).toBeGreaterThan(0);
    }
  });

  it('isActionAllowed funciona como shortcut', () => {
    expect(isActionAllowed('ADVANCE', { freightStatus: 'ACCEPTED', actorRole: 'MOTORISTA' })).toBe(true);
    expect(isActionAllowed('ADVANCE', { freightStatus: 'ACCEPTED', actorRole: 'TRANSPORTADORA' })).toBe(false);
    expect(isActionAllowed('CONFIRM_DELIVERY', { freightStatus: 'DELIVERED_PENDING_CONFIRMATION', actorRole: 'PRODUTOR' })).toBe(true);
    expect(isActionAllowed('CONFIRM_DELIVERY', { freightStatus: 'IN_TRANSIT', actorRole: 'PRODUTOR' })).toBe(false);
  });
});

// =============================================================================
// 9. MAPA — Não inicializa com container zero (unit level)
// =============================================================================

describe('Mapa — Proteção de inicialização', () => {
  it('useSafeMapLibre exports existe', async () => {
    const mod = await import('@/hooks/useSafeMapLibre');
    expect(mod.useSafeMapLibre).toBeDefined();
    expect(typeof mod.useSafeMapLibre).toBe('function');
  });
});

// =============================================================================
// 10. PAGAMENTO — Condicional
// =============================================================================

describe('Pagamento — Ações condicionais', () => {
  it('MARK_PAID aparece em DELIVERED para produtor (sem payment status)', () => {
    const result = queryActionMatrix({ freightStatus: 'DELIVERED', actorRole: 'PRODUTOR' });
    expect(result.actions.some(a => a.action === 'MARK_PAID')).toBe(true);
  });

  it('MARK_PAID removido se já pago', () => {
    const result = queryActionMatrix({
      freightStatus: 'DELIVERED',
      actorRole: 'PRODUTOR',
      paymentStatus: 'PAID_BY_PRODUCER',
    });
    expect(result.actions.some(a => a.action === 'MARK_PAID')).toBe(false);
  });
});
