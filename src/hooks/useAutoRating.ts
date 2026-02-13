import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/lib/devLogger';

// Interfaces
interface UserToRate {
  id: string;
  full_name: string;
  role: 'PRODUTOR' | 'MOTORISTA';
}

interface AutoRatingHookProps {
  freightId: string;
  freightStatus: string;
  currentUserProfile: any;
  freight: any;
}

export const useAutoRating = ({ freightId, freightStatus, currentUserProfile, freight }: AutoRatingHookProps) => {
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [userToRate, setUserToRate] = useState<any>(null);
  const [hasCheckedRating, setHasCheckedRating] = useState(false);

  const checkPaymentConfirmed = async (): Promise<boolean> => {
    if (!freightId || !currentUserProfile) return false;
    try {
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

  const checkIfUserHasRated = async () => {
    if (!freightId || !currentUserProfile) return false;
    if (freightStatus !== 'COMPLETED') {
      devLog('[useAutoRating] Status não é COMPLETED, aguardando confirmação de pagamento');
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
      return !!existingRating;
    } catch (error) {
      console.error('Error in checkIfUserHasRated:', error);
      return false;
    }
  };

  const determineUserToRate = () => {
    if (!freight || !currentUserProfile) return null;
    const isProducer = currentUserProfile.role === 'PRODUTOR';
    const isDriver = currentUserProfile.role === 'MOTORISTA' || currentUserProfile.role === 'MOTORISTA_AFILIADO';
    if (isProducer && freight.driver) {
      return { id: freight.driver.id, full_name: freight.driver.full_name, role: 'MOTORISTA' as const };
    } else if (isDriver && freight.producer) {
      return { id: freight.producer.id, full_name: freight.producer.full_name, role: 'PRODUTOR' as const };
    }
    return null;
  };

  useEffect(() => {
    const handleAutoRating = async () => {
      if (freightStatus !== 'COMPLETED' || !currentUserProfile || hasCheckedRating || !freight) return;
      devLog('[useAutoRating] Verificando avaliação para frete COMPLETED:', freightId);
      try {
        const paymentConfirmed = await checkPaymentConfirmed();
        if (!paymentConfirmed) {
          devLog('[useAutoRating] Pagamento não confirmado, aguardando...');
          setHasCheckedRating(true);
          return;
        }
        const hasRated = await checkIfUserHasRated();
        if (!hasRated) {
          const userToRateData = determineUserToRate();
          if (userToRateData) {
            devLog('[useAutoRating] ✅ Mostrando modal de avaliação para:', userToRateData.full_name);
            setUserToRate(userToRateData);
            setShowRatingModal(true);
            if (typeof window !== 'undefined') {
              setTimeout(() => {
                const event = new CustomEvent('showRatingNotification', {
                  detail: { userName: userToRateData.full_name, userRole: userToRateData.role }
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
    const timer = setTimeout(handleAutoRating, 2000);
    return () => clearTimeout(timer);
  }, [freightStatus, currentUserProfile, freight, freightId, hasCheckedRating]);

  useEffect(() => {
    setHasCheckedRating(false);
    setShowRatingModal(false);
    setUserToRate(null);
  }, [freightId]);

  const closeRatingModal = () => {
    setShowRatingModal(false);
    setUserToRate(null);
  };

  return { showRatingModal, userToRate, closeRatingModal };
};
