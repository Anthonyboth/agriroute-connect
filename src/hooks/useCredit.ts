import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface CreditAccount {
  id: string;
  wallet_id: string;
  profile_id: string;
  credit_limit: number;
  used_amount: number;
  available_limit: number;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface CreditInstallment {
  id: string;
  credit_transaction_id: string;
  installment_number: number;
  amount: number;
  due_date: string;
  paid_amount: number;
  paid_at: string | null;
  status: string;
}

export const useCredit = () => {
  const { profile } = useAuth();
  const [creditAccount, setCreditAccount] = useState<CreditAccount | null>(null);
  const [installments, setInstallments] = useState<CreditInstallment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCredit = useCallback(async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('credit_accounts')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching credit:', error);
        return;
      }

      setCreditAccount(data as unknown as CreditAccount | null);

      // Fetch installments if credit account exists
      if (data) {
        const { data: installData } = await supabase
          .from('credit_installments')
          .select('*')
          .order('due_date', { ascending: true });

        setInstallments((installData || []) as unknown as CreditInstallment[]);
      }
    } catch (e) {
      console.error('Credit fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchCredit();
  }, [fetchCredit]);

  const pendingInstallments = installments.filter(i => i.status === 'pending' || i.status === 'overdue');
  const totalPending = pendingInstallments.reduce((sum, i) => sum + (i.amount - i.paid_amount), 0);

  return {
    creditAccount,
    installments,
    pendingInstallments,
    totalPending,
    loading,
    refetch: fetchCredit
  };
};
