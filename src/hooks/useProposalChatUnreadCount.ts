import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useProposalChatUnreadCount(proposalId: string, currentUserId: string) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!proposalId || !currentUserId) {
      setIsLoading(false);
      return;
    }

    const fetchUnreadCount = async () => {
      try {
        const { count, error } = await supabase
          .from('proposal_chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('proposal_id', proposalId)
          .neq('sender_id', currentUserId)
          .is('read_at', null);

        if (error) throw error;
        setUnreadCount(count || 0);
      } catch (error) {
        console.error('[useProposalChatUnreadCount] Erro ao buscar contador:', error);
        setUnreadCount(0);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnreadCount();

    // Real-time subscription para atualizar contador quando novas mensagens chegam
    const channel = supabase
      .channel(`proposal-chat-unread-${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proposal_chat_messages',
          filter: `proposal_id=eq.${proposalId}`
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proposalId, currentUserId]);

  return { unreadCount, isLoading };
}
