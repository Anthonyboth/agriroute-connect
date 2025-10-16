import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
    // 1. Atualizar status do frete
    const { error: freightError } = await supabase
      .from('freights')
      .update({ 
        status: newStatus as any,
        updated_at: new Date().toISOString()
      })
      .eq('id', freightId);

    if (freightError) {
      console.error('[STATUS-UPDATE] Error updating freight:', freightError);
      toast.error('Erro ao atualizar status do frete');
      return false;
    }

    // 2. Inserir histórico
    try {
      await supabase
        .from('freight_status_history')
        .insert({
          freight_id: freightId,
          status: newStatus as any,
          changed_by: currentUserProfile?.id,
          notes: notes || null,
          location_lat: location?.lat || null,
          location_lng: location?.lng || null
        });
    } catch (historyError) {
      console.error('[STATUS-UPDATE] Error inserting history (não crítico):', historyError);
    }

    // 3. Mensagem de sucesso
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
