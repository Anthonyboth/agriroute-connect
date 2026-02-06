/**
 * src/security/__tests__/freightActionDispatcher.test.ts
 *
 * Testes de segurança do Action Dispatcher + Status Resolver.
 *
 * Cobre:
 * 1. Autorização UI (papéis) — botões permitidos por status/papel
 * 2. Transições — validação pré-execução
 * 3. PT-BR — nenhum inglês na UI
 * 4. Multi-carreta — preço sempre por carreta para motorista
 * 5. Consistência de estado — modo seguro
 * 6. Status resolver — fonte única de verdade
 */

import { describe, it, expect } from 'vitest';

import {
  canDispatch,
  checkStateConsistency,
  getAvailableActions,
  type DispatchInput,
} from '../freightActionDispatcher';

import {
  getUserAllowedActions,
  WORKFLOW_ORDER,
} from '../freightWorkflowGuard';

import {
  formatPriceForUser,
  getPricePerTruck,
  assertPriceIsPerTruck,
  PriceGuardError,
} from '../multiTruckPriceGuard';

import {
  detectForbiddenTerms,
  guardStatusDisplay,
  getStatusLabelPtBR,
} from '../i18nGuard';

import {
  resolveDisplayStatus,
  getDriverEffectiveStatus,
} from '@/lib/freight-status-resolver';

// ===========================================================================
// 1. TESTES DE AUTORIZAÇÃO UI (PAPÉIS)
// ===========================================================================

describe('Autorização UI — Botões por Papel e Status', () => {

  it('motorista só vê ADVANCE quando ACCEPTED (para LOADING)', () => {
    const actions = getAvailableActions({
      freightStatus: 'ACCEPTED',
      actorRole: 'MOTORISTA',
    });
    expect(actions).toContain('ADVANCE');
    expect(actions).not.toContain('CANCEL');
    expect(actions).not.toContain('CONFIRM_DELIVERY');
  });

  it('motorista vê REPORT_DELIVERY quando IN_TRANSIT', () => {
    const actions = getAvailableActions({
      freightStatus: 'IN_TRANSIT',
      actorRole: 'MOTORISTA',
    });
    expect(actions).toContain('REPORT_DELIVERY');
    expect(actions).not.toContain('ADVANCE');
  });

  it('motorista NÃO vê ações quando DELIVERED_PENDING_CONFIRMATION (turno do produtor)', () => {
    const actions = getAvailableActions({
      freightStatus: 'DELIVERED_PENDING_CONFIRMATION',
      actorRole: 'MOTORISTA',
    });
    // Motorista não pode avançar neste ponto — é o produtor que confirma
    expect(actions).not.toContain('ADVANCE');
    expect(actions).not.toContain('CONFIRM_DELIVERY');
  });

  it('produtor só vê CONFIRM_DELIVERY quando DELIVERED_PENDING_CONFIRMATION', () => {
    const actions = getAvailableActions({
      freightStatus: 'DELIVERED_PENDING_CONFIRMATION',
      actorRole: 'PRODUTOR',
    });
    expect(actions).toContain('CONFIRM_DELIVERY');
  });

  it('produtor NÃO pode avançar quando ACCEPTED (turno do motorista)', () => {
    const actions = getAvailableActions({
      freightStatus: 'ACCEPTED',
      actorRole: 'PRODUTOR',
    });
    expect(actions).not.toContain('ADVANCE');
    // Mas produtor pode cancelar
    expect(actions).toContain('CANCEL');
  });

  it('transportadora pode avançar quando ACCEPTED (em nome do motorista)', () => {
    const actions = getAvailableActions({
      freightStatus: 'ACCEPTED',
      actorRole: 'TRANSPORTADORA',
    });
    expect(actions).toContain('ADVANCE');
  });

  it('nenhum papel vê ações em status COMPLETED', () => {
    const roles = ['MOTORISTA', 'PRODUTOR', 'TRANSPORTADORA'];
    for (const role of roles) {
      const actions = getAvailableActions({
        freightStatus: 'COMPLETED',
        actorRole: role,
      });
      expect(actions, `${role} não deveria ter ações em COMPLETED`).toHaveLength(0);
    }
  });

  it('nenhum papel vê ações em status CANCELLED', () => {
    const roles = ['MOTORISTA', 'PRODUTOR', 'TRANSPORTADORA'];
    for (const role of roles) {
      const actions = getAvailableActions({
        freightStatus: 'CANCELLED',
        actorRole: role,
      });
      expect(actions, `${role} não deveria ter ações em CANCELLED`).toHaveLength(0);
    }
  });
});

// ===========================================================================
// 2. TESTES DE TRANSIÇÃO (canDispatch)
// ===========================================================================

describe('Validação de Transição — canDispatch', () => {

  it('motorista pode avançar de ACCEPTED para LOADING', () => {
    const result = canDispatch({
      action: 'ADVANCE',
      freightId: 'test-1',
      freightStatus: 'ACCEPTED',
      actorRole: 'MOTORISTA',
    });
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('LOADING');
  });

  it('motorista NÃO pode pular de ACCEPTED para IN_TRANSIT', () => {
    // ADVANCE sempre vai para o próximo status (LOADING), não para IN_TRANSIT
    // A validação é no guard, não no dispatcher
    const result = canDispatch({
      action: 'ADVANCE',
      freightId: 'test-2',
      freightStatus: 'ACCEPTED',
      actorRole: 'MOTORISTA',
    });
    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('LOADING'); // Nunca IN_TRANSIT
  });

  it('produtor NÃO pode avançar quando é turno do motorista (ACCEPTED)', () => {
    const result = canDispatch({
      action: 'ADVANCE',
      freightId: 'test-3',
      freightStatus: 'ACCEPTED',
      actorRole: 'PRODUTOR',
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('ROLE_NOT_ALLOWED');
  });

  it('canDispatch retorna erro PT-BR quando bloqueado', () => {
    const result = canDispatch({
      action: 'ADVANCE',
      freightId: 'test-4',
      freightStatus: 'COMPLETED',
      actorRole: 'MOTORISTA',
    });
    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeTruthy();
    // Mensagem deve estar em PT-BR
    expect(result.errorMessage).not.toMatch(/^[A-Z_]+$/);
  });

  it('REPORT_DELIVERY bloqueado se não está IN_TRANSIT', () => {
    const result = canDispatch({
      action: 'REPORT_DELIVERY',
      freightId: 'test-5',
      freightStatus: 'LOADING',
      actorRole: 'MOTORISTA',
    });
    expect(result.success).toBe(false);
  });

  it('CONFIRM_DELIVERY bloqueado se não está DELIVERED_PENDING_CONFIRMATION', () => {
    const result = canDispatch({
      action: 'CONFIRM_DELIVERY',
      freightId: 'test-6',
      freightStatus: 'IN_TRANSIT',
      actorRole: 'PRODUTOR',
    });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// 3. TESTES DE CONSISTÊNCIA DE ESTADO (modo seguro)
// ===========================================================================

describe('Consistência de Estado — Modo Seguro', () => {

  it('detecta inconsistência progress=IN_TRANSIT vs assignment=ACCEPTED', () => {
    const check = checkStateConsistency({
      freightStatus: 'IN_TRANSIT',
      assignmentStatus: 'ACCEPTED',
      progressStatus: 'IN_TRANSIT',
    });
    expect(check.isConsistent).toBe(false);
    expect(check.warningMessage).toContain('Sincronização');
  });

  it('aceita diferença de 1 passo (normal durante transição)', () => {
    const check = checkStateConsistency({
      freightStatus: 'LOADING',
      assignmentStatus: 'ACCEPTED',
      progressStatus: 'LOADING',
    });
    expect(check.isConsistent).toBe(true);
  });

  it('detecta accepted_trucks > required_trucks', () => {
    const check = checkStateConsistency({
      freightStatus: 'OPEN',
      requiredTrucks: 3,
      acceptedTrucks: 5,
    });
    expect(check.isConsistent).toBe(false);
    expect(check.warningMessage).toContain('carretas');
  });

  it('estado inconsistente bloqueia todas as ações', () => {
    const actions = getAvailableActions({
      freightStatus: 'IN_TRANSIT',
      actorRole: 'MOTORISTA',
      assignmentStatus: 'ACCEPTED',
      progressStatus: 'IN_TRANSIT',
    });
    expect(actions).toHaveLength(0);
  });

  it('canDispatch falha quando estado inconsistente', () => {
    const result = canDispatch({
      action: 'ADVANCE',
      freightId: 'test-inc',
      freightStatus: 'IN_TRANSIT',
      actorRole: 'MOTORISTA',
      assignmentStatus: 'ACCEPTED',
      progressStatus: 'IN_TRANSIT',
    });
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('STATE_INCONSISTENT');
  });
});

// ===========================================================================
// 4. TESTES PT-BR (nenhum inglês na UI)
// ===========================================================================

describe('PT-BR — Nenhum Status em Inglês', () => {

  it('detectForbiddenTerms captura termos proibidos em texto plano', () => {
    // detectForbiddenTerms separa por delimitadores (incluindo _),
    // então testa termos sem underscore e frases com código cru
    const testCases = [
      { input: 'Status: ACCEPTED', expected: ['ACCEPTED'] },
      { input: 'LOADING o frete', expected: ['LOADING'] },
      { input: 'COMPLETED com sucesso', expected: ['COMPLETED'] },
      { input: 'O status é PENDING', expected: ['PENDING'] },
    ];
    for (const tc of testCases) {
      const found = detectForbiddenTerms(tc.input);
      for (const term of tc.expected) {
        expect(found, `"${tc.input}" deveria conter "${term}"`).toContain(term);
      }
    }
  });

  it('guardStatusDisplay nunca retorna código uppercase puro', () => {
    const allStatuses = [...WORKFLOW_ORDER, 'CANCELLED', 'PENDING', 'EXPIRED', 'PROPOSED', 'PAID_BY_PRODUCER'];
    for (const status of allStatuses) {
      const display = guardStatusDisplay(status);
      expect(display, `guardStatusDisplay("${status}") retornou código cru`).not.toBe(status);
      // Não pode ser todo maiúsculo com underscores
      expect(display).not.toMatch(/^[A-Z][A-Z_]+$/);
    }
  });

  it('getStatusLabelPtBR retorna tradução para DELIVERED_PENDING_CONFIRMATION', () => {
    const label = getStatusLabelPtBR('DELIVERED_PENDING_CONFIRMATION');
    expect(label).toBe('Entrega Reportada');
    expect(label).not.toBe('DELIVERED_PENDING_CONFIRMATION');
  });

  it('mensagens de erro do dispatcher estão em PT-BR', () => {
    const result = canDispatch({
      action: 'ADVANCE',
      freightId: 'test-ptbr',
      freightStatus: 'COMPLETED',
      actorRole: 'MOTORISTA',
    });
    expect(result.errorMessage).toBeTruthy();
    // Não pode conter apenas código em inglês
    expect(result.errorMessage!.includes('COMPLETED')).toBe(false);
  });
});

// ===========================================================================
// 5. MULTI-CARRETA — Segurança Financeira
// ===========================================================================

describe('Multi-Carreta — Preço por Carreta para Motorista', () => {

  it('motorista vê R$ 5.400 quando total é R$ 32.400 (6 carretas)', () => {
    const result = formatPriceForUser({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: 5400,
      context: 'DRIVER',
    });
    expect(result.displayPrice).toBe(5400);
    expect(result.totalPrice).toBeNull();
    expect(result.isPerTruck).toBe(true);
  });

  it('produtor vê R$ 32.400 (total) para o mesmo frete', () => {
    const result = formatPriceForUser({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: 5400,
      context: 'PRODUCER',
    });
    expect(result.displayPrice).toBe(32400);
    expect(result.totalPrice).toBe(32400);
    expect(result.isPerTruck).toBe(false);
  });

  it('assertPriceIsPerTruck bloqueia total como unitário', () => {
    expect(() => {
      assertPriceIsPerTruck({
        displayPrice: 32400,
        freightPrice: 32400,
        requiredTrucks: 6,
      });
    }).toThrow(PriceGuardError);
  });

  it('getPricePerTruck prioriza agreedPrice sobre cálculo', () => {
    const price = getPricePerTruck({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: 5400,
    });
    expect(price).toBe(5400);
  });

  it('getPricePerTruck calcula corretamente sem agreedPrice', () => {
    const price = getPricePerTruck({
      freightPrice: 32400,
      requiredTrucks: 6,
      agreedPrice: null,
    });
    expect(price).toBe(5400); // 32400 / 6
  });

  it('carreta única: preço exibido = preço total para todos', () => {
    const contexts: Array<'DRIVER' | 'PRODUCER'> = ['DRIVER', 'PRODUCER'];
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
// 6. STATUS RESOLVER — Fonte Única de Verdade
// ===========================================================================

describe('Status Resolver — Fonte Única', () => {

  it('motorista: prioriza progressStatus sobre freightStatus', () => {
    const resolved = resolveDisplayStatus({
      freightStatus: 'OPEN',
      assignmentStatus: 'ACCEPTED',
      progressStatus: 'LOADING',
      viewerContext: 'DRIVER',
      isMultiTruck: true,
    });
    expect(resolved.displayStatus).toBe('LOADING');
    expect(resolved.displayLabel).toBe('A Caminho da Coleta');
  });

  it('motorista: fallback para assignmentStatus se sem progress', () => {
    const resolved = resolveDisplayStatus({
      freightStatus: 'OPEN',
      assignmentStatus: 'ACCEPTED',
      progressStatus: null,
      viewerContext: 'DRIVER',
    });
    expect(resolved.displayStatus).toBe('ACCEPTED');
  });

  it('produtor: sempre usa freightStatus global', () => {
    const resolved = resolveDisplayStatus({
      freightStatus: 'IN_TRANSIT',
      assignmentStatus: 'LOADING',
      progressStatus: 'LOADING',
      viewerContext: 'PRODUCER',
    });
    expect(resolved.displayStatus).toBe('IN_TRANSIT');
  });

  it('detecta inconsistência accepted > required', () => {
    const resolved = resolveDisplayStatus({
      freightStatus: 'OPEN',
      viewerContext: 'PRODUCER',
      isMultiTruck: true,
      acceptedTrucks: 5,
      requiredTrucks: 3,
    });
    expect(resolved.hasInconsistency).toBe(true);
    expect(resolved.safeMode).toBe(true);
  });

  it('getDriverEffectiveStatus retorna progress > assignment > freight', () => {
    expect(getDriverEffectiveStatus({
      freightStatus: 'OPEN',
      assignmentStatus: 'ACCEPTED',
      progressStatus: 'LOADING',
    })).toBe('LOADING');

    expect(getDriverEffectiveStatus({
      freightStatus: 'OPEN',
      assignmentStatus: 'ACCEPTED',
      progressStatus: null,
    })).toBe('ACCEPTED');

    expect(getDriverEffectiveStatus({
      freightStatus: 'IN_TRANSIT',
      assignmentStatus: null,
      progressStatus: null,
    })).toBe('IN_TRANSIT');
  });
});

// ===========================================================================
// 7. COBERTURA COMPLETA DE WORKFLOW (todos os papéis x todos os status)
// ===========================================================================

describe('Cobertura Completa — Nenhuma Ação Inválida em Nenhum Status', () => {

  const roles = ['MOTORISTA', 'PRODUTOR', 'TRANSPORTADORA'];
  const allStatuses = [...WORKFLOW_ORDER, 'CANCELLED'];

  it('nenhuma combinação papel+status retorna ação que quebraria o guard', () => {
    for (const role of roles) {
      for (const status of allStatuses) {
        const actions = getAvailableActions({
          freightStatus: status,
          actorRole: role,
        });

        // Cada ação retornada DEVE ser válida no canDispatch
        for (const action of actions) {
          const result = canDispatch({
            action,
            freightId: 'validation-test',
            freightStatus: status,
            actorRole: role,
          });
          expect(
            result.success,
            `${role}/${status}/${action} retornou ação que falha no dispatch: ${result.errorMessage}`
          ).toBe(true);
        }
      }
    }
  });
});
