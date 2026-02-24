/**
 * SecurityAutoHealService
 * 
 * Serviço avançado de auto-cura que tenta corrigir erros automaticamente
 * e reporta o resultado (sucesso/falha) ao Telegram.
 * 
 * Estratégias de correção:
 * 1. NETWORK_RETRY - Retry com backoff para erros de rede
 * 2. SESSION_REFRESH - Refresh de sessão JWT expirado
 * 3. CACHE_CLEAR - Limpar cache corrompido
 * 4. QUERY_INVALIDATE - Invalidar React Query cache
 * 5. COMPONENT_RELOAD - Recarregar componente crashado
 * 6. REALTIME_RECONNECT - Reconectar Supabase Realtime
 * 7. STORAGE_CLEANUP - Limpar storage corrompido
 * 8. CHUNK_RELOAD - Recarregar módulos dinâmicos falhos
 */

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// TYPES
// =============================================================================

export type HealStrategy =
  | 'NETWORK_RETRY'
  | 'SESSION_REFRESH'
  | 'CACHE_CLEAR'
  | 'QUERY_INVALIDATE'
  | 'COMPONENT_RELOAD'
  | 'REALTIME_RECONNECT'
  | 'STORAGE_CLEANUP'
  | 'CHUNK_RELOAD'
  | 'NONE';

export interface HealAttempt {
  strategy: HealStrategy;
  attempted: boolean;
  success: boolean;
  action: string;
  duration_ms: number;
  error_original: string;
  error_type: string;
  timestamp: string;
}

export interface HealReport {
  error_message: string;
  error_type: string;
  error_source: string;
  route: string;
  attempts: HealAttempt[];
  final_status: 'HEALED' | 'PARTIAL' | 'FAILED' | 'SKIPPED';
  total_duration_ms: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const SUPABASE_URL = 'https://shnvtxejjecbnztdbbbl.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg';

// Throttle: não reportar o mesmo erro em 2 minutos
const HEAL_THROTTLE_MS = 2 * 60 * 1000;

// =============================================================================
// SERVICE
// =============================================================================

export class SecurityAutoHealService {
  private static instance: SecurityAutoHealService;
  private healLog: HealReport[] = [];
  private throttleMap: Map<string, number> = new Map();
  private healStats = { total: 0, healed: 0, failed: 0, skipped: 0 };

  static getInstance(): SecurityAutoHealService {
    if (!SecurityAutoHealService.instance) {
      SecurityAutoHealService.instance = new SecurityAutoHealService();
    }
    return SecurityAutoHealService.instance;
  }

  // =========================================================================
  // PUBLIC API
  // =========================================================================

  /**
   * Diagnostica o erro, tenta correção e reporta resultado ao Telegram
   */
  async handleError(
    error: Error,
    context: { source?: string; module?: string; route?: string } = {}
  ): Promise<HealReport> {
    const startTime = Date.now();
    const errorMsg = error.message || 'Unknown error';
    const route = context.route || (typeof window !== 'undefined' ? window.location.pathname : 'N/A');
    const errorType = this.classifyError(error);

    // Throttle: evitar spam no mesmo erro
    const throttleKey = `${errorType}:${errorMsg.substring(0, 80)}`;
    if (this.isThrottled(throttleKey)) {
      this.healStats.skipped++;
      return {
        error_message: errorMsg,
        error_type: errorType,
        error_source: context.source || 'unknown',
        route,
        attempts: [],
        final_status: 'SKIPPED',
        total_duration_ms: 0,
      };
    }
    this.throttleMap.set(throttleKey, Date.now());

    // Selecionar estratégias baseadas no tipo de erro
    const strategies = this.selectStrategies(error, errorType);
    const attempts: HealAttempt[] = [];
    let healed = false;

    for (const strategy of strategies) {
      const attemptStart = Date.now();
      try {
        const result = await this.executeStrategy(strategy, error);
        attempts.push({
          strategy,
          attempted: true,
          success: result.success,
          action: result.action,
          duration_ms: Date.now() - attemptStart,
          error_original: errorMsg.substring(0, 200),
          error_type: errorType,
          timestamp: new Date().toISOString(),
        });

        if (result.success) {
          healed = true;
          break; // Primeira estratégia bem-sucedida encerra o loop
        }
      } catch (healError) {
        attempts.push({
          strategy,
          attempted: true,
          success: false,
          action: `Exceção: ${healError instanceof Error ? healError.message : String(healError)}`,
          duration_ms: Date.now() - attemptStart,
          error_original: errorMsg.substring(0, 200),
          error_type: errorType,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const finalStatus: HealReport['final_status'] = strategies.length === 0
      ? 'SKIPPED'
      : healed
        ? 'HEALED'
        : attempts.some(a => a.success)
          ? 'PARTIAL'
          : 'FAILED';

    const report: HealReport = {
      error_message: errorMsg,
      error_type: errorType,
      error_source: context.source || 'unknown',
      route,
      attempts,
      final_status: finalStatus,
      total_duration_ms: Date.now() - startTime,
    };

    // Atualizar stats
    this.healStats.total++;
    if (finalStatus === 'HEALED') this.healStats.healed++;
    else if (finalStatus === 'FAILED') this.healStats.failed++;
    else if (finalStatus === 'SKIPPED') this.healStats.skipped++;

    // Manter últimos 50 logs
    this.healLog.push(report);
    if (this.healLog.length > 50) this.healLog.shift();

    // Reportar ao Telegram
    await this.reportToTelegram(report);

    return report;
  }

  getStats() {
    return { ...this.healStats };
  }

  getRecentLogs(limit = 10): HealReport[] {
    return this.healLog.slice(-limit);
  }

  // =========================================================================
  // ERROR CLASSIFICATION
  // =========================================================================

  private classifyError(error: Error): string {
    const msg = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // React hook order mismatch / render loop crítico
    if (
      msg.includes('rendered more hooks than during the previous render') ||
      msg.includes('too many re-renders') ||
      msg.includes('maximum update depth exceeded')
    ) {
      return 'HOOKS';
    }

    // CHUNK_LOAD deve ser checado ANTES de NETWORK (contém "failed to fetch")
    if (msg.includes('dynamically imported') || msg.includes('loading chunk') || msg.includes('loading css chunk')) {
      return 'CHUNK_LOAD';
    }
    if (msg.includes('timeout') || msg.includes('network') || msg.includes('failed to fetch') || msg.includes('net::err')) {
      return 'NETWORK';
    }
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('refresh_token')) {
      return 'AUTH';
    }
    if (msg.includes('quota') || msg.includes('storage') || msg.includes('localstorage')) {
      return 'STORAGE';
    }
    if (msg.includes('realtime') || msg.includes('websocket') || msg.includes('subscription')) {
      return 'REALTIME';
    }
    if (msg.includes('query') || msg.includes('cache') || msg.includes('stale')) {
      return 'QUERY_CACHE';
    }
    if (msg.includes('hydrat') || msg.includes('mismatch') || msg.includes('removechild') || msg.includes('insertbefore')) {
      return 'HYDRATION';
    }
    if (msg.includes('payment') || msg.includes('stripe') || msg.includes('pix')) {
      return 'PAYMENT';
    }
    if (msg.includes('rls') || msg.includes('permission') || msg.includes('policy')) {
      return 'DATABASE';
    }
    if (stack.includes('supabase') || msg.includes('postgrest') || msg.includes('constraint')) {
      return 'DATABASE';
    }
    return 'FRONTEND';
  }

  // =========================================================================
  // STRATEGY SELECTION
  // =========================================================================

  private selectStrategies(error: Error, errorType: string): HealStrategy[] {
    switch (errorType) {
      case 'NETWORK':
        return ['NETWORK_RETRY', 'REALTIME_RECONNECT'];
      case 'AUTH':
        return ['SESSION_REFRESH'];
      case 'CHUNK_LOAD':
        return ['CHUNK_RELOAD'];
      case 'STORAGE':
        return ['STORAGE_CLEANUP'];
      case 'REALTIME':
        return ['REALTIME_RECONNECT'];
      case 'QUERY_CACHE':
        return ['QUERY_INVALIDATE', 'CACHE_CLEAR'];
      case 'HYDRATION':
        return ['CACHE_CLEAR', 'COMPONENT_RELOAD'];
      case 'PAYMENT':
        // Nunca auto-corrigir pagamentos — risco financeiro
        return [];
      case 'DATABASE':
        // Nunca auto-corrigir erros de banco — risco de dados
        return [];
      case 'HOOKS':
        // Hook mismatch normalmente exige reload completo para restaurar ordem de hooks
        return ['CHUNK_RELOAD'];
      default:
        return ['CACHE_CLEAR'];
    }
  }

  // =========================================================================
  // STRATEGY EXECUTION
  // =========================================================================

  private async executeStrategy(
    strategy: HealStrategy,
    _error: Error
  ): Promise<{ success: boolean; action: string }> {
    switch (strategy) {
      case 'NETWORK_RETRY':
        return await this.healNetworkRetry();
      case 'SESSION_REFRESH':
        return await this.healSessionRefresh();
      case 'CACHE_CLEAR':
        return this.healCacheClear();
      case 'QUERY_INVALIDATE':
        return this.healQueryInvalidate();
      case 'COMPONENT_RELOAD':
        return this.healComponentReload();
      case 'REALTIME_RECONNECT':
        return await this.healRealtimeReconnect();
      case 'STORAGE_CLEANUP':
        return this.healStorageCleanup();
      case 'CHUNK_RELOAD':
        return this.healChunkReload();
      default:
        return { success: false, action: 'Estratégia desconhecida' };
    }
  }

  // --- NETWORK_RETRY ---
  private async healNetworkRetry(): Promise<{ success: boolean; action: string }> {
    // Testar conectividade com o Supabase
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          method: 'HEAD',
          headers: { apikey: SUPABASE_ANON_KEY },
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok || response.status === 400) {
          return { success: true, action: `Rede restaurada (tentativa ${i + 1})` };
        }
      } catch {
        // Aguardar antes da próxima tentativa
        await this.sleep(Math.pow(2, i) * 1000);
      }
    }
    return { success: false, action: 'Rede indisponível após 3 tentativas' };
  }

  // --- SESSION_REFRESH ---
  private async healSessionRefresh(): Promise<{ success: boolean; action: string }> {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        return { success: false, action: `Refresh falhou: ${error?.message || 'sem sessão'}` };
      }
      return { success: true, action: 'Sessão JWT renovada com sucesso' };
    } catch (err) {
      return { success: false, action: `Exceção no refresh: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  // --- CACHE_CLEAR ---
  private healCacheClear(): { success: boolean; action: string } {
    try {
      const supabaseKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('sb-')) supabaseKeys.push(key);
      }

      let cleared = 0;
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && !supabaseKeys.includes(key)) {
          localStorage.removeItem(key);
          cleared++;
        }
      }
      sessionStorage.clear();
      return { success: true, action: `Cache limpo (${cleared} itens localStorage + sessionStorage)` };
    } catch {
      return { success: false, action: 'Erro ao limpar cache' };
    }
  }

  // --- QUERY_INVALIDATE ---
  private healQueryInvalidate(): { success: boolean; action: string } {
    try {
      // Disparar evento customizado que o QueryClientProvider pode ouvir
      window.dispatchEvent(new CustomEvent('security-invalidate-queries'));
      return { success: true, action: 'Evento de invalidação de queries disparado' };
    } catch {
      return { success: false, action: 'Erro ao invalidar queries' };
    }
  }

  // --- COMPONENT_RELOAD ---
  private healComponentReload(): { success: boolean; action: string } {
    try {
      // Disparar evento customizado para error boundaries
      window.dispatchEvent(new CustomEvent('security-component-reload'));
      return { success: true, action: 'Evento de reload de componente disparado' };
    } catch {
      return { success: false, action: 'Erro ao disparar reload' };
    }
  }

  // --- REALTIME_RECONNECT ---
  private async healRealtimeReconnect(): Promise<{ success: boolean; action: string }> {
    try {
      // Remover todos os channels e reconectar
      const channels = supabase.getChannels();
      for (const channel of channels) {
        await supabase.removeChannel(channel);
      }
      return { success: true, action: `Realtime reconectado (${channels.length} canais removidos)` };
    } catch {
      return { success: false, action: 'Erro ao reconectar Realtime' };
    }
  }

  // --- STORAGE_CLEANUP ---
  private healStorageCleanup(): { success: boolean; action: string } {
    try {
      // Limpar itens expirados ou corrompidos
      let cleaned = 0;
      const keysToRemove: string[] = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key.startsWith('sb-')) continue;

        try {
          const value = localStorage.getItem(key);
          if (value && value.length > 500000) {
            // Itens maiores que 500KB provavelmente são corrompidos
            keysToRemove.push(key);
          }
        } catch {
          keysToRemove.push(key);
        }
      }

      for (const key of keysToRemove) {
        localStorage.removeItem(key);
        cleaned++;
      }

      return { success: true, action: `Storage limpo (${cleaned} itens grandes/corrompidos removidos)` };
    } catch {
      return { success: false, action: 'Erro ao limpar storage' };
    }
  }

  // --- CHUNK_RELOAD ---
  private healChunkReload(): { success: boolean; action: string } {
    try {
      // Marcar que precisa recarregar e agendar
      const reloadKey = 'security_chunk_reload_at';
      const lastReload = localStorage.getItem(reloadKey);
      const now = Date.now();

      // Não recarregar mais de 1x por minuto
      if (lastReload && now - parseInt(lastReload) < 60000) {
        return { success: false, action: 'Chunk reload suprimido (cooldown 1 min)' };
      }

      localStorage.setItem(reloadKey, String(now));
      // Agendar reload após notificação Telegram
      setTimeout(() => window.location.reload(), 2000);
      return { success: true, action: 'Página será recarregada em 2s para carregar chunks atualizados' };
    } catch {
      return { success: false, action: 'Erro ao agendar reload de chunks' };
    }
  }

  // =========================================================================
  // TELEGRAM REPORTING
  // =========================================================================

  private async reportToTelegram(report: HealReport): Promise<void> {
    try {
      const statusIcon = {
        HEALED: '✅',
        PARTIAL: '🟡',
        FAILED: '❌',
        SKIPPED: '⏭️',
      }[report.final_status];

      const attemptsText = report.attempts.length > 0
        ? report.attempts
            .map(a => `  ${a.success ? '✅' : '❌'} <b>${a.strategy}</b>: ${this.escapeHtml(a.action)} (${a.duration_ms}ms)`)
            .join('\n')
        : '  Nenhuma estratégia aplicável';

      const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' });

      const message = [
        `🛡️ <b>AUTO-HEAL REPORT</b>`,
        ``,
        `${statusIcon} <b>Status:</b> ${report.final_status}`,
        `<b>Tipo:</b> ${this.escapeHtml(report.error_type)}`,
        `<b>Origem:</b> ${this.escapeHtml(report.error_source)}`,
        `<b>Rota:</b> ${this.escapeHtml(report.route)}`,
        ``,
        `<b>💥 Erro:</b>`,
        `<pre>${this.escapeHtml(report.error_message.substring(0, 400))}</pre>`,
        ``,
        `<b>🔧 Tentativas de Correção:</b>`,
        attemptsText,
        ``,
        `<b>⏱️ Duração Total:</b> ${report.total_duration_ms}ms`,
        `<b>📊 Stats:</b> ${this.healStats.healed}/${this.healStats.total} corrigidos | ${this.healStats.failed} falhas`,
        `<b>⏰</b> ${timestamp}`,
      ].join('\n');

      await fetch(`${SUPABASE_URL}/functions/v1/telegram-error-notifier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          'X-Skip-Error-Monitoring': 'true',
        },
        body: JSON.stringify({
          errorType: report.error_type,
          errorCategory: report.final_status === 'FAILED' ? 'CRITICAL' : 'SIMPLE',
          errorMessage: `[AUTO-HEAL ${report.final_status}] ${report.error_message}`,
          module: 'SecurityAutoHeal',
          route: report.route,
          metadata: {
            final_status: report.final_status,
            attempts: report.attempts.map(a => ({
              strategy: a.strategy,
              success: a.success,
              action: a.action,
            })),
            stats: this.healStats,
            url: typeof window !== 'undefined' ? window.location.href : 'N/A',
            timestamp: new Date().toISOString(),
          },
          // Override: usar mensagem formatada customizada
          _customMessage: message,
        }),
      });
    } catch {
      // Nunca propagar erro do reporting
      console.debug('[SecurityAutoHeal] Falha ao reportar ao Telegram (suprimido)');
    }
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  private isThrottled(key: string): boolean {
    const last = this.throttleMap.get(key);
    if (!last) return false;
    const elapsed = Date.now() - last;
    if (elapsed >= HEAL_THROTTLE_MS) {
      this.throttleMap.delete(key);
      return false;
    }
    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}
