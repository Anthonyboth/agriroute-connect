import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

  return { 
    stats, 
    isLoading,
    refetchStats: refetch 
  };
};
