import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useRef } from 'react';
import { debounce } from '@/lib/utils';

interface OptimizedStats {
  totalUsers: number;
  totalFreights: number;
  totalWeight: number;
  averageRating: number;
  activeDrivers: number;
  activeProducers: number;
  activeProviders: number;
  completedFreights: number;
  loading: boolean;
}

/**
 * Hook otimizado para estatísticas gerais do sistema
 * Usa React Query com cache de longa duração
 */
export const useOptimizedStats = () => {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['system-stats'],
    queryFn: async () => {
      // Usar RPC SECURITY DEFINER para funcionar sem autenticação
      // Usar apenas o RPC SECURITY DEFINER que já inclui todos os dados
      const statsResult = await supabase.rpc('get_platform_stats');
      
      if (statsResult.error) {
        console.error('[useOptimizedStats] Erro ao buscar stats:', statsResult.error);
        throw statsResult.error;
      }

      const row = Array.isArray(statsResult.data) ? statsResult.data[0] : statsResult.data;

      return {
        totalUsers: Number(row?.total_usuarios ?? 0),
        totalFreights: Number(row?.total_fretes ?? 0),
        totalWeight: Number(row?.peso_total ?? 0),
        averageRating: Number(row?.avaliacao_media ?? 0),
        activeDrivers: Number(row?.motoristas ?? 0),
        activeProducers: Number(row?.produtores ?? 0),
        activeProviders: Number(row?.prestadores ?? 0),
        completedFreights: Number(row?.fretes_entregues ?? 0)
      };
    },
    staleTime: 2 * 60 * 60 * 1000, // 2 horas - stats mudam pouco
    gcTime: 4 * 60 * 60 * 1000, // 4 horas
    refetchOnWindowFocus: false, // ✅ NÃO atualiza ao focar (economiza requests)
    refetchOnMount: false, // ✅ NÃO refetch se já tem dados em cache
    // ❌ REMOVIDO: refetchInterval - realtime subscription já cuida de atualizações
    refetchIntervalInBackground: false // Economiza recursos em background
  });

  const stats: OptimizedStats = {
    totalUsers: data?.totalUsers || 0,
    totalFreights: data?.totalFreights || 0,
    totalWeight: data?.totalWeight || 0,
    averageRating: data?.averageRating || 0,
    activeDrivers: data?.activeDrivers || 0,
    activeProducers: data?.activeProducers || 0,
    activeProviders: data?.activeProviders || 0,
    completedFreights: data?.completedFreights || 0,
    loading: isLoading
  };

  // Assinatura Realtime para atualização automática em 1-2s (apenas se necessário)
  useEffect(() => {
    // Debounce do refetch para evitar múltiplas chamadas
    const debouncedRefetch = debounce(() => {
      refetch();
    }, 2000); // 2s de debounce para evitar spam

    const channel = supabase
      .channel('platform-stats-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'freights' },
        debouncedRefetch
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        debouncedRefetch
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ratings' },
        debouncedRefetch
      )
      .subscribe();

    // Cleanup ao desmontar
    return () => {
      debouncedRefetch.cancel();
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  return { 
    stats, 
    isLoading,
    refetchStats: refetch 
  };
};
