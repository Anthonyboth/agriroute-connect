import { supabase } from "@/integrations/supabase/client";
import { ErrorAutoCorrector } from "./errorAutoCorrector";
import type { ErrorReport, ErrorCategory, ErrorType, AutoCorrectionResult } from "@/types/errorTypes";

const SUPABASE_URL = "https://shnvtxejjecbnztdbbbl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg";

export class ErrorMonitoringService {
  private static instance: ErrorMonitoringService;
  private autoCorrector: ErrorAutoCorrector;
  private errorQueue: ErrorReport[] = [];
  private isOnline = navigator.onLine;

  private constructor() {
    this.autoCorrector = ErrorAutoCorrector.getInstance();

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }

  static getInstance(): ErrorMonitoringService {
    if (!ErrorMonitoringService.instance) {
      ErrorMonitoringService.instance = new ErrorMonitoringService();
    }
    return ErrorMonitoringService.instance;
  }

  /**
   * Notificar TODOS os erros diretamente no Telegram
   * SEM deduplicação, SEM verificação de role
   */
  private async notifyTelegram(report: ErrorReport): Promise<boolean> {
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/telegram-error-notifier`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY,
          'X-Skip-Error-Monitoring': 'true' // ✅ Correção 2: Header para evitar loop
        },
        body: JSON.stringify(report)
      });

      const data = await response.json();
      if (import.meta.env.DEV) {
        console.log('[ErrorMonitoringService] Notificação Telegram:', data);
      }
      return data?.success || false;
    } catch (error) {
      // ✅ Não propagar erro para evitar loop infinito
      console.debug('[ErrorMonitoringService] Falha ao notificar Telegram (suprimido):', error);
      return false;
    }
  }

  private isUserPanelRoute(pathname: string): boolean {
    const userPanelRoutes = ['/dashboard', '/company', '/app', '/painel', '/profile', '/driver', '/producer', '/provider'];
    return userPanelRoutes.some(route => pathname.startsWith(route));
  }

  async reportUserPanelError(report: ErrorReport): Promise<{ notified: boolean; errorLogId?: string }> {
    if (import.meta.env.DEV) {
      console.log('[ErrorMonitoringService] Reportando erro de painel:', report.errorMessage);
    }

    // SEMPRE notificar no Telegram primeiro
    const telegramNotified = await this.notifyTelegram(report);

    if (!this.isOnline) {
      if (import.meta.env.DEV) {
        console.log('[ErrorMonitoringService] Offline - adicionando à fila');
      }
      this.errorQueue.push(report);
      return { notified: telegramNotified };
    }

    try {
      // ✅ Defensive normalization: guarantee schema-compatible payload
      const safeReport: ErrorReport = {
        ...report,
        errorCode: report.errorCode != null ? String(report.errorCode) : undefined,
      };

      const { data, error } = await supabase.functions.invoke('report-user-panel-error', {
        body: safeReport
      });
      if (error) {
        console.error('[ErrorMonitoringService] Erro ao reportar ao backend:', error);
        this.errorQueue.push(report);
      }

      return {
        notified: telegramNotified || data?.notified || false,
        errorLogId: data?.errorLogId
      };
    } catch (error) {
      console.error('[ErrorMonitoringService] Falha ao reportar erro de painel:', error);
      this.errorQueue.push(report);
      return { notified: telegramNotified };
    }
  }

  async captureError(error: Error, context?: any): Promise<{ notified: boolean; errorLogId?: string }> {
    if (import.meta.env.DEV) {
      console.log('[ErrorMonitoringService] Erro capturado:', error.message);
    }

    const errorCategory = this.classifyError(error);
    const correctionResult = await this.attemptAutoCorrection(error, errorCategory);

    const errorReport: ErrorReport = {
      errorType: this.determineErrorType(error, context),
      errorCategory,
      errorMessage: error.message,
      errorStack: error.stack,
      errorCode: this.extractErrorCode(error),
      module: context?.module || context?.componentStack?.split('\n')[0],
      functionName: context?.functionName,
      route: window.location.pathname,
      autoCorrectionAttempted: correctionResult.attempted,
      autoCorrectionAction: correctionResult.action,
      autoCorrectionSuccess: correctionResult.success,
      metadata: {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href,
        timestamp: new Date().toISOString()
      }
    };

    // Adicionar informações do usuário se disponível
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        errorReport.userId = user.id;
        errorReport.userEmail = user.email;
      }
    } catch {
      // Ignorar erro ao obter usuário
    }

    // SEMPRE notificar no Telegram PRIMEIRO
    const telegramNotified = await this.notifyTelegram(errorReport);

    // Se é erro de painel do usuário, também usa função exclusiva de reporte
    const isUserFacingError = context?.userFacing === true || this.isUserPanelRoute(window.location.pathname);
    
    if (isUserFacingError) {
      if (import.meta.env.DEV) {
        console.log('[ErrorMonitoringService] Erro de painel detectado');
      }
      const result = await this.reportUserPanelError(errorReport);
      return { ...result, notified: telegramNotified || result.notified };
    }

    const backendResult = await this.sendToBackend(errorReport);
    return { ...backendResult, notified: telegramNotified || backendResult.notified };
  }

  private classifyError(error: Error): ErrorCategory {
    const criticalKeywords = [
      'payment',
      'stripe',
      'transaction',
      'security',
      'permission denied',
      'rls',
      'constraint violation',
      'foreign key',
      'unique constraint',
      'antt',
      'cálculo',
      'calculation',
      '500',
      'internal server error',
      'removechild',
      'insertbefore',
      'hydration',
      'hydrate'
    ];

    const errorMessage = error.message.toLowerCase();
    const errorStack = error.stack?.toLowerCase() || '';

    const isCritical = criticalKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorStack.includes(keyword)
    );

    return isCritical ? 'CRITICAL' : 'SIMPLE';
  }

  private async attemptAutoCorrection(
    error: Error, 
    category: ErrorCategory
  ): Promise<AutoCorrectionResult> {
    // Não tentar autocorreção em erros críticos
    if (category === 'CRITICAL') {
      return {
        attempted: false,
        action: 'Erro crítico - sem autocorreção',
        success: false
      };
    }

    return await this.autoCorrector.correctError(error);
  }

  private determineErrorType(error: Error, context?: any): ErrorType {
    const message = error.message.toLowerCase();

    if (message.includes('payment') || message.includes('stripe')) {
      return 'PAYMENT';
    }
    if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
      return 'NETWORK';
    }
    if (message.includes('database') || message.includes('constraint') || message.includes('rls')) {
      return 'DATABASE';
    }
    if (context?.source === 'backend' || message.includes('edge function')) {
      return 'BACKEND';
    }

    return 'FRONTEND';
  }

  private extractErrorCode(error: any): string | undefined {
    // Ensure errorCode is always a string (schema requires string, not number)
    if (error.code != null) return String(error.code);
    if (error.status != null) return String(error.status);
    return undefined;
  }

  private async sendToBackend(report: ErrorReport): Promise<{ notified: boolean; errorLogId?: string }> {
    if (!this.isOnline) {
      console.debug('[ErrorMonitoringService] Offline - adicionando à fila');
      this.errorQueue.push(report);
      return { notified: false };
    }

    try {
      const { data, error } = await supabase.functions.invoke('report-error', {
        body: report
      }).catch((invokeError) => {
        console.debug('[ErrorMonitoringService] Invoke falhou (não crítico):', invokeError?.message || invokeError);
        return { data: null, error: invokeError };
      });

      if (error) {
        console.debug('[ErrorMonitoringService] Edge function retornou erro (não crítico):', error?.message || error);
        return { notified: false };
      }

      return {
        notified: data?.notified || false,
        errorLogId: data?.errorLogId
      };
    } catch (error) {
      console.debug('[ErrorMonitoringService] Erro capturado e suprimido:', error);
      return { notified: false };
    }
  }

  private async processOfflineQueue(): Promise<void> {
    if (import.meta.env.DEV) {
      console.log(`[ErrorMonitoringService] Processando fila offline (${this.errorQueue.length} itens)`);
    }

    while (this.errorQueue.length > 0 && this.isOnline) {
      const report = this.errorQueue.shift();
      if (report) {
        await this.notifyTelegram(report); // Notificar primeiro
        await this.sendToBackend(report);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
}
