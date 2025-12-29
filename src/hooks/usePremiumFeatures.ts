import { useAuth } from './useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PremiumFeatures {
  unlimitedExports: boolean;
  fullHistory: boolean;
  periodComparison: boolean;
  autoInsights: boolean;
}

export const FREE_FEATURES: PremiumFeatures = {
  unlimitedExports: false,
  fullHistory: false,
  periodComparison: false,
  autoInsights: false,
};

export const PREMIUM_FEATURES: PremiumFeatures = {
  unlimitedExports: true,
  fullHistory: true,
  periodComparison: true,
  autoInsights: true,
};

export const usePremiumFeatures = () => {
  const { user, profile } = useAuth();

  const { data: subscription, isLoading } = useQuery({
    queryKey: ['premium-subscription', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await supabase
        .from('premium_subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (error) {
        console.error('[usePremiumFeatures] Error:', error);
        return null;
      }

      return data;
    },
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  const isPremium = subscription?.plan_type === 'premium' || subscription?.plan_type === 'enterprise';
  const isTrial = subscription?.status === 'trial';
  const planType = subscription?.plan_type || 'free';

  const features: PremiumFeatures = isPremium || isTrial ? PREMIUM_FEATURES : FREE_FEATURES;

  // Check export limits for free users
  const { data: exportCount } = useQuery({
    queryKey: ['export-count-today', user?.id],
    queryFn: async () => {
      if (!user?.id || isPremium) return 0;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { count, error } = await supabase
        .from('report_exports')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', today.toISOString());

      if (error) {
        console.error('[usePremiumFeatures] Error counting exports:', error);
        return 0;
      }

      return count || 0;
    },
    enabled: !!user?.id && !isPremium,
    staleTime: 60 * 1000, // 1 minuto
  });

  const MAX_FREE_EXPORTS_PER_DAY = 3;
  const canExport = isPremium || (exportCount || 0) < MAX_FREE_EXPORTS_PER_DAY;
  const exportsRemaining = isPremium ? Infinity : Math.max(0, MAX_FREE_EXPORTS_PER_DAY - (exportCount || 0));

  return {
    isPremium,
    isTrial,
    isLoading,
    planType,
    features,
    canExport,
    exportsRemaining,
    subscription,
  };
};
