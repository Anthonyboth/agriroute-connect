import { useEffect, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { debounce } from '@/lib/utils';

interface RealtimeSyncOptions {
  userId: string;
  role: string;
  tables?: string[];
  enabled?: boolean;
}

/**
 * Hook consolidado para gerenciar subscriptions de realtime
 * Reduz de 174 subscriptions para 1 canal único por dashboard
 */
export const useRealtimeSync = ({ 
  userId, 
  role, 
  tables = ['freights', 'freight_assignments', 'proposals', 'service_requests'],
  enabled = true 
}: RealtimeSyncOptions) => {
  const queryClient = useQueryClient();

  // Debounced sync para evitar updates em cascata
  const debouncedSync = useMemo(
    () =>
      debounce((table: string) => {
        // Invalidar queries relacionadas à tabela específica
        queryClient.invalidateQueries({ 
          predicate: (query) => {
            const key = query.queryKey[0] as string;
            return key?.includes(table) || key?.includes(userId);
          }
        });
      }, 500),
    [userId, queryClient]
  );

  // Throttled sync para limitar taxa de updates
  const throttledSync = useCallback(() => {
    // Máximo 1 sync completo por segundo
    queryClient.invalidateQueries();
  }, [queryClient]);

  useEffect(() => {
    if (!enabled || !userId) return;

    const channelName = `dashboard-${role}-${userId}`;
    const channel = supabase.channel(channelName);

    // Subscribe apenas às mudanças relevantes para o usuário
    tables.forEach((table) => {
      // Para motoristas, escutar apenas fretes/assignments relacionados
      if (role === 'MOTORISTA' || role === 'MOTORISTA_AFILIADO') {
        if (table === 'freights') {
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'freights',
              filter: `driver_id=eq.${userId}`
            },
            () => debouncedSync('freights')
          );
        }
        
        if (table === 'freight_assignments') {
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'freight_assignments',
              filter: `driver_id=eq.${userId}`
            },
            () => debouncedSync('freight_assignments')
          );
        }
      }

      // Para produtores, escutar fretes próprios
      if (role === 'PRODUTOR') {
        if (table === 'freights') {
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'freights',
              filter: `producer_id=eq.${userId}`
            },
            () => debouncedSync('freights')
          );
        }
        
        if (table === 'proposals') {
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'proposals'
            },
            () => debouncedSync('proposals')
          );
        }
      }

      // Para prestadores de serviço
      if (role === 'PRESTADOR_SERVICOS') {
        if (table === 'service_requests') {
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'service_requests',
              filter: `provider_id=eq.${userId}`
            },
            () => debouncedSync('service_requests')
          );
        }
      }
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log(`[RealtimeSync] Connected: ${channelName}`);
      }
    });

    return () => {
      supabase.removeChannel(channel);
      console.log(`[RealtimeSync] Disconnected: ${channelName}`);
    };
  }, [userId, role, enabled, tables, debouncedSync]);

  return {
    syncNow: throttledSync
  };
};
