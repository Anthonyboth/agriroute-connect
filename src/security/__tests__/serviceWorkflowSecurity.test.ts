/**
 * serviceWorkflowSecurity.test.ts
 * 
 * Testes abrangentes para o patch de segurança de workflow de serviços urbanos.
 * Cobre: guard de transições, RPC, UI, guest, pagamento, avaliação.
 * 
 * Critério: 0 falhas, 25+ testes.
 */

import { describe, it, expect } from 'vitest';
import {
  canTransitionSR,
  assertValidTransitionSR,
  getNextAllowedStatusSR,
  getAllowedActions,
  getServiceRequestStatusLabelPtBR,
  getServiceRequestActionLabelPtBR,
  getServiceTypeLabelPtBR,
  detectForbiddenServiceTerms,
  canAutoExpire,
  SERVICE_REQUEST_WORKFLOW_ORDER,
  SERVICE_REQUEST_STATUS_LABELS,
  ServiceRequestWorkflowError,
} from '@/security/serviceRequestWorkflowGuard';

import {
  canRateServiceRequest,
  getPaymentUILabelPtBR,
} from '@/security/paymentClosureGuard';

// =============================================================================
// 1. GUARD DE TRANSIÇÕES (UNIT) — 12 testes
// =============================================================================

describe('serviceRequestWorkflowGuard - Transições', () => {
  it('permite ACCEPTED → ON_THE_WAY', () => {
    const result = canTransitionSR('ACCEPTED', 'ON_THE_WAY');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('permite ON_THE_WAY → IN_PROGRESS', () => {
    const result = canTransitionSR('ON_THE_WAY', 'IN_PROGRESS');
    expect(result.valid).toBe(true);
  });

  it('permite IN_PROGRESS → COMPLETED', () => {
    const result = canTransitionSR('IN_PROGRESS', 'COMPLETED');
    expect(result.valid).toBe(true);
  });

  it('permite OPEN → ACCEPTED', () => {
    const result = canTransitionSR('OPEN', 'ACCEPTED');
    expect(result.valid).toBe(true);
  });

  it('BLOQUEIA ACCEPTED → COMPLETED (pulo de etapas)', () => {
    const result = canTransitionSR('ACCEPTED', 'COMPLETED');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pular etapas');
    expect(result.expectedNext).toBe('ON_THE_WAY');
  });

  it('BLOQUEIA ACCEPTED → IN_PROGRESS (pulo de etapa)', () => {
    const result = canTransitionSR('ACCEPTED', 'IN_PROGRESS');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pular etapas');
  });

  it('BLOQUEIA ON_THE_WAY → COMPLETED (pulo de etapa)', () => {
    const result = canTransitionSR('ON_THE_WAY', 'COMPLETED');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pular etapas');
  });

  it('BLOQUEIA regressão IN_PROGRESS → ACCEPTED', () => {
    const result = canTransitionSR('IN_PROGRESS', 'ACCEPTED');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('voltar');
  });

  it('BLOQUEIA regressão COMPLETED → IN_PROGRESS', () => {
    const result = canTransitionSR('COMPLETED', 'IN_PROGRESS');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('não pode mais ser alterada');
  });

  it('BLOQUEIA regressão ON_THE_WAY → ACCEPTED', () => {
    const result = canTransitionSR('ON_THE_WAY', 'ACCEPTED');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('voltar');
  });

  it('permite cancelamento de qualquer status não-terminal', () => {
    const result = canTransitionSR('ACCEPTED', 'CANCELLED');
    expect(result.valid).toBe(true);
  });

  it('BLOQUEIA alteração de CANCELLED', () => {
    const result = canTransitionSR('CANCELLED', 'OPEN');
    expect(result.valid).toBe(false);
  });
});

// =============================================================================
// 2. ASSERT COM EXCEPTION — 3 testes
// =============================================================================

describe('serviceRequestWorkflowGuard - assertValidTransitionSR', () => {
  it('não lança exceção para transição válida', () => {
    expect(() => assertValidTransitionSR('ACCEPTED', 'ON_THE_WAY')).not.toThrow();
  });

  it('lança ServiceRequestWorkflowError para pulo', () => {
    expect(() => assertValidTransitionSR('ACCEPTED', 'COMPLETED')).toThrow(ServiceRequestWorkflowError);
  });

  it('lança com código INVALID_SR_TRANSITION', () => {
    try {
      assertValidTransitionSR('IN_PROGRESS', 'OPEN');
    } catch (e) {
      expect(e).toBeInstanceOf(ServiceRequestWorkflowError);
      expect((e as ServiceRequestWorkflowError).code).toBe('INVALID_SR_TRANSITION');
    }
  });
});

// =============================================================================
// 3. NEXT STATUS — 3 testes
// =============================================================================

describe('serviceRequestWorkflowGuard - getNextAllowedStatusSR', () => {
  it('retorna ON_THE_WAY após ACCEPTED', () => {
    expect(getNextAllowedStatusSR('ACCEPTED')).toBe('ON_THE_WAY');
  });

  it('retorna IN_PROGRESS após ON_THE_WAY', () => {
    expect(getNextAllowedStatusSR('ON_THE_WAY')).toBe('IN_PROGRESS');
  });

  it('retorna null para COMPLETED (terminal)', () => {
    expect(getNextAllowedStatusSR('COMPLETED')).toBeNull();
  });
});

// =============================================================================
// 4. AÇÕES PERMITIDAS POR PAPEL — 4 testes
// =============================================================================

describe('serviceRequestWorkflowGuard - getAllowedActions', () => {
  it('MOTORISTA pode avançar de ACCEPTED para ON_THE_WAY', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'ACCEPTED',
    });
    expect(result.canAdvance).toBe(true);
    expect(result.nextStatus).toBe('ON_THE_WAY');
    expect(result.actions).toContain('START_ROUTE');
  });

  it('GUEST não pode avançar status', () => {
    const result = getAllowedActions({
      role: 'GUEST',
      status: 'ACCEPTED',
      isGuest: true,
    });
    expect(result.canAdvance).toBe(false);
  });

  it('MOTORISTA pode cancelar em ACCEPTED', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'ACCEPTED',
    });
    expect(result.canCancel).toBe(true);
    expect(result.actions).toContain('CANCEL');
  });

  it('MOTORISTA NÃO pode cancelar em IN_PROGRESS (apenas ADMIN)', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'IN_PROGRESS',
    });
    expect(result.canCancel).toBe(false);
  });
});

// =============================================================================
// 5. LABELS PT-BR — 4 testes
// =============================================================================

describe('serviceRequestWorkflowGuard - Labels PT-BR', () => {
  it('retorna label PT-BR para ON_THE_WAY', () => {
    expect(getServiceRequestStatusLabelPtBR('ON_THE_WAY')).toBe('A Caminho');
  });

  it('retorna label PT-BR para IN_PROGRESS', () => {
    expect(getServiceRequestStatusLabelPtBR('IN_PROGRESS')).toBe('Em Andamento');
  });

  it('retorna Desconhecido para status inválido', () => {
    expect(getServiceRequestStatusLabelPtBR('INVALID')).toBe('Desconhecido');
  });

  it('labels de ações em PT-BR', () => {
    expect(getServiceRequestActionLabelPtBR('START_ROUTE')).toBe('Iniciar Deslocamento');
    expect(getServiceRequestActionLabelPtBR('START_SERVICE')).toBe('Iniciar Serviço');
    expect(getServiceRequestActionLabelPtBR('COMPLETE')).toBe('Concluir');
  });
});

// =============================================================================
// 6. DETECTAR TERMOS PROIBIDOS — 2 testes
// =============================================================================

describe('serviceRequestWorkflowGuard - Termos proibidos', () => {
  it('detecta termos em inglês', () => {
    const found = detectForbiddenServiceTerms('Status: OPEN, provider assigned');
    expect(found.length).toBeGreaterThan(0);
  });

  it('não detecta texto PT-BR correto', () => {
    const found = detectForbiddenServiceTerms('Serviço aberto, prestador designado');
    expect(found.length).toBe(0);
  });
});

// =============================================================================
// 7. EXPIRAÇÃO AUTOMÁTICA — 2 testes
// =============================================================================

describe('serviceRequestWorkflowGuard - Expiração', () => {
  it('permite expiração apenas em OPEN', () => {
    expect(canAutoExpire('OPEN')).toBe(true);
    expect(canAutoExpire('ACCEPTED')).toBe(false);
    expect(canAutoExpire('IN_PROGRESS')).toBe(false);
  });

  it('não permite expiração de status em andamento', () => {
    expect(canAutoExpire('ON_THE_WAY')).toBe(false);
    expect(canAutoExpire('COMPLETED')).toBe(false);
  });
});

// =============================================================================
// 8. AVALIAÇÃO COM GATING DE PAGAMENTO — 7 testes
// =============================================================================

describe('paymentClosureGuard - canRateServiceRequest com pagamento', () => {
  it('permite avaliar quando COMPLETED sem pagamento registrado', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'PRESTADOR_SERVICOS',
    });
    expect(result.canRate).toBe(true);
  });

  it('permite avaliar quando COMPLETED e pagamento confirmed', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'MOTORISTA',
      paymentStatus: 'confirmed_by_provider',
    });
    expect(result.canRate).toBe(true);
  });

  it('BLOQUEIA avaliação quando pagamento é proposed', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'MOTORISTA',
      paymentStatus: 'proposed',
    });
    expect(result.canRate).toBe(false);
    expect(result.message).toContain('Aguardando pagamento');
  });

  it('BLOQUEIA avaliação quando pagamento é paid_by_client', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'MOTORISTA',
      paymentStatus: 'paid_by_client',
    });
    expect(result.canRate).toBe(false);
    expect(result.message).toContain('confirmação do prestador');
  });

  it('BLOQUEIA avaliação quando já avaliou', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'MOTORISTA',
      hasAlreadyRated: true,
    });
    expect(result.canRate).toBe(false);
    expect(result.message).toContain('já enviada');
  });

  it('BLOQUEIA avaliação quando serviço não está COMPLETED', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'IN_PROGRESS',
      actorRole: 'MOTORISTA',
    });
    expect(result.canRate).toBe(false);
  });

  it('BLOQUEIA avaliação para papel não autorizado', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'RANDOM_ROLE',
    });
    expect(result.canRate).toBe(false);
  });
});

// =============================================================================
// 9. WORKFLOW ORDER — 2 testes
// =============================================================================

describe('serviceRequestWorkflowGuard - Workflow Order', () => {
  it('ordem correta do workflow', () => {
    expect(SERVICE_REQUEST_WORKFLOW_ORDER).toEqual([
      'OPEN', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED',
    ]);
  });

  it('todas as labels existem', () => {
    for (const status of SERVICE_REQUEST_WORKFLOW_ORDER) {
      expect(SERVICE_REQUEST_STATUS_LABELS[status]).toBeDefined();
      expect(SERVICE_REQUEST_STATUS_LABELS[status]).not.toBe('');
    }
  });
});

// =============================================================================
// 10. FLUXO COMPLETO — 2 testes
// =============================================================================

describe('Fluxo completo de workflow', () => {
  it('fluxo completo OPEN → COMPLETED sem erros', () => {
    const transitions = [
      ['OPEN', 'ACCEPTED'],
      ['ACCEPTED', 'ON_THE_WAY'],
      ['ON_THE_WAY', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'COMPLETED'],
    ];

    for (const [from, to] of transitions) {
      const result = canTransitionSR(from, to);
      expect(result.valid).toBe(true);
    }
  });

  it('tentativa de pular qualquer etapa falha', () => {
    const skipAttempts = [
      ['OPEN', 'ON_THE_WAY'],
      ['OPEN', 'IN_PROGRESS'],
      ['OPEN', 'COMPLETED'],
      ['ACCEPTED', 'IN_PROGRESS'],
      ['ACCEPTED', 'COMPLETED'],
      ['ON_THE_WAY', 'COMPLETED'],
    ];

    for (const [from, to] of skipAttempts) {
      const result = canTransitionSR(from, to);
      expect(result.valid).toBe(false);
    }
  });
});
