/**
 * Hook Centralizado de Integrações - AgriRoute
 * 
 * Este hook é o elo entre o AgriRoute e todas as APIs externas:
 * - Focus NFe (NF-e, CT-e, MDF-e)
 * - Pagar.me (pagamentos - em breve)
 * - Telegram (alertas e notificações)
 * - SEFAZ (validação fiscal)
 * 
 * Responsabilidades:
 * - Gerenciar status de todas as integrações
 * - Reportar erros automaticamente via Telegram
 * - Prover métricas de saúde das APIs
 * - Garantir funcionamento contínuo das emissões fiscais
 * 
 * @example
 * const { 
 *   focusNfe,
 *   pagamentos,
 *   healthStatus,
 *   reportApiError
 * } = useIntegrations();
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useFocusNfe, type FocusNfeStatus } from "./useFocusNfe";
import { isFeatureEnabled } from "@/config/featureFlags";

// =============================================================================
// TYPES
// =============================================================================

export type IntegrationName = 
  | "focus_nfe"    // Focus NFe - Emissão fiscal
  | "pagarme"      // Pagar.me - Pagamentos (futuro)
  | "telegram"     // Telegram - Alertas
  | "sefaz"        // SEFAZ - Validação fiscal
  | "geocoding"    // Geocodificação
  | "push";        // Push notifications

export type IntegrationStatus = "healthy" | "degraded" | "error" | "unknown";

export interface IntegrationHealth {
  name: IntegrationName;
  displayName: string;
  status: IntegrationStatus;
  lastCheck: string | null;
  lastError: string | null;
  responseTimeMs: number | null;
  isRequired: boolean;
  message: string;
}

export interface ApiErrorReport {
  integration: IntegrationName;
  operation: string;
  errorCode?: string;
  errorMessage: string;
  context?: Record<string, unknown>;
  userId?: string;
  timestamp: string;
}

export interface PaymentPricingTier {
  documentType: "nfe" | "cte" | "mdfe" | "nfse";
  unitPrice: number; // R$ por emissão
  description: string;
}

export interface PaymentState {
  provider: "pagarme" | "stripe_deprecated";
  isConfigured: boolean;
  canProcessPayments: boolean;
  walletBalance: number;
  pendingCharges: number;
  pricingTiers: PaymentPricingTier[];
}

export interface IntegrationsState {
  health: Record<IntegrationName, IntegrationHealth>;
  payments: PaymentState;
  lastHealthCheck: string | null;
  isCheckingHealth: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Preços por emissão de documento fiscal (modelo de cobrança por uso)
const EMISSION_PRICING: PaymentPricingTier[] = [
  { documentType: "nfe", unitPrice: 0.35, description: "Nota Fiscal Eletrônica" },
  { documentType: "cte", unitPrice: 0.25, description: "Conhecimento de Transporte" },
  { documentType: "mdfe", unitPrice: 0.15, description: "Manifesto de Documentos" },
  { documentType: "nfse", unitPrice: 0.40, description: "Nota Fiscal de Serviço" },
];

const DEFAULT_HEALTH: IntegrationHealth = {
  name: "focus_nfe",
  displayName: "Focus NFe",
  status: "unknown",
  lastCheck: null,
  lastError: null,
  responseTimeMs: null,
  isRequired: true,
  message: "Não verificado",
};

const INTEGRATIONS_CONFIG: Record<IntegrationName, Partial<IntegrationHealth>> = {
  focus_nfe: {
    displayName: "Focus NFe",
    isRequired: true,
    message: "Emissão de documentos fiscais",
  },
  pagarme: {
    displayName: "Pagar.me",
    isRequired: false, // Será required quando ativarmos pagamentos
    message: "Processamento de pagamentos (em breve)",
  },
  telegram: {
    displayName: "Telegram Alerts",
    isRequired: false,
    message: "Notificações e alertas",
  },
  sefaz: {
    displayName: "SEFAZ",
    isRequired: true,
    message: "Validação fiscal",
  },
  geocoding: {
    displayName: "Geocodificação",
    isRequired: false,
    message: "Cálculo de rotas e distâncias",
  },
  push: {
    displayName: "Push Notifications",
    isRequired: false,
    message: "Notificações push",
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function sendTelegramAlert(report: ApiErrorReport): Promise<boolean> {
  try {
    console.log("[INTEGRATIONS] Sending Telegram alert for API error:", report);
    
    const { error } = await supabase.functions.invoke("send-telegram-alert", {
      body: {
        type: "api_integration_error",
        title: `🔴 Erro de API - ${report.integration.toUpperCase()}`,
        message: `
**Integração**: ${report.integration}
**Operação**: ${report.operation}
**Erro**: ${report.errorMessage}
${report.errorCode ? `**Código**: ${report.errorCode}` : ""}
**Horário**: ${new Date(report.timestamp).toLocaleString("pt-BR")}
${report.context ? `**Contexto**: ${JSON.stringify(report.context)}` : ""}
        `.trim(),
        severity: "error",
        source: "integrations_hook",
      },
    });
    
    if (error) {
      console.error("[INTEGRATIONS] Failed to send Telegram alert:", error);
      return false;
    }
    
    return true;
  } catch (err) {
    console.error("[INTEGRATIONS] Exception sending Telegram alert:", err);
    return false;
  }
}

function mapFocusStatusToHealth(focusStatus: FocusNfeStatus): IntegrationStatus {
  switch (focusStatus) {
    case "ready":
      return "healthy";
    case "pending_validation":
    case "focus_sync_pending":
    case "loading":
      return "degraded";
    case "not_configured":
    case "certificate_missing":
    case "certificate_expired":
    case "blocked":
    case "error":
      return "error";
    default:
      return "unknown";
  }
}

// =============================================================================
// HOOK
// =============================================================================

export function useIntegrations() {
  // Sub-hooks para integrações específicas
  const focusNfe = useFocusNfe();
  
  // State
  const [state, setState] = useState<IntegrationsState>({
    health: Object.fromEntries(
      Object.entries(INTEGRATIONS_CONFIG).map(([name, config]) => [
        name,
        { ...DEFAULT_HEALTH, name: name as IntegrationName, ...config },
      ])
    ) as Record<IntegrationName, IntegrationHealth>,
    payments: {
      provider: "pagarme",
      isConfigured: false, // Pagar.me ainda não configurado
      canProcessPayments: false,
      walletBalance: 0,
      pendingCharges: 0,
      pricingTiers: EMISSION_PRICING,
    },
    lastHealthCheck: null,
    isCheckingHealth: false,
  });
  
  const reportedErrorsRef = useRef<Set<string>>(new Set());

  // =========================================================================
  // REPORT API ERROR - Reporta erros de API para Telegram
  // =========================================================================
  const reportApiError = useCallback(async (
    integration: IntegrationName,
    operation: string,
    errorMessage: string,
    options?: {
      errorCode?: string;
      context?: Record<string, unknown>;
      skipDuplicate?: boolean;
    }
  ): Promise<void> => {
    const errorKey = `${integration}:${operation}:${errorMessage}`;
    
    // Evitar spam de erros duplicados (throttle de 5 minutos)
    if (options?.skipDuplicate !== false && reportedErrorsRef.current.has(errorKey)) {
      console.log("[INTEGRATIONS] Skipping duplicate error report:", errorKey);
      return;
    }
    
    // Adicionar ao set e remover após 5 minutos
    reportedErrorsRef.current.add(errorKey);
    setTimeout(() => {
      reportedErrorsRef.current.delete(errorKey);
    }, 5 * 60 * 1000);
    
    // Get current user for context
    const { data: auth } = await supabase.auth.getUser();
    
    const report: ApiErrorReport = {
      integration,
      operation,
      errorCode: options?.errorCode,
      errorMessage,
      context: options?.context,
      userId: auth?.user?.id,
      timestamp: new Date().toISOString(),
    };
    
    console.error("[INTEGRATIONS] API Error:", report);
    
    // Enviar para Telegram
    await sendTelegramAlert(report);
    
    // Atualizar status da integração
    setState(prev => ({
      ...prev,
      health: {
        ...prev.health,
        [integration]: {
          ...prev.health[integration],
          status: "error",
          lastError: errorMessage,
          lastCheck: new Date().toISOString(),
          message: `Erro: ${errorMessage}`,
        },
      },
    }));
  }, []);

  // =========================================================================
  // CHECK INTEGRATION HEALTH - Verifica saúde de uma integração específica
  // =========================================================================
  const checkIntegrationHealth = useCallback(async (
    integration: IntegrationName
  ): Promise<IntegrationHealth> => {
    const startTime = Date.now();
    const config = INTEGRATIONS_CONFIG[integration];
    
    try {
      let status: IntegrationStatus = "unknown";
      let message = config.message || "";
      
      switch (integration) {
        case "focus_nfe": {
          // Usa o status do useFocusNfe
          status = mapFocusStatusToHealth(focusNfe.status);
          message = focusNfe.statusMessage;
          break;
        }
        
        case "pagarme": {
          // Pagar.me ainda não configurado - retorna degraded
          status = "degraded";
          message = "Integração em desenvolvimento";
          break;
        }
        
        case "telegram": {
          // Testa enviando ping silencioso
          try {
            const { error } = await supabase.functions.invoke("send-telegram-alert", {
              body: { type: "health_check", silent: true },
            });
            status = error ? "error" : "healthy";
            message = error ? `Erro: ${error.message}` : "Funcionando";
          } catch {
            status = "error";
            message = "Falha na conexão";
          }
          break;
        }
        
        case "sefaz": {
          // SEFAZ status é derivado do Focus NFe (se certificado está válido)
          if (focusNfe.certificate?.isValid && !focusNfe.certificate?.isExpired) {
            status = focusNfe.issuer?.sefazValidated ? "healthy" : "degraded";
            message = focusNfe.issuer?.sefazValidated 
              ? "Validado na SEFAZ"
              : "Aguardando validação";
          } else {
            status = "error";
            message = "Certificado inválido ou ausente";
          }
          break;
        }
        
        case "geocoding": {
          // Testa função de geocodificação
          try {
            const { error } = await supabase.functions.invoke("reverse-geocode", {
              body: { lat: -15.7801, lng: -47.9292 }, // Brasília
            });
            status = error ? "degraded" : "healthy";
            message = error ? "Serviço degradado" : "Funcionando";
          } catch {
            status = "degraded";
            message = "Serviço indisponível";
          }
          break;
        }
        
        case "push": {
          // Push sempre disponível se o browser suporta
          status = "serviceWorker" in navigator ? "healthy" : "degraded";
          message = "serviceWorker" in navigator 
            ? "Funcionando"
            : "Não suportado neste navegador";
          break;
        }
      }
      
      const health: IntegrationHealth = {
        name: integration,
        displayName: config.displayName || integration,
        status,
        lastCheck: new Date().toISOString(),
        lastError: status === "error" ? message : null,
        responseTimeMs: Date.now() - startTime,
        isRequired: config.isRequired ?? false,
        message,
      };
      
      return health;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      
      return {
        name: integration,
        displayName: config.displayName || integration,
        status: "error",
        lastCheck: new Date().toISOString(),
        lastError: errorMessage,
        responseTimeMs: Date.now() - startTime,
        isRequired: config.isRequired ?? false,
        message: `Erro: ${errorMessage}`,
      };
    }
  }, [focusNfe]);

  // =========================================================================
  // CHECK ALL HEALTH - Verifica saúde de todas as integrações
  // =========================================================================
  const checkAllHealth = useCallback(async (): Promise<void> => {
    setState(prev => ({ ...prev, isCheckingHealth: true }));
    
    try {
      const integrationNames = Object.keys(INTEGRATIONS_CONFIG) as IntegrationName[];
      
      const healthChecks = await Promise.all(
        integrationNames.map(name => checkIntegrationHealth(name))
      );
      
      const healthMap = Object.fromEntries(
        healthChecks.map(h => [h.name, h])
      ) as Record<IntegrationName, IntegrationHealth>;
      
      setState(prev => ({
        ...prev,
        health: healthMap,
        lastHealthCheck: new Date().toISOString(),
        isCheckingHealth: false,
      }));
      
      // Reportar integrações críticas com erro
      const criticalErrors = healthChecks.filter(
        h => h.isRequired && h.status === "error"
      );
      
      if (criticalErrors.length > 0) {
        for (const h of criticalErrors) {
          await reportApiError(
            h.name,
            "health_check",
            h.lastError || "Integração crítica indisponível",
            { skipDuplicate: true }
          );
        }
      }
      
    } catch (error) {
      console.error("[INTEGRATIONS] Health check failed:", error);
      setState(prev => ({ ...prev, isCheckingHealth: false }));
    }
  }, [checkIntegrationHealth, reportApiError]);

  // =========================================================================
  // GET EMISSION PRICE - Retorna preço para emitir um documento
  // =========================================================================
  const getEmissionPrice = useCallback((
    documentType: "nfe" | "cte" | "mdfe" | "nfse"
  ): number => {
    const tier = EMISSION_PRICING.find(t => t.documentType === documentType);
    return tier?.unitPrice ?? 0.35; // Default R$ 0,35
  }, []);

  // =========================================================================
  // CHARGE FOR EMISSION - Debita saldo para emissão (futuro Pagar.me)
  // =========================================================================
  const chargeForEmission = useCallback(async (
    documentType: "nfe" | "cte" | "mdfe" | "nfse",
    _documentRef?: string
  ): Promise<{ success: boolean; charged: number; errorMessage?: string }> => {
    // Feature flag: cobrança desativada temporariamente
    if (!isFeatureEnabled('enable_emission_billing')) {
      console.log(`[INTEGRATIONS] Cobrança desativada (feature flag). Emissão de ${documentType} liberada.`);
      return { success: true, charged: 0 };
    }

    // TODO: Integrar com Pagar.me quando configurado
    // Por enquanto, usa a fiscal_wallet existente
    
    const price = getEmissionPrice(documentType);
    
    console.log(`[INTEGRATIONS] Would charge R$ ${price} for ${documentType}`);
    
    // Verificar saldo na fiscal_wallet
    if (focusNfe.wallet && focusNfe.wallet.availableBalance >= 1) {
      return { success: true, charged: price };
    }
    
    return {
      success: false,
      charged: 0,
      errorMessage: "Saldo insuficiente. Adquira mais créditos.",
    };
  }, [getEmissionPrice, focusNfe.wallet]);

  // =========================================================================
  // COMPUTED VALUES
  // =========================================================================
  
  // Status geral do sistema
  const overallStatus = useMemo((): IntegrationStatus => {
    const healthValues = Object.values(state.health);
    const requiredIntegrations = healthValues.filter(h => h.isRequired);
    
    if (requiredIntegrations.some(h => h.status === "error")) {
      return "error";
    }
    if (requiredIntegrations.some(h => h.status === "degraded")) {
      return "degraded";
    }
    if (requiredIntegrations.every(h => h.status === "healthy")) {
      return "healthy";
    }
    return "unknown";
  }, [state.health]);
  
  // Pode emitir documentos?
  const canEmitDocuments = useMemo((): boolean => {
    return focusNfe.canEmit;
  }, [focusNfe.canEmit]);
  
  // Mensagem de status resumida
  const statusSummary = useMemo((): string => {
    const messages: Record<IntegrationStatus, string> = {
      healthy: "Todas as integrações funcionando",
      degraded: "Algumas integrações com lentidão",
      error: "Integrações críticas com erro",
      unknown: "Verificando integrações...",
    };
    return messages[overallStatus];
  }, [overallStatus]);

  // =========================================================================
  // EFFECTS
  // =========================================================================
  
  // Atualizar health do Focus NFe quando mudar
  useEffect(() => {
    const focusHealth: IntegrationHealth = {
      name: "focus_nfe",
      displayName: "Focus NFe",
      status: mapFocusStatusToHealth(focusNfe.status),
      lastCheck: new Date().toISOString(),
      lastError: focusNfe.errorMessage || null,
      responseTimeMs: null,
      isRequired: true,
      message: focusNfe.statusMessage,
    };
    
    setState(prev => ({
      ...prev,
      health: {
        ...prev.health,
        focus_nfe: focusHealth,
      },
    }));
  }, [focusNfe.status, focusNfe.statusMessage, focusNfe.errorMessage]);
  
  // Health check inicial e periódico
  useEffect(() => {
    // Check inicial após 2 segundos
    const initialTimer = setTimeout(() => {
      checkAllHealth();
    }, 2000);
    
    // Check periódico a cada 5 minutos
    const periodicTimer = setInterval(() => {
      checkAllHealth();
    }, 5 * 60 * 1000);
    
    return () => {
      clearTimeout(initialTimer);
      clearInterval(periodicTimer);
    };
  }, [checkAllHealth]);

  // =========================================================================
  // RETURN
  // =========================================================================
  return {
    // Sub-hooks
    focusNfe,
    
    // State
    health: state.health,
    payments: state.payments,
    isCheckingHealth: state.isCheckingHealth,
    lastHealthCheck: state.lastHealthCheck,
    
    // Computed
    overallStatus,
    statusSummary,
    canEmitDocuments,
    
    // Actions
    checkAllHealth,
    checkIntegrationHealth,
    reportApiError,
    getEmissionPrice,
    chargeForEmission,
    
    // Pricing info
    emissionPricing: EMISSION_PRICING,
  };
}

// =============================================================================
// DEPRECATION NOTICE
// =============================================================================
/**
 * @deprecated O Stripe será removido em breve.
 * Use o Pagar.me através do hook useIntegrations().payments
 * 
 * Arquivos a serem removidos na migração:
 * - src/components/StripePaymentProvider.tsx
 * - src/components/StripePaymentForm.tsx
 * - supabase/functions/create-checkout/
 * - supabase/functions/create-payment/
 * - supabase/functions/stripe-webhook/
 * - supabase/functions/check-subscription/
 * - supabase/functions/customer-portal/
 * - supabase/functions/create-stripe-connect-account/
 * 
 * Tabelas a serem migradas:
 * - subscribers (campo stripe_* para pagarme_*)
 * - service_payments (stripe_session_id, stripe_payment_intent_id)
 * - freight_payments (stripe_payment_intent_id)
 * - freight_advances (stripe_payment_intent_id)
 */
export const STRIPE_DEPRECATION_NOTICE = `
==========================================================
⚠️ AVISO: Integração Stripe será removida em breve
Use useIntegrations() para novo sistema de pagamentos
Modelo: Cobrança por emissão de documento fiscal
==========================================================
`;
