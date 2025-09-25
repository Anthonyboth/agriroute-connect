import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

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
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    subscriptionTier: 'FREE',
    subscriptionEnd: null,
    userCategory: null,
    loading: true,
  });
  const [lastErrorTime, setLastErrorTime] = useState<number>(0);

  const checkSubscription = async () => {
    if (!user) {
      setState(prev => ({ ...prev, loading: false, subscriptionTier: 'FREE' }));
      return;
    }

    try {
      setState(prev => ({ ...prev, loading: true }));
      
      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) throw error;

      setState({
        subscribed: data.subscribed || false,
        subscriptionTier: data.subscription_tier || 'FREE',
        subscriptionEnd: data.subscription_end || null,
        userCategory: data.user_category || null,
        loading: false,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        subscriptionTier: 'FREE',
        subscribed: false,
        userCategory: null
      }));
      
      // Só notifica o usuário em erros de autenticação (401/403)
      const status = (error as any)?.status ?? (error as any)?.context?.response?.status ?? null;
      if (status === 401 || status === 403) {
        const now = Date.now();
        if (now - lastErrorTime > 10000) {
          setLastErrorTime(now);
          toast.error('Sua sessão expirou. Faça login novamente.', {
            action: {
              label: 'Fechar',
              onClick: () => {},
            },
          });
        }
      }
    }
  };

  const createCheckout = async (category: string, planType: 'essential' | 'professional') => {
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
      toast.error('Erro ao criar sessão de checkout');
    }
  };

  const openCustomerPortal = async () => {
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
      toast.error('Erro ao abrir portal do cliente');
    }
  };

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

  return (
    <SubscriptionContext.Provider 
      value={{
        ...state,
        checkSubscription,
        createCheckout,
        openCustomerPortal,
        canAccessFeature,
        getAvailablePlans,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};