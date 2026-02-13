import { useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { debounce } from '@/lib/utils';
import { devLog } from '@/lib/devLogger';

interface RealtimeSyncOptions {
  userId: string;
  role: string;
  tables?: string[];
  enabled?: boolean;
}

export const useRealtimeSync = ({ 
  userId, role, 
  tables = ['freights', 'freight_assignments', 'proposals', 'service_requests'],
  enabled = true 
}: RealtimeSyncOptions) => {
  const queryClient = useQueryClient();

  const debouncedSync = useMemo(
    () => debounce((table: string) => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0] as string;
          return key?.includes(table) || key?.includes(userId);
        }
      });
    }, 500),
    [userId, queryClient]
  );

  const throttledSync = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !userId) return;
    const channelName = `dashboard-${role}-${userId}`;
    const channel = supabase.channel(channelName);

    tables.forEach((table) => {
      if (role === 'MOTORISTA' || role === 'MOTORISTA_AFILIADO') {
        if (table === 'freights') {
          channel.on('postgres_changes', { event: '*', schema: 'public', table: 'freights', filter: `driver_id=eq.${userId}` }, () => debouncedSync('freights'));
        }
        if (table === 'freight_assignments') {
          channel.on('postgres_changes', { event: '*', schema: 'public', table: 'freight_assignments', filter: `driver_id=eq.${userId}` }, () => debouncedSync('freight_assignments'));
        }
      }
      if (role === 'PRODUTOR') {
        if (table === 'freights') {
          channel.on('postgres_changes', { event: '*', schema: 'public', table: 'freights', filter: `producer_id=eq.${userId}` }, () => debouncedSync('freights'));
        }
        if (table === 'proposals') {
          channel.on('postgres_changes', { event: '*', schema: 'public', table: 'proposals' }, () => debouncedSync('proposals'));
        }
      }
      if (role === 'PRESTADOR_SERVICOS') {
        if (table === 'service_requests') {
          channel.on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests', filter: `provider_id=eq.${userId}` }, () => debouncedSync('service_requests'));
        }
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') devLog(`[RealtimeSync] Connected: ${channelName}`);
    });

    return () => {
      supabase.removeChannel(channel);
      devLog(`[RealtimeSync] Disconnected: ${channelName}`);
    };
  }, [userId, role, enabled, tables, debouncedSync]);

  return { syncNow: throttledSync };
};
