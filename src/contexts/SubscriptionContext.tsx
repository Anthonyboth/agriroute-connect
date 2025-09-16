import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type SubscriptionTier = 'FREE' | 'ESSENTIAL' | 'PROFESSIONAL';

interface SubscriptionState {
  subscribed: boolean;
  subscriptionTier: SubscriptionTier;
  subscriptionEnd: string | null;
  loading: boolean;
}

interface SubscriptionContextType extends SubscriptionState {
  checkSubscription: () => Promise<void>;
  createCheckout: (tier: 'ESSENTIAL' | 'PROFESSIONAL') => Promise<void>;
  openCustomerPortal: () => Promise<void>;
  canAccessFeature: (requiredTier: SubscriptionTier) => boolean;
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
        loading: false,
      });
    } catch (error) {
      console.error('Error checking subscription:', error);
      setState(prev => ({ 
        ...prev, 
        loading: false,
        subscriptionTier: 'FREE',
        subscribed: false 
      }));
      
      // Avoid multiple error toasts within 10 seconds
      const now = Date.now();
      if (now - lastErrorTime > 10000) {
        setLastErrorTime(now);
        toast.error('Erro ao verificar assinatura', {
          action: {
            label: 'Fechar',
            onClick: () => {},
          },
        });
      }
    }
  };

  const createCheckout = async (tier: 'ESSENTIAL' | 'PROFESSIONAL') => {
    if (!user) {
      toast.error('Você precisa estar logado para assinar');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier }
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
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};