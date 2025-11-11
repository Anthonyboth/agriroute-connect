import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyDriverPerformance {
  driverId: string;
  driverName: string;
  driverPhone: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  totalFreights: number;
  completedFreights: number;
  activeFreights: number;
  totalRevenue: number;
  averageRating: number;
  totalRatings: number;
  acceptanceRate: number;
  responseTime: number; // in hours
  onTimeRate: number;
}

export const useCompanyDriverPerformance = (companyId: string) => {
  return useQuery({
    queryKey: ['company-driver-performance', companyId],
    queryFn: async (): Promise<CompanyDriverPerformance[]> => {
      if (!companyId) {
        throw new Error('Company ID é obrigatório');
      }

      // Fetch company drivers
      const { data: companyDrivers, error: driversError } = await supabase
        .from('company_drivers')
        .select(`
          driver_profile_id,
          status,
          driver:driver_profile_id(
            id,
            full_name,
            phone,
            last_seen_at
          )
        `)
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE');

      if (driversError) throw driversError;

      if (!companyDrivers || companyDrivers.length === 0) {
        return [];
      }

      const driverIds = companyDrivers.map(cd => cd.driver_profile_id);

      // Fetch freights for all drivers
      const { data: freights, error: freightsError } = await supabase
        .from('freights')
        .select('id, driver_id, status, price, pickup_date, delivery_date, created_at')
        .in('driver_id', driverIds);

      if (freightsError) throw freightsError;

      // Fetch ratings
      const freightIds = freights?.map(f => f.id) || [];
      const { data: ratings, error: ratingsError } = await supabase
        .from('freight_ratings')
        .select('rating, freight_id')
        .in('freight_id', freightIds);

      if (ratingsError) throw ratingsError;

      // Fetch freight assignments (for acceptance rate)
      const { data: assignments, error: assignmentsError } = await supabase
        .from('freight_assignments')
        .select('driver_id, status, created_at, updated_at')
        .in('driver_id', driverIds);

      if (assignmentsError) throw assignmentsError;

      // Calculate performance for each driver
      const performance: CompanyDriverPerformance[] = companyDrivers.map(cd => {
        const driver = cd.driver as any;
        const driverId = cd.driver_profile_id;
        const driverFreights = freights?.filter(f => f.driver_id === driverId) || [];
        const driverAssignments = assignments?.filter(a => a.driver_id === driverId) || [];

        const totalFreights = driverFreights.length;
        const completedFreights = driverFreights.filter(f => 
          f.status === 'COMPLETED' || f.status === 'DELIVERED'
        ).length;
        const activeFreights = driverFreights.filter(f => 
          f.status === 'ACCEPTED' || f.status === 'IN_TRANSIT' || f.status === 'LOADING' || f.status === 'LOADED'
        ).length;

        const totalRevenue = driverFreights
          .filter(f => f.status === 'COMPLETED' || f.status === 'DELIVERED')
          .reduce((sum, f) => sum + (Number(f.price) || 0), 0);

        const driverRatings = ratings?.filter(r => 
          driverFreights.some(f => f.id === r.freight_id)
        ) || [];

        const averageRating = driverRatings.length > 0
          ? driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length
          : 0;

        // Acceptance rate
        const acceptedAssignments = driverAssignments.filter(a => a.status === 'ACCEPTED').length;
        const totalAssignments = driverAssignments.length;
        const acceptanceRate = totalAssignments > 0 ? (acceptedAssignments / totalAssignments) * 100 : 0;

        // Response time (average time from assignment to acceptance)
        const responseTimes = driverAssignments
          .filter(a => a.status === 'ACCEPTED' && a.updated_at && a.created_at)
          .map(a => {
            const hours = (new Date(a.updated_at!).getTime() - new Date(a.created_at).getTime()) / (1000 * 60 * 60);
            return hours;
          });

        const responseTime = responseTimes.length > 0
          ? responseTimes.reduce((sum, h) => sum + h, 0) / responseTimes.length
          : 0;

        // On-time rate
        const onTimeFreights = driverFreights.filter(f => {
          if (!f.delivery_date || !f.pickup_date) return false;
          const deliveryTime = new Date(f.delivery_date).getTime() - new Date(f.pickup_date).getTime();
          const expectedDays = 3; // Default expected delivery time
          return deliveryTime <= expectedDays * 24 * 60 * 60 * 1000;
        }).length;

        const onTimeRate = completedFreights > 0 ? (onTimeFreights / completedFreights) * 100 : 0;

        // Online status (last seen within 15 minutes)
        const isOnline = driver?.last_seen_at 
          ? (Date.now() - new Date(driver.last_seen_at).getTime()) < 15 * 60 * 1000
          : false;

        return {
          driverId,
          driverName: driver?.full_name || 'Motorista',
          driverPhone: driver?.phone || null,
          isOnline,
          lastSeen: driver?.last_seen_at || null,
          totalFreights,
          completedFreights,
          activeFreights,
          totalRevenue,
          averageRating,
          totalRatings: driverRatings.length,
          acceptanceRate,
          responseTime,
          onTimeRate
        };
      });

      // Sort by total revenue (descending)
      return performance.sort((a, b) => b.totalRevenue - a.totalRevenue);
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};
