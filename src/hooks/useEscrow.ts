import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useEscrow = (onSuccess?: () => void) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const reserveEscrow = async (freightId: string, amount: number, description?: string) => {
    if (!profile?.id) return;
    if (amount <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('freight_escrow_reserve', {
        p_payer_profile_id: profile.id,
        p_freight_id: freightId,
        p_amount: amount,
        p_description: description || 'Reserva escrow de frete'
      });

      if (error) throw error;

      toast.success(`R$ ${amount.toFixed(2)} reservado para o frete`);
      onSuccess?.();
      return data;
    } catch (err: any) {
      console.error('Escrow reserve error:', err);
      const msg = err.message?.includes('Saldo insuficiente')
        ? 'Saldo insuficiente para reservar este valor'
        : (err.message || 'Erro ao reservar escrow');
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const liquidateFreight = async (freightId: string, receiverProfileId: string, description?: string) => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('freight_escrow_liquidate', {
        p_freight_id: freightId,
        p_receiver_profile_id: receiverProfileId,
        p_description: description || 'Liquidação de frete'
      });

      if (error) throw error;

      const result = data as any;
      toast.success(
        `Frete liquidado! Bruto: R$ ${result.gross_amount} | Líquido: R$ ${result.net_amount}`
      );
      onSuccess?.();
      return result;
    } catch (err: any) {
      console.error('Liquidation error:', err);
      toast.error(err.message || 'Erro ao liquidar frete');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const blockFunds = async (amount: number, reason: string, referenceType?: string, referenceId?: string) => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('wallet_block_funds', {
        p_profile_id: profile.id,
        p_amount: amount,
        p_reason: reason,
        p_reference_type: referenceType || null,
        p_reference_id: referenceId || null
      });

      if (error) throw error;

      toast.success('Fundos bloqueados com sucesso');
      onSuccess?.();
      return data;
    } catch (err: any) {
      console.error('Block funds error:', err);
      toast.error(err.message || 'Erro ao bloquear fundos');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const unblockFunds = async (amount: number, reason: string, referenceType?: string, referenceId?: string) => {
    if (!profile?.id) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('wallet_unblock_funds', {
        p_profile_id: profile.id,
        p_amount: amount,
        p_reason: reason,
        p_reference_type: referenceType || null,
        p_reference_id: referenceId || null
      });

      if (error) throw error;

      toast.success('Fundos desbloqueados com sucesso');
      onSuccess?.();
      return data;
    } catch (err: any) {
      console.error('Unblock funds error:', err);
      toast.error(err.message || 'Erro ao desbloquear fundos');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { reserveEscrow, liquidateFreight, blockFunds, unblockFunds, loading };
};
