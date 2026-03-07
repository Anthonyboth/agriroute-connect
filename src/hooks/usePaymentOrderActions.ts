import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const usePaymentOrderActions = (onSuccess?: () => void) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const createPaymentOrder = async (
    freightId: string,
    operationOwnerType: string,
    financialOwnerId: string,
    executorId: string,
    grossAmount: number,
    platformFeePct: number = 5.0
  ) => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('create_payment_order', {
        p_freight_id: freightId,
        p_payer_profile_id: profile.id,
        p_operation_owner_type: operationOwnerType,
        p_financial_owner_id: financialOwnerId,
        p_executor_id: executorId,
        p_gross_amount: grossAmount,
        p_platform_fee_pct: platformFeePct
      });
      if (error) throw error;
      toast.success(`Pagamento de R$ ${grossAmount.toFixed(2)} reservado em escrow`);
      onSuccess?.();
      return data;
    } catch (err: any) {
      console.error('Create payment order error:', err);
      const msg = err.message?.includes('Saldo insuficiente')
        ? 'Saldo insuficiente para este pagamento'
        : (err.message || 'Erro ao criar ordem de pagamento');
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const executeFreightSplit = async (paymentOrderId: string) => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('execute_freight_split', {
        p_payment_order_id: paymentOrderId
      });
      if (error) throw error;
      const result = data as any;
      toast.success(`Split executado! Líquido: R$ ${result.net?.toFixed(2)}`);
      onSuccess?.();
      return result;
    } catch (err: any) {
      console.error('Execute split error:', err);
      toast.error(err.message || 'Erro ao executar split');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const createDriverPayout = async (
    driverProfileId: string,
    amount: number,
    paymentOrderId?: string,
    description?: string
  ) => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('create_driver_payout', {
        p_carrier_profile_id: profile.id,
        p_driver_profile_id: driverProfileId,
        p_amount: amount,
        p_payment_order_id: paymentOrderId || null,
        p_description: description || 'Repasse ao motorista'
      });
      if (error) throw error;
      toast.success(`Repasse de R$ ${amount.toFixed(2)} realizado!`);
      onSuccess?.();
      return data;
    } catch (err: any) {
      console.error('Create payout error:', err);
      toast.error(err.message || 'Erro ao realizar repasse');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createPaymentOrder, executeFreightSplit, createDriverPayout, loading };
};
