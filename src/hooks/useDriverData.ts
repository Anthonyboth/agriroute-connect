import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

/**
 * Hook otimizado para buscar assignments do motorista
 * Usa React Query com cache agressivo
 */
export const useDriverAssignments = (driverId: string | undefined) => {
  return useQuery({
    queryKey: ['driver-assignments', driverId],
    queryFn: async () => {
      if (!driverId) return [];

      const { data, error } = await supabase.functions.invoke('get-driver-assignments', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (error) throw error;
      return data?.assignments || [];
    },
    enabled: !!driverId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos (cacheTime renomeado para gcTime)
    refetchOnWindowFocus: false
  });
};

/**
 * Hook para buscar fretes disponíveis (matched)
 */
export const useAvailableFreights = (driverId: string) => {
  const queryClient = useQueryClient();

  // Setup realtime invalidation
  useEffect(() => {
    if (!driverId) return;

    const channel = supabase
      .channel('driver-freights-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freights'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['available-freights', driverId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_assignments'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['available-freights', driverId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [driverId, queryClient]);

  return useQuery({
    queryKey: ['available-freights', driverId],
    queryFn: async () => {
      console.log('[useAvailableFreights] Fetching available freights for driver:', driverId);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.warn('[useAvailableFreights] No session found, skipping fetch');
        return [];
      }
      
      const { data, error } = await supabase.functions.invoke('driver-spatial-matching', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: { driver_id: driverId }
      });

      if (error) {
        console.error('[useAvailableFreights] Error fetching freights:', error);
        throw error;
      }

      console.log('[useAvailableFreights] Found available freights:', data?.freights?.length || 0);
      return data?.freights || [];
    },
    enabled: !!driverId,
    staleTime: 5 * 1000, // 5 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true,
  });
};

/**
 * Hook para buscar propostas do motorista
 */
export const useDriverProposals = (driverId: string | undefined) => {
  return useQuery({
    queryKey: ['driver-proposals', driverId],
    queryFn: async () => {
      if (!driverId) return [];

      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(
            *,
            producer:profiles!freights_producer_id_fkey(id, full_name, contact_phone)
          )
        `)
        .eq('driver_id', driverId)
        .neq('status', 'CANCELLED')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!driverId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });
};

/**
 * Hook para buscar solicitações de transporte (da transportadora)
 * Retorna vazio se a tabela não existir ainda
 */
export const useTransportRequests = (driverId: string | undefined) => {
  return useQuery({
    queryKey: ['transport-requests', driverId],
    queryFn: async () => {
      if (!driverId) return [];

      // Placeholder: funcionalidade de transport requests pode ser expandida no futuro
      // quando a estrutura de transportadoras for implementada
      return [];
    },
    enabled: !!driverId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false
  });
};

/**
 * Hook para buscar estatísticas do motorista
 */
export const useDriverStats = (driverId: string | undefined) => {
  return useQuery({
    queryKey: ['driver-stats', driverId],
    queryFn: async () => {
      if (!driverId) return null;

      // Buscar assignments completados (usar freight.price como base)
      const { data: completedAssignments, error: completedError } = await supabase
        .from('freight_assignments')
        .select(`
          id,
          freight:freights(price)
        `, { count: 'exact' })
        .eq('driver_id', driverId)
        .eq('status', 'COMPLETED');

      if (completedError) throw completedError;

      // Buscar assignments ativos
      const { data: activeAssignments, error: activeError } = await supabase
        .from('freight_assignments')
        .select('id', { count: 'exact' })
        .eq('driver_id', driverId)
        .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT']);

      if (activeError) throw activeError;

      // Calcular ganhos totais a partir do preço do frete
      const totalEarnings = (completedAssignments || []).reduce(
        (sum: number, a: any) => sum + (a.freight?.price || 0),
        0
      );

      return {
        completedCount: completedAssignments?.length || 0,
        activeCount: activeAssignments?.length || 0,
        totalEarnings
      };
    },
    enabled: !!driverId,
    staleTime: 10 * 60 * 1000, // 10 minutos (stats mudam menos frequentemente)
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false
  });
};
