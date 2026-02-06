/**
 * Testes de segurança de localização (PT-BR).
 * 
 * Cobre:
 * - Nenhum status em inglês visível ao usuário
 * - Detecção de termos proibidos
 * - Sanitização de texto
 */

import { describe, it, expect } from 'vitest';
import {
  getStatusLabelPtBR,
  getActionLabelPtBR,
  detectForbiddenTerms,
  sanitizeForDisplay,
  guardStatusDisplay,
} from '../i18nGuard';

describe('i18nGuard', () => {
  // =========================================================================
  // getStatusLabelPtBR
  // =========================================================================
  
  describe('getStatusLabelPtBR', () => {
    const requiredStatuses = [
      ['OPEN', 'Aberto'],
      ['ACCEPTED', 'Aceito'],
      ['LOADING', 'A Caminho da Coleta'],
      ['LOADED', 'Carregado'],
      ['IN_TRANSIT', 'Em Trânsito'],
      ['DELIVERED_PENDING_CONFIRMATION', 'Entrega Reportada'],
      ['DELIVERED', 'Entregue'],
      ['COMPLETED', 'Concluído'],
      ['CANCELLED', 'Cancelado'],
      ['PENDING', 'Pendente'],
    ];

    it.each(requiredStatuses)('%s → "%s"', (status, expected) => {
      expect(getStatusLabelPtBR(status)).toBe(expected);
    });

    it('retorna "Desconhecido" para string vazia', () => {
      expect(getStatusLabelPtBR('')).toBe('Desconhecido');
    });

    it('humaniza status não mapeado (nunca retorna código cru)', () => {
      const label = getStatusLabelPtBR('SOME_UNKNOWN_STATUS');
      expect(label).not.toBe('SOME_UNKNOWN_STATUS');
      expect(label).toBe('Some Unknown Status');
    });

    it('é case-insensitive', () => {
      expect(getStatusLabelPtBR('open')).toBe('Aberto');
      expect(getStatusLabelPtBR('Open')).toBe('Aberto');
      expect(getStatusLabelPtBR('OPEN')).toBe('Aberto');
    });
  });

  // =========================================================================
  // getActionLabelPtBR
  // =========================================================================
  
  describe('getActionLabelPtBR', () => {
    it('traduz ações conhecidas', () => {
      expect(getActionLabelPtBR('ACCEPT')).toBe('Aceitar');
      expect(getActionLabelPtBR('REJECT')).toBe('Rejeitar');
      expect(getActionLabelPtBR('CONFIRM')).toBe('Confirmar');
      expect(getActionLabelPtBR('REPORT_DELIVERY')).toBe('Reportar Entrega');
      expect(getActionLabelPtBR('CONFIRM_PAYMENT')).toBe('Confirmar Pagamento');
    });
  });

  // =========================================================================
  // detectForbiddenTerms
  // =========================================================================
  
  describe('detectForbiddenTerms', () => {
    it('detecta termos em inglês em texto', () => {
      const found = detectForbiddenTerms('Status: OPEN - Aguardando');
      expect(found).toContain('OPEN');
    });

    it('detecta múltiplos termos', () => {
      const found = detectForbiddenTerms('ACCEPTED LOADING IN_TRANSIT');
      expect(found.length).toBeGreaterThanOrEqual(2);
    });

    it('retorna vazio para texto em PT-BR puro', () => {
      const found = detectForbiddenTerms('Frete em trânsito, aguardando confirmação');
      expect(found).toHaveLength(0);
    });

    it('retorna vazio para string vazia', () => {
      expect(detectForbiddenTerms('')).toHaveLength(0);
    });
  });

  // =========================================================================
  // sanitizeForDisplay
  // =========================================================================
  
  describe('sanitizeForDisplay', () => {
    it('substitui termos em inglês por PT-BR', () => {
      const result = sanitizeForDisplay('Status: OPEN');
      expect(result).toContain('Aberto');
      expect(result).not.toContain('OPEN');
    });

    it('mantém texto já em PT-BR intacto', () => {
      const text = 'Frete aceito pelo motorista';
      expect(sanitizeForDisplay(text)).toBe(text);
    });
  });

  // =========================================================================
  // guardStatusDisplay
  // =========================================================================
  
  describe('guardStatusDisplay', () => {
    it('traduz status cru para PT-BR', () => {
      expect(guardStatusDisplay('IN_TRANSIT')).toBe('Em Trânsito');
    });

    it('retorna tradução mesmo para status já traduzido', () => {
      // Se alguém passar já traduzido, não deve quebrar
      const result = guardStatusDisplay('Em Trânsito');
      expect(result).toBeTruthy();
    });
  });
});
