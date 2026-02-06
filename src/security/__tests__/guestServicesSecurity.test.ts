/**
 * guestServicesSecurity.test.ts
 *
 * Testes obrigatórios para o fluxo de segurança de serviços guest.
 * Cobre: PII guard, chat rules, workflow blocking, workflow progression, cancelamento.
 *
 * Critério: 0 falhas, 5+ testes específicos.
 */

import { describe, it, expect } from 'vitest';

import {
  maskServiceRequestPii,
  isPiiVisibleForStatus,
  getGuestContactRules,
  normalizePhoneForHref,
  getWhatsAppUrl,
  getTelUrl,
} from '@/security/serviceRequestPiiGuard';

import {
  canTransitionSR,
  getNextAllowedStatusSR,
  getAllowedActions,
} from '@/security/serviceRequestWorkflowGuard';

// =============================================================================
// 1. PII GUARD — em status OPEN, payload NÃO pode retornar PII
// =============================================================================

describe('PII Guard - Proteção de dados pessoais em OPEN', () => {
  it('mascara contact_phone e contact_name em status OPEN', () => {
    const request = {
      id: 'test-1',
      status: 'OPEN',
      contact_phone: '11999887766',
      contact_name: 'João Silva',
      contact_email: 'joao@email.com',
      location_address: 'Rua das Flores, 123, Campinas, SP',
      location_lat: -22.9068,
      location_lng: -43.1729,
      city_name: 'Campinas',
      state: 'SP',
    };

    const masked = maskServiceRequestPii(request);

    expect(masked.contact_phone).toBeNull();
    expect(masked.contact_name).toBeNull();
    expect(masked.contact_email).toBeNull();
    expect(masked.location_lat).toBeNull();
    expect(masked.location_lng).toBeNull();
    // Endereço deve mostrar apenas cidade
    expect(masked.location_address).toBe('Campinas, SP');
    expect(masked.location_address).not.toContain('Rua das Flores');
  });

  it('NÃO mascara PII em status ACCEPTED', () => {
    const request = {
      id: 'test-2',
      status: 'ACCEPTED',
      contact_phone: '11999887766',
      contact_name: 'Maria Oliveira',
      location_address: 'Av. Paulista, 1000, São Paulo, SP',
      location_lat: -23.5505,
      location_lng: -46.6333,
      city_name: 'São Paulo',
      state: 'SP',
    };

    const masked = maskServiceRequestPii(request);

    expect(masked.contact_phone).toBe('11999887766');
    expect(masked.contact_name).toBe('Maria Oliveira');
    expect(masked.location_lat).toBe(-23.5505);
    expect(masked.location_address).toBe('Av. Paulista, 1000, São Paulo, SP');
  });

  it('NÃO mascara PII em status ON_THE_WAY, IN_PROGRESS, COMPLETED', () => {
    for (const status of ['ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED']) {
      const request = {
        id: `test-${status}`,
        status,
        contact_phone: '11888776655',
        contact_name: 'Pedro',
        location_address: 'Rua Teste, 456',
        location_lat: -20.0,
        location_lng: -40.0,
        city_name: 'Uberlândia',
        state: 'MG',
      };

      const masked = maskServiceRequestPii(request);
      expect(masked.contact_phone).toBe('11888776655');
      expect(masked.contact_name).toBe('Pedro');
      expect(masked.location_lat).toBe(-20.0);
    }
  });

  it('isPiiVisibleForStatus retorna false para OPEN', () => {
    expect(isPiiVisibleForStatus('OPEN')).toBe(false);
    expect(isPiiVisibleForStatus('open')).toBe(false);
  });

  it('isPiiVisibleForStatus retorna true para ACCEPTED+', () => {
    expect(isPiiVisibleForStatus('ACCEPTED')).toBe(true);
    expect(isPiiVisibleForStatus('ON_THE_WAY')).toBe(true);
    expect(isPiiVisibleForStatus('IN_PROGRESS')).toBe(true);
    expect(isPiiVisibleForStatus('COMPLETED')).toBe(true);
  });
});

// =============================================================================
// 2. CHAT RULES — se client_id=null, chat indisponível, WhatsApp/Ligar disponível
// =============================================================================

describe('Guest Contact Rules - Chat indisponível para guest', () => {
  it('client_id=null: chat indisponível, WhatsApp e Ligar disponíveis', () => {
    const rules = getGuestContactRules(null);

    expect(rules.chatAvailable).toBe(false);
    expect(rules.chatMessage).toContain('indisponível');
    expect(rules.chatMessage).toContain('sem cadastro');
    expect(rules.showWhatsApp).toBe(true);
    expect(rules.showCall).toBe(true);
  });

  it('client_id existente: chat disponível', () => {
    const rules = getGuestContactRules('some-uuid-123');

    expect(rules.chatAvailable).toBe(true);
    expect(rules.chatMessage).toBe('');
    expect(rules.showWhatsApp).toBe(false);
    expect(rules.showCall).toBe(false);
  });

  it('normaliza telefone para href (remove caracteres não numéricos)', () => {
    expect(normalizePhoneForHref('(11) 99988-7766')).toBe('11999887766');
    expect(normalizePhoneForHref('+55 11 99988-7766')).toBe('5511999887766');
    expect(normalizePhoneForHref('11999887766')).toBe('11999887766');
  });

  it('gera URL WhatsApp correta', () => {
    const url = getWhatsAppUrl('(11) 99988-7766');
    expect(url).toBe('https://wa.me/5511999887766');
  });

  it('gera URL tel correta', () => {
    const url = getTelUrl('(11) 99988-7766');
    expect(url).toBe('tel:11999887766');
  });
});

// =============================================================================
// 3. WORKFLOW — bloquear salto ACCEPTED → COMPLETED
// =============================================================================

describe('Workflow Guard - Bloqueio de salto de etapas', () => {
  it('BLOQUEIA salto ACCEPTED → COMPLETED', () => {
    const result = canTransitionSR('ACCEPTED', 'COMPLETED');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pular etapas');
    expect(result.expectedNext).toBe('ON_THE_WAY');
  });

  it('BLOQUEIA salto ACCEPTED → IN_PROGRESS', () => {
    const result = canTransitionSR('ACCEPTED', 'IN_PROGRESS');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pular etapas');
  });

  it('BLOQUEIA salto ON_THE_WAY → COMPLETED', () => {
    const result = canTransitionSR('ON_THE_WAY', 'COMPLETED');
    expect(result.valid).toBe(false);
  });

  it('BLOQUEIA regressão IN_PROGRESS → ACCEPTED', () => {
    const result = canTransitionSR('IN_PROGRESS', 'ACCEPTED');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('voltar');
  });
});

// =============================================================================
// 4. WORKFLOW — aceitar sequência correta ACCEPTED → ON_THE_WAY → IN_PROGRESS → COMPLETED
// =============================================================================

describe('Workflow Guard - Sequência correta de progressão', () => {
  it('fluxo completo ACCEPTED → ON_THE_WAY → IN_PROGRESS → COMPLETED funciona', () => {
    const transitions: [string, string][] = [
      ['ACCEPTED', 'ON_THE_WAY'],
      ['ON_THE_WAY', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'COMPLETED'],
    ];

    for (const [from, to] of transitions) {
      const result = canTransitionSR(from, to);
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    }
  });

  it('próximo status correto em cada etapa', () => {
    expect(getNextAllowedStatusSR('ACCEPTED')).toBe('ON_THE_WAY');
    expect(getNextAllowedStatusSR('ON_THE_WAY')).toBe('IN_PROGRESS');
    expect(getNextAllowedStatusSR('IN_PROGRESS')).toBe('COMPLETED');
    expect(getNextAllowedStatusSR('COMPLETED')).toBeNull();
  });
});

// =============================================================================
// 5. CANCELAMENTO — provider cancelar em ACCEPTED/ON_THE_WAY
// =============================================================================

describe('Cancelamento - Provider pode cancelar apenas em ACCEPTED/ON_THE_WAY', () => {
  it('permite cancelamento em ACCEPTED para MOTORISTA', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'ACCEPTED',
    });
    expect(result.canCancel).toBe(true);
    expect(result.actions).toContain('CANCEL');
  });

  it('permite cancelamento em ON_THE_WAY para MOTORISTA', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'ON_THE_WAY',
    });
    expect(result.canCancel).toBe(true);
    expect(result.actions).toContain('CANCEL');
  });

  it('BLOQUEIA cancelamento em IN_PROGRESS para MOTORISTA (apenas ADMIN)', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'IN_PROGRESS',
    });
    expect(result.canCancel).toBe(false);
    expect(result.actions).not.toContain('CANCEL');
  });

  it('BLOQUEIA cancelamento em COMPLETED (status terminal)', () => {
    const result = getAllowedActions({
      role: 'MOTORISTA',
      status: 'COMPLETED',
    });
    expect(result.canCancel).toBe(false);
  });

  it('transição para CANCELLED é válida a partir de ACCEPTED', () => {
    const result = canTransitionSR('ACCEPTED', 'CANCELLED');
    expect(result.valid).toBe(true);
  });

  it('transição para CANCELLED é válida a partir de ON_THE_WAY', () => {
    const result = canTransitionSR('ON_THE_WAY', 'CANCELLED');
    expect(result.valid).toBe(true);
  });
});
