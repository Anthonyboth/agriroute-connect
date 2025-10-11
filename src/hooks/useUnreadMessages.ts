import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UnreadCounts {
  [key: string]: number;
}

export const useUnreadMessages = (currentUserId?: string) => {
  const [unreadFreightMessages, setUnreadFreightMessages] = useState<UnreadCounts>({});
  const [unreadServiceMessages, setUnreadServiceMessages] = useState<UnreadCounts>({});

  // Buscar mensagens não lidas de um frete específico
  const fetchUnreadFreightMessages = async (freightId: string) => {
    if (!currentUserId) return 0;

    try {
      const { count, error } = await supabase
        .from('freight_messages')
        .select('*', { count: 'exact', head: true })
        .eq('freight_id', freightId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);

      if (error) throw error;
      
      setUnreadFreightMessages(prev => ({ ...prev, [freightId]: count || 0 }));
      return count || 0;
    } catch (error) {
      console.error('Error fetching unread freight messages:', error);
      return 0;
    }
  };

  // Buscar mensagens não lidas de um serviço específico
  const fetchUnreadServiceMessages = async (serviceRequestId: string) => {
    if (!currentUserId) return 0;

    try {
      const { count, error } = await supabase
        .from('service_messages')
        .select('*', { count: 'exact', head: true })
        .eq('service_request_id', serviceRequestId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);

      if (error) throw error;
      
      setUnreadServiceMessages(prev => ({ ...prev, [serviceRequestId]: count || 0 }));
      return count || 0;
    } catch (error) {
      console.error('Error fetching unread service messages:', error);
      return 0;
    }
  };

  // Marcar mensagens de frete como lidas
  const markFreightMessagesAsRead = async (freightId: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from('freight_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('freight_id', freightId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);

      if (error) throw error;
      
      setUnreadFreightMessages(prev => ({ ...prev, [freightId]: 0 }));
    } catch (error) {
      console.error('Error marking freight messages as read:', error);
    }
  };

  // Marcar mensagens de serviço como lidas
  const markServiceMessagesAsRead = async (serviceRequestId: string) => {
    if (!currentUserId) return;

    try {
      const { error } = await supabase
        .from('service_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('service_request_id', serviceRequestId)
        .neq('sender_id', currentUserId)
        .is('read_at', null);

      if (error) throw error;
      
      setUnreadServiceMessages(prev => ({ ...prev, [serviceRequestId]: 0 }));
    } catch (error) {
      console.error('Error marking service messages as read:', error);
    }
  };

  // Subscription para atualizar contador em tempo real (fretes)
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('unread-freight-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_messages',
        },
        (payload) => {
          const message = payload.new as any;
          if (message && message.freight_id && message.sender_id !== currentUserId) {
            fetchUnreadFreightMessages(message.freight_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  // Subscription para atualizar contador em tempo real (serviços)
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel('unread-service-messages')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_messages',
        },
        (payload) => {
          const message = payload.new as any;
          if (message && message.service_request_id && message.sender_id !== currentUserId) {
            fetchUnreadServiceMessages(message.service_request_id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  return {
    unreadFreightMessages,
    unreadServiceMessages,
    fetchUnreadFreightMessages,
    fetchUnreadServiceMessages,
    markFreightMessagesAsRead,
    markServiceMessagesAsRead,
  };
};
