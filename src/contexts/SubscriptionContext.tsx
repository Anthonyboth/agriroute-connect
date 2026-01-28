import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
import { forceLogoutAndRedirect } from '@/utils/authRecovery';

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
  // Removed unused lastErrorTime state

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

    // Gate: não executar na rota /auth
    if (location.pathname === '/auth') {
      return;
    }

    // Prevenir chamadas concorrentes
    if (inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;

    // Helper para obter token válido (com refresh se necessário)
    const getValidAccessToken = async (): Promise<string | null> => {
      // Primeiro, tentar obter a sessão atual
      const { data: sessionData } = await supabase.auth.getSession();
      
      if (!sessionData.session) {
        // Sem sessão, tentar refresh
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          console.warn('[SubscriptionContext] No valid session after refresh');
          return null;
        }
        return refreshData.session.access_token;
      }
      
      // Verificar se o token está próximo de expirar (< 2 minutos)
      const expiresAt = sessionData.session.expires_at || 0;
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = expiresAt - now;
      
      if (expiresIn < 120) {
        // Token quase expirando, fazer refresh
        console.log('[SubscriptionContext] Token expiring soon, refreshing...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          console.warn('[SubscriptionContext] Failed to refresh expiring token');
          // Usar o token atual mesmo assim
          return sessionData.session.access_token;
        }
        return refreshData.session.access_token;
      }
      
      return sessionData.session.access_token;
    };

    // Retry logic with session refresh on 401
    const maxRetries = 2;
    let lastError: any = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (!mountedRef.current) return;
        
        if (attempt === 0) {
          setState(prev => ({ ...prev, loading: true }));
        }
        
        // Obter token válido (com refresh automático se necessário)
        const accessToken = await getValidAccessToken();
        
        if (!accessToken) {
          console.warn('[SubscriptionContext] No valid access token available');
          // Se o app acredita que há usuário mas não há token válido, forçar logout.
          await forceLogoutAndRedirect('/auth');
          break;
        }
        
        const { data, error } = await supabase.functions.invoke('check-subscription', {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        // Verificar se retornou SESSION_EXPIRED (401) para tentar refresh
        if (error || (data && data.code === 'SESSION_EXPIRED')) {
          const errorMessage = error?.message || data?.error || '';
          const isSessionError = errorMessage.includes('Session expired') || 
                                 errorMessage.includes('SESSION_EXPIRED') ||
                                 data?.code === 'SESSION_EXPIRED';
          
          if (isSessionError && attempt < maxRetries - 1) {
            console.log('[SubscriptionContext] Session expired, forcing refresh...');
            // Forçar refresh da sessão
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (!refreshError && refreshData.session) {
              console.log('[SubscriptionContext] Session refreshed, retrying...');
              await new Promise(resolve => setTimeout(resolve, 300));
              continue; // Retry com novo token
            }
          }

          // Sessão inválida e não conseguimos recuperar → logout para evitar loop de 401.
          if (isSessionError) {
            await forceLogoutAndRedirect('/auth');
            return;
          }
          
          if (error) throw error;
        }

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
        console.error(`[SubscriptionContext] Attempt ${attempt + 1} failed:`, error);
        
        // Se for 401 e ainda temos tentativas, retry
        const status = (error as any)?.status ?? (error as any)?.context?.response?.status ?? null;
        if (status === 401 && attempt < maxRetries - 1) {
          console.log('[SubscriptionContext] Got 401, will retry after refresh...');
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        
        break;
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
    
    // Não mostrar toast de erro para não interromper o fluxo
    // O usuário pode continuar usando com tier FREE
    console.warn('[SubscriptionContext] Using FREE tier due to session/subscription check failure');
    
    inFlightRef.current = false;
  }, [user, location.pathname]);

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
    // Planos informativos - cobrança não está ativa
    // Valores fixos para todas as categorias conforme solicitado
    const plans = [
      { id: 'free', name: 'Plano Grátis', price: 0, planType: 'free', commission: '10%' },
      { id: 'essential', name: 'Plano Essencial', price: 120, planType: 'essential', commission: '5%' },
      { id: 'professional', name: 'Plano Profissional', price: 240, planType: 'professional', commission: '0%' }
    ];

    return plans;
  };

  const canAccessFeature = (requiredTier: SubscriptionTier): boolean => {
    return tierHierarchy[state.subscriptionTier] >= tierHierarchy[requiredTier];
  };

  // ✅ P0 FIX: Usar user?.id em vez de user objeto para evitar loops
  // quando o objeto user é recriado mas o id permanece o mesmo
  const userIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    // ✅ CRÍTICO: Só executar se o ID do usuário realmente mudou
    if (user?.id === userIdRef.current) {
      return; // ID não mudou, não refazer a verificação
    }
    
    userIdRef.current = user?.id ?? null;
    
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
  }, [user?.id]); // ✅ Usar user?.id em vez de user para estabilidade

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