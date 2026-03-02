/**
 * useServiceProposals.ts
 * 
 * Hook para gerenciar propostas e contrapropostas em solicitações de serviço.
 * Suporta realtime, CRUD e ações de aceitar/rejeitar via RPCs.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface ServiceProposal {
  id: string;
  service_request_id: string;
  proposer_id: string;
  proposer_role: 'CLIENT' | 'PROVIDER';
  proposed_price: number;
  message: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
  responded_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  proposer_name?: string;
}

interface UseServiceProposalsOptions {
  serviceRequestId?: string;
  serviceRequestIds?: string[];
  enabled?: boolean;
}

export function useServiceProposals({ serviceRequestId, serviceRequestIds, enabled = true }: UseServiceProposalsOptions) {
  const { toast } = useToast();
  const [proposals, setProposals] = useState<ServiceProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const ids = serviceRequestIds || (serviceRequestId ? [serviceRequestId] : []);

  const fetchProposals = useCallback(async () => {
    if (!enabled || ids.length === 0) return;
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('service_request_proposals')
        .select('*, profiles_secure:proposer_id(full_name)')
        .in('service_request_id', ids)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching service proposals:', error);
        return;
      }

      const mapped = (data || []).map((p: any) => ({
        ...p,
        proposer_name: p.profiles_secure?.full_name || 'Usuário',
      }));
      setProposals(mapped);
    } catch (err) {
      console.error('Exception fetching proposals:', err);
    } finally {
      setLoading(false);
    }
  }, [enabled, ids.join(',')]);

  useEffect(() => {
    fetchProposals();
    
    // Polling fallback every 15s to catch missed realtime events
    const interval = setInterval(fetchProposals, 15000);
    return () => clearInterval(interval);
  }, [fetchProposals]);

  // Realtime subscription
  useEffect(() => {
    if (!enabled || ids.length === 0) return;

    const channel = supabase
      .channel(`service-proposals-${ids.join('-').slice(0, 50)}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_request_proposals',
        },
        (payload) => {
          const record = (payload.new || payload.old) as any;
          if (record && ids.includes(record.service_request_id)) {
            fetchProposals();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, ids.join(','), fetchProposals]);

  const submitProposal = useCallback(async (
    serviceRequestId: string,
    proposerId: string,
    proposerRole: 'CLIENT' | 'PROVIDER',
    proposedPrice: number,
    message?: string
  ) => {
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any)
        .from('service_request_proposals')
        .insert({
          service_request_id: serviceRequestId,
          proposer_id: proposerId,
          proposer_role: proposerRole,
          proposed_price: proposedPrice,
          message: message || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Proposta Enviada',
        description: `Valor de R$ ${proposedPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} enviado com sucesso.`,
      });

      fetchProposals();
      return data;
    } catch (err: any) {
      console.error('Error submitting proposal:', err);
      toast({
        title: 'Erro',
        description: err?.message || 'Não foi possível enviar a proposta.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setSubmitting(false);
    }
  }, [fetchProposals, toast]);

  const acceptProposal = useCallback(async (proposalId: string, onSuccess?: () => void) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('accept_service_proposal' as any, {
        p_proposal_id: proposalId,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        toast({
          title: 'Erro',
          description: result?.error || 'Não foi possível aceitar a proposta.',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Proposta Aceita',
        description: result.message,
      });

      fetchProposals();
      onSuccess?.();
      return true;
    } catch (err: any) {
      console.error('Error accepting proposal:', err);
      toast({
        title: 'Erro',
        description: err?.message || 'Não foi possível aceitar a proposta.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [fetchProposals, toast]);

  const rejectProposal = useCallback(async (
    proposalId: string,
    reason?: string,
    returnToOpen?: boolean
  ) => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('reject_service_proposal' as any, {
        p_proposal_id: proposalId,
        p_rejection_reason: reason || null,
        p_return_to_open: returnToOpen || false,
      });

      if (error) throw error;

      const result = data as any;
      if (!result?.success) {
        toast({
          title: 'Erro',
          description: result?.error || 'Não foi possível rejeitar a proposta.',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Proposta Rejeitada',
        description: result.message,
      });

      fetchProposals();
      return true;
    } catch (err: any) {
      console.error('Error rejecting proposal:', err);
      toast({
        title: 'Erro',
        description: err?.message || 'Não foi possível rejeitar a proposta.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [fetchProposals, toast]);

  // Helper: get proposals for a specific service request
  const getProposalsForRequest = useCallback((requestId: string) => {
    return proposals.filter(p => p.service_request_id === requestId);
  }, [proposals]);

  // Helper: get pending proposals count for a specific service request
  const getPendingCount = useCallback((requestId: string) => {
    return proposals.filter(p => p.service_request_id === requestId && p.status === 'PENDING').length;
  }, [proposals]);

  // Helper: get latest proposal for a specific service request
  const getLatestProposal = useCallback((requestId: string) => {
    const requestProposals = proposals.filter(p => p.service_request_id === requestId);
    return requestProposals[0] || null; // already sorted by created_at desc
  }, [proposals]);

  return {
    proposals,
    loading,
    submitting,
    submitProposal,
    acceptProposal,
    rejectProposal,
    getProposalsForRequest,
    getPendingCount,
    getLatestProposal,
    refetch: fetchProposals,
  };
}
