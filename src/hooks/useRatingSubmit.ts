import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

/**
 * Tipos de avaliação suportados:
 * - PRODUCER_TO_DRIVER: Produtor avalia Motorista
 * - DRIVER_TO_PRODUCER: Motorista avalia Produtor
 * - PRODUCER_TO_COMPANY: Produtor avalia Transportadora (quando motorista é afiliado)
 * - COMPANY_TO_PRODUCER: Transportadora avalia Produtor
 * ❌ NÃO EXISTE: Transportadora ↔ Motorista
 */
export type RatingType = 
  | 'PRODUCER_TO_DRIVER' 
  | 'DRIVER_TO_PRODUCER' 
  | 'PRODUCER_TO_COMPANY' 
  | 'COMPANY_TO_PRODUCER';

interface RatingSubmission {
  freightId: string;
  raterId: string;
  ratedUserId: string;
  rating: number;
  comment?: string;
  ratingType: RatingType;
  companyId?: string; // Para avaliações envolvendo transportadora
  assignmentId?: string; // Para fretes multi-carreta
}

interface PendingRating {
  freightId: string;
  assignmentId: string | null;
  driverId: string;
  driverName: string;
  companyId: string | null;
  companyName: string | null;
  producerId: string;
  producerName: string;
  pendingTypes: RatingType[];
  paymentConfirmedAt: string;
}

interface UseRatingSubmitResult {
  submitRating: (data: RatingSubmission) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
  canSubmitRating: (freightId: string, ratingType?: RatingType) => Promise<{ canSubmit: boolean; reason?: string }>;
  getPendingRatings: (profileId: string) => Promise<PendingRating[]>;
}

/**
 * Hook centralizado para submissão de avaliações de frete
 * 
 * ✅ Implementa:
 * - Verificação prévia de pagamento confirmado
 * - Verificação de avaliação duplicada
 * - Suporte a avaliações de transportadoras
 * - Tratamento de erros RLS com mensagens claras
 * - Logging para monitoramento
 */
export const useRatingSubmit = (): UseRatingSubmitResult => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Busca avaliações pendentes usando a função RPC
   */
  const getPendingRatings = useCallback(async (profileId: string): Promise<PendingRating[]> => {
    try {
      const { data, error: rpcError } = await supabase.rpc('get_pending_ratings_with_affiliation', {
        p_profile_id: profileId
      });

      if (rpcError) {
        console.error('[useRatingSubmit] Erro ao buscar avaliações pendentes:', rpcError);
        return [];
      }

      return (data || []).map((row: any) => ({
        freightId: row.freight_id,
        assignmentId: row.assignment_id,
        driverId: row.driver_id,
        driverName: row.driver_name,
        companyId: row.company_id,
        companyName: row.company_name,
        producerId: row.producer_id,
        producerName: row.producer_name,
        pendingTypes: row.pending_types || [],
        paymentConfirmedAt: row.payment_confirmed_at
      }));
    } catch (err) {
      console.error('[useRatingSubmit] Erro em getPendingRatings:', err);
      return [];
    }
  }, []);

  /**
   * Verifica se o usuário pode avaliar o frete
   */
  const canSubmitRating = useCallback(async (
    freightId: string,
    ratingType?: RatingType
  ): Promise<{ canSubmit: boolean; reason?: string }> => {
    try {
      // 1. Verificar se existe pelo menos um pagamento confirmado para este frete
      const { data: confirmedPayment, error: confirmedError } = await supabase
        .from('external_payments')
        .select('id, status')
        .eq('freight_id', freightId)
        .eq('status', 'confirmed')
        .limit(1)
        .maybeSingle();

      if (confirmedError) {
        console.error('[useRatingSubmit] Erro ao verificar pagamento:', confirmedError);
        return { canSubmit: false, reason: 'Erro ao verificar status do pagamento' };
      }

      if (!confirmedPayment) {
        // Buscar status atual para dar mensagem contextual
        const { data: currentPayment } = await supabase
          .from('external_payments')
          .select('status')
          .eq('freight_id', freightId)
          .limit(1)
          .maybeSingle();

        const currentStatus = currentPayment?.status?.toLowerCase?.()?.trim?.() || '';

        if (currentStatus === 'paid_by_producer') {
          return { 
            canSubmit: false, 
            reason: 'Aguardando o motorista confirmar o recebimento do pagamento. A avaliação será liberada após a confirmação.' 
          };
        } else if (currentStatus === 'proposed') {
          return { 
            canSubmit: false, 
            reason: 'O pagamento ainda não foi efetuado pelo produtor. A avaliação estará disponível após a confirmação mútua do pagamento.' 
          };
        } else {
          return { 
            canSubmit: false, 
            reason: 'O pagamento deste frete ainda não foi confirmado. A avaliação estará disponível após a confirmação do pagamento.' 
          };
        }
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

      // 4. Verificar se já avaliou (considerando o tipo específico se fornecido)
      let query = supabase
        .from('freight_ratings')
        .select('id')
        .eq('freight_id', freightId)
        .eq('rater_id', profile.id);

      if (ratingType) {
        query = query.eq('rating_type', ratingType);
      }

      const { data: existingRating } = await query.maybeSingle();

      if (existingRating) {
        return { canSubmit: false, reason: 'Você já enviou esta avaliação' };
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
      const { canSubmit, reason } = await canSubmitRating(data.freightId, data.ratingType);
      
      if (!canSubmit) {
        setError(reason || 'Não é possível avaliar este frete');
        toast.error('Avaliação não permitida', {
          description: reason || 'Verifique se o pagamento foi confirmado'
        });
        return false;
      }

      // Preparar dados para inserção
      const insertData: any = {
        freight_id: data.freightId,
        rater_id: data.raterId,
        rated_user_id: data.ratedUserId,
        rating: data.rating,
        comment: data.comment || null,
        rating_type: data.ratingType,
      };

      // Adicionar company_id se for avaliação de transportadora
      if (data.companyId && (data.ratingType === 'PRODUCER_TO_COMPANY' || data.ratingType === 'COMPANY_TO_PRODUCER')) {
        insertData.company_id = data.companyId;
      }

      // Adicionar assignment_id se fornecido (para fretes multi-carreta)
      if (data.assignmentId) {
        insertData.assignment_id = data.assignmentId;
      }

      // Submeter avaliação
      const { error: insertError } = await supabase
        .from('freight_ratings')
        .insert(insertData);

      if (insertError) {
        // Tratamento específico de erros RLS
        if (insertError.message.includes('row-level security')) {
          const userMessage = 'O pagamento deste frete ainda não foi confirmado. Aguarde a confirmação para avaliar.';
          setError(userMessage);
          toast.error('Avaliação não disponível', {
            description: userMessage
          });
          
          console.warn('[useRatingSubmit] RLS bloqueou avaliação:', {
            freightId: data.freightId,
            raterId: data.raterId,
            ratingType: data.ratingType
          });
          
          return false;
        }

        // Erro de duplicidade
        if (insertError.message.includes('duplicate key') || insertError.message.includes('unique')) {
          setError('Você já enviou esta avaliação');
          toast.error('Avaliação já registrada');
          return false;
        }

        // Outros erros
        throw insertError;
      }

      // Mensagem de sucesso personalizada
      const successMessages: Record<RatingType, string> = {
        'PRODUCER_TO_DRIVER': 'Avaliação do motorista enviada!',
        'DRIVER_TO_PRODUCER': 'Avaliação do produtor enviada!',
        'PRODUCER_TO_COMPANY': 'Avaliação da transportadora enviada!',
        'COMPANY_TO_PRODUCER': 'Avaliação do produtor enviada!'
      };

      toast.success(successMessages[data.ratingType] || 'Avaliação enviada com sucesso!');
      return true;

    } catch (err: any) {
      const errorMessage = err?.message || 'Erro ao enviar avaliação';
      setError(errorMessage);
      
      console.error('[useRatingSubmit] Erro ao submeter avaliação:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        freightId: data.freightId,
        ratingType: data.ratingType
      });

      // Enviar para monitoramento
      await ErrorMonitoringService.getInstance().captureError(
        new Error(`Rating Submission Failed: ${errorMessage}`),
        {
          module: 'useRatingSubmit',
          functionName: 'submitRating',
          freightId: data.freightId,
          raterId: data.raterId,
          ratingType: data.ratingType,
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
    canSubmitRating,
    getPendingRatings
  };
};
