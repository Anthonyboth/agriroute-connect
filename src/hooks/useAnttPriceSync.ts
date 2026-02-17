import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface AnttSyncResult {
  success: boolean;
  status: string;
  prices_updated: number;
  relevant_news: Array<{ title: string; date: string; url: string }>;
  freight_table_info: {
    resolution: string | null;
    last_update: string | null;
    prices: any[];
    raw_tables: string[];
  };
  last_sync: string | null;
  message: string;
  error?: string;
}

interface AnttSyncLog {
  id: string;
  synced_at: string;
  source_url: string;
  status: string;
  prices_updated: number;
  parsed_data: any;
  error_message: string | null;
  triggered_by: string;
  created_at: string;
}

export function useAnttPriceSync() {
  const queryClient = useQueryClient();

  // Fetch sync history (admin only)
  const {
    data: syncLogs,
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: ['antt-sync-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('antt_price_sync_logs')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as AnttSyncLog[];
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });

  // Fetch current ANTT prices
  const {
    data: currentPrices,
    isLoading: isLoadingPrices,
    refetch: refetchPrices,
  } = useQuery({
    queryKey: ['antt-freight-prices'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('antt_freight_prices')
        .select('*')
        .order('service_type')
        .order('distance_range_min');

      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 min
  });

  // Trigger sync mutation
  const syncMutation = useMutation({
    mutationFn: async (): Promise<AnttSyncResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { data, error } = await supabase.functions.invoke('sync-antt-prices', {
        body: { triggered_by: 'manual' },
      });

      if (error) throw error;
      return data as AnttSyncResult;
    },
    onSuccess: (result) => {
      if (result.success) {
        if (result.status === 'no_update') {
          toast.info('Nenhuma atualização nova encontrada na ANTT.');
        } else if (result.prices_updated > 0) {
          toast.success(`${result.prices_updated} preços ANTT atualizados com sucesso!`);
          queryClient.invalidateQueries({ queryKey: ['antt-freight-prices'] });
        } else if (result.relevant_news?.length > 0) {
          toast.info(`${result.relevant_news.length} notícias relevantes encontradas. Revisão manual pode ser necessária.`);
        } else {
          toast.info(result.message);
        }
      } else {
        toast.error(result.error || 'Erro ao sincronizar preços ANTT.');
      }
      queryClient.invalidateQueries({ queryKey: ['antt-sync-logs'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro na sincronização: ${error.message}`);
    },
  });

  const lastSuccessfulSync = syncLogs?.find(log => log.status === 'success');
  const lastSyncAttempt = syncLogs?.[0];

  return {
    // Actions
    triggerSync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    
    // Data
    syncLogs,
    currentPrices,
    lastSuccessfulSync,
    lastSyncAttempt,
    
    // Loading
    isLoadingLogs,
    isLoadingPrices,
    
    // Refresh
    refetchLogs,
    refetchPrices,
  };
}
