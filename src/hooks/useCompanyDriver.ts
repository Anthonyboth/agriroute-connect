import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { queryWithTimeout } from '@/lib/query-utils';

export const useCompanyDriver = () => {
  const { profile } = useAuth();
  
  const { data: companyDriver, isLoading } = useQuery({
    queryKey: ['company-driver', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      return await queryWithTimeout(
        async () => {
          const { data, error } = await supabase
            .from('company_drivers')
            .select(`
              *,
              company:company_id(
                id,
                company_name,
                company_cnpj
              )
            `)
            .eq('driver_profile_id', profile.id)
            .eq('status', 'ACTIVE')
            .maybeSingle();
          
          if (error) throw error;
          return data;
        },
        { timeoutMs: 8000, operationName: 'companyDriver' }
      );
    },
    enabled: !!profile?.id && (profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO'),
    staleTime: 60_000,
    retry: 1,
  });
  
  return {
    companyDriver,
    isCompanyDriver: !!companyDriver,
    companyId: companyDriver?.company_id,
    companyName: companyDriver?.company?.company_name,
    canAcceptFreights: companyDriver?.can_accept_freights || false,
    canManageVehicles: companyDriver?.can_manage_vehicles || false,
    isAffiliated: companyDriver?.affiliation_type === 'AFFILIATED',
    isLoading,
  };
};
