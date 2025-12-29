import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'milestone' | 'performance' | 'special' | 'seasonal';
  xp_reward: number;
  requirement_type: string;
  requirement_value: number;
  earned_at?: string;
  is_earned: boolean;
}

export interface DriverLevel {
  level: number;
  current_xp: number;
  total_xp: number;
  xp_to_next_level: number;
  progress_percentage: number;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  reward_type: 'discount' | 'priority' | 'badge' | 'cash';
  value: number | null;
  required_level: number;
  required_xp: number;
  is_available: boolean;
  is_redeemed: boolean;
}

// XP required per level (exponential growth)
const XP_PER_LEVEL = [0, 100, 250, 500, 1000, 2000, 3500, 5500, 8000, 12000, 18000];

export const useDriverGamification = (driverId?: string) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  const effectiveDriverId = driverId || profile?.id;

  // Fetch all badge types with earned status
  const { data: badges, isLoading: loadingBadges } = useQuery({
    queryKey: ['driver-badges', effectiveDriverId],
    queryFn: async () => {
      if (!effectiveDriverId) return [];

      // Get all badge types
      const { data: badgeTypes, error: typesError } = await supabase
        .from('badge_types')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (typesError) throw typesError;

      // Get earned badges for this driver
      const { data: earnedBadges, error: earnedError } = await supabase
        .from('driver_badges')
        .select('badge_type_id, earned_at')
        .eq('driver_id', effectiveDriverId);

      if (earnedError) throw earnedError;

      const earnedMap = new Map(earnedBadges?.map(b => [b.badge_type_id, b.earned_at]));

      return (badgeTypes || []).map(badge => ({
        ...badge,
        earned_at: earnedMap.get(badge.id),
        is_earned: earnedMap.has(badge.id),
      })) as Badge[];
    },
    enabled: !!effectiveDriverId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch driver level
  const { data: levelData, isLoading: loadingLevel } = useQuery({
    queryKey: ['driver-level', effectiveDriverId],
    queryFn: async () => {
      if (!effectiveDriverId) return null;

      const { data, error } = await supabase
        .from('driver_levels')
        .select('*')
        .eq('driver_id', effectiveDriverId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;

      // If no level record, return default
      if (!data) {
        return {
          level: 1,
          current_xp: 0,
          total_xp: 0,
          xp_to_next_level: XP_PER_LEVEL[1] || 100,
          progress_percentage: 0,
        } as DriverLevel;
      }

      const currentLevelXP = XP_PER_LEVEL[data.level - 1] || 0;
      const nextLevelXP = XP_PER_LEVEL[data.level] || XP_PER_LEVEL[XP_PER_LEVEL.length - 1];
      const xpInCurrentLevel = data.total_xp - currentLevelXP;
      const xpNeeded = nextLevelXP - currentLevelXP;

      return {
        level: data.level,
        current_xp: data.current_xp,
        total_xp: data.total_xp,
        xp_to_next_level: nextLevelXP - data.total_xp,
        progress_percentage: Math.min(100, (xpInCurrentLevel / xpNeeded) * 100),
      } as DriverLevel;
    },
    enabled: !!effectiveDriverId,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch rewards
  const { data: rewards, isLoading: loadingRewards } = useQuery({
    queryKey: ['driver-rewards', effectiveDriverId],
    queryFn: async () => {
      if (!effectiveDriverId) return [];

      // Get all active rewards
      const { data: allRewards, error: rewardsError } = await supabase
        .from('rewards')
        .select('*')
        .eq('is_active', true)
        .order('required_level', { ascending: true });

      if (rewardsError) throw rewardsError;

      // Get redeemed rewards
      const { data: redeemed, error: redeemedError } = await supabase
        .from('driver_rewards')
        .select('reward_id')
        .eq('driver_id', effectiveDriverId);

      if (redeemedError) throw redeemedError;

      const redeemedSet = new Set(redeemed?.map(r => r.reward_id));
      const driverLevel = levelData?.level || 1;
      const driverXP = levelData?.total_xp || 0;

      return (allRewards || []).map(reward => ({
        ...reward,
        is_available: driverLevel >= reward.required_level && driverXP >= reward.required_xp,
        is_redeemed: redeemedSet.has(reward.id),
      })) as Reward[];
    },
    enabled: !!effectiveDriverId && !!levelData,
    staleTime: 5 * 60 * 1000,
  });

  // Mutation to redeem a reward
  const redeemReward = useMutation({
    mutationFn: async (rewardId: string) => {
      if (!effectiveDriverId) throw new Error('Driver ID not found');

      const { data, error } = await supabase
        .from('driver_rewards')
        .insert({
          driver_id: effectiveDriverId,
          reward_id: rewardId,
          status: 'pending',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Recompensa resgatada com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['driver-rewards', effectiveDriverId] });
    },
    onError: (error) => {
      console.error('[useDriverGamification] Error redeeming reward:', error);
      toast.error('Erro ao resgatar recompensa');
    },
  });

  // Stats
  const earnedBadgesCount = badges?.filter(b => b.is_earned).length || 0;
  const totalBadgesCount = badges?.length || 0;
  const availableRewardsCount = rewards?.filter(r => r.is_available && !r.is_redeemed).length || 0;

  return {
    // Data
    badges: badges || [],
    levelData: levelData || { level: 1, current_xp: 0, total_xp: 0, xp_to_next_level: 100, progress_percentage: 0 },
    rewards: rewards || [],
    
    // Stats
    earnedBadgesCount,
    totalBadgesCount,
    availableRewardsCount,
    
    // Loading states
    isLoading: loadingBadges || loadingLevel || loadingRewards,
    
    // Actions
    redeemReward: redeemReward.mutate,
    isRedeeming: redeemReward.isPending,
  };
};
