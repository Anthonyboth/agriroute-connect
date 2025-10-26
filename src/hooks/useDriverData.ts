import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
export const useAvailableFreights = (driverId: string | undefined, filters?: any) => {
  return useQuery({
    queryKey: ['available-freights', driverId, filters],
    queryFn: async () => {
      if (!driverId) return [];

      // Buscar fretes matched via spatial matching
      const { data, error } = await supabase.functions.invoke('driver-spatial-matching', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      if (error) throw error;
      return data?.freights || [];
    },
    enabled: !!driverId,
    staleTime: 2 * 60 * 1000, // 2 minutos (fretes disponíveis mudam mais rápido)
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
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
