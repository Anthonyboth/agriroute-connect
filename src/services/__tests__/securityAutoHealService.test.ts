import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityAutoHealService } from '@/services/securityAutoHealService';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      refreshSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test' } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    },
    getChannels: vi.fn().mockReturnValue([]),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock fetch
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ success: true }),
});
vi.stubGlobal('fetch', mockFetch);

describe('SecurityAutoHealService', () => {
  let service: SecurityAutoHealService;

  beforeEach(() => {
    // Reset singleton
    (SecurityAutoHealService as any).instance = undefined;
    service = SecurityAutoHealService.getInstance();
    mockFetch.mockClear();
  });

  describe('Singleton', () => {
    it('retorna a mesma instância', () => {
      const a = SecurityAutoHealService.getInstance();
      const b = SecurityAutoHealService.getInstance();
      expect(a).toBe(b);
    });
  });

  describe('Classificação de erros', () => {
    it('classifica erro de rede', async () => {
      const report = await service.handleError(new Error('Failed to fetch data'));
      expect(report.error_type).toBe('NETWORK');
    });

    it('classifica erro de auth', async () => {
      const report = await service.handleError(new Error('401 Unauthorized'));
      expect(report.error_type).toBe('AUTH');
    });

    it('classifica erro de chunk loading', async () => {
      const report = await service.handleError(new Error('Failed to fetch dynamically imported module'));
      expect(report.error_type).toBe('CHUNK_LOAD');
    });

    it('classifica erro de storage', async () => {
      const report = await service.handleError(new Error('QuotaExceededError: localStorage quota exceeded'));
      expect(report.error_type).toBe('STORAGE');
    });

    it('classifica erro de realtime', async () => {
      const report = await service.handleError(new Error('WebSocket connection failed'));
      expect(report.error_type).toBe('REALTIME');
    });

    it('classifica erro de pagamento', async () => {
      const report = await service.handleError(new Error('Stripe payment failed'));
      expect(report.error_type).toBe('PAYMENT');
    });

    it('classifica erro de banco de dados', async () => {
      const report = await service.handleError(new Error('RLS policy violation'));
      expect(report.error_type).toBe('DATABASE');
    });

    it('classifica erro genérico como FRONTEND', async () => {
      const report = await service.handleError(new Error('Something unexpected'));
      expect(report.error_type).toBe('FRONTEND');
    });
  });

  describe('Seleção de estratégias', () => {
    it('NÃO tenta corrigir erros de pagamento (risco financeiro)', async () => {
      const report = await service.handleError(new Error('Stripe payment intent failed'));
      // Para pagamento, nenhuma estratégia é selecionada
      expect(report.attempts.length).toBe(0);
      expect(report.final_status).toBe('SKIPPED');
    });

    it('NÃO tenta corrigir erros de banco (risco de dados)', async () => {
      const report = await service.handleError(new Error('RLS policy denied access'));
      expect(report.attempts.length).toBe(0);
      expect(report.final_status).toBe('SKIPPED');
    });

    it('tenta SESSION_REFRESH para erros de auth', async () => {
      const report = await service.handleError(new Error('JWT token expired - 401'));
      expect(report.attempts.some(a => a.strategy === 'SESSION_REFRESH')).toBe(true);
    });

    it('tenta NETWORK_RETRY para erros de rede', async () => {
      const report = await service.handleError(new Error('Network timeout'));
      expect(report.attempts.some(a => a.strategy === 'NETWORK_RETRY')).toBe(true);
    });
  });

  describe('Throttling', () => {
    it('aplica throttle para o mesmo erro em sequência', async () => {
      const error = new Error('Repeated unique throttle test error');
      const report1 = await service.handleError(error);
      const report2 = await service.handleError(error);

      // Primeiro deve processar, segundo deve ser SKIPPED
      expect(report1.final_status).not.toBe('SKIPPED');
      expect(report2.final_status).toBe('SKIPPED');
    });
  });

  describe('Estatísticas', () => {
    it('mantém stats de correções', async () => {
      // Reset singleton para stats limpas
      (SecurityAutoHealService as any).instance = undefined;
      const freshService = SecurityAutoHealService.getInstance();

      await freshService.handleError(new Error('Unique test error for stats'));
      const stats = freshService.getStats();
      expect(stats.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Notificação Telegram', () => {
    it('envia report ao Telegram com _customMessage', async () => {
      // Reset singleton
      (SecurityAutoHealService as any).instance = undefined;
      const freshService = SecurityAutoHealService.getInstance();

      await freshService.handleError(new Error('Unique telegram test error'));

      // Verificar que fetch foi chamado com telegram-error-notifier
      const telegramCalls = mockFetch.mock.calls.filter(
        (call: any[]) => typeof call[0] === 'string' && call[0].includes('telegram-error-notifier')
      );
      expect(telegramCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Logs recentes', () => {
    it('mantém histórico de reports', async () => {
      (SecurityAutoHealService as any).instance = undefined;
      const freshService = SecurityAutoHealService.getInstance();

      await freshService.handleError(new Error('Log test unique error'));
      const logs = freshService.getRecentLogs();
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].error_message).toContain('Log test unique error');
    });
  });
});
