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

      // Buscar solicitações pendentes usando o RPC que usa user_cities
      let availableRequests: any[] = [];
      try {
        const { data, error } = await supabase.rpc('get_service_requests_for_provider_cities', {
          p_provider_id: providerId
        });

        if (!error && data) {
          availableRequests = (data as any[]).filter((r: any) => r.status === 'OPEN');
        }
      } catch (err) {
        console.warn('Counts RPC fetch warning:', err);
      }

      // Fallback: se não houver user_cities configuradas, usar perfil city/state
      if (availableRequests.length === 0) {
        try {
          // Verificar se há user_cities ativas para o prestador
          const { data: providerData } = await supabase
            .from('profiles')
            .select('user_id')
            .eq('id', providerId)
            .single();

          if (providerData) {
            const { count: userCitiesCount } = await supabase
              .from('user_cities')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', providerData.user_id)
              .eq('type', 'PRESTADOR_SERVICO')
              .eq('is_active', true);

            // Só usar fallback se não houver nenhum user_cities ativo
            if (!userCitiesCount || userCitiesCount === 0) {
              const { data: providerProfile, error: profileError } = await supabase
                .from('profiles')
                .select('current_city_name, current_state, service_types')
                .eq('id', providerId)
                .maybeSingle();

              if (!profileError && providerProfile?.current_city_name && providerProfile?.current_state) {
                let query = supabase
                  .from('service_requests')
                  .select('id, service_type')
                  .is('provider_id', null)
                  .eq('status', 'OPEN')
                  .ilike('city_name', providerProfile.current_city_name)
                  .ilike('state', providerProfile.current_state);

                const types: string[] | undefined = Array.isArray(providerProfile.service_types)
                  ? (providerProfile.service_types as unknown as string[])
                  : undefined;

                if (types && types.length > 0) {
                  query = query.in('service_type', types);
                }

                const { data: cityPending, error: pendingError } = await query;
                if (!pendingError && cityPending) {
                  availableRequests = cityPending.map((r) => ({ id: r.id }));
                }

                console.log('Counts fallback by profile city/state applied (no user_cities):', {
                  providerId,
                  city: providerProfile.current_city_name,
                  state: providerProfile.current_state,
                  typesCount: types?.length || 0,
                  matched: availableRequests.length
                });
              }
            }
          }
        } catch (cityErr) {
          console.warn('Fallback count failed:', cityErr);
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

      // Pendentes = disponíveis para aceitar (vindos do RPC)
      const pending = availableRequests.length;
      const total = (providerRequests || []).length;

      setCounts({
        pending,
        accepted,
        completed,
        total
      });

      console.log('Request counts updated (user_cities based):', {
        pending,
        accepted,
        completed,
        total,
        availableFromUserCities: availableRequests.length
      });

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

      // Reagir a mudanças no perfil do prestador (cidade/estado/serviços)
      const profilesChannel = supabase
        .channel('profiles-counts-realtime')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${providerId}`
          },
          () => {
            refreshCounts();
          }
        )
        .subscribe();

      // NOVO: Reagir a mudanças em user_cities (add/remove/toggle)
      const userCitiesChannel = supabase
        .channel('user-cities-counts-realtime')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'user_cities',
            filter: `user_id=eq.${profileData.user_id}`
          },
          (payload) => {
            console.log('🏙️ user_cities mudou, atualizando counts:', payload);
            refreshCounts();
          }
        )
        .subscribe();

      // Refresh automático a cada 30 segundos como backup
      const interval = setInterval(refreshCounts, 30000);

      return () => {
        supabase.removeChannel(channel);
        supabase.removeChannel(profilesChannel);
        supabase.removeChannel(userCitiesChannel);
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