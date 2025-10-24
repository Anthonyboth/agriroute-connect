import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SendNotificationPayload {
  user_id: string;
  title: string;
  message: string;
  type: string;
  data?: Record<string, any>;
}

/**
 * Envia uma notificação persistente para um usuário via Edge Function
 */
export const sendNotification = async (payload: SendNotificationPayload): Promise<boolean> => {
  try {
    console.log('[sendNotification] Enviando notificação:', payload);
    
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: payload
    });

    if (error) {
      console.error('[sendNotification] ❌ Erro ao enviar notificação:', error);
      return false;
    }

    console.log('[sendNotification] ✅ Notificação enviada com sucesso:', data);
    return true;
  } catch (error) {
    console.error('[sendNotification] ❌ Exceção ao enviar notificação:', error);
    return false;
  }
};
