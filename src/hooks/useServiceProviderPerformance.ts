import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ServiceProviderPerformanceData {
  providerId: string;
  providerName: string;
  totalServices: number;
  completedServices: number;
  cancelledServices: number;
  inProgressServices: number;
  averageRating: number;
  totalRatings: number;
  totalRevenue: number;
  averageServiceTime: number;
  completionRate: number;
  serviceTypeDistribution: Array<{
    type: string;
    count: number;
    revenue: number;
  }>;
  monthlyStats: Array<{
    month: string;
    services: number;
    revenue: number;
    avgRating: number;
  }>;
  recentServices: Array<{
    id: string;
    service_type: string;
    city_name: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    final_price: number | null;
    rating: number | null;
  }>;
  topCities: Array<{
    city: string;
    count: number;
    revenue: number;
  }>;
}

export const useServiceProviderPerformance = (providerId: string, startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['service-provider-performance', providerId, startDate, endDate],
    queryFn: async (): Promise<ServiceProviderPerformanceData> => {
      if (!providerId || providerId.trim() === '') {
        // Retornar dados vazios em vez de lançar erro
        return {
          providerId: '',
          providerName: 'Prestador',
          totalServices: 0,
          completedServices: 0,
          cancelledServices: 0,
          inProgressServices: 0,
          averageRating: 0,
          totalRatings: 0,
          totalRevenue: 0,
          averageServiceTime: 0,
          completionRate: 0,
          serviceTypeDistribution: [],
          monthlyStats: [],
          recentServices: [],
          topCities: []
        };
      }

      // Fetch service requests
      const { data: services, error: servicesError } = await supabase
        .from('service_requests')
        .select(`
          id,
          service_type,
          city_name,
          state,
          status,
          estimated_price,
          final_price,
          created_at,
          completed_at,
          accepted_at
        `)
        .eq('provider_id', providerId)
        .order('created_at', { ascending: false });

      if (servicesError) throw servicesError;

      // Fetch ratings for this provider's services
      const { data: ratings, error: ratingsError } = await supabase
        .from('service_ratings')
        .select('rating, comment, created_at, service_request_id')
        .in('service_request_id', services?.map(s => s.id) || []);

      if (ratingsError) throw ratingsError;

      // Fetch provider profile
      const { data: providerProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', providerId)
        .single();

      if (profileError) throw profileError;

      // Calculate stats
      const totalServices = services?.length || 0;
      const completedServices = services?.filter(s => s.status === 'COMPLETED').length || 0;
      const cancelledServices = services?.filter(s => s.status === 'CANCELLED').length || 0;
      const inProgressServices = services?.filter(s => s.status === 'ACCEPTED' || s.status === 'IN_PROGRESS').length || 0;

      const totalRevenue = services
        ?.filter(s => s.status === 'COMPLETED')
        .reduce((sum, s) => sum + (Number(s.final_price) || Number(s.estimated_price) || 0), 0) || 0;

      const averageRating = ratings?.length
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      const completionRate = totalServices > 0 ? (completedServices / totalServices) * 100 : 0;

      // Calculate average service time (from accepted to completed)
      const serviceTimes = services?.filter(s => s.completed_at && s.accepted_at).map(s => {
        const hours = (new Date(s.completed_at!).getTime() - new Date(s.accepted_at!).getTime()) / (1000 * 60 * 60);
        return hours;
      }) || [];

      const averageServiceTime = serviceTimes.length
        ? serviceTimes.reduce((sum, hours) => sum + hours, 0) / serviceTimes.length
        : 0;

      // Service type distribution
      const typeMap = new Map<string, { count: number; revenue: number }>();
      services?.forEach(s => {
        const existing = typeMap.get(s.service_type) || { count: 0, revenue: 0 };
        typeMap.set(s.service_type, {
          count: existing.count + 1,
          revenue: existing.revenue + (Number(s.final_price) || Number(s.estimated_price) || 0)
        });
      });

      const serviceTypeDistribution = Array.from(typeMap.entries())
        .map(([type, data]) => ({
          type: formatServiceType(type),
          count: data.count,
          revenue: data.revenue
        }))
        .sort((a, b) => b.count - a.count);

      // Monthly stats
      const monthlyMap = new Map<string, { services: number; revenue: number; ratings: number[] }>();
      services?.forEach(s => {
        const month = new Date(s.created_at).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' });
        const existing = monthlyMap.get(month) || { services: 0, revenue: 0, ratings: [] };
        const serviceRating = ratings?.find(r => r.service_request_id === s.id);

        monthlyMap.set(month, {
          services: existing.services + 1,
          revenue: existing.revenue + (Number(s.final_price) || Number(s.estimated_price) || 0),
          ratings: serviceRating ? [...existing.ratings, serviceRating.rating] : existing.ratings
        });
      });

      const monthlyStats = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          services: data.services,
          revenue: data.revenue,
          avgRating: data.ratings.length > 0 ? data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length : 0
        }))
        .slice(0, 12)
        .reverse();

      // Top cities
      const cityMap = new Map<string, { count: number; revenue: number }>();
      services?.forEach(s => {
        const city = s.city_name || 'Não especificada';
        const existing = cityMap.get(city) || { count: 0, revenue: 0 };
        cityMap.set(city, {
          count: existing.count + 1,
          revenue: existing.revenue + (Number(s.final_price) || Number(s.estimated_price) || 0)
        });
      });

      const topCities = Array.from(cityMap.entries())
        .map(([city, data]) => ({
          city,
          count: data.count,
          revenue: data.revenue
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Recent services
      const recentServices = services?.slice(0, 10).map(s => {
        const serviceRating = ratings?.find(r => r.service_request_id === s.id);
        return {
          id: s.id,
          service_type: formatServiceType(s.service_type),
          city_name: s.city_name || 'Não especificada',
          status: s.status,
          created_at: s.created_at,
          completed_at: s.completed_at,
          final_price: Number(s.final_price) || Number(s.estimated_price) || null,
          rating: serviceRating?.rating || null
        };
      }) || [];

      return {
        providerId,
        providerName: providerProfile?.full_name || 'Prestador',
        totalServices,
        completedServices,
        cancelledServices,
        inProgressServices,
        averageRating,
        totalRatings: ratings?.length || 0,
        totalRevenue,
        averageServiceTime,
        completionRate,
        serviceTypeDistribution,
        monthlyStats,
        recentServices,
        topCities
      };
    },
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Helper function to format service types
function formatServiceType(type: string): string {
  const typeMap: Record<string, string> = {
    'MECANICO': 'Mecânico',
    'ELETRICISTA': 'Eletricista',
    'BORRACHEIRO': 'Borracheiro',
    'GUINCHO': 'Guincho',
    'SOCORRO': 'Socorro Mecânico',
    'CHAVEIRO': 'Chaveiro',
    'FUNILARIA': 'Funilaria',
    'VIDRACEIRO': 'Vidraceiro',
    'MUDANCA': 'Mudança',
    'LAVAGEM': 'Lavagem',
    'OUTRO': 'Outro'
  };
  return typeMap[type] || type;
}
