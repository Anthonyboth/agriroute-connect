/**
 * ServiceWorkflowActions.tsx
 * 
 * Botões sequenciais de ação do prestador baseados no status atual.
 * Usa a RPC transition_service_request_status para garantir atomicidade.
 * Nenhum update direto de status no frontend.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Navigation, Play, CheckCircle, X, MessageSquare, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  canTransitionSR,
  getNextAllowedStatusSR,
  SERVICE_REQUEST_STATUS_LABELS,
  type ServiceRequestStatus,
} from '@/security/serviceRequestWorkflowGuard';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ServiceWorkflowActionsProps {
  requestId: string;
  currentStatus: string;
  clientId: string | null;
  estimatedPrice?: number;
  /** Callback com requestId e novo status para update otimista */
  onStatusChange: (requestId: string, newStatus: string) => void;
  onOpenChat: () => void;
  onCancel: () => void;
}

/** Mapeia status alvo → config do botão */
const WORKFLOW_BUTTON_CONFIG: Record<string, {
  label: string;
  icon: React.ReactNode;
  className: string;
  description: string;
}> = {
  ON_THE_WAY: {
    label: 'A Caminho',
    icon: <Navigation className="h-4 w-4 mr-2" />,
    className: 'bg-blue-600 hover:bg-blue-700 text-white',
    description: 'Indica que você está indo ao local do serviço.',
  },
  IN_PROGRESS: {
    label: 'Iniciar Serviço',
    icon: <Play className="h-4 w-4 mr-2" />,
    className: 'bg-orange-600 hover:bg-orange-700 text-white',
    description: 'Confirma que você chegou e iniciou o trabalho.',
  },
  COMPLETED: {
    label: 'Concluir Serviço',
    icon: <CheckCircle className="h-4 w-4 mr-2" />,
    className: 'bg-green-600 hover:bg-green-700 text-white',
    description: 'Marca o serviço como finalizado.',
  },
};

export const ServiceWorkflowActions: React.FC<ServiceWorkflowActionsProps> = ({
  requestId,
  currentStatus,
  clientId,
  estimatedPrice,
  onStatusChange,
  onOpenChat,
  onCancel,
}) => {
  const { toast } = useToast();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const normalizedStatus = currentStatus.toUpperCase().trim() as ServiceRequestStatus;
  const nextStatus = getNextAllowedStatusSR(normalizedStatus);
  const canAdvance = nextStatus ? canTransitionSR(normalizedStatus, nextStatus) : null;

  // Determinar cancelamento permitido
  const canCancel = normalizedStatus === 'ACCEPTED' || normalizedStatus === 'ON_THE_WAY';

  const handleTransition = async (targetStatus: string) => {
    if (isTransitioning) return;

    // Para COMPLETED, abrir dialog de confirmação
    if (targetStatus === 'COMPLETED') {
      setShowCompleteDialog(true);
      return;
    }

    await executeTransition(targetStatus);
  };

  const executeTransition = async (targetStatus: string, finalPrice?: number) => {
    setIsTransitioning(true);
    try {
      const { data, error } = await supabase.rpc('transition_service_request_status', {
        p_request_id: requestId,
        p_next_status: targetStatus,
        p_final_price: finalPrice ?? null,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        toast({
          title: 'Ação não permitida',
          description: result?.error || 'Não foi possível alterar o status.',
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'Sucesso',
        description: result.message,
      });

      // ✅ PERF: Passa requestId + newStatus para update otimista imediato
      onStatusChange(requestId, targetStatus);
    } catch (err: any) {
      console.error('Erro na transição:', err);
      toast({
        title: 'Erro',
        description: err?.message || 'Não foi possível alterar o status.',
        variant: 'destructive',
      });
    } finally {
      setIsTransitioning(false);
      setShowCompleteDialog(false);
    }
  };

  // Status badge PT-BR
  const statusLabel = SERVICE_REQUEST_STATUS_LABELS[normalizedStatus] || normalizedStatus;

  // Mensagem de bloqueio quando não pode avançar
  const getBlockReason = (): string | null => {
    if (!nextStatus) return null;
    if (canAdvance?.valid) return null;
    return canAdvance?.error || null;
  };

  const blockReason = getBlockReason();
  const buttonConfig = nextStatus ? WORKFLOW_BUTTON_CONFIG[nextStatus] : null;

  return (
    <div className="space-y-3">
      {/* Status atual */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Status:</span>
        <Badge variant="outline" className="text-xs">
          {statusLabel}
        </Badge>
      </div>

      {/* Botão de ação principal (workflow) */}
      {buttonConfig && canAdvance?.valid && (
        <Button
          size="sm"
          className={`w-full ${buttonConfig.className}`}
          onClick={() => handleTransition(nextStatus!)}
          disabled={isTransitioning}
        >
          {isTransitioning ? (
            <>
               <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              Atualizando...
            </>
          ) : (
            <>
              {buttonConfig.icon}
              {buttonConfig.label}
            </>
          )}
        </Button>
      )}

      {/* Mensagem de bloqueio */}
      {blockReason && (
        <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">{blockReason}</p>
        </div>
      )}

      {/* Ações secundárias */}
      <div className="flex gap-2">
        {/* Chat */}
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          onClick={onOpenChat}
          disabled={!clientId}
        >
          {clientId ? (
            <>
              <MessageSquare className="h-4 w-4 mr-2" />
              Abrir Chat
            </>
          ) : (
            <>
              <Phone className="h-4 w-4 mr-2" />
              Chat Indisponível
            </>
          )}
        </Button>

        {/* Cancelar */}
        {canCancel && (
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={onCancel}
            disabled={isTransitioning}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
        )}
      </div>

      {/* Aviso para guest sem chat */}
      {!clientId && (
        <p className="text-xs text-muted-foreground italic">
          Chat indisponível para solicitante sem cadastro. Use telefone ou WhatsApp para contato.
        </p>
      )}

      {/* Dialog de confirmação para conclusão */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Concluir Serviço?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Confirma a conclusão deste serviço?</p>
              {estimatedPrice && (
                <p className="font-medium text-foreground">
                  Valor: R$ {estimatedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Após concluir, o pagamento será registrado automaticamente e o cliente poderá avaliar o serviço.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTransitioning}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => executeTransition('COMPLETED', estimatedPrice)}
              disabled={isTransitioning}
              className="bg-green-600 hover:bg-green-700"
            >
              {isTransitioning ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Concluindo...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar Conclusão
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
