import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ServiceRequestCounts {
  pending: number;
  accepted: number;
  completed: number;
  total: number;
}

export const useServiceRequestCounts = (providerId?: string) => {
  const [counts, setCounts] = useState<ServiceRequestCounts>({
    pending: 0,
    accepted: 0,
    completed: 0,
    total: 0
  });
  const [loading, setLoading] = useState(false);

  const refreshCounts = async () => {
    if (!providerId) return;

    setLoading(true);
    try {
      // Buscar solicitações do prestador
      const { data: providerRequests, error: providerError } = await supabase
        .from('service_requests')
        .select('status')
        .eq('provider_id', providerId);

      if (providerError) throw providerError;

      // Buscar TODAS as solicitações pendentes diretamente na tabela
      const { data: allPendingRequests, error: pendingError } = await supabase
        .from('service_requests')
        .select('id')
        .is('provider_id', null)
        .eq('status', 'OPEN');

      if (pendingError) throw pendingError;

      // Tentar buscar regionais como complemento
      let regionalPendingCount = 0;
      try {
        const { data: regionalData, error: regionalError } = await supabase
          .rpc('get_service_requests_in_radius', {
            provider_profile_id: providerId
          });

        if (!regionalError && regionalData) {
          regionalPendingCount = regionalData.filter((r: any) => 
            !r.provider_id && r.status === 'OPEN'
          ).length;
        }
      } catch (regionalErr) {
        console.log('Regional count failed, using direct count:', regionalErr);
      }

      // Contar solicitações próprias pendentes
      const ownPending = (providerRequests || []).filter(r => 
        r.status === 'OPEN' || r.status === 'PENDING'
      ).length;

      // Contar solicitações aceitas/em andamento
      const accepted = (providerRequests || []).filter(r => 
        r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS'
      ).length;

      // Contar solicitações concluídas
      const completed = (providerRequests || []).filter(r => 
        r.status === 'COMPLETED'
      ).length;

      const total = (providerRequests || []).length;
      
      // Use o maior entre busca direta e regional para garantir precisão
      const directPendingCount = (allPendingRequests || []).length;
      const pending = Math.max(directPendingCount, regionalPendingCount) + ownPending;

      setCounts({
        pending,
        accepted,
        completed,
        total
      });

      console.log('Request counts updated:', {
        pending,
        accepted,
        completed,
        total,
        directPendingCount,
        regionalPendingCount,
        ownPending
      });

    } catch (error) {
      console.error('Error fetching service request counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!providerId) return;

    // Buscar dados iniciais
    refreshCounts();

    // Configurar realtime para atualizações automáticas das contagens
    const channel = supabase
      .channel('service-requests-counts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_requests'
        },
        () => {
          // Atualizar contagens quando houver mudanças
          refreshCounts();
        }
      )
      .subscribe();

    // Refresh automático a cada 15 segundos como backup
    const interval = setInterval(refreshCounts, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [providerId]);

  return { counts, loading, refreshCounts };
};