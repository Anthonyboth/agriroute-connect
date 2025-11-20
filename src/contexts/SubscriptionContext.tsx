import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';

export type SubscriptionTier = 'FREE' | 'ESSENTIAL' | 'PROFESSIONAL';

interface SubscriptionState {
  subscribed: boolean;
  subscriptionTier: SubscriptionTier;
  subscriptionEnd: string | null;
  userCategory: string | null;
  loading: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  createCheckout: (category: string, planType: 'essential' | 'professional') => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  canAccessFeature: (requiredTier: SubscriptionTier) => boolean;
  getAvailablePlans: () => any[];
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

const tierHierarchy = {
  FREE: 0,
  ESSENTIAL: 1,  
  PROFESSIONAL: 2
};

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ 
  children 
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    subscriptionTier: 'FREE',
    subscriptionEnd: null,
    userCategory: null,
    loading: true,
  });
  const [lastErrorTime, setLastErrorTime] = useState<number>(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!user) {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, loading: false, subscriptionTier: 'FREE' }));
      return;
    }

    // Evitar chamadas se a sessão está expirada
    const session = await supabase.auth.getSession();
    if (!session.data.session) {
      if (!mountedRef.current) return;
      setState(prev => ({ ...prev, loading: false, subscriptionTier: 'FREE' }));
      return;
    }

    // Gate: não executar na rota /auth
    if (location.pathname === '/auth') {
      return;
    }

    // Prevenir chamadas concorrentes
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;

    // Retry logic with exponential backoff for session propagation
    const retryDelays = [100, 500, 1000]; // Progressive delays
    let lastError: any = null;

    for (let attempt = 0; attempt <= retryDelays.length; attempt++) {
      try {
        if (!mountedRef.current) return;
        
        if (attempt === 0) {
          setState(prev => ({ ...prev, loading: true }));
        }
        
        const { data, error } = await supabase.functions.invoke('check-subscription', {
          headers: {
            'Authorization': session.data.session?.access_token ? `Bearer ${session.data.session.access_token}` : ''
          }
        });
        
        if (error) throw error;

        if (!mountedRef.current) return;
        setState({
          subscribed: data.subscribed || false,
          subscriptionTier: data.subscription_tier || 'FREE',
          subscriptionEnd: data.subscription_end || null,
          userCategory: data.user_category || null,
          loading: false,
        });
        
        // Success - exit retry loop
        inFlightRef.current = false;
        return;
        
      } catch (error) {
        lastError = error;
        const errorMessage = (error as any)?.message || String(error);
        
        // Check if it's a session propagation error
        const isSessionPropagationError = errorMessage.includes('session_id') || 
                                         errorMessage.includes('Session from') ||
                                         errorMessage.includes('does not exist');
        
        // If it's the last attempt or not a propagation error, break
        if (attempt >= retryDelays.length || !isSessionPropagationError) {
          console.error(`Subscription check failed after ${attempt + 1} attempts:`, error);
          break;
        }
        
        // Wait before next retry
        await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        console.log(`Retrying subscription check (attempt ${attempt + 2}/${retryDelays.length + 1})...`);
      }
    }
    
    // All retries failed
    if (!mountedRef.current) {
      inFlightRef.current = false;
      return;
    }
    
    // Sempre permitir acesso com tier FREE em caso de erro
    setState(prev => ({ 
      ...prev, 
      loading: false,
      subscriptionTier: 'FREE',
      subscribed: false,
      userCategory: null
    }));
    
    // Só notifica o usuário em erros críticos de autenticação E fora da rota /auth
    // Não notificar em erros de propagação de sessão (500)
    const status = (lastError as any)?.status ?? (lastError as any)?.context?.response?.status ?? null;
    if ((status === 401 || status === 403) && location.pathname !== '/auth') {
      const now = Date.now();
      if (now - lastErrorTime > 30000) {
        setLastErrorTime(now);
        toast.error('Sua sessão expirou. Faça login novamente.', {
          action: {
            label: 'Fechar',
            onClick: () => {},
          },
        });
      }
    }
    // Para erros de sessão (500) não notifica para não interromper o fluxo
    
    inFlightRef.current = false;
  }, [user, location.pathname, lastErrorTime]);

  const createCheckout = useCallback(async (category: string, planType: 'essential' | 'professional') => {
    if (!user) {
      toast.error('Você precisa estar logado para assinar');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { category, planType }
      });

      if (error) throw error;

      // Open Stripe checkout in new tab
      window.open(data.url, '_blank');
      
      toast.success('Redirecionando para o checkout...');
    } catch (error) {
      console.error('Error creating checkout:', error);
      if (location.pathname !== '/auth') {
        toast.error('Erro ao criar sessão de checkout');
      }
    }
  }, [user, location.pathname]);

  const openCustomerPortal = useCallback(async () => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      // Open customer portal in new tab
      window.open(data.url, '_blank');
      
      toast.success('Abrindo portal do cliente...');
    } catch (error) {
      console.error('Error opening customer portal:', error);
      if (location.pathname !== '/auth') {
        toast.error('Erro ao abrir portal do cliente');
      }
    }
  }, [user, location.pathname]);

  const getAvailablePlans = () => {
    const category = state.userCategory || 'prestador';
    
    // New pricing scheme based on user requirements
    const categoryPlans = {
      'prestador': [
        { id: 'free', name: 'Plano Grátis', price: 0, planType: 'free', commission: '5%' },
        { id: 'essential', name: 'Plano Essencial', price: 69, planType: 'essential', commission: '2%' },
        { id: 'professional', name: 'Plano Profissional', price: 119, planType: 'professional', commission: '0%' }
      ],
      'motorista_rural': [
        { id: 'free', name: 'Plano Grátis', price: 0, planType: 'free', commission: '5%' },
        { id: 'essential', name: 'Plano Essencial', price: 119, planType: 'essential', commission: '2%' },
        { id: 'professional', name: 'Plano Profissional', price: 199, planType: 'professional', commission: '0%' }
      ],
      'motorista_urbano': [
        { id: 'free', name: 'Plano Grátis', price: 0, planType: 'free', commission: '5%' },
        { id: 'essential', name: 'Plano Essencial', price: 69, planType: 'essential', commission: '2%' },
        { id: 'professional', name: 'Plano Profissional', price: 119, planType: 'professional', commission: '0%' }
      ],
      'guincho_urbano': [
        { id: 'free', name: 'Plano Grátis', price: 0, planType: 'free', commission: '5%' },
        { id: 'essential', name: 'Plano Essencial', price: 69, planType: 'essential', commission: '2%' },
        { id: 'professional', name: 'Plano Profissional', price: 119, planType: 'professional', commission: '0%' }
      ]
    };

    return categoryPlans[category as keyof typeof categoryPlans] || categoryPlans.prestador;
  };

  const canAccessFeature = (requiredTier: SubscriptionTier): boolean => {
    return tierHierarchy[state.subscriptionTier] >= tierHierarchy[requiredTier];
  };

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    if (user) {
      // Debounce subscription check to avoid multiple calls
      timeoutId = setTimeout(() => {
        checkSubscription();
      }, 500);
    } else {
      setState({
        subscribed: false,
        subscriptionTier: 'FREE',
        subscriptionEnd: null,
        userCategory: null,
        loading: false,
      });
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user]);

  const value = useMemo(() => ({
    ...state,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
    canAccessFeature,
    getAvailablePlans,
  }), [state, checkSubscription, createCheckout, openCustomerPortal]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};