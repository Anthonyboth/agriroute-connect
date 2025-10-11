import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ServiceRatingData {
  serviceRequestId: string;
  ratedUserId: string;
  raterRole: 'CLIENT' | 'PROVIDER';
}

export const useServiceRating = ({ serviceRequestId, ratedUserId, raterRole }: ServiceRatingData) => {
  const [shouldShowModal, setShouldShowModal] = useState(false);
  const [hasRated, setHasRated] = useState(false);

  useEffect(() => {
    checkIfAlreadyRated();
  }, [serviceRequestId, raterRole]);

  const checkIfAlreadyRated = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) return;

      const ratingType = raterRole === 'CLIENT' ? 'CLIENT_TO_PROVIDER' : 'PROVIDER_TO_CLIENT';

      const { data, error } = await supabase
        .from('service_ratings')
        .select('id')
        .eq('service_request_id', serviceRequestId)
        .eq('rater_id', profile.id)
        .eq('rating_type', ratingType)
        .maybeSingle();

      if (error) throw error;

      setHasRated(!!data);
      
      // Mostrar modal se ainda não avaliou
      if (!data) {
        setShouldShowModal(true);
      }
    } catch (error) {
      console.error('Erro ao verificar avaliação:', error);
    }
  };

  const submitRating = async (rating: number, comment?: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      const ratingType = raterRole === 'CLIENT' ? 'CLIENT_TO_PROVIDER' : 'PROVIDER_TO_CLIENT';

      const { error } = await supabase
        .from('service_ratings')
        .insert({
          service_request_id: serviceRequestId,
          rater_id: profile.id,
          rated_user_id: ratedUserId,
          rating,
          comment: comment || null,
          rating_type: ratingType
        });

      if (error) throw error;

      toast.success('Avaliação enviada com sucesso!');
      setHasRated(true);
      setShouldShowModal(false);
      
      return { success: true };
    } catch (error: any) {
      console.error('Erro ao enviar avaliação:', error);
      toast.error('Erro ao enviar avaliação: ' + error.message);
      return { success: false, error };
    }
  };

  const skipRating = () => {
    setShouldShowModal(false);
    toast.info('Você pode avaliar mais tarde acessando o histórico de serviços');
  };

  return {
    shouldShowModal,
    hasRated,
    submitRating,
    skipRating,
    checkIfAlreadyRated
  };
};