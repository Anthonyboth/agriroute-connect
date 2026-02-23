import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { devLog } from '@/lib/devLogger';
import { supabase } from '@/integrations/supabase/client';
import { AuthContext } from '@/hooks/useAuth';
import { subscriptionWithRetry } from '@/lib/query-utils';
import { RatingType } from '@/hooks/useRatingSubmit';

// Tipos para avaliação com múltiplas etapas
export interface RatingStep {
  type: RatingType;
  ratedUserId: string;
  ratedUserName: string;
  companyId?: string;
  label: string;
  icon?: React.ReactNode;
}

interface RatingContextType {
  openServiceRating: (requestId: string, ratedId: string, ratedName?: string, type?: string) => void;
  closeServiceRating: () => void;
  openFreightRating: (freightId: string, ratedId: string, ratedName?: string, companyId?: string, companyName?: string) => void;
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
  // Novos campos para transportadora
  freightCompanyId: string | null;
  freightCompanyName: string | null;
  ratingSteps: RatingStep[];
}

const RatingContext = createContext<RatingContextType | undefined>(undefined);

export const RatingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [serviceToRate, setServiceToRate] = useState<{ serviceRequestId: string; userId: string; userName: string; serviceType?: string } | null>(null);
  const [freightToRate, setFreightToRate] = useState<{ freightId: string; userId: string; userRole: string; userName: string } | null>(null);
  // Use AuthContext directly to avoid throwing when AuthProvider is temporarily unavailable
  const authContext = useContext(AuthContext);
  const profile = authContext?.profile;
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realtimeConnectedRef = useRef(false);
  const realtimeFailCountRef = useRef(0);
  const lastLogTimeRef = useRef(0);
  
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
  // Novos estados para transportadora
  const [freightCompanyId, setFreightCompanyId] = useState<string | null>(null);
  const [freightCompanyName, setFreightCompanyName] = useState<string | null>(null);
  const [ratingSteps, setRatingSteps] = useState<RatingStep[]>([]);

  // Track path changes without React Router
  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };

    // Patch history methods to dispatch custom event
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(history, args);
      window.dispatchEvent(new Event('locationchange'));
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(history, args);
      window.dispatchEvent(new Event('locationchange'));
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('locationchange', handleLocationChange);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('locationchange', handleLocationChange);
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);

  // 🔄 Função de polling para fallback quando Realtime falhar
  // ✅ CORREÇÃO: Agora verifica se o PAGAMENTO foi confirmado antes de solicitar avaliação
  const pollForPendingRatings = async () => {
    if (!profile?.id || currentPath === '/auth') return;

    const now = Date.now();
    if (now - lastLogTimeRef.current > 60000) {
      devLog('[RatingContext] 🔄 Polling para avaliações pendentes (após pagamento confirmado)...');
      lastLogTimeRef.current = now;
    }

    try {
      // Para produtor: buscar fretes COMPLETED com pagamento CONFIRMADO sem avaliação
      if (profile.role === 'PRODUTOR') {
        // Buscar fretes COMPLETED (não DELIVERED, pois COMPLETED = após confirmação de pagamento)
        const { data: freights } = await supabase
          .from('freights')
          .select(`
            id,
            status,
            driver_id,
            driver:profiles_secure!freights_driver_id_fkey(id, full_name, role)
          `)
          .eq('producer_id', profile.id)
          .eq('status', 'COMPLETED')
          .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('updated_at', { ascending: false })
          .limit(5);

        if (freights && freights.length > 0) {
          for (const freight of freights) {
            // ✅ Verificar se pagamento foi confirmado
            const { data: paymentConfirmed } = await supabase
              .from('external_payments')
              .select('id')
              .eq('freight_id', freight.id)
              .eq('status', 'confirmed')
              .maybeSingle();

            if (!paymentConfirmed) {
              devLog('[RatingContext] ⏳ Frete aguardando confirmação de pagamento:', freight.id);
              continue; // Pular este frete - pagamento não confirmado
            }

            // Verificar se já avaliou
            const { data: existingRating } = await supabase
              .from('freight_ratings')
              .select('id')
              .eq('freight_id', freight.id)
              .eq('rater_id', profile.id)
              .maybeSingle();

            if (!existingRating && freight.driver) {
              devLog('[RatingContext] ✅ Polling encontrou frete com pagamento confirmado pendente de avaliação:', freight.id);
              openFreightRating(freight.id, freight.driver.id, freight.driver.full_name);
              return; // Abrir apenas um de cada vez
            }
          }
        }
      }

      // Para motorista: buscar fretes onde ele participou e o pagamento foi confirmado
      if (profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO') {
        // Buscar assignments do motorista em fretes COMPLETED
        const { data: assignments } = await supabase
          .from('freight_assignments')
          .select(`
            id,
            freight_id,
            status,
            freight:freights!inner(
              id,
              status,
              producer_id,
              producer:profiles_secure!freights_producer_id_fkey(id, full_name, role)
            )
          `)
          .eq('driver_id', profile.id)
          .eq('status', 'DELIVERED')
          .gte('updated_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .order('updated_at', { ascending: false })
          .limit(5);

        if (assignments && assignments.length > 0) {
          for (const assignment of assignments) {
            const freight = assignment.freight as any;
            
            // ✅ Verificar se pagamento foi confirmado para este motorista
            const { data: paymentConfirmed } = await supabase
              .from('external_payments')
              .select('id')
              .eq('freight_id', freight.id)
              .eq('driver_id', profile.id)
              .eq('status', 'confirmed')
              .maybeSingle();

            if (!paymentConfirmed) {
              devLog('[RatingContext] ⏳ Aguardando confirmação de pagamento para motorista:', freight.id);
              continue; // Pular - pagamento não confirmado
            }

            // Verificar se já avaliou
            const { data: existingRating } = await supabase
              .from('freight_ratings')
              .select('id')
              .eq('freight_id', freight.id)
              .eq('rater_id', profile.id)
              .maybeSingle();

            if (!existingRating && freight.producer) {
              devLog('[RatingContext] ✅ Motorista pode avaliar frete com pagamento confirmado:', freight.id);
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
    if (!profile?.id || currentPath === '/auth') return;
    
    // Não iniciar se Realtime estiver muito instável
    if (realtimeFailCountRef.current >= 3) {
      console.warn('[RatingContext] 🔴 Realtime desabilitado após múltiplas falhas, usando apenas polling');
      return;
    }

    // Refs para armazenar os canais
    let serviceChannel: any = null;
    let freightRetryConfig: any = null;

    // ✅ DELAY: Aguardar 2s para autenticação estabilizar antes de iniciar subscriptions
    const delayTimer = setTimeout(() => {
      serviceChannel = supabase
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

      // 🚀 Detectar PAGAMENTO CONFIRMADO (não mais DELIVERED/DELIVERED_PENDING_CONFIRMATION)
      // ✅ CORREÇÃO: Avaliação só após confirmação de pagamento
      freightRetryConfig = subscriptionWithRetry(
        'payment_confirmation_detection',
        (channel) => {
          // Detectar quando pagamento é confirmado em external_payments
          channel.on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'external_payments',
            filter: `status=eq.confirmed`
          }, async (payload: any) => {
            const payment = payload.new;
            
            // Verificar se este pagamento é relevante para o usuário atual
            const isProducer = payment.producer_id === profile.id;
            const isDriver = payment.driver_id === profile.id;
            
            if (!isProducer && !isDriver) return;
            
            devLog('[RatingContext] 🔔 Pagamento CONFIRMADO detectado:', payment.freight_id);
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Buscar dados do frete para avaliação
            const { data: freight } = await supabase
              .from('freights')
              .select(`
                id,
                producer_id,
                driver_id,
                producer:profiles_secure!freights_producer_id_fkey(id, full_name),
                driver:profiles_secure!freights_driver_id_fkey(id, full_name)
              `)
              .eq('id', payment.freight_id)
              .maybeSingle();
            
            if (!freight) return;
            
            // Verificar se já avaliou
            const { data: existingRating } = await supabase
              .from('freight_ratings')
              .select('id')
              .eq('freight_id', freight.id)
              .eq('rater_id', profile.id)
              .maybeSingle();
            
            if (existingRating) return;
            
            // Produtor avalia motorista
            if (isProducer && freight.driver) {
              devLog('[RatingContext] ✅ Produtor pode avaliar motorista após pagamento confirmado');
              openFreightRating(freight.id, freight.driver.id, freight.driver.full_name);
            }
            
            // Motorista avalia produtor
            if (isDriver && freight.producer) {
              devLog('[RatingContext] ✅ Motorista pode avaliar produtor após pagamento confirmado');
              openFreightRating(freight.id, freight.producer.id, freight.producer.full_name);
            }
          });

          return channel;
        },
        {
          maxRetries: 5,
          retryDelayMs: 3000,
          onStatusChange: (status) => {
            const now = Date.now();
            
            // Apenas logar erros, não status normais
            if (status === 'CLOSED' || status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
              if (now - lastLogTimeRef.current > 60000) {
                console.warn(`[RatingContext] ⚠️ Status: ${status}`);
                lastLogTimeRef.current = now;
              }
              
              realtimeConnectedRef.current = false;
              realtimeFailCountRef.current++;
              
              if (realtimeFailCountRef.current >= 3) {
                console.warn('[RatingContext] 🔴 Realtime falhou 3x, desabilitando');
              }
            }
          },
          onReady: (channel) => {
            const now = Date.now();
            if (now - lastLogTimeRef.current > 60000) {
              devLog('[RatingContext] ✅ Realtime conectado');
              lastLogTimeRef.current = now;
            }
            realtimeConnectedRef.current = true;
            realtimeFailCountRef.current = 0; // Reset contador
            
            // Limpar polling se estava ativo
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
          },
          onError: (error) => {
            const now = Date.now();
            if (now - lastLogTimeRef.current > 60000) {
              console.error('[RatingContext] ❌ Erro no Realtime, ativando polling');
              lastLogTimeRef.current = now;
            }
            realtimeConnectedRef.current = false;
            
            // Ativar polling de fallback (intervalo maior)
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
            }
            pollingIntervalRef.current = setInterval(pollForPendingRatings, 60000); // A cada 60s
          }
        }
      );
    }, 2000); // Aguardar 2 segundos para estabilizar autenticação

    return () => {
      clearTimeout(delayTimer);
      if (serviceChannel) {
        supabase.removeChannel(serviceChannel);
      }
      if (freightRetryConfig) {
        freightRetryConfig.cleanup();
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [profile?.id, currentPath]);

  // 🔄 Polling inicial ao montar (caso Realtime nunca conecte)
  useEffect(() => {
    if (!profile?.id || currentPath === '/auth') return;

    const initialCheck = setTimeout(() => {
      if (!realtimeConnectedRef.current) {
        const now = Date.now();
        if (now - lastLogTimeRef.current > 60000) {
          devLog('[RatingContext] 🔄 Executando verificação inicial');
          lastLogTimeRef.current = now;
        }
        pollForPendingRatings();
      }
    }, 3000);

    return () => clearTimeout(initialCheck);
  }, [profile?.id, currentPath]);

  // Listener para abrir avaliação de frete após confirmação pelo produtor
  useEffect(() => {
    const handler = (event: Event) => {
      const ce = event as CustomEvent;
      const { freightId, ratedUserId, ratedUserName } = (ce.detail || {}) as any;
      if (freightId && ratedUserId) {
        // Abrir modal diretamente via state para evitar dependência de ordem de declaração
        setFreightId(freightId);
        setFreightRatedUserId(ratedUserId);
        setFreightRatedUserName(ratedUserName || null);
        setFreightRatingOpen(true);
      }
    };
    window.addEventListener('show-freight-rating', handler as EventListener);
    return () => window.removeEventListener('show-freight-rating', handler as EventListener);
  }, []);

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
    ratedName?: string,
    companyId?: string,
    companyName?: string
  ) => {
    setFreightId(fId);
    setFreightRatedUserId(ratedId);
    setFreightRatedUserName(ratedName || null);
    setFreightCompanyId(companyId || null);
    setFreightCompanyName(companyName || null);
    
    // Construir steps de avaliação
    const steps: RatingStep[] = [];
    
    // Se temos ratedId, é avaliação de motorista ou produtor
    if (ratedId) {
      // Determinar o tipo baseado no role do usuário
      if (profile?.role === 'PRODUTOR') {
        steps.push({
          type: 'PRODUCER_TO_DRIVER',
          ratedUserId: ratedId,
          ratedUserName: ratedName || 'Motorista',
          label: 'Motorista'
        });
        
        // Se motorista tem transportadora, adicionar step para avaliar empresa
        if (companyId && companyName) {
          steps.push({
            type: 'PRODUCER_TO_COMPANY',
            ratedUserId: companyId, // Para avaliação de empresa, usamos company_id
            ratedUserName: companyName,
            companyId: companyId,
            label: 'Transportadora'
          });
        }
      } else if (profile?.role === 'MOTORISTA' || profile?.role === 'MOTORISTA_AFILIADO') {
        steps.push({
          type: 'DRIVER_TO_PRODUCER',
          ratedUserId: ratedId,
          ratedUserName: ratedName || 'Produtor',
          label: 'Produtor'
        });
      } else if (profile?.role === 'TRANSPORTADORA') {
        steps.push({
          type: 'COMPANY_TO_PRODUCER',
          ratedUserId: ratedId,
          ratedUserName: ratedName || 'Produtor',
          companyId: companyId,
          label: 'Produtor'
        });
      }
    }
    
    setRatingSteps(steps);
    setFreightRatingOpen(true);
  };

  const closeFreightRating = () => {
    setFreightRatingOpen(false);
    setFreightId(null);
    setFreightRatedUserId(null);
    setFreightRatedUserName(null);
    setFreightCompanyId(null);
    setFreightCompanyName(null);
    setRatingSteps([]);
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
        freightCompanyId,
        freightCompanyName,
        ratingSteps,
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
