import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseProposalTypingIndicatorProps {
  proposalId: string;
  userId: string;
  userName: string;
  userRole: 'producer' | 'driver';
}

interface TypingUser {
  userId: string;
  userName: string;
  userRole: 'producer' | 'driver';
}

export function useProposalTypingIndicator({
  proposalId,
  userId,
  userName,
  userRole
}: UseProposalTypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!proposalId || !userId) return;

    const channel = supabase.channel(`proposal-typing-${proposalId}`, {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: TypingUser[] = [];
        
        Object.keys(state).forEach((presenceKey) => {
          const presences = state[presenceKey];
          presences.forEach((presence: any) => {
            if (presence.userId !== userId && presence.typing) {
              users.push({
                userId: presence.userId,
                userName: presence.userName,
                userRole: presence.userRole,
              });
            }
          });
        });

        setTypingUsers(users);
      })
      .subscribe();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setTyping(false);
      supabase.removeChannel(channel);
    };
  }, [proposalId, userId]);

  const setTyping = async (isTyping: boolean) => {
    if (!channelRef.current) return;

    try {
      await channelRef.current.track({
        userId,
        userName,
        userRole,
        typing: isTyping,
        online_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('[useProposalTypingIndicator] Erro ao atualizar typing:', error);
    }
  };

  const handleTyping = () => {
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set typing
    setTyping(true);

    // Auto-clear after 3 seconds of inactivity
    timeoutRef.current = setTimeout(() => {
      setTyping(false);
    }, 3000);
  };

  return { typingUsers, handleTyping, setTyping };
}
