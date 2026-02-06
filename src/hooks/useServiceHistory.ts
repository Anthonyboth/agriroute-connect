/**
 * useServiceHistory.ts
 * 
 * Hook para consultar a tabela imutável service_request_history.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface ServiceHistoryItem {
  id: string;
  service_request_id: string;
  client_id: string | null;
  provider_id: string | null;
  service_type: string | null;
  status_final: string;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  city: string | null;
  state: string | null;
  estimated_price: number;
  final_price: number;
  contact_name: string | null;
  contact_phone: string | null;
  source: string;
}

interface UseServiceHistoryOptions {
  asClient?: boolean; // true = mostrar serviços solicitados, false = serviços prestados
  limit?: number;
}

export function useServiceHistory(options: UseServiceHistoryOptions = {}) {
  const { profile } = useAuth();
  const { asClient = false, limit = 100 } = options;

  const query = useQuery({
    queryKey: ['service-request-history', profile?.id, asClient, limit],
    queryFn: async () => {
      if (!profile?.id) return [];

      let q = supabase
        .from('service_request_history')
        .select('*')
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (asClient) {
        q = q.eq('client_id', profile.id);
      } else {
        q = q.eq('provider_id', profile.id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as ServiceHistoryItem[];
    },
    enabled: !!profile?.id,
    staleTime: 2 * 60 * 1000,
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
