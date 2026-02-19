/**
 * useFreightHistory.ts
 * 
 * Hook para consultar a tabela imutável freight_history.
 * Substitui consultas diretas à tabela 'freights' para histórico.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface FreightHistoryItem {
  id: string;
  freight_id: string;
  producer_id: string | null;
  is_guest_freight: boolean;
  company_id: string | null;
  driver_id: string | null;
  required_trucks: number;
  accepted_trucks: number;
  status_final: string;
  completed_at: string | null;
  cancelled_at: string | null;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  distance_km: number;
  weight: number;
  price_total: number;
  price_per_truck: number;
  cargo_type: string | null;
  source: string;
  created_at: string;
  // Campos de confirmação (adicionados via migração)
  delivery_confirmed_at: string | null;
  delivery_confirmed_by: string | null;
  payment_confirmed_by_producer_at: string | null;
  payment_confirmed_by_driver_at: string | null;
  trip_snapshot: Record<string, any> | null;
}

export interface FreightAssignmentHistoryItem {
  id: string;
  freight_id: string;
  assignment_id: string;
  driver_id: string;
  company_id: string | null;
  status_final: string;
  completed_at: string | null;
  agreed_price: number;
  distance_km: number;
  weight_per_truck: number;
  origin_city: string | null;
  origin_state: string | null;
  destination_city: string | null;
  destination_state: string | null;
  cargo_type: string | null;
  created_at: string;
  // Campos de confirmação (adicionados via migração)
  delivery_confirmed_at: string | null;
  payment_confirmed_by_producer_at: string | null;
  payment_confirmed_by_driver_at: string | null;
  trip_snapshot: Record<string, any> | null;
}

interface UseFreightHistoryOptions {
  role?: 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA';
  companyId?: string;
  limit?: number;
}

export function useFreightHistory(options: UseFreightHistoryOptions = {}) {
  const { profile } = useAuth();
  const { role, companyId, limit = 100 } = options;

  const effectiveRole = role || (profile?.role as any) || 'MOTORISTA';

  // Query para fretes criados pelo usuário (como producer) — independente do role
  // Motoristas que criam fretes (ex: entrega de pacotes) também devem ver no histórico
  const freightHistoryQuery = useQuery({
    queryKey: ['freight-history', profile?.id, effectiveRole, companyId, limit],
    queryFn: async () => {
      if (!profile?.id) return [];

      // Produtor vê por producer_id
      // Motorista/outros também veem fretes que ELES criaram (producer_id)
      const { data, error } = await supabase
        .from('freight_history')
        .select('*')
        .eq('producer_id', profile.id)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(limit);

      if (error) throw error;
      return (data || []) as FreightHistoryItem[];
    },
    enabled: !!profile?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Query para assignments (motorista e transportadora)
  const assignmentHistoryQuery = useQuery({
    queryKey: ['freight-assignment-history', profile?.id, effectiveRole, companyId, limit],
    queryFn: async () => {
      if (!profile?.id) return [];

      if (effectiveRole === 'MOTORISTA' || effectiveRole === 'MOTORISTA_AFILIADO') {
        const { data, error } = await supabase
          .from('freight_assignment_history')
          .select('*')
          .eq('driver_id', profile.id)
          .order('completed_at', { ascending: false, nullsFirst: false })
          .limit(limit);

        if (error) throw error;
        return (data || []) as FreightAssignmentHistoryItem[];
      }

      if (effectiveRole === 'TRANSPORTADORA' && companyId) {
        const { data, error } = await supabase
          .from('freight_assignment_history')
          .select('*')
          .eq('company_id', companyId)
          .order('completed_at', { ascending: false, nullsFirst: false })
          .limit(limit);

        if (error) throw error;
        return (data || []) as FreightAssignmentHistoryItem[];
      }

      return [] as FreightAssignmentHistoryItem[];
    },
    enabled: !!profile?.id && (effectiveRole === 'MOTORISTA' || effectiveRole === 'MOTORISTA_AFILIADO' || effectiveRole === 'TRANSPORTADORA'),
    staleTime: 2 * 60 * 1000,
  });

  // Query para transportes (PET, Pacotes) do service_request_history — onde o usuário é o client_id
  const TRANSPORT_TYPES = ['TRANSPORTE_PET', 'ENTREGA_PACOTES'];
  const transportHistoryQuery = useQuery({
    queryKey: ['transport-history-as-client', profile?.id, limit],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data, error } = await supabase
        .from('service_request_history')
        .select('*')
        .eq('client_id', profile.id)
        .in('service_type', TRANSPORT_TYPES)
        .order('completed_at', { ascending: false, nullsFirst: false })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id,
    staleTime: 2 * 60 * 1000,
  });

  return {
    freightHistory: freightHistoryQuery.data || [],
    assignmentHistory: assignmentHistoryQuery.data || [],
    transportHistory: transportHistoryQuery.data || [],
    isLoading: freightHistoryQuery.isLoading || assignmentHistoryQuery.isLoading || transportHistoryQuery.isLoading,
    isError: freightHistoryQuery.isError || assignmentHistoryQuery.isError || transportHistoryQuery.isError,
    error: freightHistoryQuery.error || assignmentHistoryQuery.error || transportHistoryQuery.error,
    refetch: () => {
      freightHistoryQuery.refetch();
      assignmentHistoryQuery.refetch();
      transportHistoryQuery.refetch();
    },
  };
}
