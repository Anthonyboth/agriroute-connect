/**
 * src/components/security/FreightActionButton.tsx
 *
 * Componente OBRIGATÓRIO para qualquer ação crítica de frete.
 * Internamente aplica:
 *   - getUserAllowedActions() para habilitar/desabilitar
 *   - assertValidTransition() antes de executar onRun
 *   - getActionLabelPtBR() para texto do botão
 *   - Fail-safe: mesmo se habilitado, bloqueia no handler se guard falhar
 *
 * PROIBIDO usar <Button> direto para ações de frete — use este componente.
 */

import React, { useCallback, useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  getUserAllowedActions,
  assertValidTransition,
  canTransition,
  FreightWorkflowError,
  type FreightWorkflowStatus,
  type UserRole,
} from '@/security/freightWorkflowGuard';
import { getActionLabelPtBR } from '@/security/i18nGuard';

// =============================================================================
// TIPOS
// =============================================================================

type FreightActionType =
  | 'ADVANCE'       // Avançar status
  | 'CANCEL'        // Cancelar frete
  | 'ACCEPT'        // Aceitar proposta
  | 'REJECT'        // Rejeitar proposta
  | 'CONFIRM_DELIVERY' // Confirmar entrega (produtor)
  | 'REPORT_DELIVERY'  // Reportar entrega (motorista)
  | 'CONFIRM_PAYMENT'  // Confirmar pagamento
  | 'MARK_PAID'     // Marcar como pago
  | 'COUNTER'       // Contraproposta
  | 'RATE';          // Avaliar

interface FreightActionButtonProps extends Omit<ButtonProps, 'onClick'> {
  /** Tipo da ação a ser executada */
  action: FreightActionType;
  /** Dados mínimos do frete */
  freight: {
    id: string;
    status: string;
    required_trucks?: number;
  };
  /** Dados opcionais de atribuição */
  assignment?: {
    id: string;
    status?: string;
  };
  /** Papel do usuário atual */
  userRole: string;
  /** Handler executado APÓS validação dos guards */
  onRun: () => Promise<void> | void;
  /** Label customizado (fallback: getActionLabelPtBR) */
  label?: string;
  /** Ícone à esquerda */
  icon?: React.ReactNode;
  /** Se deve validar transição de workflow (default: true para ADVANCE/CANCEL) */
  validateTransition?: boolean;
  /** Texto de loading customizado */
  loadingText?: string;
}

// Ações que requerem validação de transição de workflow
const TRANSITION_ACTIONS: FreightActionType[] = [
  'ADVANCE',
  'CANCEL',
  'CONFIRM_DELIVERY',
  'REPORT_DELIVERY',
];

// Mapa de ações para o próximo status esperado
const ACTION_TO_STATUS: Partial<Record<FreightActionType, string>> = {
  CANCEL: 'CANCELLED',
  REPORT_DELIVERY: 'DELIVERED_PENDING_CONFIRMATION',
  CONFIRM_DELIVERY: 'DELIVERED',
};

// =============================================================================
// COMPONENTE
// =============================================================================

export const FreightActionButton: React.FC<FreightActionButtonProps> = ({
  action,
  freight,
  assignment,
  userRole,
  onRun,
  label,
  icon,
  validateTransition,
  loadingText,
  disabled,
  ...buttonProps
}) => {
  const [isLoading, setIsLoading] = useState(false);

  // Determinar se deve validar transição
  const shouldValidateTransition = validateTransition ?? TRANSITION_ACTIONS.includes(action);

  // Verificar se a ação é permitida via guards
  const allowedActions = getUserAllowedActions(userRole, freight.status);

  // Verificar habilitação baseada no tipo de ação
  const isActionAllowed = (() => {
    switch (action) {
      case 'ADVANCE':
        return allowedActions.canAdvance;
      case 'CANCEL':
        return allowedActions.canCancel;
      case 'REPORT_DELIVERY': {
        const check = canTransition(freight.status, 'DELIVERED_PENDING_CONFIRMATION');
        return check.valid;
      }
      case 'CONFIRM_DELIVERY': {
        const check = canTransition(freight.status, 'DELIVERED');
        return check.valid;
      }
      // Ações de proposta não dependem do workflow guard
      case 'ACCEPT':
      case 'REJECT':
      case 'COUNTER':
      case 'CONFIRM_PAYMENT':
      case 'MARK_PAID':
      case 'RATE':
        return true;
      default:
        return true;
    }
  })();

  // Motivo do bloqueio (para tooltip)
  const blockReason = (() => {
    if (isActionAllowed) return null;
    
    switch (action) {
      case 'ADVANCE':
        if (!allowedActions.canAdvance && allowedActions.nextStatus === null) {
          return 'O frete já está em status final e não pode ser avançado.';
        }
        return `Você (${userRole}) não tem permissão para avançar o frete neste status.`;
      case 'CANCEL':
        return 'Não é possível cancelar o frete neste status.';
      case 'REPORT_DELIVERY':
      case 'CONFIRM_DELIVERY': {
        const targetStatus = ACTION_TO_STATUS[action] || '';
        const check = canTransition(freight.status, targetStatus);
        return check.error || 'Ação não permitida neste status.';
      }
      default:
        return 'Ação não permitida.';
    }
  })();

  // Label do botão
  const buttonLabel = label || getActionLabelPtBR(action);

  // Handler com fail-safe
  const handleClick = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Fail-safe: re-validar mesmo se botão estava habilitado
    if (!isActionAllowed) {
      toast.error(blockReason || 'Ação não permitida.');
      return;
    }

    // Validar transição de workflow se necessário
    if (shouldValidateTransition) {
      const targetStatus = ACTION_TO_STATUS[action] || allowedActions.nextStatus;
      if (targetStatus) {
        try {
          assertValidTransition(freight.status, targetStatus);
        } catch (error) {
          if (error instanceof FreightWorkflowError) {
            toast.error(error.message);
          } else {
            toast.error('Transição de status não permitida.');
          }
          return;
        }
      }
    }

    setIsLoading(true);
    try {
      await onRun();
    } catch (error: any) {
      console.error(`[FreightActionButton] Erro na ação ${action}:`, error);
      if (error instanceof FreightWorkflowError) {
        toast.error(error.message);
      } else {
        toast.error(error?.message || 'Erro ao executar ação. Tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [action, freight.status, isActionAllowed, blockReason, shouldValidateTransition, allowedActions.nextStatus, onRun]);

  const isDisabled = disabled || isLoading || !isActionAllowed;

  const buttonContent = (
    <Button
      type="button"
      {...buttonProps}
      disabled={isDisabled}
      onClick={handleClick}
      data-action={action}
      data-freight-id={freight.id}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          {loadingText || 'Processando...'}
        </>
      ) : (
        <>
          {icon && <span className="mr-2">{icon}</span>}
          {buttonLabel}
        </>
      )}
    </Button>
  );

  // Se bloqueado, mostrar tooltip com motivo
  if (!isActionAllowed && blockReason) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-block">{buttonContent}</span>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-sm">{blockReason}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return buttonContent;
};
