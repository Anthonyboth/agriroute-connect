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
      const { data, error } = await supabase.rpc('get_platform_stats');
      
      if (error) {
        console.error('[useOptimizedStats] Erro ao buscar stats:', error);
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;

      return {
        totalUsers: Number(row?.total_usuarios ?? 0),
        totalFreights: Number(row?.total_fretes ?? 0),
        totalWeight: Number(row?.peso_total ?? 0),
        averageRating: Number(row?.avaliacao_media ?? 0),
        activeDrivers: Number(row?.motoristas ?? 0),
        activeProducers: Number(row?.produtores ?? 0),
        completedFreights: Number(row?.fretes_entregues ?? 0)
      };
    },
    staleTime: 55 * 60 * 1000, // 55 minutos
    gcTime: 2 * 60 * 60 * 1000, // 2 horas
    refetchOnWindowFocus: true, // Atualiza ao voltar para a aba
    refetchInterval: 60 * 60 * 1000, // Atualiza automaticamente a cada 1 hora
    refetchIntervalInBackground: true // Continua atualizando mesmo em background
  });

  const stats: OptimizedStats = {
    totalUsers: data?.totalUsers || 0,
    totalFreights: data?.totalFreights || 0,
    totalWeight: data?.totalWeight || 0,
    averageRating: data?.averageRating || 0,
    activeDrivers: data?.activeDrivers || 0,
    activeProducers: data?.activeProducers || 0,
    completedFreights: data?.completedFreights || 0,
    loading: isLoading
  };

  // Assinatura Realtime para atualização automática em 1-2s
  useEffect(() => {
    console.log('[useOptimizedStats] Iniciando assinatura Realtime...');
    
    // Debounce do refetch para evitar múltiplas chamadas
    const debouncedRefetch = debounce(() => {
      console.log('[useOptimizedStats] Realtime detectou mudança, atualizando stats...');
      refetch();
    }, 1000);

    const channel = supabase
      .channel('platform-stats-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'freights' },
        () => {
          console.log('[useOptimizedStats] Mudança em freights detectada');
          debouncedRefetch();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          console.log('[useOptimizedStats] Mudança em profiles detectada');
          debouncedRefetch();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ratings' },
        () => {
          console.log('[useOptimizedStats] Mudança em ratings detectada');
          debouncedRefetch();
        }
      )
      .subscribe((status) => {
        console.log('[useOptimizedStats] Status da assinatura Realtime:', status);
      });

    // Cleanup ao desmontar
    return () => {
      console.log('[useOptimizedStats] Removendo assinatura Realtime');
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
