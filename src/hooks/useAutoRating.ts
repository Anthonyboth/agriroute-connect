import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AutoRatingHookProps {
  freightId: string;
  freightStatus: string;
  currentUserProfile: any;
  freight: any;
}

/**
 * Hook para verificar e disparar avaliação automática de frete
 * 
 * ✅ CORREÇÃO: Avaliação SOMENTE após pagamento confirmado (status = 'confirmed' em external_payments)
 * O ciclo correto é:
 * 1. Motorista reporta entrega (DELIVERED_PENDING_CONFIRMATION)
 * 2. Produtor confirma pagamento (external_payments.status = 'confirmed')
 * 3. Frete vai para histórico (COMPLETED)
 * 4. AGORA ambos podem avaliar
 */
export const useAutoRating = ({ freightId, freightStatus, currentUserProfile, freight }: AutoRatingHookProps) => {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [userToRate, setUserToRate] = useState<any>(null);
  const [hasCheckedRating, setHasCheckedRating] = useState(false);

  // Função para verificar se pagamento foi confirmado
  const checkPaymentConfirmed = async (): Promise<boolean> => {
    if (!freightId || !currentUserProfile) return false;

    try {
      // Verificar se existe pagamento confirmado para este frete
      const { data: payment, error } = await supabase
        .from('external_payments')
        .select('id, status')
        .eq('freight_id', freightId)
        .eq('status', 'confirmed')
        .maybeSingle();

      if (error) {
        console.error('[useAutoRating] Erro ao verificar pagamento:', error);
        return false;
      }

      return !!payment;
    } catch (error) {
      console.error('[useAutoRating] Erro em checkPaymentConfirmed:', error);
      return false;
    }
  };

  // Função para verificar se o usuário já avaliou
  const checkIfUserHasRated = async () => {
    if (!freightId || !currentUserProfile) {
      return false;
    }
    
    // ✅ CORREÇÃO: Só permitir avaliação para status COMPLETED (após confirmação de pagamento)
    // DELIVERED_PENDING_CONFIRMATION e DELIVERED não são mais gatilhos de avaliação
    if (freightStatus !== 'COMPLETED') {
      console.log('[useAutoRating] Status não é COMPLETED, aguardando confirmação de pagamento');
      return false;
    }

    try {
      const { data: existingRating, error } = await supabase
        .from('freight_ratings')
        .select('id')
        .eq('freight_id', freightId)
        .eq('rater_id', currentUserProfile.id)
        .maybeSingle();

      if (error) {
        console.error('Error checking existing rating:', error);
        return false;
      }

      return !!existingRating; // Retorna true se já existe avaliação
    } catch (error) {
      console.error('Error in checkIfUserHasRated:', error);
      return false;
    }
  };

  // Determinar quem deve ser avaliado
  const determineUserToRate = () => {
    if (!freight || !currentUserProfile) return null;

    const isProducer = currentUserProfile.role === 'PRODUTOR';
    const isDriver = currentUserProfile.role === 'MOTORISTA' || currentUserProfile.role === 'MOTORISTA_AFILIADO';

    if (isProducer && freight.driver) {
      // Produtor avalia motorista
      return {
        id: freight.driver.id,
        full_name: freight.driver.full_name,
        role: 'MOTORISTA' as const
      };
    } else if (isDriver && freight.producer) {
      // Motorista avalia produtor
      return {
        id: freight.producer.id,
        full_name: freight.producer.full_name,
        role: 'PRODUTOR' as const
      };
    }

    return null;
  };

  // Efeito principal que monitora mudanças no status
  useEffect(() => {
    const handleAutoRating = async () => {
      // ✅ CORREÇÃO: Só executa se status é COMPLETED (após pagamento confirmado)
      if (freightStatus !== 'COMPLETED' || !currentUserProfile || hasCheckedRating || !freight) {
        return;
      }

      console.log('[useAutoRating] Verificando avaliação para frete COMPLETED:', freightId);

      try {
        // ✅ Verificar se pagamento foi confirmado (dupla verificação de segurança)
        const paymentConfirmed = await checkPaymentConfirmed();
        if (!paymentConfirmed) {
          console.log('[useAutoRating] Pagamento não confirmado, aguardando...');
          setHasCheckedRating(true);
          return;
        }

        // Verificar se já avaliou
        const hasRated = await checkIfUserHasRated();
        
        if (!hasRated) {
          // Determinar quem deve ser avaliado
          const userToRateData = determineUserToRate();
          
          if (userToRateData) {
            console.log('[useAutoRating] ✅ Mostrando modal de avaliação para:', userToRateData.full_name);
            setUserToRate(userToRateData);
            setShowRatingModal(true);
            
            // Mostrar notificação explicativa
            if (typeof window !== 'undefined') {
              setTimeout(() => {
                const event = new CustomEvent('showRatingNotification', {
                  detail: {
                    userName: userToRateData.full_name,
                    userRole: userToRateData.role
                  }
                });
                window.dispatchEvent(event);
              }, 500);
            }
          }
        }

        setHasCheckedRating(true);
      } catch (error) {
        console.error('[useAutoRating] Erro na verificação de avaliação:', error);
        setHasCheckedRating(true);
      }
    };

    // Delay para garantir que todos os dados estão carregados
    const timer = setTimeout(handleAutoRating, 2000);
    
    return () => clearTimeout(timer);
  }, [freightStatus, currentUserProfile, freight, freightId, hasCheckedRating]);

  // Reset quando muda de frete
  useEffect(() => {
    setHasCheckedRating(false);
    setShowRatingModal(false);
    setUserToRate(null);
  }, [freightId]);

  const closeRatingModal = () => {
    setShowRatingModal(false);
    setUserToRate(null);
  };

  return {
    showRatingModal,
    userToRate,
    closeRatingModal
  };
};