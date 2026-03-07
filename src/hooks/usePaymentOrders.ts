import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PaymentOrder {
  id: string;
  freight_id: string | null;
  payer_profile_id: string;
  operation_owner_type: string;
  financial_owner_id: string;
  executor_id: string | null;
  gross_amount: number;
  platform_fee_amount: number;
  reserved_amount: number;
  released_amount: number;
  blocked_amount: number;
  advance_deduction: number;
  credit_deduction: number;
  net_amount: number;
  status_operational: string;
  status_financial: string;
  contestation_window_ends_at: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export interface Payout {
  id: string;
  payment_order_id: string | null;
  source_wallet_id: string;
  recipient_profile_id: string;
  recipient_wallet_id: string;
  gross_amount: number;
  credit_deduction: number;
  advance_deduction: number;
  net_amount: number;
  status: string;
  description: string | null;
  completed_at: string | null;
  created_at: string;
}

export const usePaymentOrders = () => {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const [ordersResult, payoutsResult] = await Promise.all([
        supabase.from('payment_orders').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('payouts').select('*').order('created_at', { ascending: false }).limit(50)
      ]);
      setOrders((ordersResult.data || []) as unknown as PaymentOrder[]);
      setPayouts((payoutsResult.data || []) as unknown as Payout[]);
    } catch (e) {
      console.error('Payment orders fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const escrowTotal = orders.filter(o => o.status_financial === 'paid_reserved').reduce((s, o) => s + o.reserved_amount, 0);
  const releasedTotal = orders.filter(o => o.status_financial === 'fully_released').reduce((s, o) => s + o.net_amount, 0);
  const blockedTotal = orders.filter(o => o.status_financial === 'blocked').reduce((s, o) => s + o.blocked_amount, 0);

  return {
    orders,
    payouts,
    loading,
    escrowTotal,
    releasedTotal,
    blockedTotal,
    refetch: fetchData
  };
};
