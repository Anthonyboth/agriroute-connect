/**
 * Hook para monitorar performance e detectar problemas
 * Ajuda a identificar gargalos e operações lentas
 */

import { useCallback, useRef, useEffect } from 'react';

interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  success: boolean;
  error?: string;
}

interface PerformanceMonitorOptions {
  /** Limite de tempo em ms para considerar operação lenta */
  slowThresholdMs?: number;
  /** Callback quando operação é lenta */
  onSlowOperation?: (metrics: PerformanceMetrics) => void;
  /** Callback quando operação falha */
  onError?: (metrics: PerformanceMetrics) => void;
  /** Habilitar logs de console */
  enableConsoleLog?: boolean;
}

const performanceHistory: PerformanceMetrics[] = [];
const MAX_HISTORY = 100;

export function usePerformanceMonitor(options: PerformanceMonitorOptions = {}) {
  const {
    slowThresholdMs = 3000,
    onSlowOperation,
    onError,
    enableConsoleLog = process.env.NODE_ENV === 'development',
  } = options;

  const activeOperationsRef = useRef<Map<string, number>>(new Map());

  /**
   * Inicia o tracking de uma operação
   */
  const startOperation = useCallback((operationName: string): string => {
    const operationId = `${operationName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeOperationsRef.current.set(operationId, performance.now());
    
    if (enableConsoleLog) {
      console.log(`[Perf] ▶️ Iniciando: ${operationName}`);
    }
    
    return operationId;
  }, [enableConsoleLog]);

  /**
   * Finaliza o tracking de uma operação
   */
  const endOperation = useCallback((
    operationId: string,
    success: boolean = true,
    error?: string
  ): PerformanceMetrics | null => {
    const startTime = activeOperationsRef.current.get(operationId);
    
    if (startTime === undefined) {
      console.warn(`[Perf] Operação não encontrada: ${operationId}`);
      return null;
    }

    activeOperationsRef.current.delete(operationId);
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    const operationName = operationId.split('-')[0];

    const metrics: PerformanceMetrics = {
      operationName,
      startTime,
      endTime,
      duration,
      success,
      error,
    };

    // Adicionar ao histórico
    performanceHistory.push(metrics);
    if (performanceHistory.length > MAX_HISTORY) {
      performanceHistory.shift();
    }

    // Log
    if (enableConsoleLog) {
      const emoji = success ? '✅' : '❌';
      const slowWarning = duration > slowThresholdMs ? ' ⚠️ LENTO' : '';
      console.log(`[Perf] ${emoji} ${operationName}: ${duration.toFixed(2)}ms${slowWarning}`);
    }

    // Callbacks
    if (duration > slowThresholdMs) {
      onSlowOperation?.(metrics);
    }

    if (!success) {
      onError?.(metrics);
    }

    return metrics;
  }, [slowThresholdMs, onSlowOperation, onError, enableConsoleLog]);

  /**
   * Wrapper para medir tempo de uma função assíncrona
   */
  const measureAsync = useCallback(async <T>(
    operationName: string,
    fn: () => Promise<T>
  ): Promise<T> => {
    const operationId = startOperation(operationName);
    
    try {
      const result = await fn();
      endOperation(operationId, true);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      endOperation(operationId, false, errorMessage);
      throw error;
    }
  }, [startOperation, endOperation]);

  /**
   * Wrapper para medir tempo de uma função síncrona
   */
  const measureSync = useCallback(<T>(
    operationName: string,
    fn: () => T
  ): T => {
    const operationId = startOperation(operationName);
    
    try {
      const result = fn();
      endOperation(operationId, true);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      endOperation(operationId, false, errorMessage);
      throw error;
    }
  }, [startOperation, endOperation]);

  /**
   * Obtém estatísticas de performance
   */
  const getStats = useCallback(() => {
    if (performanceHistory.length === 0) {
      return null;
    }

    const durations = performanceHistory.map(m => m.duration);
    const successCount = performanceHistory.filter(m => m.success).length;
    const slowCount = performanceHistory.filter(m => m.duration > slowThresholdMs).length;

    return {
      totalOperations: performanceHistory.length,
      successRate: (successCount / performanceHistory.length) * 100,
      averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
      minDuration: Math.min(...durations),
      maxDuration: Math.max(...durations),
      slowOperations: slowCount,
      slowRate: (slowCount / performanceHistory.length) * 100,
    };
  }, [slowThresholdMs]);

  /**
   * Limpa o histórico de performance
   */
  const clearHistory = useCallback(() => {
    performanceHistory.length = 0;
  }, []);

  return {
    startOperation,
    endOperation,
    measureAsync,
    measureSync,
    getStats,
    clearHistory,
    history: performanceHistory,
  };
}

/**
 * Hook para medir tempo de renderização de componentes
 */
export function useRenderPerformance(componentName: string) {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(performance.now());

  useEffect(() => {
    renderCountRef.current++;
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    
    if (process.env.NODE_ENV === 'development' && timeSinceLastRender < 100) {
      console.warn(
        `[RenderPerf] ${componentName} renderizou ${renderCountRef.current}x ` +
        `(${timeSinceLastRender.toFixed(2)}ms desde último render)`
      );
    }
    
    lastRenderTimeRef.current = now;
  });

  return {
    renderCount: renderCountRef.current,
  };
}
