import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface WalletDispute {
  id: string;
  wallet_id: string;
  dispute_type: string;
  amount: number;
  status: string;
  reason: string | null;
  resolution: string | null;
  freight_id: string | null;
  opened_by: string | null;
  resolved_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export const useDisputes = () => {
  const { profile } = useAuth();
  const [disputes, setDisputes] = useState<WalletDispute[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDisputes = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wallet_disputes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching disputes:', error);
        return;
      }

      setDisputes((data || []) as unknown as WalletDispute[]);
    } catch (e) {
      console.error('Disputes fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const openDispute = async (walletId: string, disputeType: string, amount: number, reason: string, freightId?: string) => {
    if (!profile?.id) return;

    try {
      const { error } = await supabase
        .from('wallet_disputes')
        .insert({
          wallet_id: walletId,
          dispute_type: disputeType,
          amount,
          reason,
          freight_id: freightId || null,
          opened_by: profile.id
        });

      if (error) throw error;

      toast.success('Disputa aberta com sucesso');
      fetchDisputes();
    } catch (err: any) {
      console.error('Open dispute error:', err);
      toast.error(err.message || 'Erro ao abrir disputa');
    }
  };

  const openCount = disputes.filter(d => d.status === 'open' || d.status === 'under_review').length;

  return {
    disputes,
    openCount,
    loading,
    openDispute,
    refetch: fetchDisputes
  };
};
