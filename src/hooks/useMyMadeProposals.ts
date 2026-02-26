/**
 * useMyMadeProposals.ts
 * 
 * Hook para buscar propostas FEITAS pelo usuário atual em fretes de terceiros.
 * Complementa o FreightProposalsManager que mostra propostas RECEBIDAS.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MadeProposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  proposal_unit_price?: number | null;
  proposal_pricing_type?: string | null;
  message?: string;
  status: string;
  created_at: string;
  freight?: {
    id: string;
    cargo_type: string;
    origin_city: string | null;
    origin_state: string | null;
    origin_address?: string | null;
    destination_city: string | null;
    destination_state: string | null;
    destination_address?: string | null;
    price: number;
    distance_km: number;
    weight: number;
    status: string;
    pricing_type?: string;
    required_trucks?: number;
    accepted_trucks?: number;
    service_type?: string;
    producer_id?: string;
  };
  freight_owner?: {
    full_name: string;
  };
}

interface UseMyMadeProposalsOptions {
  userId?: string;
  /** For company dashboards: fetch proposals made by these driver IDs */
  driverIds?: string[];
  enabled?: boolean;
}

export function useMyMadeProposals({ userId, driverIds, enabled = true }: UseMyMadeProposalsOptions) {
  const [proposals, setProposals] = useState<MadeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchInFlightRef = useRef(false);

  const ids = driverIds || (userId ? [userId] : []);

  const fetchProposals = useCallback(async () => {
    if (!enabled || ids.length === 0) {
      setProposals([]);
      setLoading(false);
      return;
    }

    if (fetchInFlightRef.current) return;
    fetchInFlightRef.current = true;

    try {
      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(
            id, cargo_type, origin_city, origin_state, origin_address,
            destination_city, destination_state, destination_address, price,
            distance_km, weight, status, pricing_type,
            required_trucks, accepted_trucks, service_type, producer_id
          ),
          freight_owner:freights!freight_proposals_freight_id_fkey(
            producer:profiles_secure!freights_producer_id_fkey(full_name)
          )
        `)
        .in('driver_id', ids)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (data || []).map((p: any) => ({
        ...p,
        freight_owner: {
          full_name: p.freight_owner?.producer?.full_name || 'Proprietário',
        },
      }));

      setProposals(mapped);
    } catch (err) {
      console.error('Error fetching made proposals:', err);
    } finally {
      setLoading(false);
      fetchInFlightRef.current = false;
    }
  }, [enabled, ids.join(',')]);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  // Realtime
  useEffect(() => {
    if (!enabled || ids.length === 0) return;

    const channel = supabase
      .channel(`made-proposals-${ids[0]?.slice(0, 8)}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'freight_proposals',
      }, (payload) => {
        const record = (payload.new || payload.old) as any;
        if (record && ids.includes(record.driver_id)) {
          fetchProposals();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, ids.join(','), fetchProposals]);

  // Só contar propostas onde o frete ainda está OPEN e com vagas
  const isFreightActive = (p: MadeProposal) => {
    const f = p.freight;
    if (!f) return false;
    const status = (f.status || '').toUpperCase();
    const available = (f.required_trucks ?? 1) - (f.accepted_trucks ?? 0);
    return status === 'OPEN' && available > 0;
  };
  const pendingCount = proposals.filter(p => (p.status === 'PENDING' || p.status === 'COUNTER_PROPOSED') && isFreightActive(p)).length;
  const acceptedCount = proposals.filter(p => p.status === 'ACCEPTED').length;
  const rejectedCount = proposals.filter(p => p.status === 'REJECTED').length;

  return {
    proposals,
    loading,
    pendingCount,
    acceptedCount,
    rejectedCount,
    refetch: fetchProposals,
  };
}
