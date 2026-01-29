import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

interface RatingSubmission {
  freightId: string;
  raterId: string;
  ratedUserId: string;
  rating: number;
  comment?: string;
  ratingType: 'PRODUCER_TO_DRIVER' | 'DRIVER_TO_PRODUCER';
}

interface UseRatingSubmitResult {
  submitRating: (data: RatingSubmission) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  canSubmitRating: (freightId: string) => Promise<{ canSubmit: boolean; reason?: string }>;
}

/**
 * Hook centralizado para submissão de avaliações de frete
 * 
 * ✅ Implementa:
 * - Verificação prévia de pagamento confirmado
 * - Verificação de avaliação duplicada
 * - Tratamento de erros RLS com mensagens claras
 * - Logging para monitoramento
 */
export const useRatingSubmit = (): UseRatingSubmitResult => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Verifica se o usuário pode avaliar o frete
   */
  const canSubmitRating = useCallback(async (freightId: string): Promise<{ canSubmit: boolean; reason?: string }> => {
    try {
      // 1. Verificar se o pagamento foi confirmado
      const { data: payment, error: paymentError } = await supabase
        .from('external_payments')
        .select('id, status')
        .eq('freight_id', freightId)
        .eq('status', 'confirmed')
        .maybeSingle();

      if (paymentError) {
        console.error('[useRatingSubmit] Erro ao verificar pagamento:', paymentError);
        return { canSubmit: false, reason: 'Erro ao verificar status do pagamento' };
      }

      if (!payment) {
        return { 
          canSubmit: false, 
          reason: 'O pagamento deste frete ainda não foi confirmado. A avaliação estará disponível após a confirmação do pagamento.' 
        };
      }

      // 2. Verificar se o usuário autenticado pode avaliar
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { canSubmit: false, reason: 'Usuário não autenticado' };
      }

      // 3. Buscar profile do usuário
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!profile) {
        return { canSubmit: false, reason: 'Perfil do usuário não encontrado' };
      }

      // 4. Verificar se já avaliou
      const { data: existingRating } = await supabase
        .from('freight_ratings')
        .select('id')
        .eq('freight_id', freightId)
        .eq('rater_id', profile.id)
        .maybeSingle();

      if (existingRating) {
        return { canSubmit: false, reason: 'Você já avaliou este frete' };
      }

      return { canSubmit: true };
    } catch (err: any) {
      console.error('[useRatingSubmit] Erro em canSubmitRating:', err);
      return { canSubmit: false, reason: 'Erro ao verificar permissões de avaliação' };
    }
  }, []);

  /**
   * Submete a avaliação com verificações prévias
   */
  const submitRating = useCallback(async (data: RatingSubmission): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Verificação prévia
      const { canSubmit, reason } = await canSubmitRating(data.freightId);
      
      if (!canSubmit) {
        setError(reason || 'Não é possível avaliar este frete');
        toast.error('Avaliação não permitida', {
          description: reason || 'Verifique se o pagamento foi confirmado'
        });
        return false;
      }

      // Submeter avaliação
      const { error: insertError } = await supabase
        .from('freight_ratings')
        .upsert({
          freight_id: data.freightId,
          rater_id: data.raterId,
          rated_user_id: data.ratedUserId,
          rating: data.rating,
          comment: data.comment || null,
          rating_type: data.ratingType,
        }, {
          onConflict: 'freight_id,rater_id,rating_type'
        });

      if (insertError) {
        // Tratamento específico de erros RLS
        if (insertError.message.includes('row-level security')) {
          const userMessage = 'O pagamento deste frete ainda não foi confirmado. Aguarde a confirmação para avaliar.';
          setError(userMessage);
          toast.error('Avaliação não disponível', {
            description: userMessage
          });
          
          // Log para monitoramento (sem alarmar o usuário)
          console.warn('[useRatingSubmit] RLS bloqueou avaliação - pagamento não confirmado:', {
            freightId: data.freightId,
            raterId: data.raterId
          });
          
          return false;
        }

        // Outros erros
        throw insertError;
      }

      toast.success('Avaliação enviada com sucesso!');
      return true;

    } catch (err: any) {
      const errorMessage = err?.message || 'Erro ao enviar avaliação';
      setError(errorMessage);
      
      // Log detalhado
      console.error('[useRatingSubmit] Erro ao submeter avaliação:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        freightId: data.freightId
      });

      // Enviar para monitoramento
      await ErrorMonitoringService.getInstance().captureError(
        new Error(`Rating Submission Failed: ${errorMessage}`),
        {
          module: 'useRatingSubmit',
          functionName: 'submitRating',
          freightId: data.freightId,
          raterId: data.raterId,
          errorCode: err?.code,
          userFacing: true
        }
      );

      toast.error('Erro ao enviar avaliação', {
        description: 'Tente novamente mais tarde'
      });
      
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [canSubmitRating]);

  return {
    submitRating,
    isSubmitting,
    error,
    canSubmitRating
  };
};