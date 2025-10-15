import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface RatingContextType {
  openServiceRating: (serviceRequestId: string, ratedUserId: string, ratedUserName?: string, serviceType?: string) => void;
  closeServiceRating: () => void;
  openFreightRating: (freightId: string, ratedUserId: string, ratedUserName?: string) => void;
  closeFreightRating: () => void;
  
  // Service rating state
  serviceRatingOpen: boolean;
  serviceRequestId: string | null;
  serviceRatedUserId: string | null;
  serviceRatedUserName: string | null;
  serviceType: string | null;
  
  // Freight rating state
  freightRatingOpen: boolean;
  freightId: string | null;
  freightRatedUserId: string | null;
  freightRatedUserName: string | null;
}

const RatingContext = createContext<RatingContextType | undefined>(undefined);

export const RatingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  
  // Service rating state
  const [serviceRatingOpen, setServiceRatingOpen] = useState(false);
  const [serviceRequestId, setServiceRequestId] = useState<string | null>(null);
  const [serviceRatedUserId, setServiceRatedUserId] = useState<string | null>(null);
  const [serviceRatedUserName, setServiceRatedUserName] = useState<string | null>(null);
  const [serviceType, setServiceType] = useState<string | null>(null);
  
  // Freight rating state
  const [freightRatingOpen, setFreightRatingOpen] = useState(false);
  const [freightId, setFreightId] = useState<string | null>(null);
  const [freightRatedUserId, setFreightRatedUserId] = useState<string | null>(null);
  const [freightRatedUserName, setFreightRatedUserName] = useState<string | null>(null);

  // Detectar conclusão de serviços em tempo real
  useEffect(() => {
    if (!profile?.id) return;

    const serviceChannel = supabase
      .channel('service_completion_detection')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'service_requests',
        filter: `status=eq.COMPLETED`
      }, async (payload: any) => {
        const service = payload.new;
        
        // Verificar se o usuário atual está envolvido
        if (service.client_id === profile.id || service.provider_id === profile.id) {
          // Aguardar 1 segundo para dar tempo do status ser atualizado
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verificar se já avaliou
          const { data: existingRating } = await supabase
            .from('service_ratings')
            .select('id')
            .eq('service_request_id', service.id)
            .eq('rater_id', profile.id)
            .maybeSingle();
          
          if (!existingRating) {
            // Determinar quem será avaliado
            const ratedUserId = service.client_id === profile.id ? service.provider_id : service.client_id;
            
            // Buscar nome do avaliado
            const { data: ratedProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', ratedUserId)
              .single();
            
            // Abrir modal automaticamente
            openServiceRating(
              service.id, 
              ratedUserId, 
              ratedProfile?.full_name,
              service.service_type
            );
          }
        }
      })
      .subscribe();

    // Detectar conclusão de fretes em tempo real
    const freightChannel = supabase
      .channel('freight_completion_detection')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'freights',
        filter: `status=eq.DELIVERED`
      }, async (payload: any) => {
        const freight = payload.new;
        
        // Verificar se o usuário atual está envolvido
        if (freight.producer_id === profile.id || freight.driver_id === profile.id) {
          // Aguardar 1 segundo
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Verificar se já avaliou
          const { data: existingRating } = await supabase
            .from('freight_ratings')
            .select('id')
            .eq('freight_id', freight.id)
            .eq('rater_id', profile.id)
            .maybeSingle();
          
          if (!existingRating) {
            // Determinar quem será avaliado
            const ratedUserId = freight.producer_id === profile.id ? freight.driver_id : freight.producer_id;
            
            // Buscar nome do avaliado
            const { data: ratedProfile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', ratedUserId)
              .single();
            
            // Abrir modal automaticamente
            openFreightRating(
              freight.id, 
              ratedUserId, 
              ratedProfile?.full_name
            );
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(serviceChannel);
      supabase.removeChannel(freightChannel);
    };
  }, [profile?.id]);

  const openServiceRating = (
    requestId: string, 
    ratedId: string, 
    ratedName?: string,
    type?: string
  ) => {
    setServiceRequestId(requestId);
    setServiceRatedUserId(ratedId);
    setServiceRatedUserName(ratedName || null);
    setServiceType(type || null);
    setServiceRatingOpen(true);
  };

  const closeServiceRating = () => {
    setServiceRatingOpen(false);
    setServiceRequestId(null);
    setServiceRatedUserId(null);
    setServiceRatedUserName(null);
    setServiceType(null);
  };

  const openFreightRating = (
    fId: string, 
    ratedId: string, 
    ratedName?: string
  ) => {
    setFreightId(fId);
    setFreightRatedUserId(ratedId);
    setFreightRatedUserName(ratedName || null);
    setFreightRatingOpen(true);
  };

  const closeFreightRating = () => {
    setFreightRatingOpen(false);
    setFreightId(null);
    setFreightRatedUserId(null);
    setFreightRatedUserName(null);
  };

  return (
    <RatingContext.Provider
      value={{
        openServiceRating,
        closeServiceRating,
        openFreightRating,
        closeFreightRating,
        serviceRatingOpen,
        serviceRequestId,
        serviceRatedUserId,
        serviceRatedUserName,
        serviceType,
        freightRatingOpen,
        freightId,
        freightRatedUserId,
        freightRatedUserName,
      }}
    >
      {children}
    </RatingContext.Provider>
  );
};

export const useGlobalRating = () => {
  const context = useContext(RatingContext);
  if (context === undefined) {
    throw new Error('useGlobalRating must be used within a RatingProvider');
  }
  return context;
};
