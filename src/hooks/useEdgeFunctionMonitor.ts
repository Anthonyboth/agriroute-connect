import { useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface EdgeFunctionError {
  functionName: string;
  error: Error;
  timestamp: Date;
  retryCount: number;
}

interface MonitorConfig {
  enableAutoReport: boolean;
  reportThreshold: number; // Número de erros antes de reportar
  cooldownMs: number; // Tempo entre reports
}

const DEFAULT_CONFIG: MonitorConfig = {
  enableAutoReport: true,
  reportThreshold: 3,
  cooldownMs: 60000, // 1 minuto
};

// Singleton para rastrear erros globalmente
class EdgeFunctionErrorTracker {
  private static instance: EdgeFunctionErrorTracker;
  private errors: Map<string, EdgeFunctionError[]> = new Map();
  private lastReportTime: Map<string, number> = new Map();
  private config: MonitorConfig = DEFAULT_CONFIG;

  static getInstance(): EdgeFunctionErrorTracker {
    if (!EdgeFunctionErrorTracker.instance) {
      EdgeFunctionErrorTracker.instance = new EdgeFunctionErrorTracker();
    }
    return EdgeFunctionErrorTracker.instance;
  }

  configure(config: Partial<MonitorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  trackError(functionName: string, error: Error, retryCount: number = 0): void {
    const errorEntry: EdgeFunctionError = {
      functionName,
      error,
      timestamp: new Date(),
      retryCount,
    };

    const existingErrors = this.errors.get(functionName) || [];
    existingErrors.push(errorEntry);

    // Manter apenas os últimos 10 erros por função
    if (existingErrors.length > 10) {
      existingErrors.shift();
    }

    this.errors.set(functionName, existingErrors);

    // Verificar se deve reportar
    this.checkAndReport(functionName);
  }

  private async checkAndReport(functionName: string): Promise<void> {
    if (!this.config.enableAutoReport) return;

    const errors = this.errors.get(functionName) || [];
    const recentErrors = errors.filter(
      (e) => Date.now() - e.timestamp.getTime() < 300000 // Últimos 5 minutos
    );

    if (recentErrors.length < this.config.reportThreshold) return;

    // Verificar cooldown
    const lastReport = this.lastReportTime.get(functionName) || 0;
    if (Date.now() - lastReport < this.config.cooldownMs) return;

    // Reportar
    await this.reportToTelegram(functionName, recentErrors);
    this.lastReportTime.set(functionName, Date.now());

    // Limpar erros reportados
    this.errors.set(functionName, []);
  }

  private async reportToTelegram(
    functionName: string,
    errors: EdgeFunctionError[]
  ): Promise<void> {
    try {
      const errorSummary = errors.map((e) => ({
        message: e.error.message,
        timestamp: e.timestamp.toISOString(),
        retryCount: e.retryCount,
      }));

      await supabase.functions.invoke('send-telegram-alert', {
        body: {
          errorData: {
            errorType: 'EDGE_FUNCTION_FAILURE',
            errorCategory: 'CRITICAL',
            errorMessage: `Edge Function "${functionName}" com ${errors.length} erros em 5 minutos`,
            module: 'EdgeFunctionMonitor',
            functionName,
            metadata: {
              errors: errorSummary,
              totalErrors: errors.length,
              firstErrorAt: errors[0]?.timestamp.toISOString(),
              lastErrorAt: errors[errors.length - 1]?.timestamp.toISOString(),
            },
          },
        },
      });

      console.log(
        `[EdgeFunctionMonitor] Alerta enviado para ${functionName} (${errors.length} erros)`
      );
    } catch (error) {
      console.error('[EdgeFunctionMonitor] Falha ao enviar alerta:', error);
    }
  }

  getErrorStats(): Record<string, { count: number; lastError?: Date }> {
    const stats: Record<string, { count: number; lastError?: Date }> = {};

    this.errors.forEach((errors, functionName) => {
      stats[functionName] = {
        count: errors.length,
        lastError: errors[errors.length - 1]?.timestamp,
      };
    });

    return stats;
  }

  clearErrors(functionName?: string): void {
    if (functionName) {
      this.errors.delete(functionName);
    } else {
      this.errors.clear();
    }
  }
}

export const edgeFunctionTracker = EdgeFunctionErrorTracker.getInstance();

export function useEdgeFunctionMonitor(config?: Partial<MonitorConfig>) {
  const configRef = useRef(config);

  useEffect(() => {
    if (configRef.current) {
      edgeFunctionTracker.configure(configRef.current);
    }
  }, []);

  const trackError = useCallback(
    (functionName: string, error: Error, retryCount?: number) => {
      edgeFunctionTracker.trackError(functionName, error, retryCount);
    },
    []
  );

  const getStats = useCallback(() => {
    return edgeFunctionTracker.getErrorStats();
  }, []);

  const clearErrors = useCallback((functionName?: string) => {
    edgeFunctionTracker.clearErrors(functionName);
  }, []);

  return {
    trackError,
    getStats,
    clearErrors,
  };
}

// Wrapper para chamar edge functions com monitoramento automático
export async function invokeWithMonitoring<T = any>(
  functionName: string,
  body?: Record<string, any>,
  options?: { maxRetries?: number; showToast?: boolean }
): Promise<{ data: T | null; error: Error | null }> {
  const maxRetries = options?.maxRetries ?? 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(
        `[EdgeFunction] ${functionName} - Tentativa ${attempt}/${maxRetries + 1}`
      );

      const { data, error } = await supabase.functions.invoke(functionName, {
        body,
      });

      if (error) {
        lastError = new Error(
          typeof error === 'object' && 'message' in error
            ? (error as any).message
            : String(error)
        );
        throw lastError;
      }

      return { data: data as T, error: null };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Rastrear erro
      edgeFunctionTracker.trackError(functionName, lastError, attempt);

      // Se não for a última tentativa, aguardar antes de retentar
      if (attempt <= maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  return { data: null, error: lastError };
}
