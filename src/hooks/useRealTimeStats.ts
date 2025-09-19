import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOptimizedStats } from './useOptimizedStats';

interface RealTimeStats {
  totalUsers: number;
  totalFreights: number;
  averageRating: number;
  activeDrivers: number;
  activeProducers: number;
  completedFreights: number;
  loading: boolean;
}

export const useRealTimeStats = () => {
  // Use the new optimized hook instead
  const { stats: optimizedStats, refetchStats } = useOptimizedStats();
  
  // Convert to legacy format for backward compatibility
  const stats: RealTimeStats = {
    totalUsers: optimizedStats.totalUsers,
    totalFreights: optimizedStats.totalFreights,
    averageRating: optimizedStats.averageRating,
    activeDrivers: optimizedStats.activeDrivers,
    activeProducers: optimizedStats.activeProducers,
    completedFreights: optimizedStats.completedFreights,
    loading: optimizedStats.loading
  };

  return { stats, refetchStats };
};