import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatErrorMessage } from '@/lib/pt-br-validator';

interface SubmitRatingParams {
  serviceRequestId: string;
  ratedUserId: string;
  raterRole: 'CLIENT' | 'PROVIDER';
  rating: number;
  comment?: string;
}

interface SubmitRatingResult {
  success: boolean;
  error?: string;
}

/**
 * Hook personalizado para submissão de avaliações de serviço
 * Valida UUIDs e trata erros antes de enviar para o banco
 */
export function useServiceRatingSubmit() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Valida se uma string é um UUID válido
   */
  const isValidUUID = (uuid: string): boolean => {
    if (!uuid || typeof uuid !== 'string') return false;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  /**
   * Submete uma avaliação de serviço com validação completa
   */
  const submitRating = async ({
    serviceRequestId,
    ratedUserId,
    raterRole,
    rating,
    comment,
  }: SubmitRatingParams): Promise<SubmitRatingResult> => {
    // Validações antes de começar
    if (!isValidUUID(serviceRequestId)) {
      console.error('[useServiceRatingSubmit] ID de serviço inválido:', serviceRequestId);
      toast.error('Erro ao processar avaliação: identificador de serviço inválido');
      return { success: false, error: 'Invalid service request ID' };
    }

    if (!isValidUUID(ratedUserId)) {
      console.error('[useServiceRatingSubmit] ID de usuário avaliado inválido:', {
        ratedUserId,
        type: typeof ratedUserId,
        isNull: ratedUserId === null,
        isUndefined: ratedUserId === undefined,
        isEmpty: ratedUserId === '',
      });
      toast.error('Erro ao processar avaliação: identificador de usuário inválido');
      return { success: false, error: 'Invalid rated user ID' };
    }

    if (rating < 1 || rating > 5) {
      toast.error('Por favor, selecione uma nota de 1 a 5 estrelas');
      return { success: false, error: 'Invalid rating value' };
    }

    if (!raterRole || !['CLIENT', 'PROVIDER'].includes(raterRole)) {
      console.error('[useServiceRatingSubmit] Role inválido:', raterRole);
      toast.error('Erro ao processar avaliação: tipo de avaliador inválido');
      return { success: false, error: 'Invalid rater role' };
    }

    setIsSubmitting(true);
    console.log('[useServiceRatingSubmit] Iniciando submissão de avaliação:', {
      serviceRequestId,
      ratedUserId,
      raterRole,
      rating,
    });

    try {
      // Obter o perfil do usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Erro ao buscar perfil do usuário');
      }

      const raterId = profile.id;
      console.log('[useServiceRatingSubmit] Rater ID:', raterId);

      // Determinar o tipo de avaliação
      const ratingType = raterRole === 'CLIENT' ? 'CLIENT_TO_PROVIDER' : 'PROVIDER_TO_CLIENT';

      // Verificar se já existe avaliação
      const { data: existingRating } = await supabase
        .from('service_ratings')
        .select('id')
        .eq('service_request_id', serviceRequestId)
        .eq('rater_id', raterId)
        .eq('rating_type', ratingType)
        .maybeSingle();

      if (existingRating) {
        console.log('[useServiceRatingSubmit] Avaliação já existe');
        toast.info('Você já avaliou este serviço');
        return { success: false, error: 'Rating already exists' };
      }

      // Inserir nova avaliação
      const { error: insertError } = await supabase
        .from('service_ratings')
        .insert({
          service_request_id: serviceRequestId,
          rater_id: raterId,
          rated_user_id: ratedUserId,
          rating,
          comment: comment?.trim() || null,
          rating_type: ratingType,
        });

      if (insertError) {
        console.error('[useServiceRatingSubmit] Erro ao inserir avaliação:', insertError);
        throw insertError;
      }

      console.log('[useServiceRatingSubmit] Avaliação enviada com sucesso');
      toast.success('Avaliação enviada com sucesso!');
      
      return { success: true };

    } catch (error: any) {
      console.error('[useServiceRatingSubmit] Erro ao submeter avaliação:', error);
      
      const errorMessage = formatErrorMessage(error.message || 'Erro desconhecido');
      toast.error(errorMessage);
      
      return { success: false, error: error.message };
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submitRating,
    isSubmitting,
  };
}
