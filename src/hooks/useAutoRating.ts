import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

  // Função para verificar se o usuário já avaliou
  const checkIfUserHasRated = async () => {
    if (!freightId || !currentUserProfile) {
      return false;
    }
    
    // Aceitar DELIVERED ou DELIVERED_PENDING_CONFIRMATION
    if (freightStatus !== 'DELIVERED' && freightStatus !== 'DELIVERED_PENDING_CONFIRMATION') {
      return false;
    }
    
    // Se for DELIVERED_PENDING_CONFIRMATION, só mostrar para motorista
    if (freightStatus === 'DELIVERED_PENDING_CONFIRMATION' && currentUserProfile.role !== 'MOTORISTA') {
      return false;
    }

    try {
      const { data: existingRating, error } = await supabase
        .from('ratings')
        .select('id')
        .eq('freight_id', freightId)
        .eq('rater_user_id', currentUserProfile.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
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
    const isDriver = currentUserProfile.role === 'MOTORISTA';

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
      // Só executa se:
      // 1. Status é DELIVERED
      // 2. Temos um usuário logado
      // 3. Ainda não checamos se precisa mostrar avaliação
      // 4. Temos dados do frete
      if (freightStatus !== 'DELIVERED' || !currentUserProfile || hasCheckedRating || !freight) {
        return;
      }

      console.log('Checking auto rating for freight:', freightId);

      try {
        // Verificar se já avaliou
        const hasRated = await checkIfUserHasRated();
        
        if (!hasRated) {
          // Determinar quem deve ser avaliado
          const userToRateData = determineUserToRate();
          
          if (userToRateData) {
            console.log('Showing auto rating modal for:', userToRateData.full_name);
            setUserToRate(userToRateData);
            setShowRatingModal(true);
            
            // Mostrar notificação explicativa
            if (typeof window !== 'undefined') {
              setTimeout(() => {
                // Usar toast nativo ou criar notificação personalizada
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
        console.error('Error in auto rating check:', error);
        setHasCheckedRating(true);
      }
    };

    // Pequeno delay para garantir que todos os dados estão carregados
    const timer = setTimeout(handleAutoRating, 2000); // Aumentar para 2 segundos
    
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