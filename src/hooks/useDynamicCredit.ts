import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useReceivableAdvance } from './useReceivableAdvance';

export interface DynamicCreditLimit {
  id: string;
  profile_id: string;
  receivables_total: number;
  dynamic_limit: number;
  utilization_percent: number;
  locked_receivable_ids: string[];
  status: string;
  last_calculated_at: string;
}

export const useDynamicCredit = () => {
  const { profile } = useAuth();
  const { totalEligible, eligibleReceivables } = useReceivableAdvance();
  const [dynamicCredit, setDynamicCredit] = useState<DynamicCreditLimit | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDynamicCredit = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dynamic_credit_limits')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();
      if (error) throw error;
      setDynamicCredit(data as unknown as DynamicCreditLimit | null);
    } catch (e) {
      console.error('Dynamic credit fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  // Recalculate dynamic limit based on current receivables
  const recalculate = useCallback(async () => {
    if (!profile?.id) return;
    const utilizationPercent = dynamicCredit?.utilization_percent || 50;
    const dynamicLimit = totalEligible * (utilizationPercent / 100);

    try {
      const { error } = await supabase.from('dynamic_credit_limits').upsert({
        profile_id: profile.id,
        receivables_total: totalEligible,
        dynamic_limit: dynamicLimit,
        utilization_percent: utilizationPercent,
        locked_receivable_ids: eligibleReceivables.map(r => r.id),
        status: totalEligible > 0 ? 'active' : 'suspended',
        last_calculated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' });
      if (error) throw error;
      await fetchDynamicCredit();
    } catch (e) {
      console.error('Recalculate dynamic credit error:', e);
    }
  }, [profile?.id, totalEligible, eligibleReceivables, dynamicCredit?.utilization_percent, fetchDynamicCredit]);

  useEffect(() => { fetchDynamicCredit(); }, [fetchDynamicCredit]);

  // Auto-recalculate when receivables change
  useEffect(() => {
    if (profile?.id && totalEligible >= 0) {
      recalculate();
    }
  }, [totalEligible]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculatedLimit = useMemo(() => {
    const pct = dynamicCredit?.utilization_percent || 50;
    return totalEligible * (pct / 100);
  }, [totalEligible, dynamicCredit?.utilization_percent]);

  return {
    dynamicCredit,
    calculatedLimit,
    receivablesTotal: totalEligible,
    receivablesCount: eligibleReceivables.length,
    loading,
    recalculate,
    refetch: fetchDynamicCredit,
  };
};
