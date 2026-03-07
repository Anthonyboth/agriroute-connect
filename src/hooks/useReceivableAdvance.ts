import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface FreightReceivable {
  id: string;
  freight_id: string;
  owner_wallet_id: string;
  owner_type: string;
  total_amount: number;
  committed_amount: number;
  liquidated_amount: number;
  status: string;
  created_at: string;
}

export interface ReceivableAdvance {
  id: string;
  wallet_id: string;
  total_requested: number;
  fee_amount: number;
  net_amount: number;
  status: string;
  approved_by: string | null;
  created_at: string;
}

export const useReceivableAdvance = () => {
  const { profile } = useAuth();
  const [receivables, setReceivables] = useState<FreightReceivable[]>([]);
  const [advances, setAdvances] = useState<ReceivableAdvance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      const [recvResult, advResult] = await Promise.all([
        supabase.from('freight_receivables').select('*').order('created_at', { ascending: false }),
        supabase.from('receivable_advances').select('*').order('created_at', { ascending: false })
      ]);

      setReceivables((recvResult.data || []) as unknown as FreightReceivable[]);
      setAdvances((advResult.data || []) as unknown as ReceivableAdvance[]);
    } catch (e) {
      console.error('Receivable advance fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const eligibleReceivables = receivables.filter(r => r.status === 'eligible' || r.status === 'partially_committed');
  const totalEligible = eligibleReceivables.reduce((sum, r) => sum + (r.total_amount - r.committed_amount), 0);

  return {
    receivables,
    advances,
    eligibleReceivables,
    totalEligible,
    loading,
    refetch: fetchData
  };
};
