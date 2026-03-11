import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface WalletData {
  id: string;
  profile_id: string;
  wallet_type: string;
  available_balance: number;
  pending_balance: number;
  reserved_balance: number;
  blocked_balance: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface LedgerEntry {
  id: string;
  wallet_id: string;
  entry_type: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  reference_type: string | null;
  reference_id: string | null;
  description: string | null;
  metadata: any;
  created_at: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  transaction_type: string;
  amount: number;
  status: string;
  pix_key: string | null;
  pix_key_type: string | null;
  description: string | null;
  metadata: any;
  created_by: string | null;
  approved_by: string | null;
  created_at: string;
  completed_at: string | null;
}

export const useWallet = () => {
  const { profile } = useAuth();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    if (!profile?.id) return;
    
    try {
      setLoading(true);
      
      // Ensure wallet exists via RPC
      const { data: walletId, error: ensureErr } = await supabase
        .rpc('ensure_wallet_exists', { p_profile_id: profile.id });
      
      if (ensureErr) {
        console.error('Error ensuring wallet:', ensureErr);
        setError('Erro ao carregar carteira');
        return;
      }

      // Fetch wallet data
      const { data: walletData, error: walletErr } = await supabase
        .from('wallets')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (walletErr) {
        console.error('Error fetching wallet:', walletErr);
        setError('Erro ao carregar carteira');
        return;
      }

      setWallet(walletData as unknown as WalletData);
      setError(null);
    } catch (e) {
      console.error('Wallet fetch error:', e);
      setError('Erro ao carregar carteira');
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const fetchTransactions = useCallback(async (filter?: string) => {
    if (!profile?.id) return;

    try {
      let query = supabase
        .from('wallet_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (filter && filter !== 'all') {
        query = query.eq('transaction_type', filter as any);
      }

      const { data, error: txErr } = await query;

      if (txErr) {
        console.error('Error fetching transactions:', txErr);
        return;
      }

      setTransactions((data || []) as unknown as WalletTransaction[]);
    } catch (e) {
      console.error('Transaction fetch error:', e);
    }
  }, [profile?.id]);

  const fetchLedger = useCallback(async () => {
    if (!profile?.id) return;

    try {
      const { data, error: ledgerErr } = await supabase
        .from('ledger_entries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (ledgerErr) {
        console.error('Error fetching ledger:', ledgerErr);
        return;
      }

      setLedgerEntries((data || []) as unknown as LedgerEntry[]);
    } catch (e) {
      console.error('Ledger fetch error:', e);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchWallet();
    fetchTransactions();
  }, [fetchWallet, fetchTransactions]);

  const totalBalance = wallet 
    ? wallet.available_balance + wallet.pending_balance + wallet.reserved_balance + wallet.blocked_balance
    : 0;

  return {
    wallet,
    transactions,
    ledgerEntries,
    loading,
    error,
    totalBalance,
    fetchWallet,
    fetchTransactions,
    fetchLedger,
    refetch: () => {
      fetchWallet();
      fetchTransactions();
    }
  };
};
