import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface ServiceAutoRatingData {
  serviceRequestId: string;
  shouldShow: boolean;
  ratedUserId?: string;
  ratedUserName?: string;
  raterRole?: 'CLIENT' | 'PROVIDER';
  serviceType?: string;
}

export const useServiceAutoRating = () => {
  const { profile } = useAuth();
  const [autoRatingData, setAutoRatingData] = useState<ServiceAutoRatingData>({
    serviceRequestId: '',
    shouldShow: false,
  });

  useEffect(() => {
    if (!profile) return;

    const checkPendingRatings = async () => {
      try {
        // Buscar serviços completados onde o usuário ainda não avaliou
        const { data: services, error } = await supabase
          .from('service_requests')
          .select(`
            id,
            status,
            service_type,
            client_id,
            provider_id,
            client:profiles!service_requests_client_id_fkey(id, full_name),
            provider:profiles!service_requests_provider_id_fkey(id, full_name)
          `)
          .eq('status', 'COMPLETED')
          .or(`client_id.eq.${profile.id},provider_id.eq.${profile.id}`)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) throw error;

        for (const service of services || []) {
          // Determinar se é cliente ou prestador
          const isClient = service.client_id === profile.id;
          const raterRole: 'CLIENT' | 'PROVIDER' = isClient ? 'CLIENT' : 'PROVIDER';
          const ratingType = isClient ? 'CLIENT_TO_PROVIDER' : 'PROVIDER_TO_CLIENT';
          const ratedUserId = isClient ? service.provider_id : service.client_id;
          const ratedUserName = isClient 
            ? (service.provider as any)?.[0]?.full_name 
            : (service.client as any)?.[0]?.full_name;

          // Verificar se já avaliou
          const { data: existingRating } = await supabase
            .from('service_ratings')
            .select('id')
            .eq('service_request_id', service.id)
            .eq('rater_id', profile.id)
            .eq('rating_type', ratingType)
            .maybeSingle();

          if (!existingRating) {
            setAutoRatingData({
              serviceRequestId: service.id,
              shouldShow: true,
              ratedUserId,
              ratedUserName,
              raterRole,
              serviceType: service.service_type,
            });
            return;
          }
        }
      } catch (error) {
        console.error('Erro ao verificar avaliações pendentes:', error);
      }
    };

    checkPendingRatings();

    // Subscrever a mudanças em service_requests
    const subscription = supabase
      .channel('service_rating_check')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_requests',
          filter: `status=eq.COMPLETED`
        },
        () => {
          checkPendingRatings();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [profile]);

  const closeAutoRating = () => {
    setAutoRatingData({
      serviceRequestId: '',
      shouldShow: false,
    });
  };

  return {
    ...autoRatingData,
    closeAutoRating,
  };
};
