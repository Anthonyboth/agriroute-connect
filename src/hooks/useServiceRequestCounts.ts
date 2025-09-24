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

      // Buscar solicitações pendentes regionais
      const { data: regionalData, error: regionalError } = await supabase
        .rpc('get_service_requests_in_radius', {
          provider_profile_id: providerId
        });

      if (regionalError) throw regionalError;

      // Contar solicitações pendentes (regionais + próprias)
      const pendingRegional = (regionalData || []).filter((r: any) => 
        !r.provider_id && r.status === 'OPEN'
      ).length;

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
      const pending = pendingRegional + ownPending;

      setCounts({
        pending,
        accepted,
        completed,
        total
      });

    } catch (error) {
      console.error('Error fetching service request counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshCounts();
  }, [providerId]);

  return { counts, loading, refreshCounts };
};