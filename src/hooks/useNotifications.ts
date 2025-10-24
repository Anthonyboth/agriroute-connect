import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { queryWithTimeout, subscriptionWithRetry } from '@/lib/query-utils';

export const useNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const fetchUnreadCount = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      console.log('[useNotifications] Buscando notificações não lidas...');
      
      const count = await queryWithTimeout(
        async () => {
          const { count, error } = await supabase
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id)
            .eq('read', false);
          
          if (error) throw error;
          return count;
        },
        { 
          timeoutMs: 5000, 
          operationName: 'fetchUnreadCount',
          retries: 1
        }
      );
      
      const newCount = count || 0;
      console.log(`[useNotifications] ${newCount} notificações não lidas`);
      setUnreadCount(newCount);
    } catch (error: any) {
      console.error('[useNotifications] Erro ao buscar contador:', error);
      // NÃO setar 0 - manter valor anterior em caso de erro
      // Isso evita esconder o contador real quando há falhas temporárias
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      fetchUnreadCount();
      
      // Configurar real-time subscription com retry
      const { cleanup } = subscriptionWithRetry(
        'notifications_changes',
        (channel) => {
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'notifications',
              filter: `user_id=eq.${profile.id}`
            },
            () => fetchUnreadCount()
          );
        },
        {
          maxRetries: 5,
          retryDelayMs: 3000,
          onError: (error) => {
            console.error('[useNotifications] Realtime error:', error);
            // Fallback: polling manual se realtime falhar
            const pollInterval = setInterval(fetchUnreadCount, 30000);
            return () => clearInterval(pollInterval);
          }
        }
      );

      return cleanup;
    }
  }, [profile, fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    refreshCount: fetchUnreadCount
  };
};
