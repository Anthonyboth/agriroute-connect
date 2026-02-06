import { describe, it, expect } from 'vitest';
import {
  canTransitionSR,
  assertValidTransitionSR,
  getAllowedActions,
  getServiceRequestStatusLabelPtBR,
  getServiceRequestActionLabelPtBR,
  detectForbiddenServiceTerms,
  sanitizeServiceUiTextPtBR,
  canAutoExpire,
  getExpirationHours,
  ServiceRequestWorkflowError,
  SERVICE_REQUEST_WORKFLOW_ORDER,
  SERVICE_REQUEST_STATUS_LABELS,
} from '../serviceRequestWorkflowGuard';

// =============================================================================
// 1. Transições inválidas bloqueadas
// =============================================================================
describe('Service Request Workflow Guard — Transições', () => {
  it('OPEN → IN_PROGRESS deve falhar (pulo de etapa)', () => {
    const result = canTransitionSR('OPEN', 'IN_PROGRESS');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pular etapas');
    expect(result.expectedNext).toBe('ACCEPTED');
  });

  it('ACCEPTED → OPEN deve falhar (regressão)', () => {
    const result = canTransitionSR('ACCEPTED', 'OPEN');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('voltar');
  });

  it('OPEN → COMPLETED deve falhar (pulo de múltiplas etapas)', () => {
    const result = canTransitionSR('OPEN', 'COMPLETED');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pular etapas');
  });

  it('IN_PROGRESS → ACCEPTED deve falhar (regressão)', () => {
    const result = canTransitionSR('IN_PROGRESS', 'ACCEPTED');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('voltar');
  });

  it('COMPLETED → OPEN deve falhar (status terminal)', () => {
    const result = canTransitionSR('COMPLETED', 'OPEN');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('não pode mais ser alterada');
  });

  it('CANCELLED → ACCEPTED deve falhar (status terminal)', () => {
    const result = canTransitionSR('CANCELLED', 'ACCEPTED');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('não pode mais ser alterada');
  });

  it('assertValidTransitionSR deve lançar ServiceRequestWorkflowError', () => {
    expect(() => {
      assertValidTransitionSR('OPEN', 'IN_PROGRESS');
    }).toThrow(ServiceRequestWorkflowError);
  });

  // Transições válidas
  it('OPEN → ACCEPTED deve ser válido', () => {
    const result = canTransitionSR('OPEN', 'ACCEPTED');
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('ACCEPTED → ON_THE_WAY deve ser válido', () => {
    const result = canTransitionSR('ACCEPTED', 'ON_THE_WAY');
    expect(result.valid).toBe(true);
  });

  it('ON_THE_WAY → IN_PROGRESS deve ser válido', () => {
    const result = canTransitionSR('ON_THE_WAY', 'IN_PROGRESS');
    expect(result.valid).toBe(true);
  });

  it('IN_PROGRESS → COMPLETED deve ser válido', () => {
    const result = canTransitionSR('IN_PROGRESS', 'COMPLETED');
    expect(result.valid).toBe(true);
  });

  it('OPEN → CANCELLED deve ser válido (cancelamento)', () => {
    const result = canTransitionSR('OPEN', 'CANCELLED');
    expect(result.valid).toBe(true);
  });

  it('Fluxo linear completo deve funcionar passo a passo', () => {
    const steps = SERVICE_REQUEST_WORKFLOW_ORDER;
    for (let i = 0; i < steps.length - 1; i++) {
      const result = canTransitionSR(steps[i], steps[i + 1]);
      expect(result.valid).toBe(true);
    }
  });
});

// =============================================================================
// 2. Expiração automática — somente OPEN
// =============================================================================
describe('Service Request Expiração Automática', () => {
  it('Status OPEN pode ser auto-expirado', () => {
    expect(canAutoExpire('OPEN')).toBe(true);
  });

  it('Status ACCEPTED NÃO pode ser auto-expirado', () => {
    expect(canAutoExpire('ACCEPTED')).toBe(false);
  });

  it('Status IN_PROGRESS NÃO pode ser auto-expirado', () => {
    expect(canAutoExpire('IN_PROGRESS')).toBe(false);
  });

  it('Status COMPLETED NÃO pode ser auto-expirado', () => {
    expect(canAutoExpire('COMPLETED')).toBe(false);
  });

  it('Status ON_THE_WAY NÃO pode ser auto-expirado', () => {
    expect(canAutoExpire('ON_THE_WAY')).toBe(false);
  });

  it('GUINCHO expira em 4 horas', () => {
    expect(getExpirationHours('GUINCHO')).toBe(4);
  });

  it('FRETE_MOTO expira em 24 horas', () => {
    expect(getExpirationHours('FRETE_MOTO')).toBe(24);
  });

  it('FRETE_URBANO expira em 72 horas', () => {
    expect(getExpirationHours('FRETE_URBANO')).toBe(72);
  });

  it('MUDANCA_RESIDENCIAL expira em 72 horas', () => {
    expect(getExpirationHours('MUDANCA_RESIDENCIAL')).toBe(72);
  });

  it('MUDANCA_COMERCIAL expira em 72 horas', () => {
    expect(getExpirationHours('MUDANCA_COMERCIAL')).toBe(72);
  });

  it('Tipo desconhecido usa fallback 72h', () => {
    expect(getExpirationHours('DESCONHECIDO')).toBe(72);
  });
});

// =============================================================================
// 3. PT-BR enforcement
// =============================================================================
describe('Service Request PT-BR Enforcement', () => {
  it('Todos os status devem ter tradução PT-BR', () => {
    const allStatuses = [...SERVICE_REQUEST_WORKFLOW_ORDER, 'CANCELLED'] as const;
    for (const status of allStatuses) {
      const label = getServiceRequestStatusLabelPtBR(status);
      expect(label).not.toBe('Desconhecido');
      expect(label).not.toBe(status); // Não pode retornar o código cru
    }
  });

  it('getServiceRequestStatusLabelPtBR nunca retorna código em inglês', () => {
    expect(getServiceRequestStatusLabelPtBR('OPEN')).toBe('Aberto');
    expect(getServiceRequestStatusLabelPtBR('ACCEPTED')).toBe('Aceito');
    expect(getServiceRequestStatusLabelPtBR('ON_THE_WAY')).toBe('A Caminho');
    expect(getServiceRequestStatusLabelPtBR('IN_PROGRESS')).toBe('Em Andamento');
    expect(getServiceRequestStatusLabelPtBR('COMPLETED')).toBe('Concluído');
    expect(getServiceRequestStatusLabelPtBR('CANCELLED')).toBe('Cancelado');
  });

  it('Status desconhecido retorna "Desconhecido" (nunca código cru)', () => {
    expect(getServiceRequestStatusLabelPtBR('FAKE_STATUS')).toBe('Desconhecido');
  });

  it('Detecta termos proibidos em inglês', () => {
    const forbidden = detectForbiddenServiceTerms('Status: OPEN e driver confirmou');
    expect(forbidden).toContain('OPEN');
    expect(forbidden).toContain('driver');
  });

  it('Texto limpo não retorna termos proibidos', () => {
    const forbidden = detectForbiddenServiceTerms('Solicitação aberta pelo motorista');
    expect(forbidden).toHaveLength(0);
  });

  it('sanitizeServiceUiTextPtBR substitui termos proibidos', () => {
    const result = sanitizeServiceUiTextPtBR('Status OPEN, driver assigned');
    expect(result).toContain('Aberto');
    expect(result).toContain('motorista');
    expect(result).not.toMatch(/\bOPEN\b/);
    expect(result).not.toMatch(/\bdriver\b/);
  });

  it('sanitizeServiceUiTextPtBR substitui provider e carrier', () => {
    const result = sanitizeServiceUiTextPtBR('provider e carrier confirmaram');
    expect(result).toContain('prestador');
    expect(result).toContain('transportadora');
  });
});

// =============================================================================
// 4. Ações por papel
// =============================================================================
describe('Service Request Ações por Papel', () => {
  it('Motorista em OPEN pode aceitar', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'OPEN',
    });
    expect(result.canAdvance).toBe(true);
    expect(result.actions).toContain('ACCEPT');
    expect(result.nextStatusLabel).toBe('Aceito');
  });

  it('Guest NÃO pode avançar status', () => {
    const result = getAllowedActions({
      role: 'GUEST',
      status: 'OPEN',
      isGuest: true,
    });
    expect(result.canAdvance).toBe(false);
    expect(result.canCancel).toBe(true); // Guest pode cancelar OPEN
  });

  it('Produtor NÃO pode avançar mas pode cancelar em OPEN', () => {
    const result = getAllowedActions({
      role: 'PRODUTOR',
      status: 'OPEN',
    });
    expect(result.canAdvance).toBe(false);
    expect(result.canCancel).toBe(true);
  });

  it('Motorista em ACCEPTED pode iniciar deslocamento', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'ACCEPTED',
    });
    expect(result.canAdvance).toBe(true);
    expect(result.actions).toContain('START_ROUTE');
  });

  it('Motorista em IN_PROGRESS pode concluir', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'IN_PROGRESS',
    });
    expect(result.canAdvance).toBe(true);
    expect(result.actions).toContain('COMPLETE');
  });

  it('Transportadora pode aceitar e avançar', () => {
    const result = getAllowedActions({
      role: 'TRANSPORTADORA',
      status: 'OPEN',
      isCompanyFlow: true,
    });
    expect(result.canAdvance).toBe(true);
    expect(result.actions).toContain('ACCEPT');
  });

  it('Nenhuma ação de avanço em COMPLETED', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'COMPLETED',
    });
    expect(result.canAdvance).toBe(false);
    expect(result.canCancel).toBe(false);
    expect(result.actions).toContain('RATE');
  });

  it('Admin pode cancelar em IN_PROGRESS', () => {
    const result = getAllowedActions({
      role: 'ADMIN',
      status: 'IN_PROGRESS',
    });
    expect(result.canCancel).toBe(true);
  });

  it('Motorista NÃO pode cancelar em IN_PROGRESS', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'IN_PROGRESS',
    });
    expect(result.canCancel).toBe(false);
  });
});
