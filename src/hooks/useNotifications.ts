import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { queryWithTimeout, subscriptionWithRetry } from '@/lib/query-utils';
import { devLog } from '@/lib/devLogger';

export const useNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const fetchUnreadCount = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      devLog('[useNotifications] Buscando notificações não lidas...');
      
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
          timeoutMs: 20000, 
          operationName: 'fetchUnreadCount',
          retries: 1
        }
      );
      
      const newCount = count || 0;
      devLog(`[useNotifications] ${newCount} notificações não lidas`);
      setUnreadCount(newCount);
    } catch (error: any) {
      // Usar warn para timeouts (não dispara monitor Telegram)
      const isTimeout = error?.message?.includes('Timeout');
      if (isTimeout) {
        console.warn('[useNotifications] Timeout ao buscar contador - será tentado novamente no próximo ciclo');
      } else {
        console.error('[useNotifications] Erro ao buscar contador:', error);
      }
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      fetchUnreadCount();
      
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
            const pollInterval = setInterval(fetchUnreadCount, 30000);
            return () => clearInterval(pollInterval);
          }
        }
      );

      const pollInterval = setInterval(fetchUnreadCount, 60000);

      return () => {
        cleanup();
        clearInterval(pollInterval);
      };
    }
  }, [profile, fetchUnreadCount]);

  const decrementCount = useCallback((amount: number = 1) => {
    setUnreadCount(prev => Math.max(0, prev - amount));
  }, []);

  const incrementCount = useCallback((amount: number = 1) => {
    setUnreadCount(prev => prev + amount);
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', profile.id)
        .eq('read', false);
      if (error) throw error;
      setUnreadCount(0);
      devLog('[useNotifications] Todas notificações marcadas como lidas');
    } catch (error) {
      console.error('[useNotifications] Erro ao marcar como lidas:', error);
      fetchUnreadCount();
    }
  }, [profile, fetchUnreadCount]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)
        .eq('user_id', profile.id);
      if (error) throw error;
      decrementCount(1);
      devLog('[useNotifications] Notificação marcada como lida:', notificationId);
    } catch (error) {
      console.error('[useNotifications] Erro ao marcar notificação:', error);
      fetchUnreadCount();
    }
  }, [profile, decrementCount, fetchUnreadCount]);

  return {
    unreadCount,
    loading,
    refreshCount: fetchUnreadCount,
    markAllAsRead,
    markAsRead,
    decrementCount,
    incrementCount
  };
};
