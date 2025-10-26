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
      // Buscar contagens em paralelo
      const [usersRes, freightsRes, weightRes, ratingsRes, driversRes, producersRes, completedRes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('freights').select('id', { count: 'exact', head: true }),
        supabase.from('freights').select('weight').eq('status', 'COMPLETED'),
        supabase.from('ratings').select('rating'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'MOTORISTA'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'PRODUTOR'),
        supabase.from('freights').select('id', { count: 'exact', head: true }).eq('status', 'COMPLETED')
      ]);

      // Calcular média de avaliações
      const ratings = ratingsRes.data || [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + (r.rating || 0), 0) / ratings.length
        : 0;

      // Calcular peso total (em kg)
      const totalWeight = (weightRes.data || []).reduce((sum, f) => sum + (f.weight || 0), 0);

      return {
        totalUsers: usersRes.count || 0,
        totalFreights: freightsRes.count || 0,
        totalWeight,
        averageRating: avgRating,
        activeDrivers: driversRes.count || 0,
        activeProducers: producersRes.count || 0,
        completedFreights: completedRes.count || 0
      };
    },
    staleTime: 15 * 60 * 1000, // 15 minutos (stats globais mudam lentamente)
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false
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
