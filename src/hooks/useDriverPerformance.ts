import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DriverPerformanceData {
  driverId: string;
  driverName: string;
  totalFreights: number;
  completedFreights: number;
  cancelledFreights: number;
  onTimeFreights: number;
  averageRating: number;
  totalRatings: number;
  totalRevenue: number;
  averageDeliveryTime: number;
  completionRate: number;
  onTimeRate: number;
  topRoutes: Array<{
    origin: string;
    destination: string;
    count: number;
    totalRevenue: number;
  }>;
  monthlyStats: Array<{
    month: string;
    freights: number;
    revenue: number;
    avgRating: number;
  }>;
  recentDeliveries: Array<{
    id: string;
    cargo_type: string;
    origin_city: string;
    destination_city: string;
    status: string;
    pickup_date: string;
    delivery_date: string | null;
    price: number;
    rating: number | null;
  }>;
}

export const useDriverPerformance = (driverId: string, startDate?: Date, endDate?: Date) => {
  return useQuery({
    queryKey: ['driver-performance', driverId, startDate, endDate],
    queryFn: async (): Promise<DriverPerformanceData> => {
      if (!driverId) {
        throw new Error('Driver ID é obrigatório');
      }

      // Build date filter
      let dateFilter = '';
      if (startDate && endDate) {
        dateFilter = `and(created_at.gte.${startDate.toISOString()},created_at.lte.${endDate.toISOString()})`;
      } else if (startDate) {
        dateFilter = `created_at.gte.${startDate.toISOString()}`;
      } else if (endDate) {
        dateFilter = `created_at.lte.${endDate.toISOString()}`;
      }

      // Fetch freights
      const { data: freights, error: freightsError } = await supabase
        .from('freights')
        .select(`
          id,
          cargo_type,
          origin_city,
          origin_state,
          destination_city,
          destination_state,
          status,
          pickup_date,
          delivery_date,
          price,
          created_at,
          updated_at
        `)
        .eq('driver_id', driverId)
        .order('created_at', { ascending: false });

      if (freightsError) throw freightsError;

      // Fetch ratings
      const { data: ratings, error: ratingsError } = await supabase
        .from('freight_ratings')
        .select('rating, comment, created_at, freight_id')
        .in('freight_id', freights?.map(f => f.id) || []);

      if (ratingsError) throw ratingsError;

      // Fetch driver profile
      const { data: driverProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', driverId)
        .single();

      if (profileError) throw profileError;

      // Calculate stats
      const totalFreights = freights?.length || 0;
      const completedFreights = freights?.filter(f => f.status === 'COMPLETED' || f.status === 'DELIVERED').length || 0;
      const cancelledFreights = freights?.filter(f => f.status === 'CANCELLED').length || 0;
      
      const totalRevenue = freights
        ?.filter(f => f.status === 'COMPLETED' || f.status === 'DELIVERED')
        .reduce((sum, f) => sum + (Number(f.price) || 0), 0) || 0;

      const averageRating = ratings?.length 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0;

      const completionRate = totalFreights > 0 ? (completedFreights / totalFreights) * 100 : 0;

      // Calculate on-time deliveries
      const onTimeFreights = freights?.filter(f => {
        if (!f.delivery_date || !f.pickup_date) return false;
        const deliveryTime = new Date(f.delivery_date).getTime() - new Date(f.pickup_date).getTime();
        const expectedDays = 3; // Default expected delivery time
        return deliveryTime <= expectedDays * 24 * 60 * 60 * 1000;
      }).length || 0;

      const onTimeRate = completedFreights > 0 ? (onTimeFreights / completedFreights) * 100 : 0;

      // Calculate average delivery time
      const deliveryTimes = freights?.filter(f => f.delivery_date && f.pickup_date).map(f => {
        const days = (new Date(f.delivery_date!).getTime() - new Date(f.pickup_date).getTime()) / (1000 * 60 * 60 * 24);
        return days;
      }) || [];
      
      const averageDeliveryTime = deliveryTimes.length 
        ? deliveryTimes.reduce((sum, days) => sum + days, 0) / deliveryTimes.length 
        : 0;

      // Top routes
      const routeMap = new Map<string, { count: number; totalRevenue: number; origin: string; destination: string }>();
      freights?.forEach(f => {
        const key = `${f.origin_city}|${f.origin_state}-${f.destination_city}|${f.destination_state}`;
        const existing = routeMap.get(key) || { count: 0, totalRevenue: 0, origin: `${f.origin_city}, ${f.origin_state}`, destination: `${f.destination_city}, ${f.destination_state}` };
        routeMap.set(key, {
          ...existing,
          count: existing.count + 1,
          totalRevenue: existing.totalRevenue + (Number(f.price) || 0)
        });
      });

      const topRoutes = Array.from(routeMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Monthly stats
      const monthlyMap = new Map<string, { freights: number; revenue: number; ratings: number[]; }>();
      freights?.forEach(f => {
        const month = new Date(f.created_at).toLocaleDateString('pt-BR', { year: 'numeric', month: 'short' });
        const existing = monthlyMap.get(month) || { freights: 0, revenue: 0, ratings: [] };
        const freightRating = ratings?.find(r => r.freight_id === f.id);
        
        monthlyMap.set(month, {
          freights: existing.freights + 1,
          revenue: existing.revenue + (Number(f.price) || 0),
          ratings: freightRating ? [...existing.ratings, freightRating.rating] : existing.ratings
        });
      });

      const monthlyStats = Array.from(monthlyMap.entries())
        .map(([month, data]) => ({
          month,
          freights: data.freights,
          revenue: data.revenue,
          avgRating: data.ratings.length > 0 ? data.ratings.reduce((sum, r) => sum + r, 0) / data.ratings.length : 0
        }))
        .slice(0, 12)
        .reverse();

      // Recent deliveries
      const recentDeliveries = freights?.slice(0, 10).map(f => {
        const freightRating = ratings?.find(r => r.freight_id === f.id);
        return {
          id: f.id,
          cargo_type: f.cargo_type,
          origin_city: f.origin_city,
          destination_city: f.destination_city,
          status: f.status,
          pickup_date: f.pickup_date,
          delivery_date: f.delivery_date,
          price: Number(f.price) || 0,
          rating: freightRating?.rating || null
        };
      }) || [];

      return {
        driverId,
        driverName: driverProfile?.full_name || 'Motorista',
        totalFreights,
        completedFreights,
        cancelledFreights,
        onTimeFreights,
        averageRating,
        totalRatings: ratings?.length || 0,
        totalRevenue,
        averageDeliveryTime,
        completionRate,
        onTimeRate,
        topRoutes,
        monthlyStats,
        recentDeliveries
      };
    },
    enabled: !!driverId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
