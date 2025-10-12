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

      // Buscar solicitações pendentes por cidade e compatíveis (RPC)
      let cityBasedRequests: any[] = [];
      let compatibleRequests: any[] = [];
      try {
        const [cityRes, compatRes] = await Promise.all([
          supabase.rpc('get_service_requests_by_city', {
            provider_profile_id: providerId
          }),
          supabase.rpc('get_compatible_service_requests_for_provider', {
            p_provider_id: providerId
          })
        ]);

        if (!cityRes.error && cityRes.data) {
          cityBasedRequests = cityRes.data.filter((r: any) => r.status === 'OPEN');
        }
        if (!compatRes.error && compatRes.data) {
          compatibleRequests = (compatRes.data as any[]).filter((r: any) => r.status === 'OPEN');
        }
      } catch (err) {
        console.warn('Counts RPC fetch warning:', err);
      }

      // Fallback: se cidade falhar, busca direta por pendentes OPEN sem provider
      if (cityBasedRequests.length === 0) {
        try {
          const { data: allPendingRequests, error: pendingError } = await supabase
            .from('service_requests')
            .select('id')
            .is('provider_id', null)
            .eq('status', 'OPEN');
          if (!pendingError && allPendingRequests) {
            cityBasedRequests = allPendingRequests.map((r) => ({ id: r.id }));
          }
        } catch (cityErr) {
          console.warn('City-based count failed, using fallback:', cityErr);
        }
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

      // Unificar pendentes (compatíveis + cidade) sem duplicar
      const mergedPendingIds = new Set<string>();
      (cityBasedRequests || []).forEach((r: any) => mergedPendingIds.add(r.id));
      (compatibleRequests || []).forEach((r: any) => mergedPendingIds.add(r.request_id));
      const pendingCount = mergedPendingIds.size;
      const pending = pendingCount + ownPending;
      const total = (providerRequests || []).length;

      setCounts({
        pending,
        accepted,
        completed,
        total
      });

      console.log('Request counts updated (city+compatible):', {
        pending,
        accepted,
        completed,
        total,
        cityBasedPending: (cityBasedRequests || []).length,
        compatiblePending: (compatibleRequests || []).length,
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