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
}

export async function driverUpdateFreightStatus({
  freightId,
  newStatus,
  currentUserProfile,
  notes,
  location
}: UpdateStatusParams): Promise<boolean> {
  try {
    // ✅ PREFLIGHT CHECK: Verificar se frete já está em status final
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
      
      toast.error('Este frete já foi entregue ou está aguardando confirmação. Não é possível alterar o status.');
      
      // Disparar evento para forçar refresh da UI
      window.dispatchEvent(new CustomEvent('freight-status-blocked', { 
        detail: { freightId, status: freightData.status } 
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
      p_new_status: newStatus as any,
      p_notes: notes || null,
      p_lat: location?.lat || null,
      p_lng: location?.lng || null
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
      if (error.code === 'P0001' && error.message?.includes('Transição de status inválida após entrega reportada')) {
        toast.error('Este frete já foi entregue e está aguardando confirmação. Não é possível alterar o status.');
        
        // Disparar evento para forçar refresh da UI
        window.dispatchEvent(new CustomEvent('freight-status-blocked', { 
          detail: { freightId, status: 'DELIVERED_PENDING_CONFIRMATION' } 
        }));
        
        return false;
      }
      
      toast.error('Erro ao atualizar status do frete: ' + (error.message || 'Erro desconhecido'));
      return false;
    }
    
    // Verificar resposta da função (data é Json, precisa de cast)
    const result = data as any;
    if (!result || !result.ok) {
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
    return true;

  } catch (error: any) {
    console.error('[STATUS-UPDATE] Unexpected error:', error);
    toast.error('Erro inesperado ao atualizar status');
    return false;
  }
}
