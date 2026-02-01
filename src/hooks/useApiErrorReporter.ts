/**
 * Hook para reportar erros de API automaticamente via Telegram
 * 
 * Uso simples em qualquer componente ou hook que faz chamadas de API:
 * 
 * @example
 * const { wrapApiCall } = useApiErrorReporter();
 * 
 * const result = await wrapApiCall(
 *   "focus_nfe",
 *   "emitirNfe",
 *   async () => {
 *     const { data, error } = await supabase.functions.invoke("nfe-emitir", { body });
 *     if (error) throw error;
 *     return data;
 *   }
 * );
 */

import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { IntegrationName } from "./useIntegrations";

// =============================================================================
// TYPES
// =============================================================================

interface ApiErrorContext {
  integration: IntegrationName;
  operation: string;
  context?: Record<string, unknown>;
}

// Throttle para evitar spam de alertas
const ERROR_THROTTLE_MS = 5 * 60 * 1000; // 5 minutos

// =============================================================================
// HOOK
// =============================================================================

export function useApiErrorReporter() {
  const reportedErrorsRef = useRef<Map<string, number>>(new Map());

  /**
   * Reporta erro de API para Telegram
   */
  const reportError = useCallback(async (
    ctx: ApiErrorContext,
    error: unknown
  ): Promise<void> => {
    const errorMessage = error instanceof Error 
      ? error.message 
      : typeof error === "string" 
        ? error 
        : "Erro desconhecido";
    
    const errorKey = `${ctx.integration}:${ctx.operation}:${errorMessage}`;
    
    // Throttle: não reportar o mesmo erro em 5 minutos
    const lastReported = reportedErrorsRef.current.get(errorKey);
    const now = Date.now();
    
    if (lastReported && now - lastReported < ERROR_THROTTLE_MS) {
      console.log("[API-ERROR] Skipping duplicate report:", errorKey);
      return;
    }
    
    reportedErrorsRef.current.set(errorKey, now);
    
    // Limpar entradas antigas (mais de 1 hora)
    for (const [key, timestamp] of reportedErrorsRef.current.entries()) {
      if (now - timestamp > 60 * 60 * 1000) {
        reportedErrorsRef.current.delete(key);
      }
    }
    
    console.error("[API-ERROR]", ctx.integration, ctx.operation, errorMessage);
    
    // Enviar alerta para Telegram
    try {
      const { data: auth } = await supabase.auth.getUser();
      
      await supabase.functions.invoke("send-telegram-alert", {
        body: {
          type: "api_integration_error",
          title: `🔴 Erro de API - ${ctx.integration.toUpperCase()}`,
          message: `
**Integração**: ${ctx.integration}
**Operação**: ${ctx.operation}
**Erro**: ${errorMessage}
**Usuário**: ${auth?.user?.email || "não autenticado"}
**Horário**: ${new Date().toLocaleString("pt-BR")}
${ctx.context ? `**Contexto**: ${JSON.stringify(ctx.context)}` : ""}
          `.trim(),
          severity: "error",
          source: "api_error_reporter",
        },
      });
    } catch (telegramError) {
      console.error("[API-ERROR] Failed to send Telegram alert:", telegramError);
    }
  }, []);

  /**
   * Wrapper para chamadas de API com report automático de erros
   */
  const wrapApiCall = useCallback(async <T>(
    integration: IntegrationName,
    operation: string,
    apiCall: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<{ success: boolean; data?: T; error?: string }> => {
    try {
      const data = await apiCall();
      return { success: true, data };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      await reportError(
        { integration, operation, context },
        error
      );
      
      return { success: false, error: errorMessage };
    }
  }, [reportError]);

  /**
   * Wrapper que lança erro após reportar (para uso com try/catch externo)
   */
  const wrapAndThrow = useCallback(async <T>(
    integration: IntegrationName,
    operation: string,
    apiCall: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> => {
    try {
      return await apiCall();
    } catch (error) {
      await reportError(
        { integration, operation, context },
        error
      );
      throw error;
    }
  }, [reportError]);

  return {
    reportError,
    wrapApiCall,
    wrapAndThrow,
  };
}
