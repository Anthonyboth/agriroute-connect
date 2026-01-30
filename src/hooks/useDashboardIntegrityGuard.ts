/**
 * useDashboardIntegrityGuard.ts
 *
 * Hook de "fixação" que detecta regressões de componentes nos painéis.
 * Quando uma regressão é detectada:
 *   1) Loga no console com [CRITICAL]
 *   2) Envia alerta para Telegram via edge function
 *   3) Retorna indicação para forçar uso do componente correto
 *
 * Escopo: Painel Motorista, Painel Produtor, Transportadora, Modais/queries
 */

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

type GuardArea = 'driver_ongoing' | 'producer_ongoing' | 'company_freights' | 'freight_details_modal';

interface IntegrityViolation {
  area: GuardArea;
  expectedComponent: string;
  actualComponent: string;
  route: string;
  timestamp: string;
}

// Configuração dos componentes esperados por área
const EXPECTED_COMPONENTS: Record<GuardArea, string[]> = {
  driver_ongoing: ['DriverOngoingTab', 'FreightInProgressCard'],
  producer_ongoing: ['ProducerOngoingTab', 'FreightInProgressCard'],
  company_freights: ['MyAssignmentCard', 'CompanyFreightsManager'],
  freight_details_modal: ['FreightDetails', 'FreightParticipantCard'],
};

// Componentes PROIBIDOS por área (regressões conhecidas)
const FORBIDDEN_COMPONENTS: Record<GuardArea, string[]> = {
  driver_ongoing: ['MyAssignmentCard'], // MyAssignmentCard só é permitido para Transportadora
  producer_ongoing: ['MyAssignmentCard'],
  company_freights: [],
  freight_details_modal: [],
};

let lastReportedViolation: string | null = null;

/**
 * Envia alerta de violação de integridade para Telegram
 */
async function reportViolationToTelegram(violation: IntegrityViolation): Promise<void> {
  const violationKey = `${violation.area}:${violation.actualComponent}`;
  
  // Throttle: não reportar a mesma violação em menos de 5 minutos
  if (lastReportedViolation === violationKey) {
    return;
  }
  lastReportedViolation = violationKey;

  try {
    await supabase.functions.invoke('send-telegram-alert', {
      body: {
        type: 'INTEGRITY_VIOLATION',
        message: `🚨 REGRESSÃO DETECTADA\n\nÁrea: ${violation.area}\nEsperado: ${violation.expectedComponent}\nAtual: ${violation.actualComponent}\nRota: ${violation.route}\nTimestamp: ${violation.timestamp}`,
        priority: 'high',
      },
    });

    // Também reportar via report-error para histórico
    await supabase.functions.invoke('report-error', {
      body: {
        errorType: 'RUNTIME_ERROR',
        errorCategory: 'CRITICAL',
        errorMessage: `Dashboard integrity violation: ${violation.area} using ${violation.actualComponent} instead of ${violation.expectedComponent}`,
        module: 'useDashboardIntegrityGuard',
        route: violation.route,
        metadata: violation,
      },
    });
  } catch (err) {
    console.error('[IntegrityGuard] Falha ao reportar violação:', err);
  }

  // Reset throttle após 5 minutos
  setTimeout(() => {
    if (lastReportedViolation === violationKey) {
      lastReportedViolation = null;
    }
  }, 5 * 60 * 1000);
}

/**
 * Hook para validar integridade de componentes em tempo de execução
 */
export function useDashboardIntegrityGuard(area: GuardArea, currentComponentName: string) {
  const hasReported = useRef(false);

  const checkIntegrity = useCallback(() => {
    const forbidden = FORBIDDEN_COMPONENTS[area] || [];
    const expected = EXPECTED_COMPONENTS[area] || [];

    // Verificar se está usando componente proibido
    if (forbidden.includes(currentComponentName)) {
      const violation: IntegrityViolation = {
        area,
        expectedComponent: expected.join(' ou '),
        actualComponent: currentComponentName,
        route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        timestamp: new Date().toISOString(),
      };

      console.error('[CRITICAL] DASHBOARD_INTEGRITY_VIOLATION', violation);

      if (!hasReported.current) {
        hasReported.current = true;
        reportViolationToTelegram(violation);
      }

      return {
        isValid: false,
        violation,
        shouldForceCorrect: true,
      };
    }

    return {
      isValid: true,
      violation: null,
      shouldForceCorrect: false,
    };
  }, [area, currentComponentName]);

  useEffect(() => {
    checkIntegrity();
  }, [checkIntegrity]);

  return checkIntegrity();
}

/**
 * Validação estática para uso em renderização condicional
 * Retorna true se o componente é permitido para a área
 */
export function isComponentAllowedForArea(area: GuardArea, componentName: string): boolean {
  const forbidden = FORBIDDEN_COMPONENTS[area] || [];
  return !forbidden.includes(componentName);
}

/**
 * Guard para queries/JOINs - detecta uso de tabelas inseguras
 */
export function validateSecureQuery(
  tableName: string,
  operation: 'select' | 'join',
  context: string
): boolean {
  const INSECURE_DIRECT_ACCESS = ['profiles']; // profiles deve usar profiles_secure
  const SECURE_ALTERNATIVES: Record<string, string> = {
    profiles: 'profiles_secure',
  };

  if (INSECURE_DIRECT_ACCESS.includes(tableName)) {
    const alternative = SECURE_ALTERNATIVES[tableName];
    
    console.warn(
      `[QUERY_GUARD] Acesso direto a "${tableName}" detectado em ${context}. ` +
      `Use "${alternative}" para evitar vazamento de PII.`
    );

    // Reportar para monitoramento (sem bloquear)
    supabase.functions.invoke('report-error', {
      body: {
        errorType: 'RUNTIME_ERROR',
        errorCategory: 'SIMPLE',
        errorMessage: `Direct access to ${tableName} table detected`,
        module: 'validateSecureQuery',
        functionName: context,
        metadata: {
          tableName,
          operation,
          alternative,
          route: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
        },
      },
    }).catch(() => {});

    return false;
  }

  return true;
}
