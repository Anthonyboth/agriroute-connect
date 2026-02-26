/**
 * src/hooks/useFreightCancellation.ts
 *
 * Hook centralizado para regras de cancelamento de frete.
 * Fonte única de verdade para decidir quem pode cancelar, quando, e como.
 *
 * Regras de negócio:
 * - Motorista: cancela direto em ACCEPTED/LOADING; solicita em LOADED/IN_TRANSIT/DELIVERED_PENDING_CONFIRMATION
 * - Produtor: cancela direto em qualquer status ativo (exceto COMPLETED/CANCELLED)
 * - Transportadora: não cancela (apenas monitora)
 */

import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sendNotification } from '@/utils/notify';

// Status onde motorista pode cancelar diretamente
const DRIVER_DIRECT_CANCEL_STATUSES = ['ACCEPTED'] as const;

// Status onde motorista só pode solicitar cancelamento (produtor aprova)
const DRIVER_REQUEST_CANCEL_STATUSES = ['LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'] as const;

// Status terminais — ninguém cancela
const TERMINAL_STATUSES = ['DELIVERED', 'COMPLETED', 'CANCELLED'] as const;

// CRITICAL: Produtor só pode cancelar diretamente ANTES do carregamento.
// Após LOADING, deve entrar em contato com o suporte.
const PRODUCER_ACTIVE_STATUSES = [
  'NEW', 'APPROVED', 'OPEN', 'IN_NEGOTIATION',
  'ACCEPTED',
] as const;

export type CancellationRole = 'MOTORISTA' | 'PRODUTOR' | 'TRANSPORTADORA' | 'ADMIN';

export type CancelAction = 'DIRECT' | 'REQUEST' | 'NONE';

export interface CancelButtonConfig {
  /** Label do botão */
  label: string;
  /** Se mostra o botão */
  visible: boolean;
  /** Tipo de ação */
  action: CancelAction;
  /** Variante visual */
  variant: 'destructive' | 'outline';
  /** Se é cancelamento que requer aprovação */
  requiresApproval: boolean;
}

/**
 * Verifica se o ator pode cancelar diretamente (sem aprovação).
 */
export function canCancelDirectly(status: string, role: CancellationRole): boolean {
  const s = status?.toUpperCase().trim() || '';

  // Terminal statuses - nobody cancels
  if (TERMINAL_STATUSES.includes(s as any)) return false;

  if (role === 'PRODUTOR' || role === 'ADMIN') {
    return PRODUCER_ACTIVE_STATUSES.includes(s as any);
  }

  if (role === 'MOTORISTA') {
    return DRIVER_DIRECT_CANCEL_STATUSES.includes(s as any);
  }

  return false;
}

/**
 * Verifica se o frete está em status que exige contato com suporte para cancelar.
 */
export function requiresSupportForCancellation(status: string, role: CancellationRole): boolean {
  const s = status?.toUpperCase().trim() || '';
  const SUPPORT_REQUIRED_STATUSES = ['LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'];
  
  if (role === 'PRODUTOR' || role === 'ADMIN') {
    return SUPPORT_REQUIRED_STATUSES.includes(s);
  }
  return false;
}

/**
 * Verifica se o ator pode solicitar cancelamento (requer aprovação do produtor).
 */
export function canRequestCancellation(status: string, role: CancellationRole): boolean {
  const s = status?.toUpperCase().trim() || '';

  if (role === 'MOTORISTA') {
    return DRIVER_REQUEST_CANCEL_STATUSES.includes(s as any);
  }

  // Produtor e admin cancelam direto, nunca precisam solicitar
  return false;
}

/**
 * Retorna a configuração do botão de cancelamento para o contexto.
 */
export function getCancelButtonConfig(status: string, role: CancellationRole): CancelButtonConfig {
  if (canCancelDirectly(status, role)) {
    return {
      label: 'Cancelar',
      visible: true,
      action: 'DIRECT',
      variant: 'destructive',
      requiresApproval: false,
    };
  }

  if (canRequestCancellation(status, role)) {
    return {
      label: 'Cancelamento',
      visible: true,
      action: 'REQUEST',
      variant: 'outline',
      requiresApproval: true,
    };
  }

  // For producer/admin in LOADING+ status: show contact support info
  if (requiresSupportForCancellation(status, role)) {
    return {
      label: 'Contatar Suporte',
      visible: true,
      action: 'NONE',
      variant: 'outline',
      requiresApproval: false,
    };
  }

  return {
    label: '',
    visible: false,
    action: 'NONE',
    variant: 'outline',
    requiresApproval: false,
  };
}

/**
 * Hook com ações de cancelamento (direto e solicitação).
 */
export function useFreightCancellation() {
  /**
   * Cancela o frete diretamente via edge function cancel-freight-safe.
   */
  const handleDirectCancel = useCallback(async (
    freightId: string,
    reason?: string,
    onSuccess?: () => void,
  ) => {
    try {
      const { data, error } = await supabase.functions.invoke('cancel-freight-safe', {
        body: { freight_id: freightId, reason: reason || 'Cancelado pelo usuário' },
      });

      if (error) {
        console.error('[useFreightCancellation] Erro ao cancelar:', error);
        toast.error('Erro ao cancelar o frete. Tente novamente.');
        return false;
      }

      // Check for 409 response (status not allowed)
      if (data && data.success === false) {
        toast.error(data.error || 'Não é possível cancelar este frete.');
        return false;
      }

      toast.success('Frete cancelado com sucesso.');
      onSuccess?.();
      return true;
    } catch (err) {
      console.error('[useFreightCancellation] Exceção:', err);
      toast.error('Erro inesperado ao cancelar o frete.');
      return false;
    }
  }, []);

  /**
   * Solicita cancelamento — notifica o produtor para aprovar.
   */
  const handleRequestCancel = useCallback(async (
    freightId: string,
    producerUserId?: string,
    onSuccess?: () => void,
  ) => {
    try {
      // Notificar o produtor se temos o ID
      if (producerUserId) {
        await sendNotification({
          user_id: producerUserId,
          title: 'Solicitação de Cancelamento',
          message: 'O motorista solicitou o cancelamento de um frete. Acesse o painel para aprovar ou recusar.',
          type: 'cancel_request',
          data: { freight_id: freightId },
        });
      }

      toast.info('Solicitação de cancelamento enviada ao produtor.');
      onSuccess?.();
      return true;
    } catch (err) {
      console.error('[useFreightCancellation] Erro ao solicitar cancelamento:', err);
      toast.error('Erro ao enviar solicitação de cancelamento.');
      return false;
    }
  }, []);

  return {
    canCancelDirectly,
    canRequestCancellation,
    requiresSupportForCancellation,
    getCancelButtonConfig,
    handleDirectCancel,
    handleRequestCancel,
  };
}
