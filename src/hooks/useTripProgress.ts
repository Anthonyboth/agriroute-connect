import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Interface para resposta da RPC update_trip_progress
 */
interface TripProgressResponse {
  success: boolean;
  message?: string;
  error?: string;
  progress_id?: string;
  previous_status?: string;
  new_status?: string;
  timestamp?: string;
  idempotent?: boolean;
  detail?: string;
}

/**
 * Interface para o progresso da viagem
 */
interface TripProgress {
  id: string;
  freight_id: string;
  driver_id: string;
  assignment_id: string | null;
  current_status: string;
  accepted_at: string | null;
  loading_at: string | null;
  loaded_at: string | null;
  in_transit_at: string | null;
  delivered_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  driver_notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Mapeamento de status para labels amigáveis
 */
const STATUS_LABELS: Record<string, string> = {
  'ACCEPTED': 'Aceito',
  'LOADING': 'A caminho da coleta',
  'LOADED': 'Carregado',
  'IN_TRANSIT': 'Em trânsito',
  'DELIVERED_PENDING_CONFIRMATION': 'Entrega reportada',
  'DELIVERED': 'Entregue',
  'COMPLETED': 'Concluído',
};

/**
 * Ordem sequencial dos status - NÃO pode voltar atrás
 */
const STATUS_ORDER = [
  'NEW',
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'COMPLETED'
];

/**
 * Verifica se a transição de status é válida (não permite regressão)
 */
function isValidStatusTransition(currentStatus: string, newStatus: string): { valid: boolean; error?: string } {
  const current = currentStatus.toUpperCase().trim();
  const next = newStatus.toUpperCase().trim();
  
  const currentIndex = STATUS_ORDER.indexOf(current);
  const nextIndex = STATUS_ORDER.indexOf(next);
  
  // Status não reconhecido
  if (currentIndex === -1) {
    // Se o status atual não está na lista, assume que pode ir para qualquer status válido
    return { valid: true };
  }
  
  if (nextIndex === -1) {
    return { valid: false, error: `Status de destino não reconhecido: ${newStatus}` };
  }
  
  // Mesmo status = idempotente, ok
  if (currentIndex === nextIndex) {
    return { valid: true };
  }
  
  // Bloquear regressão
  if (nextIndex < currentIndex) {
    return { 
      valid: false, 
      error: `Não é permitido voltar de "${STATUS_LABELS[current] || current}" para "${STATUS_LABELS[next] || next}". O status só pode avançar.`
    };
  }
  
  // Bloquear salto de mais de 1 passo
  if (nextIndex > currentIndex + 1) {
    const expectedNext = STATUS_ORDER[currentIndex + 1];
    return { 
      valid: false, 
      error: `Não é permitido pular etapas. De "${STATUS_LABELS[current] || current}" você deve ir para "${STATUS_LABELS[expectedNext] || expectedNext}".`
    };
  }
  
  return { valid: true };
}

/**
 * Hook dedicado para gerenciar o progresso da viagem do motorista
 * Usa a nova RPC update_trip_progress que é à prova de falhas
 */
export const useTripProgress = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Lock para evitar chamadas duplicadas
  const lockRef = useRef<Set<string>>(new Set());

  /**
   * Atualiza o progresso da viagem
   * Esta é a função principal - NUNCA falha para o motorista
   * VALIDAÇÃO: Impede regressão de status (voltar para etapa anterior)
   */
  const updateProgress = useCallback(async (
    freightId: string,
    newStatus: string,
    options?: {
      lat?: number;
      lng?: number;
      notes?: string;
      showToast?: boolean;
      currentStatus?: string; // Opcional: se fornecido, valida antes de chamar o servidor
    }
  ): Promise<{ success: boolean; message: string }> => {
    const lockKey = `${freightId}-${newStatus}`;
    const showToast = options?.showToast !== false;
    
    // Evita chamadas duplicadas
    if (lockRef.current.has(lockKey)) {
      if (import.meta.env.DEV) console.log('[useTripProgress] Chamada duplicada bloqueada:', lockKey);
      return { success: true, message: 'Operação já em andamento' };
    }
    
    // =====================================================
    // VALIDAÇÃO DE NÃO-REGRESSÃO NO FRONTEND (UX rápido)
    // =====================================================
    if (options?.currentStatus) {
      const validation = isValidStatusTransition(options.currentStatus, newStatus);
      if (!validation.valid) {
        console.warn('[useTripProgress] Transição bloqueada no frontend:', validation.error);
        setLastError(validation.error || 'Transição de status inválida');
        
        if (showToast) {
          toast.error('Atualização bloqueada', {
            description: validation.error
          });
        }
        
        return { success: false, message: validation.error || 'Transição inválida' };
      }
    }
    // =====================================================
    
    lockRef.current.add(lockKey);
    setIsUpdating(true);
    setLastError(null);

    try {
      if (import.meta.env.DEV) console.log('[useTripProgress] Atualizando progresso:', { freightId, newStatus });
      
      // Chamar a RPC dedicada (que também valida no servidor)
      const { data, error } = await supabase.rpc('update_trip_progress', {
        p_freight_id: freightId,
        p_new_status: newStatus.toUpperCase().trim(),
        p_lat: options?.lat ?? null,
        p_lng: options?.lng ?? null,
        p_notes: options?.notes ?? null
      });

      if (error) {
        console.error('[useTripProgress] Erro RPC:', error);
        setLastError(error.message);
        
        if (showToast) {
          toast.error('Erro ao atualizar progresso', {
            description: error.message
          });
        }
        
        return { success: false, message: error.message };
      }

      const response = data as unknown as TripProgressResponse;
      
      if (!response.success) {
        console.error('[useTripProgress] Falha na atualização:', response);
        setLastError(response.message || response.error || 'Erro desconhecido');
        
        if (showToast) {
          toast.error('Falha ao atualizar progresso', {
            description: response.message || response.error
          });
        }
        
        return { success: false, message: response.message || response.error || 'Erro' };
      }

      if (import.meta.env.DEV) console.log('[useTripProgress] Progresso atualizado com sucesso:', response);
      
      // Invalidar queries relacionadas para atualizar UI
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['driver-assignments'] }),
        queryClient.invalidateQueries({ queryKey: ['freight-details', freightId] }),
        queryClient.invalidateQueries({ queryKey: ['available-freights'] })
      ]);
      
      if (showToast && !response.idempotent) {
        const statusLabel = STATUS_LABELS[newStatus.toUpperCase()] || newStatus;
        toast.success('Progresso atualizado', {
          description: `Status: ${statusLabel}`
        });
      }
      
      return { 
        success: true, 
        message: response.message || 'Atualizado com sucesso' 
      };
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro inesperado';
      console.error('[useTripProgress] Erro inesperado:', err);
      setLastError(errorMessage);
      
      if (showToast) {
        toast.error('Erro inesperado', { description: errorMessage });
      }
      
      return { success: false, message: errorMessage };
      
    } finally {
      setIsUpdating(false);
      lockRef.current.delete(lockKey);
    }
  }, [queryClient]);

  /**
   * Buscar o progresso atual de um frete
   */
  const getProgress = useCallback(async (freightId?: string): Promise<TripProgress | TripProgress[] | null> => {
    try {
      const { data, error } = await supabase.rpc('get_my_trip_progress', {
        p_freight_id: freightId ?? null
      });

      if (error) {
        console.error('[useTripProgress] Erro ao buscar progresso:', error);
        return null;
      }

      const response = data as unknown as { success: boolean; progress?: TripProgress; progresses?: TripProgress[] };
      
      if (!response.success) {
        return null;
      }

      return freightId ? response.progress || null : response.progresses || [];
      
    } catch (err) {
      console.error('[useTripProgress] Erro inesperado ao buscar:', err);
      return null;
    }
  }, []);

  /**
   * Retorna o próximo status na sequência
   */
  const getNextStatus = useCallback((currentStatus: string): string | null => {
    const normalizedStatus = currentStatus.toUpperCase().trim();
    const currentIndex = STATUS_ORDER.indexOf(normalizedStatus);
    
    if (currentIndex === -1 || currentIndex >= STATUS_ORDER.length - 1) {
      return null;
    }
    
    return STATUS_ORDER[currentIndex + 1];
  }, []);

  /**
   * Retorna o label amigável do status
   */
  const getStatusLabel = useCallback((status: string): string => {
    return STATUS_LABELS[status.toUpperCase().trim()] || status;
  }, []);

  /**
   * Verifica se pode avançar para o próximo status
   */
  const canAdvance = useCallback((currentStatus: string): boolean => {
    const normalizedStatus = currentStatus.toUpperCase().trim();
    const currentIndex = STATUS_ORDER.indexOf(normalizedStatus);
    
    // Pode avançar se não está no último status e não está cancelado
    return currentIndex !== -1 && 
           currentIndex < STATUS_ORDER.length - 1 &&
           normalizedStatus !== 'CANCELLED' &&
           normalizedStatus !== 'COMPLETED';
  }, []);

  /**
   * Atalho: Avança para o próximo status automaticamente
   * Valida que está seguindo a sequência correta
   */
  const advanceToNextStatus = useCallback(async (
    freightId: string,
    currentStatus: string,
    options?: { lat?: number; lng?: number; notes?: string }
  ) => {
    const nextStatus = getNextStatus(currentStatus);
    
    if (!nextStatus) {
      toast.error('Não há próximo status disponível');
      return { success: false, message: 'Não há próximo status disponível' };
    }
    
    // Passa o status atual para validação no frontend
    return updateProgress(freightId, nextStatus, { 
      ...options, 
      currentStatus 
    });
  }, [getNextStatus, updateProgress]);

  /**
   * Valida se uma transição de status é permitida
   * Exportado para uso em componentes que precisam validar antes de mostrar botões
   */
  const validateTransition = useCallback((currentStatus: string, newStatus: string) => {
    return isValidStatusTransition(currentStatus, newStatus);
  }, []);

  return {
    // Estados
    isUpdating,
    lastError,
    
    // Funções principais
    updateProgress,
    getProgress,
    advanceToNextStatus,
    
    // Utilitários
    getNextStatus,
    getStatusLabel,
    canAdvance,
    validateTransition,
    
    // Constantes
    STATUS_ORDER,
    STATUS_LABELS
  };
};

export type { TripProgress, TripProgressResponse };
