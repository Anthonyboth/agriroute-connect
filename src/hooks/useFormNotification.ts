/**
 * Hook dedicado para notificações de erros de formulário e validação.
 * 
 * CARACTERÍSTICAS:
 * - Sempre exibe acima de todos os modais e dialogs (z-index máximo)
 * - Mensagens claras e acionáveis
 * - Previne flooding (apenas 1 notificação por vez)
 * - Funciona para usuários logados e não logados
 */

import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

export interface FormNotificationOptions {
  /** Campo que está com problema */
  field?: string;
  /** O que está faltando ou errado */
  problem: string;
  /** Como resolver o problema */
  solution: string;
  /** Tipo de notificação */
  type?: 'error' | 'warning' | 'info';
  /** Duração em ms (padrão: 6000) */
  duration?: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

// Singleton para controlar o estado global de notificações
let lastNotificationTime = 0;
let lastNotificationKey = '';
const MIN_INTERVAL_MS = 2000; // Mínimo 2s entre notificações iguais

export function useFormNotification() {
  const isShowingRef = useRef(false);

  /**
   * Exibe uma notificação de erro de formulário.
   * Previne duplicatas e flooding automaticamente.
   */
  const showFormError = useCallback((options: FormNotificationOptions) => {
    const { field, problem, solution, type = 'error', duration = 6000 } = options;
    
    // Cria chave única para evitar duplicatas
    const notificationKey = `${field || 'form'}-${problem}`;
    const now = Date.now();
    
    // Previne notificações duplicadas em sequência rápida
    if (notificationKey === lastNotificationKey && now - lastNotificationTime < MIN_INTERVAL_MS) {
      console.log('[FormNotification] Duplicata ignorada:', notificationKey);
      return;
    }
    
    // Previne múltiplas notificações simultâneas
    if (isShowingRef.current) {
      console.log('[FormNotification] Notificação já visível, ignorando nova');
      return;
    }
    
    lastNotificationTime = now;
    lastNotificationKey = notificationKey;
    isShowingRef.current = true;

    // Monta mensagem clara e concisa
    const fieldLabel = field ? `**${field}:** ` : '';
    const message = `${fieldLabel}${problem}`;
    const description = `✅ ${solution}`;

    // Dismiss any existing toasts first
    toast.dismiss();

    // Exibe notificação com configuração para máximo z-index
    const toastFn = type === 'error' ? toast.error : type === 'warning' ? toast.warning : toast.info;
    
    toastFn(message, {
      description,
      duration,
      position: 'top-center',
      // Força estilo para garantir visibilidade máxima
      style: {
        zIndex: 2147483647, // Máximo z-index seguro (32-bit signed int max)
        position: 'relative',
      },
      onDismiss: () => {
        isShowingRef.current = false;
      },
      onAutoClose: () => {
        isShowingRef.current = false;
      },
    });

    // Safety reset após duração
    setTimeout(() => {
      isShowingRef.current = false;
    }, duration + 500);
  }, []);

  /**
   * Exibe erro de campo obrigatório não preenchido
   */
  const showMissingField = useCallback((fieldName: string, fieldLabel: string) => {
    showFormError({
      field: fieldLabel,
      problem: 'Campo obrigatório não preenchido.',
      solution: `Preencha o campo "${fieldLabel}" para continuar.`,
      type: 'error',
    });
  }, [showFormError]);

  /**
   * Exibe erro de formato inválido
   */
  const showInvalidFormat = useCallback((fieldLabel: string, expectedFormat: string) => {
    showFormError({
      field: fieldLabel,
      problem: 'Formato inválido.',
      solution: expectedFormat,
      type: 'error',
    });
  }, [showFormError]);

  /**
   * Exibe erros de validação de formulário (múltiplos campos)
   * Agrupa em uma única notificação clara
   */
  const showValidationErrors = useCallback((errors: ValidationError[]) => {
    if (!errors || errors.length === 0) return;

    // Se apenas 1 erro, mostra diretamente
    if (errors.length === 1) {
      showFormError({
        field: errors[0].field,
        problem: errors[0].message,
        solution: `Corrija o campo "${errors[0].field}" para continuar.`,
        type: 'error',
      });
      return;
    }

    // Múltiplos erros: agrupa em mensagem única
    const fieldsList = errors.slice(0, 3).map(e => e.field).join(', ');
    const hasMore = errors.length > 3;
    
    showFormError({
      problem: `${errors.length} campos precisam de atenção.`,
      solution: `Verifique: ${fieldsList}${hasMore ? ` e mais ${errors.length - 3}` : ''}.`,
      type: 'error',
      duration: 8000,
    });
  }, [showFormError]);

  /**
   * Exibe erro de ação não permitida
   */
  const showActionError = useCallback((action: string, reason: string, solution: string) => {
    showFormError({
      problem: `Não foi possível ${action}.`,
      solution,
      type: 'error',
    });
  }, [showFormError]);

  /**
   * Exibe aviso (não bloqueante)
   */
  const showWarning = useCallback((message: string, solution: string) => {
    showFormError({
      problem: message,
      solution,
      type: 'warning',
    });
  }, [showFormError]);

  /**
   * Exibe sucesso
   */
  const showSuccess = useCallback((message: string) => {
    // Previne flooding
    const now = Date.now();
    if (now - lastNotificationTime < MIN_INTERVAL_MS) {
      return;
    }
    
    lastNotificationTime = now;
    toast.dismiss();
    
    toast.success(message, {
      duration: 4000,
      position: 'top-center',
      style: {
        zIndex: 2147483647,
      },
    });
  }, []);

  return {
    showFormError,
    showMissingField,
    showInvalidFormat,
    showValidationErrors,
    showActionError,
    showWarning,
    showSuccess,
  };
}

/**
 * Função utilitária para uso fora de componentes React
 * (ex: em serviços, utils, etc.)
 */
export const formNotification = {
  error: (problem: string, solution: string) => {
    toast.dismiss();
    toast.error(problem, {
      description: `✅ ${solution}`,
      duration: 6000,
      position: 'top-center',
      style: { zIndex: 2147483647 },
    });
  },
  
  warning: (problem: string, solution: string) => {
    toast.dismiss();
    toast.warning(problem, {
      description: `✅ ${solution}`,
      duration: 6000,
      position: 'top-center',
      style: { zIndex: 2147483647 },
    });
  },
  
  success: (message: string) => {
    toast.dismiss();
    toast.success(message, {
      duration: 4000,
      position: 'top-center',
      style: { zIndex: 2147483647 },
    });
  },
};
