import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Status finais que não podem mais ser alterados
export const FINAL_STATUSES = [
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED'
] as const;

interface UpdateStatusParams {
  freightId: string;
  newStatus: string;
  currentUserProfile: any;
  notes?: string;
  location?: { lat: number; lng: number };
  companyId?: string; // Allow companies to update status
  assignmentId?: string; // Track which assignment is being updated
}

export async function driverUpdateFreightStatus({
  freightId,
  newStatus,
  currentUserProfile,
  notes,
  location,
  companyId,
  assignmentId
}: UpdateStatusParams): Promise<boolean> {
  console.log('[STATUS UPDATE] 🔄 Iniciando atualização:', {
    freightId,
    newStatus,
    profileId: currentUserProfile.id,
    notes,
    location
  });
  
  try {
    // ✅ PREFLIGHT CHECK 1: Verificar se frete já está em status final via tabela principal
    const { data: freightData, error: checkError } = await supabase
      .from('freights')
      .select('status')
      .eq('id', freightId)
      .maybeSingle();

    if (checkError) {
      console.error('[STATUS-UPDATE] Preflight check error:', checkError);
      toast.error('Erro ao verificar status do frete');
      return false;
    }

    if (freightData && FINAL_STATUSES.includes(freightData.status as any)) {
      console.warn('[STATUS-UPDATE] Preflight blocked: freight in final status', {
        freightId,
        currentStatus: freightData.status,
        attemptedStatus: newStatus
      });
      
      toast.error('Este frete já foi entregue e está aguardando confirmação. Não é possível alterar o status.');
      
      // Disparar evento para forçar refresh da UI
      window.dispatchEvent(new CustomEvent('freight-status-blocked', { 
        detail: { freightId, status: freightData.status } 
      }));
      
      return false;
    }

    // ✅ PREFLIGHT CHECK 2: Verificar histórico de status (fonte de verdade definitiva)
    const { data: lastBlocking, error: historyError } = await supabase
      .from('freight_status_history')
      .select('status, created_at')
      .eq('freight_id', freightId)
      .in('status', FINAL_STATUSES)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (historyError) {
      console.error('[STATUS-UPDATE] History check error:', historyError);
      // Não bloqueia por erro de histórico, apenas loga
    }

    if (lastBlocking) {
      console.warn('[STATUS-UPDATE] Preflight blocked: found blocking status in history', {
        freightId,
        blockingStatus: lastBlocking.status,
        blockingTime: lastBlocking.created_at,
        attemptedStatus: newStatus
      });
      
      toast.error('Este frete já foi entregue e está aguardando confirmação. Não é possível alterar o status.');
      
      // Disparar evento para forçar refresh da UI
      window.dispatchEvent(new CustomEvent('freight-status-blocked', { 
        detail: { freightId, status: lastBlocking.status } 
      }));
      
      return false;
    }

    if (import.meta.env.DEV) {
      console.log('[STATUS-UPDATE] Preflight passed:', {
        currentStatus: freightData?.status,
        nextStatus: newStatus
      });
    }

    // Usar RPC segura para atualizar status (evita problemas de RLS)
    const { data, error } = await supabase.rpc('driver_update_freight_status', {
      p_freight_id: freightId,
      p_new_status: newStatus,
      p_user_id: currentUserProfile.id,
      p_notes: notes ?? null,
      p_lat: location?.lat ?? null,
      p_lng: location?.lng ?? null,
      p_assignment_id: assignmentId ?? null
    });

    if (error) {
      console.error('[STATUS-UPDATE] RPC error:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        freightId,
        newStatus,
        notes,
        location
      });
      
      // ✅ Tratamento especial para erro P0001 (transição inválida após entrega)
      if (error.code === 'P0001') {
        // Mensagem amigável para o usuário - sem expor erro técnico
        toast.error('Este frete já foi entregue e está aguardando confirmação. Não é possível alterar o status.');
        
        // Disparar evento para forçar refresh da UI
        window.dispatchEvent(new CustomEvent('freight-status-blocked', { 
          detail: { freightId, status: 'DELIVERED_PENDING_CONFIRMATION' } 
        }));
        
        // Log para debug (não aparece para usuário final)
        if (import.meta.env.DEV) {
          console.error('[STATUS-UPDATE] P0001 error intercepted:', error.message);
        }
        
        return false;
      }
      
      toast.error('Erro ao atualizar status do frete: ' + (error.message || 'Erro desconhecido'));
      return false;
    }
    
    // Verificar resposta da função (data é Json, precisa de cast)
    const result = data as any;
    if (!result || !(result.ok || result.success)) {
      console.error('[STATUS-UPDATE] Function returned error:', result?.error);
      
      // Mensagens de erro específicas
      if (result?.error === 'FREIGHT_ALREADY_CONFIRMED') {
        toast.error('Este frete já foi entregue e confirmado. Não é possível alterar o status.');
      } else if (result?.error === 'TRANSITION_NOT_ALLOWED') {
        const msg = result?.message || 
          `Não é possível mudar de ${result?.current_status || 'status atual'} para ${result?.attempted_status || newStatus}`;
        toast.error(msg);
        console.warn('[STATUS-UPDATE] Transição bloqueada:', {
          current: result?.current_status,
          attempted: result?.attempted_status,
          message: result?.message
        });
      } else {
        toast.error(result?.message || result?.error || 'Erro ao atualizar status');
      }
      return false;
    }

    // Mensagens de sucesso
    const statusMessages: Record<string, string> = {
      'LOADING': 'Status atualizado: A caminho da coleta! 🚚',
      'IN_TRANSIT': 'Status atualizado: Em trânsito! 🛣️',
      'DELIVERED_PENDING_CONFIRMATION': 'Entrega reportada com sucesso! O produtor tem 72h para confirmar. ✅'
    };

    toast.success(statusMessages[newStatus] || 'Status atualizado com sucesso!');
    
    // 🔔 Enviar notificação persistente quando motorista reporta entrega
    if (newStatus === 'DELIVERED_PENDING_CONFIRMATION') {
      try {
        // Buscar dados do frete para obter producer_id
        const { data: freightData } = await supabase
          .from('freights')
          .select('id, producer_id, driver_id, cargo_type, origin_city, destination_city')
          .eq('id', freightId)
          .single();

        if (freightData?.producer_id) {
          const { sendNotification } = await import('@/utils/notify');
          await sendNotification({
            user_id: freightData.producer_id,
            title: 'Entrega reportada',
            message: `O motorista reportou a entrega do frete ${freightData.cargo_type}. Você tem até 72h para confirmar.`,
            type: 'freight_delivery_reported',
            data: { freight_id: freightId }
          });
          console.log('[freight-status-helpers] 🔔 Notificação enviada ao produtor:', freightData.producer_id);
        }

        // ✅ SINCRONIZAR assignment.status para mover para histórico
        await supabase
          .from('freight_assignments')
          .update({ 
            status: 'DELIVERED_PENDING_CONFIRMATION', 
            updated_at: new Date().toISOString() 
          })
          .eq('freight_id', freightId)
          .eq('driver_id', currentUserProfile?.id)
          .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT']);

        // ✅ DISPARAR evento para mover frete para histórico na UI
        window.dispatchEvent(new CustomEvent('freight:movedToHistory', { 
          detail: { freightId } 
        }));

        console.log('[freight-status-helpers] ✅ Frete movido para histórico:', freightId);

      } catch (notifyError) {
        console.warn('[freight-status-helpers] ⚠️ Erro não bloqueante:', notifyError);
      }
    }
    
    console.log('[STATUS UPDATE] ✅ Status atualizado com sucesso:', {
      freightId,
      newStatus,
      assignmentId
    });
    
    return true;

  } catch (error: any) {
    console.error('[STATUS UPDATE] ❌ Falha na atualização:', {
      freightId,
      newStatus,
      error: error.message,
      code: error.code,
      details: error
    });
    
    // Tratamento específico para lock timeout
    if (error.code === '55P03') {
      toast.error('Frete sendo atualizado por outra operação', {
        description: 'Tente novamente em alguns segundos.'
      });
      return false;
    }
    
    console.error('[STATUS-UPDATE] Unexpected error:', error);
    toast.error('Erro inesperado ao atualizar status');
    return false;
  }
}
