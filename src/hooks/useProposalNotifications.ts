import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

interface ProposalNotification {
  id: string;
  type: 'new_proposal' | 'counter_proposal' | 'proposal_accepted' | 'proposal_rejected';
  proposalId: string;
  freightId: string;
  message: string;
  createdAt: Date;
  read: boolean;
  data?: any;
}

export const useProposalNotifications = () => {
  const [proposalCount, setProposalCount] = useState(0);
  const [counterProposalCount, setCounterProposalCount] = useState(0);
  const [notifications, setNotifications] = useState<ProposalNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();

  const fetchProposalCounts = useCallback(async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const isProducer = profile.role === 'PRODUTOR';
      
      if (isProducer) {
        // Producers: count pending proposals on their freights
        const { data: freights } = await supabase
          .from('freights')
          .select('id')
          .eq('producer_id', profile.id)
          .in('status', ['OPEN', 'IN_NEGOTIATION']);

        if (freights && freights.length > 0) {
          const freightIds = freights.map(f => f.id);
          
          // Count pending proposals
          const { count: proposalsCount } = await supabase
            .from('freight_proposals')
            .select('*', { count: 'exact', head: true })
            .in('freight_id', freightIds)
            .eq('status', 'PENDING');

          // Count counter-proposals awaiting producer response
          const { count: counterCount } = await supabase
            .from('freight_proposals')
            .select('*', { count: 'exact', head: true })
            .in('freight_id', freightIds)
            .eq('status', 'COUNTER_PROPOSED');

          setProposalCount(proposalsCount || 0);
          setCounterProposalCount(counterCount || 0);
        }
      } else {
        // Drivers: count proposals with counter-offers from producers
        const { count: counterCount } = await supabase
          .from('freight_proposals')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', profile.id)
          .eq('status', 'COUNTER_PROPOSED');

        // Count accepted proposals
        const { count: acceptedCount } = await supabase
          .from('freight_proposals')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', profile.id)
          .eq('status', 'ACCEPTED');

        setCounterProposalCount(counterCount || 0);
        setProposalCount(acceptedCount || 0);
      }
    } catch (error) {
      console.error('[useProposalNotifications] Erro ao buscar contadores:', error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  // Setup realtime subscription for proposals
  useEffect(() => {
    if (!profile) return;

    fetchProposalCounts();

    const isProducer = profile.role === 'PRODUTOR';
    
    // Subscribe to proposal changes
    const channel = supabase
      .channel('proposal-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_proposals'
        },
        async (payload) => {
          if (import.meta.env.DEV) console.log('[useProposalNotifications] Realtime event:', payload.eventType);
          
          const newRecord = payload.new as any;
          const oldRecord = payload.old as any;
          
          // Check if this proposal is relevant to the current user
          let isRelevant = false;
          let notificationType: ProposalNotification['type'] = 'new_proposal';
          let message = '';

          if (isProducer) {
            // Check if the freight belongs to this producer
            const { data: freight } = await supabase
              .from('freights')
              .select('producer_id, cargo_type')
              .eq('id', newRecord?.freight_id || oldRecord?.freight_id)
              .single();

            isRelevant = freight?.producer_id === profile.id;

            if (isRelevant) {
              if (payload.eventType === 'INSERT') {
                notificationType = 'new_proposal';
                message = 'Nova proposta recebida!';
              } else if (payload.eventType === 'UPDATE') {
                if (newRecord.status === 'PENDING' && oldRecord.status !== 'PENDING') {
                  notificationType = 'counter_proposal';
                  message = 'Motorista respondeu sua contraproposta';
                }
              }
            }
          } else {
            // Driver: check if this is their proposal
            isRelevant = newRecord?.driver_id === profile.id || oldRecord?.driver_id === profile.id;

            if (isRelevant && payload.eventType === 'UPDATE') {
              if (newRecord.status === 'COUNTER_PROPOSED') {
                notificationType = 'counter_proposal';
                message = 'Produtor fez uma contraproposta!';
              } else if (newRecord.status === 'ACCEPTED') {
                notificationType = 'proposal_accepted';
                message = 'Sua proposta foi aceita!';
              } else if (newRecord.status === 'REJECTED') {
                notificationType = 'proposal_rejected';
                message = 'Sua proposta foi recusada';
              }
            }
          }

          if (isRelevant && message) {
            // Show toast notification
            if (notificationType === 'proposal_accepted') {
              toast.success(message, {
                description: 'Acesse os detalhes do frete para continuar'
              });
            } else if (notificationType === 'proposal_rejected') {
              toast.error(message);
            } else {
              toast.info(message, {
                description: 'Clique para ver os detalhes'
              });
            }

            // Refresh counts
            fetchProposalCounts();

            // Add to local notifications
            const notification: ProposalNotification = {
              id: `${Date.now()}`,
              type: notificationType,
              proposalId: newRecord?.id || oldRecord?.id,
              freightId: newRecord?.freight_id || oldRecord?.freight_id,
              message,
              createdAt: new Date(),
              read: false,
              data: newRecord
            };
            
            setNotifications(prev => [notification, ...prev.slice(0, 19)]);
          }
        }
      )
      .subscribe();

    // Polling fallback every 30 seconds
    const pollInterval = setInterval(fetchProposalCounts, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [profile, fetchProposalCounts]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const totalCount = proposalCount + counterProposalCount;

  return {
    proposalCount,
    counterProposalCount,
    totalCount,
    notifications,
    loading,
    refreshCounts: fetchProposalCounts,
    markAsRead,
    clearNotifications
  };
};
