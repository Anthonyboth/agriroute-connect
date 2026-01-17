import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompanyDriverPerformance {
  driverId: string;
  driverName: string;
  driverEmail: string | null;
  driverPhone: string | null;
  isOnline: boolean;
  lastSeen: string | null;
  totalFreights: number;
  completedFreights: number;
  cancelledFreights: number;
  activeFreights: number;
  totalRevenue: number;
  totalDistance: number;
  averageRating: number;
  totalRatings: number;
  acceptanceRate: number;
  responseTime: number; // in hours
  onTimeRate: number;
  monthlyData: { month: string; freights: number; revenue: number }[];
}

export interface CompanyPerformanceSummary {
  drivers: CompanyDriverPerformance[];
  totalDrivers: number;
  onlineDrivers: number;
  totalRevenue: number;
  totalFreights: number;
  totalCompleted: number;
  totalCancelled: number;
  totalActive: number;
  totalDistance: number;
  avgRating: number;
  avgAcceptanceRate: number;
  avgResponseTime: number;
  bestDriver: CompanyDriverPerformance | null;
  driversNeedingAttention: CompanyDriverPerformance[];
  monthlyEvolution: { month: string; freights: number; revenue: number }[];
}

export const useCompanyDriverPerformance = (companyId: string) => {
  return useQuery({
    queryKey: ['company-driver-performance', companyId],
    queryFn: async (): Promise<CompanyPerformanceSummary> => {
      if (!companyId) {
        throw new Error('Company ID é obrigatório');
      }

      // Fetch company drivers (ACTIVE or APPROVED)
      const { data: companyDrivers, error: driversError } = await supabase
        .from('company_drivers')
        .select(`
          driver_profile_id,
          status
        `)
        .eq('company_id', companyId)
        .in('status', ['ACTIVE', 'APPROVED']);

      if (driversError) throw driversError;

      const driverIdsFromAffiliations = (companyDrivers || []).map(cd => cd.driver_profile_id);

      // Fetch freights for this company
      const { data: freights, error: freightsError } = await supabase
        .from('freights')
        .select('id, driver_id, status, price, pickup_date, delivery_date, created_at, company_id, distance_km')
        .eq('company_id', companyId);

      if (freightsError) throw freightsError;

      // Unique driver ids from freights
      const driverIdsFromFreights = Array.from(new Set((freights || [])
        .map(f => f.driver_id)
        .filter((id): id is string => !!id)));

      // Union of driver ids
      const combinedDriverIds = Array.from(new Set([
        ...driverIdsFromAffiliations,
        ...driverIdsFromFreights,
      ]));

      if (combinedDriverIds.length === 0) {
        return {
          drivers: [],
          totalDrivers: 0,
          onlineDrivers: 0,
          totalRevenue: 0,
          totalFreights: 0,
          totalCompleted: 0,
          totalCancelled: 0,
          totalActive: 0,
          totalDistance: 0,
          avgRating: 0,
          avgAcceptanceRate: 0,
          avgResponseTime: 0,
          bestDriver: null,
          driversNeedingAttention: [],
          monthlyEvolution: []
        };
      }

      // Fetch basic profile info for all combined drivers
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, last_gps_update')
        .in('id', combinedDriverIds);

      if (profilesError) throw profilesError;

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      // Fetch ratings for company's freights
      // CORREÇÃO: Dividir em lotes de 50 para evitar erro HTTP 400
      const freightIds = freights?.map(f => f.id) || [];
      let ratings: any[] = [];
      const batchSize = 50;
      for (let i = 0; i < freightIds.length; i += batchSize) {
        const batch = freightIds.slice(i, i + batchSize);
        try {
          const { data: batchData } = await supabase
            .from('freight_ratings')
            .select('rating, freight_id')
            .in('freight_id', batch);
          if (batchData) ratings.push(...batchData);
        } catch (e) {
          console.warn('[useCompanyDriverPerformance] Erro ao buscar ratings batch:', e);
        }
      }

      // Fetch freight assignments restricted to this company and drivers
      const { data: assignments, error: assignmentsError } = await supabase
        .from('freight_assignments')
        .select('driver_id, status, created_at, updated_at, company_id')
        .eq('company_id', companyId)
        .in('driver_id', combinedDriverIds);

      if (assignmentsError) throw assignmentsError;

      // Calculate monthly evolution for last 12 months
      const last12Months: { month: string; freights: number; revenue: number }[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = monthDate.toISOString().slice(0, 7);
        const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
        
        const monthFreights = (freights || []).filter(f => {
          const fDate = new Date(f.created_at);
          return fDate.getFullYear() === monthDate.getFullYear() && 
                 fDate.getMonth() === monthDate.getMonth();
        });
        
        last12Months.push({
          month: monthName,
          freights: monthFreights.length,
          revenue: monthFreights
            .filter(f => f.status === 'COMPLETED' || f.status === 'DELIVERED')
            .reduce((sum, f) => sum + (Number(f.price) || 0), 0)
        });
      }

      // Calculate performance for each driver
      const performance: CompanyDriverPerformance[] = combinedDriverIds.map(driverId => {
        const driverFreights = (freights || []).filter(f => f.driver_id === driverId);
        const driverAssignments = (assignments || []).filter(a => a.driver_id === driverId);
        const driver = profileMap.get(driverId) as any;

        const totalFreights = driverFreights.length;
        const completedFreights = driverFreights.filter(f => 
          f.status === 'COMPLETED' || f.status === 'DELIVERED'
        ).length;
        const cancelledFreights = driverFreights.filter(f => 
          f.status === 'CANCELLED'
        ).length;
        const activeFreights = driverFreights.filter(f => 
          f.status === 'ACCEPTED' || f.status === 'IN_TRANSIT' || f.status === 'LOADING' || f.status === 'LOADED'
        ).length;

        const totalRevenue = driverFreights
          .filter(f => f.status === 'COMPLETED' || f.status === 'DELIVERED')
          .reduce((sum, f) => sum + (Number(f.price) || 0), 0);

        const totalDistance = driverFreights
          .filter(f => f.status === 'COMPLETED' || f.status === 'DELIVERED')
          .reduce((sum, f) => sum + (Number(f.distance_km) || 0), 0);

        const driverRatings = (ratings || []).filter(r => 
          driverFreights.some(f => f.id === r.freight_id)
        );

        const averageRating = driverRatings.length > 0
          ? driverRatings.reduce((sum, r) => sum + (Number((r as any).rating) || 0), 0) / driverRatings.length
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
          const expectedDays = 3;
          return deliveryTime <= expectedDays * 24 * 60 * 60 * 1000;
        }).length;

        const onTimeRate = completedFreights > 0 ? (onTimeFreights / completedFreights) * 100 : 0;

        // Online status (last seen within 15 minutes)
        const isOnline = driver?.last_gps_update 
          ? (Date.now() - new Date(driver.last_gps_update).getTime()) < 15 * 60 * 1000
          : false;

        // Monthly data for this driver
        const driverMonthlyData: { month: string; freights: number; revenue: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthName = monthDate.toLocaleDateString('pt-BR', { month: 'short' });
          
          const monthFreights = driverFreights.filter(f => {
            const fDate = new Date(f.created_at);
            return fDate.getFullYear() === monthDate.getFullYear() && 
                   fDate.getMonth() === monthDate.getMonth();
          });
          
          driverMonthlyData.push({
            month: monthName,
            freights: monthFreights.length,
            revenue: monthFreights
              .filter(f => f.status === 'COMPLETED' || f.status === 'DELIVERED')
              .reduce((sum, f) => sum + (Number(f.price) || 0), 0)
          });
        }

        return {
          driverId,
          driverName: driver?.full_name || 'Motorista',
          driverEmail: driver?.email || null,
          driverPhone: driver?.phone || null,
          isOnline,
          lastSeen: driver?.last_gps_update || null,
          totalFreights,
          completedFreights,
          cancelledFreights,
          activeFreights,
          totalRevenue,
          totalDistance,
          averageRating,
          totalRatings: driverRatings.length,
          acceptanceRate,
          responseTime,
          onTimeRate,
          monthlyData: driverMonthlyData
        };
      });

      // Sort by total revenue (descending)
      const sortedPerformance = performance.sort((a, b) => b.totalRevenue - a.totalRevenue);

      // Calculate summary statistics
      const totalDrivers = sortedPerformance.length;
      const onlineDrivers = sortedPerformance.filter(d => d.isOnline).length;
      const totalRevenue = sortedPerformance.reduce((sum, d) => sum + d.totalRevenue, 0);
      const totalFreightsSum = sortedPerformance.reduce((sum, d) => sum + d.totalFreights, 0);
      const totalCompleted = sortedPerformance.reduce((sum, d) => sum + d.completedFreights, 0);
      const totalCancelled = sortedPerformance.reduce((sum, d) => sum + d.cancelledFreights, 0);
      const totalActive = sortedPerformance.reduce((sum, d) => sum + d.activeFreights, 0);
      const totalDistance = sortedPerformance.reduce((sum, d) => sum + d.totalDistance, 0);
      const avgRating = totalDrivers > 0 
        ? sortedPerformance.reduce((sum, d) => sum + d.averageRating, 0) / totalDrivers 
        : 0;
      const avgAcceptanceRate = totalDrivers > 0 
        ? sortedPerformance.reduce((sum, d) => sum + d.acceptanceRate, 0) / totalDrivers 
        : 0;
      const avgResponseTime = totalDrivers > 0 
        ? sortedPerformance.reduce((sum, d) => sum + d.responseTime, 0) / totalDrivers 
        : 0;

      // Best driver by revenue (with at least 1 completed freight)
      const bestDriver = sortedPerformance.find(d => d.completedFreights > 0) || null;

      // Drivers needing attention (low rating or high cancellation)
      const driversNeedingAttention = sortedPerformance.filter(d => 
        (d.averageRating > 0 && d.averageRating < 3.5) || 
        (d.totalFreights > 0 && (d.cancelledFreights / d.totalFreights) > 0.2)
      );

      return {
        drivers: sortedPerformance,
        totalDrivers,
        onlineDrivers,
        totalRevenue,
        totalFreights: totalFreightsSum,
        totalCompleted,
        totalCancelled,
        totalActive,
        totalDistance,
        avgRating,
        avgAcceptanceRate,
        avgResponseTime,
        bestDriver,
        driversNeedingAttention,
        monthlyEvolution: last12Months
      };
    },
    enabled: !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};
