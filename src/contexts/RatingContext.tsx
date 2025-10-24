import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { subscriptionWithRetry } from '@/lib/query-utils';

// Tipos
interface RatingContextType {
  openServiceRating: (requestId: string, ratedId: string, ratedName?: string, type?: string) => void;
  closeServiceRating: () => void;
  openFreightRating: (freightId: string, ratedId: string, ratedName?: string) => void;
  closeFreightRating: () => void;
  serviceRatingOpen: boolean;
  serviceRequestId: string | null;
  serviceRatedUserId: string | null;
  serviceRatedUserName: string | null;
  serviceType: string | null;
  freightRatingOpen: boolean;
  freightId: string | null;
  freightRatedUserId: string | null;
  freightRatedUserName: string | null;
}

const RatingContext = createContext<RatingContextType | undefined>(undefined);

export const RatingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [serviceToRate, setServiceToRate] = useState<{ serviceRequestId: string; userId: string; userName: string; serviceType?: string } | null>(null);
  const [freightToRate, setFreightToRate] = useState<{ freightId: string; userId: string; userRole: string; userName: string } | null>(null);
  const { profile } = useAuth();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeConnectedRef = useRef(false);
  
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

  // 🔄 Função de polling para fallback quando Realtime falhar
  const pollForPendingRatings = async () => {
    if (!profile?.id) return;

    console.log('[RatingContext] 🔄 Polling para avaliações pendentes...');

    try {
      // Para produtor: buscar fretes DELIVERED sem avaliação
      if (profile.role === 'PRODUTOR') {
        // Buscar nos últimos 30 dias
        let { data: freights } = await supabase
          .from('freights')
          .select(`
            *,
            driver:profiles!freights_driver_id_fkey(id, full_name, role)
          `)
          .eq('producer_id', profile.id)
          .eq('status', 'DELIVERED')
          .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        // Fallback: se não encontrou nada nos últimos 30 dias, buscar sem filtro de data
        if (!freights || freights.length === 0) {
          const { data: oldFreights } = await supabase
            .from('freights')
            .select(`
              *,
              driver:profiles!freights_driver_id_fkey(id, full_name, role)
            `)
            .eq('producer_id', profile.id)
            .eq('status', 'DELIVERED')
            .order('updated_at', { ascending: false })
            .limit(1);
          
          freights = oldFreights;
        }

        if (freights && freights.length > 0) {
          for (const freight of freights) {
            const { data: existingRating } = await supabase
              .from('freight_ratings')
              .select('id')
              .eq('freight_id', freight.id)
              .eq('rater_id', profile.id)
              .maybeSingle();

            if (!existingRating && freight.driver) {
              console.log('[RatingContext] ✅ Polling encontrou frete pendente de avaliação:', freight.id);
              openFreightRating(freight.id, freight.driver.id, freight.driver.full_name);
              return; // Abrir apenas um de cada vez
            }
          }
        }
      }

      // Para motorista: buscar fretes DELIVERED_PENDING_CONFIRMATION sem avaliação
      if (profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO') {
        // Buscar nos últimos 30 dias
        let { data: freights } = await supabase
          .from('freights')
          .select(`
            *,
            producer:profiles!freights_producer_id_fkey(id, full_name, role)
          `)
          .eq('driver_id', profile.id)
          .eq('status', 'DELIVERED_PENDING_CONFIRMATION')
          .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .limit(1);

        // Fallback: se não encontrou nada nos últimos 30 dias, buscar sem filtro de data
        if (!freights || freights.length === 0) {
          const { data: oldFreights } = await supabase
            .from('freights')
            .select(`
              *,
              producer:profiles!freights_producer_id_fkey(id, full_name, role)
            `)
            .eq('driver_id', profile.id)
            .eq('status', 'DELIVERED_PENDING_CONFIRMATION')
            .order('updated_at', { ascending: false })
            .limit(1);
          
          freights = oldFreights;
        }

        if (freights && freights.length > 0) {
          for (const freight of freights) {
            const { data: existingRating } = await supabase
              .from('freight_ratings')
              .select('id')
              .eq('freight_id', freight.id)
              .eq('rater_id', profile.id)
              .maybeSingle();

            if (!existingRating && freight.producer) {
              console.log('[RatingContext] ✅ Polling encontrou frete pendente de avaliação:', freight.id);
              openFreightRating(freight.id, freight.producer.id, freight.producer.full_name);
              return;
            }
          }
        }
      }
    } catch (error) {
      console.error('[RatingContext] ❌ Erro no polling:', error);
    }
  };

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

    // 🚀 Detectar DELIVERED e DELIVERED_PENDING_CONFIRMATION com subscriptionWithRetry
    const freightRetryConfig = subscriptionWithRetry(
      'freight_delivery_detection',
      (channel) => {
        // DELIVERED: produtor avalia motorista
        channel.on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'freights',
          filter: `status=eq.DELIVERED`
        }, async (payload: any) => {
          const freight = payload.new;
          
          if (freight.producer_id === profile.id) {
            console.log('[RatingContext] 🔔 DELIVERED detectado para produtor:', freight.id);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const { data: existingRating } = await supabase
              .from('freight_ratings')
              .select('id')
              .eq('freight_id', freight.id)
              .eq('rater_id', profile.id)
              .maybeSingle();
            
            if (!existingRating && freight.driver_id) {
              const { data: driverProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', freight.driver_id)
                .single();
              
              openFreightRating(freight.id, freight.driver_id, driverProfile?.full_name);
            }
          }
        });

        // DELIVERED_PENDING_CONFIRMATION: motorista avalia produtor
        channel.on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'freights',
          filter: `status=eq.DELIVERED_PENDING_CONFIRMATION`
        }, async (payload: any) => {
          const freight = payload.new;
          
          if (freight.driver_id === profile.id) {
            console.log('[RatingContext] 🔔 DELIVERED_PENDING_CONFIRMATION detectado para motorista:', freight.id);
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const { data: existingRating } = await supabase
              .from('freight_ratings')
              .select('id')
              .eq('freight_id', freight.id)
              .eq('rater_id', profile.id)
              .maybeSingle();
            
            if (!existingRating && freight.producer_id) {
              const { data: producerProfile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', freight.producer_id)
                .single();
              
              openFreightRating(freight.id, freight.producer_id, producerProfile?.full_name);
            }
          }
        });

        return channel;
      },
      {
        maxRetries: 5,
        retryDelayMs: 3000,
        onStatusChange: (status) => {
          console.log(`[RatingContext] 📡 Status changed: ${status}`);
          if (status === 'CLOSED' || status === 'TIMED_OUT') {
            realtimeConnectedRef.current = false;
          }
        },
        onReady: (channel) => {
          console.log('[RatingContext] ✅ Realtime conectado com sucesso');
          realtimeConnectedRef.current = true;
          
          // Limpar polling se estava ativo
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        },
        onError: (error) => {
          console.error('[RatingContext] ❌ Erro no Realtime, ativando polling:', error);
          realtimeConnectedRef.current = false;
          
          // Ativar polling de fallback
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          pollingIntervalRef.current = setInterval(pollForPendingRatings, 30000); // A cada 30s
          console.log('[RatingContext] 🔄 Polling ativado como fallback');
        }
      }
    );

    return () => {
      supabase.removeChannel(serviceChannel);
      freightRetryConfig.cleanup();
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [profile?.id]);

  // 🔄 Polling inicial ao montar (caso Realtime nunca conecte)
  useEffect(() => {
    if (!profile?.id) return;

    const initialCheck = setTimeout(() => {
      if (!realtimeConnectedRef.current) {
        console.log('[RatingContext] 🔄 Executando verificação inicial de avaliações pendentes');
        pollForPendingRatings();
      }
    }, 3000); // 3s após montar

    return () => clearTimeout(initialCheck);
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
