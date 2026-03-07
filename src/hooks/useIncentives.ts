import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface IncentiveCampaign {
  id: string;
  name: string;
  description: string | null;
  incentive_type: string;
  bonus_amount: number;
  bonus_type: string;
  required_count: number;
  target_region_city_id: string | null;
  target_region_name: string | null;
  time_slot_start: string | null;
  time_slot_end: string | null;
  min_trust_score: number | null;
  total_budget: number;
  spent_budget: number;
  max_claims_per_driver: number;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

export interface BonusProgress {
  id: string;
  campaign_id: string;
  driver_profile_id: string;
  current_count: number;
  required_count: number;
  is_completed: boolean;
  is_claimed: boolean;
  bonus_amount: number;
  completed_at: string | null;
  claimed_at: string | null;
  freight_ids: string[];
}

export interface IncentiveWithProgress {
  campaign: IncentiveCampaign;
  progress: BonusProgress | null;
}

export const useIncentives = () => {
  const { profile } = useAuth();
  const [campaigns, setCampaigns] = useState<IncentiveCampaign[]>([]);
  const [progress, setProgress] = useState<BonusProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      const [campaignsRes, progressRes] = await Promise.all([
        supabase
          .from('incentive_campaigns')
          .select('*')
          .eq('is_active', true)
          .order('bonus_amount', { ascending: false }),
        supabase
          .from('driver_bonus_progress')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);

      setCampaigns((campaignsRes.data || []) as unknown as IncentiveCampaign[]);
      setProgress((progressRes.data || []) as unknown as BonusProgress[]);
    } catch (e) {
      console.error('Incentives fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Merge campaigns with driver progress
  const incentivesWithProgress: IncentiveWithProgress[] = campaigns
    .filter(c => c.spent_budget < c.total_budget) // budget remaining
    .map(campaign => ({
      campaign,
      progress: progress.find(p => p.campaign_id === campaign.id) || null,
    }));

  const activeBonuses = incentivesWithProgress.filter(
    i => !i.progress?.is_claimed
  );

  const completedUnclaimed = incentivesWithProgress.filter(
    i => i.progress?.is_completed && !i.progress?.is_claimed
  );

  const totalUnclaimedBonus = completedUnclaimed.reduce(
    (s, i) => s + (i.progress?.bonus_amount || i.campaign.bonus_amount),
    0
  );

  return {
    campaigns,
    progress,
    incentivesWithProgress,
    activeBonuses,
    completedUnclaimed,
    totalUnclaimedBonus,
    loading,
    refetch: fetchData,
  };
};
