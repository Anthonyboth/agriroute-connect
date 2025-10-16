import { supabase } from "@/integrations/supabase/client";
import { ErrorAutoCorrector } from "./errorAutoCorrector";
import type { ErrorReport, ErrorCategory, ErrorType, AutoCorrectionResult } from "@/types/errorTypes";

export class ErrorMonitoringService {
  private static instance: ErrorMonitoringService;
  private autoCorrector: ErrorAutoCorrector;
  private errorQueue: ErrorReport[] = [];
  private isOnline = navigator.onLine;

  private constructor() {
    this.autoCorrector = ErrorAutoCorrector.getInstance();
    
    // Monitorar status da rede
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

  private isUserPanelRoute(pathname: string): boolean {
    const userPanelRoutes = ['/dashboard', '/company', '/app', '/painel', '/profile', '/driver', '/producer', '/provider'];
    return userPanelRoutes.some(route => pathname.startsWith(route));
  }

  async reportUserPanelError(report: ErrorReport): Promise<{ notified: boolean; errorLogId?: string }> {
    console.log('[ErrorMonitoringService] Reportando erro de painel ao Telegram:', report.errorMessage);

    if (!this.isOnline) {
      console.log('[ErrorMonitoringService] Offline - adicionando à fila');
      this.errorQueue.push(report);
      return { notified: false };
    }

    try {
      const { data, error } = await supabase.functions.invoke('report-user-panel-error', {
        body: report
      });

      if (error) {
        console.error('[ErrorMonitoringService] Erro ao reportar ao painel:', error);
        this.errorQueue.push(report);
        return { notified: false };
      }

      console.log('[ErrorMonitoringService] Resposta do reporte de painel:', data);
      
      return {
        notified: data?.notified || false,
        errorLogId: data?.errorLogId
      };
    } catch (error) {
      console.error('[ErrorMonitoringService] Falha ao reportar erro de painel:', error);
      this.errorQueue.push(report);
      return { notified: false };
    }
  }

  async captureError(error: Error, context?: any): Promise<{ notified: boolean; errorLogId?: string }> {
    console.log('[ErrorMonitoringService] Erro capturado:', error.message);

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
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      errorReport.userId = user.id;
      errorReport.userEmail = user.email;
    }

    // Se é erro de painel do usuário, usa função exclusiva
    const isUserFacingError = context?.userFacing === true || this.isUserPanelRoute(window.location.pathname);
    
    if (isUserFacingError) {
      console.log('[ErrorMonitoringService] Erro de painel detectado - usando reporte exclusivo');
      return await this.reportUserPanelError(errorReport);
    }

    return await this.sendToBackend(errorReport);
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
    return error.code || error.status?.toString() || undefined;
  }

  private async sendToBackend(report: ErrorReport): Promise<{ notified: boolean; errorLogId?: string }> {
    if (!this.isOnline) {
      console.log('[ErrorMonitoringService] Offline - adicionando à fila');
      this.errorQueue.push(report);
      return { notified: false };
    }

    try {
      console.log('[ErrorMonitoringService] Enviando relatório ao backend:', {
        route: report.route,
        errorMessage: report.errorMessage,
        errorType: report.errorType
      });

      const { data, error } = await supabase.functions.invoke('report-error', {
        body: report
      });

      if (error) {
        console.error('[ErrorMonitoringService] Erro ao enviar relatório:', error);
        this.errorQueue.push(report);
        return { notified: false };
      }

      console.log('[ErrorMonitoringService] Resposta do backend:', data);
      
      return {
        notified: data?.notified || false,
        errorLogId: data?.errorLogId
      };
    } catch (error) {
      console.error('[ErrorMonitoringService] Falha ao enviar relatório:', error);
      this.errorQueue.push(report);
      return { notified: false };
    }
  }

  private async processOfflineQueue(): Promise<void> {
    console.log(`[ErrorMonitoringService] Processando fila offline (${this.errorQueue.length} itens)`);

    while (this.errorQueue.length > 0 && this.isOnline) {
      const report = this.errorQueue.shift();
      if (report) {
        await this.sendToBackend(report);
        await new Promise(resolve => setTimeout(resolve, 1000)); // Delay entre envios
      }
    }
  }
}
