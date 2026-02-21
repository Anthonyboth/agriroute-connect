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
  includeTransportTypes?: boolean; // true = incluir PET/Pacotes/Guincho (aba "Fretes Urbanos")
  limit?: number;
}

export function useServiceHistory(options: UseServiceHistoryOptions = {}) {
  const { profile } = useAuth();
  const { asClient = false, includeTransportTypes = false, limit = 100 } = options;

  // Tipos de transporte urbano (tratados como "Fretes Urbanos")
  const TRANSPORT_TYPES = ['TRANSPORTE_PET', 'ENTREGA_PACOTES', 'GUINCHO'];

  const query = useQuery({
    queryKey: ['service-request-history', profile?.id, asClient, includeTransportTypes, limit],
    queryFn: async () => {
      if (!profile?.id) return [];

      let q = supabase
        .from('service_request_history')
        .select('*');

      // Se includeTransportTypes = true, mostrar APENAS tipos de transporte urbano
      // Se false, excluir tipos de transporte (mostrar apenas serviços técnicos)
      if (includeTransportTypes) {
        q = q.in('service_type', TRANSPORT_TYPES);
      } else {
        q = q.not('service_type', 'in', `(${TRANSPORT_TYPES.join(',')})`);
      }

      q = q.order('completed_at', { ascending: false, nullsFirst: false })
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
