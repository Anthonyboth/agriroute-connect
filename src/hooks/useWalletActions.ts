import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useWalletActions = (onSuccess?: () => void) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const deposit = async (amount: number, description?: string) => {
    if (!profile?.id) return;
    if (amount <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('wallet_deposit', {
        p_profile_id: profile.id,
        p_amount: amount,
        p_description: description || 'Depósito na carteira'
      });

      if (error) throw error;

      toast.success(`Depósito de R$ ${amount.toFixed(2)} realizado com sucesso!`);
      onSuccess?.();
      return data;
    } catch (err: any) {
      console.error('Deposit error:', err);
      toast.error(err.message || 'Erro ao realizar depósito');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const withdraw = async (amount: number, pixKey: string, pixKeyType: string, description?: string) => {
    if (!profile?.id) return;
    if (amount <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('wallet_withdraw', {
        p_profile_id: profile.id,
        p_amount: amount,
        p_pix_key: pixKey,
        p_pix_key_type: pixKeyType as any,
        p_description: description || 'Saque via Pix'
      });

      if (error) throw error;

      toast.success('Saque solicitado com sucesso! Aguarde processamento.');
      onSuccess?.();
      return data;
    } catch (err: any) {
      console.error('Withdraw error:', err);
      const msg = err.message?.includes('Saldo insuficiente') 
        ? 'Saldo insuficiente para este saque' 
        : (err.message || 'Erro ao solicitar saque');
      toast.error(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const transfer = async (toProfileId: string, amount: number, description?: string) => {
    if (!profile?.id) return;
    if (amount <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('wallet_transfer', {
        p_from_profile_id: profile.id,
        p_to_profile_id: toProfileId,
        p_amount: amount,
        p_description: description || 'Transferência interna'
      });

      if (error) throw error;

      toast.success(`Transferência de R$ ${amount.toFixed(2)} realizada!`);
      onSuccess?.();
      return data;
    } catch (err: any) {
      console.error('Transfer error:', err);
      toast.error(err.message || 'Erro ao realizar transferência');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { deposit, withdraw, transfer, loading };
};
