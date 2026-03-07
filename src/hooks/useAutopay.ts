import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface AutopaySettings {
  id: string;
  profile_id: string;
  enabled: boolean;
  max_auto_deduct_percent: number;
  pay_credit_installments: boolean;
  pay_platform_fees: boolean;
  created_at: string;
  updated_at: string;
}

export interface AutopayLog {
  id: string;
  profile_id: string;
  installment_id: string | null;
  amount: number;
  source_transaction_id: string | null;
  deduction_type: string;
  status: string;
  created_at: string;
}

export const useAutopay = () => {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<AutopaySettings | null>(null);
  const [logs, setLogs] = useState<AutopayLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.id) return;
    try {
      setLoading(true);
      const [settingsRes, logsRes] = await Promise.all([
        supabase.from('autopay_settings').select('*').eq('profile_id', profile.id).maybeSingle(),
        supabase.from('autopay_logs').select('*').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(20),
      ]);
      setSettings(settingsRes.data as unknown as AutopaySettings | null);
      setLogs((logsRes.data || []) as unknown as AutopayLog[]);
    } catch (e) {
      console.error('Autopay fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const toggleAutopay = useCallback(async (enabled: boolean) => {
    if (!profile?.id) return;
    try {
      const { error } = await supabase.from('autopay_settings').upsert({
        profile_id: profile.id,
        enabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' });
      if (error) throw error;
      await fetchData();
    } catch (e) {
      console.error('Toggle autopay error:', e);
      throw e;
    }
  }, [profile?.id, fetchData]);

  const updateSettings = useCallback(async (updates: Partial<AutopaySettings>) => {
    if (!profile?.id) return;
    try {
      const { error } = await supabase.from('autopay_settings').upsert({
        profile_id: profile.id,
        ...updates,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'profile_id' });
      if (error) throw error;
      await fetchData();
    } catch (e) {
      console.error('Update autopay error:', e);
      throw e;
    }
  }, [profile?.id, fetchData]);

  return {
    settings,
    logs,
    loading,
    toggleAutopay,
    updateSettings,
    refetch: fetchData,
  };
};
