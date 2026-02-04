import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionWithRetry } from '@/lib/query-utils';
import { canProviderHandleService } from '@/lib/service-types';

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
      // Buscar solicitações do prestador (próprias)
      const { data: providerRequests, error: providerError } = await supabase
        .from('service_requests')
        .select('status')
        .eq('provider_id', providerId);

      if (providerError) throw providerError;

      // Buscar profile do prestador para obter service_types
      const { data: providerProfile } = await supabase
        .from('profiles')
        .select('service_types')
        .eq('id', providerId)
        .maybeSingle();

      const providerServiceTypes: string[] = providerProfile?.service_types || [];

      // Buscar solicitações disponíveis usando RPC unificado
      let availableRequests: any[] = [];
      try {
        const { data, error } = await supabase.rpc('get_services_for_provider', {
          p_provider_id: providerId
        });

        if (!error && data) {
          // ✅ CORREÇÃO: Usar função de matching inteligente por categoria
          availableRequests = (data as any[]).filter((r: any) => {
            // Deve estar OPEN
            if (r.status !== 'OPEN') return false;
            
            // Usar matching inteligente que entende SERVICO_AGRICOLA → AGRONOMO
            return canProviderHandleService(providerServiceTypes, r.service_type);
          });
        }
      } catch (err) {
        console.warn('Erro ao buscar solicitações disponíveis:', err);
      }

      // Contar por status
      const ownPending = (providerRequests || []).filter(r => 
        r.status === 'OPEN' || r.status === 'PENDING'
      ).length;

      const accepted = (providerRequests || []).filter(r => 
        r.status === 'ACCEPTED' || r.status === 'IN_PROGRESS'
      ).length;

      const completed = (providerRequests || []).filter(r => 
        r.status === 'COMPLETED'
      ).length;

      const pending = availableRequests.length;
      const total = (providerRequests || []).length;

      setCounts({
        pending,
        accepted,
        completed,
        total
      });

      if (import.meta.env.DEV) {
        console.log('Request counts updated:', { pending, accepted, completed, total });
      }

    } catch (error) {
      console.error('Error fetching service request counts:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!providerId) return;

    const setupSubscriptions = async () => {
      // Buscar user_id do profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('id', providerId)
        .single();

      if (!profileData) return;

      // Store cleanup functions
      const cleanups: Array<() => void> = [];

      // Buscar dados iniciais
      refreshCounts();

      // Configurar realtime com retry
      const { cleanup: cleanup1 } = subscriptionWithRetry(
        'service-requests-counts-realtime',
        (channel) => {
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'service_requests'
            },
            () => refreshCounts()
          );
        }
      );
      cleanups.push(cleanup1);

      const { cleanup: cleanup2 } = subscriptionWithRetry(
        'profiles-counts-realtime',
        (channel) => {
          channel.on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'profiles',
              filter: `id=eq.${providerId}`
            },
            () => refreshCounts()
          );
        }
      );
      cleanups.push(cleanup2);

      const { cleanup: cleanup3 } = subscriptionWithRetry(
        'user-cities-counts-realtime',
        (channel) => {
          channel.on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_cities',
              filter: `user_id=eq.${profileData.user_id}`
            },
            () => refreshCounts()
          );
        }
      );
      cleanups.push(cleanup3);

      // Refresh automático a cada 30 segundos como backup
      const interval = setInterval(refreshCounts, 30000);

      return () => {
        cleanups.forEach(fn => fn());
        clearInterval(interval);
      };
    };

    const cleanup = setupSubscriptions();
    return () => {
      cleanup.then(fn => fn && fn());
    };
  }, [providerId]);

  return { counts, loading, refreshCounts };
};