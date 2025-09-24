import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BalanceData {
  available_balance: number;
  pending_balance: number;
  total_earned: number;
  last_payout_at?: string;
  recent_transactions?: Array<{
    id: string;
    transaction_type: string;
    amount: number;
    balance_before: number;
    balance_after: number;
    status: string;
    description: string;
    created_at: string;
    metadata: any;
  }>;
}

export const useProviderBalance = () => {
  const [balance, setBalance] = useState<BalanceData>({
    available_balance: 0,
    pending_balance: 0,
    total_earned: 0,
    recent_transactions: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchBalance = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase.functions.invoke('get-provider-balance');
      
      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setBalance(data);
    } catch (err) {
      console.error('Error fetching provider balance:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar saldo');
    } finally {
      setLoading(false);
    }
  };

  const requestPayout = async (amount: number, pixKey: string, description?: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('request-provider-payout', {
        body: { amount, pix_key: pixKey, description }
      });
      
      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: "Saque Solicitado!",
        description: "Sua solicitação foi enviada e será processada em até 2 dias úteis.",
      });

      // Recarregar saldo após solicitação
      await fetchBalance();
      
      return data;
    } catch (err) {
      console.error('Error requesting payout:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao solicitar saque';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
  }, []);

  // Recarregar saldo a cada 30 segundos para detectar atualizações do Stripe
  useEffect(() => {
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  return {
    balance,
    loading,
    error,
    fetchBalance,
    requestPayout,
    // Valores formatados para exibição
    availableBalance: balance.available_balance,
    pendingBalance: balance.pending_balance,
    totalEarned: balance.total_earned,
    recentTransactions: balance.recent_transactions || []
  };
};