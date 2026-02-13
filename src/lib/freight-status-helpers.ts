import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { StatusUpdateQueue } from './status-update-queue';
import { devLog } from './devLogger';

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
  devLog('[STATUS UPDATE] 🔄 Iniciando atualização:', {
    freightId,
    newStatus,
    profileId: currentUserProfile?.id,
  });
  
  try {
    const normalizedStatus = String(newStatus).toUpperCase().trim();

    // ✅ Motorista autônomo: usar SEMPRE a RPC update_trip_progress (fonte única de verdade)
    // para evitar 403 em inserts legados (freight_status_history) e reduzir latência.
    // Mantemos a RPC antiga apenas para fluxos legados específicos da transportadora.
    const role = currentUserProfile?.role;
    // IMPORTANTE: não usar companyId como heurística aqui.
    // Motoristas afiliados (company_id preenchido) também precisam usar update_trip_progress;
    // o caminho legado possui validações antigas que estavam bloqueando a progressão.
    const shouldUseTripProgressRpc = role !== 'TRANSPORTADORA';

    devLog('[STATUS UPDATE] 🧠 RPC selecionada:', shouldUseTripProgressRpc ? 'update_trip_progress' : 'driver_update_freight_status', {
      role,
      companyId: companyId ?? null,
      assignmentId: assignmentId ?? null,
    });

    const rpcPromise = shouldUseTripProgressRpc
      ? supabase.functions.invoke('driver-update-trip-progress-fast', {
          body: {
            freightId,
            newStatus: normalizedStatus,
            lat: location?.lat ?? null,
            lng: location?.lng ?? null,
            notes: notes ?? null,
          },
        })
      : supabase.rpc('driver_update_freight_status', {
          p_freight_id: freightId,
          p_new_status: normalizedStatus,
          p_user_id: currentUserProfile.id,
          p_notes: notes ?? null,
          p_location: location ?? null,
        });
    
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('RPC_TIMEOUT')), 15000)  // 15s para corresponder ao timeout do DB
    );
    
    let data: any, error: any;
    try {
      const result = await Promise.race([rpcPromise, timeoutPromise]) as any;
        data = result.data;
        error = result.error;
    } catch (timeoutError: any) {
      if (timeoutError.message === 'RPC_TIMEOUT') {
        console.warn('[STATUS-UPDATE] RPC timeout, armazenando para sincronizar...');

        // ✅ Não fazer fallback direto em tabelas legadas (pode dar 403/lock e piorar latência).
        // Armazenar localmente e sincronizar via fila.
        StatusUpdateQueue.add({
          freightId,
          newStatus: normalizedStatus,
          userId: currentUserProfile.id,
          notes,
          location,
          assignmentId,
        });

        toast.info('Atualização armazenada localmente', {
          description: 'Será sincronizada automaticamente quando a conexão melhorar.'
        });
        return false;
      }
      throw timeoutError;
    }

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
      
      // ✅ Tratamento especial para statement timeout
      if (error.code === '57014') {
        toast.error('Operação demorou muito', {
          description: 'Tente novamente. Se o erro persistir, atualize a página.'
        });
        return false;
      }
      
      // ✅ Tratamento especial para lock timeout
      if (error.code === '55P03') {
        toast.error('Aguarde um momento...', {
          description: 'Outra operação está atualizando este frete. Tente novamente em alguns segundos.'
        });
        return false;
      }
      
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
      
      toast.error('Erro ao atualizar status do frete', {
        description: error.message || 'Erro desconhecido'
      });
      return false;
    }
    
    // ✅ Normalizar resposta (as duas RPCs retornam formatos diferentes)
    const result = data as any;
    const ok = Boolean(result?.success ?? result?.ok);
    if (!ok) {
      const message = result?.message || result?.error || 'Erro ao atualizar status';
      toast.error('Não foi possível atualizar o status', { description: message });
      return false;
    }

    // Guardar timestamp local para UI rápida
    if (result?.timestamp) {
      try {
        const key = 'tripProgress:lastUpdate';
        const current = JSON.parse(localStorage.getItem(key) || '{}');
        current[freightId] = {
          status: normalizedStatus,
          timestamp: result.timestamp,
        };
        localStorage.setItem(key, JSON.stringify(current));
      } catch {
        // ignore
      }
    }
    
    // Mensagens de sucesso
    const statusMessages: Record<string, string> = {
      'LOADING': 'Status atualizado: A caminho da coleta! 🚚',
      'IN_TRANSIT': 'Status atualizado: Em trânsito! 🛣️',
      'DELIVERED_PENDING_CONFIRMATION': 'Entrega reportada com sucesso! O produtor tem 72h para confirmar. ✅'
    };

    toast.success(statusMessages[normalizedStatus] || 'Status atualizado com sucesso!');
    
    // 🔔 Enviar notificação persistente quando motorista reporta entrega
    if (normalizedStatus === 'DELIVERED_PENDING_CONFIRMATION') {
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
            title: 'Entrega Reportada pelo Motorista',
            message: `O motorista relatou que sua carga foi entregue. Você tem 72h para confirmar a entrega. Se não confirmar, o sistema confirmará automaticamente.`,
            type: 'delivery_confirmation_required',
            data: { freight_id: freightId }
          });
          devLog('[freight-status-helpers] 🔔 Notificação enviada ao produtor:', freightData.producer_id);
        }

        // ✅ Sincronização legada é não-bloqueante (o RPC já cuida do core)
        await supabase
          .from('freight_assignments')
          .update({
            status: 'DELIVERED_PENDING_CONFIRMATION',
            updated_at: new Date().toISOString(),
          })
          .eq('freight_id', freightId)
          .eq('driver_id', currentUserProfile?.id)
          .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT']);

        // ✅ DISPARAR evento para mover frete para histórico na UI
        window.dispatchEvent(new CustomEvent('freight:movedToHistory', { 
          detail: { freightId } 
        }));

        devLog('[freight-status-helpers] ✅ Frete movido para histórico:', freightId);

      } catch (notifyError) {
        console.warn('[freight-status-helpers] ⚠️ Erro não bloqueante:', notifyError);
      }
    }
    
    devLog('[STATUS UPDATE] ✅ Status atualizado com sucesso:', {
      freightId,
      newStatus: normalizedStatus,
      assignmentId
    });
    return true;

  } catch (error: any) {
    console.error('[STATUS UPDATE] ❌ Falha na atualização:', {
      freightId,
      newStatus: String(newStatus),
      error: error.message,
      code: error.code,
      details: error
    });
    
    // Tratamento específico para lock timeout
    if (error.code === '55P03') {
      devLog('🔥 [DEBUG] Lock timeout detectado');
      toast.error('Frete sendo atualizado por outra operação', {
        description: 'Tente novamente em alguns segundos.'
      });
      return false;
    }
    
    console.error('[STATUS-UPDATE] Unexpected error:', error);
    toast.error('Erro inesperado ao atualizar status');
    return false;
  } finally {
    devLog('[STATUS UPDATE] Fim da operação');
  }
}

// Função auxiliar para atualização direta (fallback)
async function updateStatusDirect(
  freightId: string,
  newStatus: string,
  userId: string,
  notes?: string,
  location?: { lat: number; lng: number },
  assignmentId?: string
): Promise<boolean> {
  try {
    devLog('[STATUS-UPDATE] Executando fallback direto...');
    
    // Verificar se é frete multi-carreta
    const { data: freightData } = await supabase
      .from('freights')
      .select('required_trucks, driver_id')
      .eq('id', freightId)
      .single();
    
    const isMultiTruck = (freightData?.required_trucks ?? 1) > 1 && !freightData?.driver_id;
    
    // ✅ Para fretes multi-carreta, NUNCA atualizar o status do frete diretamente
    // Apenas atualizar o assignment do motorista
    if (isMultiTruck) {
      devLog('[STATUS-UPDATE] Multi-truck freight - updating assignment only');
      
      const { error: assignmentError } = await supabase
        .from('freight_assignments')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString() 
        })
        .eq('freight_id', freightId)
        .eq('driver_id', userId)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION']);
      
      if (assignmentError) {
        console.error('[STATUS-UPDATE] Erro ao atualizar assignment:', assignmentError);
        return false;
      }
      
      // Apenas atualizar updated_at do frete para trigger de refresh
      await supabase
        .from('freights')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', freightId);
        
    } else {
      // Frete de carreta única - comportamento legado
      const { error: freightError } = await supabase
        .from('freights')
        .update({ 
          status: newStatus as any,
          updated_at: new Date().toISOString() 
        })
        .eq('id', freightId);
      
      if (freightError) {
        console.error('[STATUS-UPDATE] Erro ao atualizar frete:', freightError);
        return false;
      }
      
      // Atualizar assignment também
      await supabase
        .from('freight_assignments')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString() 
        })
        .eq('freight_id', freightId)
        .eq('driver_id', userId);
    }
    
    // 2. Inserir histórico
    const { error: historyError } = await supabase
      .from('freight_status_history')
      .insert({
        freight_id: freightId,
        status: newStatus as any,
        changed_by: userId,
        notes: notes || `Status: ${newStatus}`
      } as any);
    
    if (historyError) {
      console.warn('[STATUS-UPDATE] Erro ao inserir histórico:', historyError);
      // Não bloqueia pois já foi atualizado
    }
    
    // 3. Inserir checkin se houver localização
    if (location?.lat && location?.lng) {
      await supabase
        .from('freight_checkins')
        .insert({
          freight_id: freightId,
          user_id: userId,
          location_lat: location.lat,
          location_lng: location.lng,
          checkin_type: newStatus,
          notes: notes
        } as any);
    }
    
    console.log('[STATUS-UPDATE] ✅ Fallback direto bem-sucedido');
    return true;
    
  } catch (err) {
    console.error('[STATUS-UPDATE] Erro no fallback direto:', err);
    return false;
  }
}
