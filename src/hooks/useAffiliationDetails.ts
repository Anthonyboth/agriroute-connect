import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useCompanyDriver } from './useCompanyDriver';

export interface AffiliationDetails {
  // Empresa
  companyId: string;
  companyName: string;
  companyCnpj: string;
  companyAddress?: string;
  companyCity?: string;
  companyState?: string;
  companyAntt?: string;
  
  // Responsável
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  
  // Afiliação
  affiliationType: 'AFFILIATED' | 'EMPLOYEE';
  status: 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'LEFT';
  canAcceptFreights: boolean;
  canManageVehicles: boolean;
  affiliatedAt: string;
  createdAt: string;
}

export const useAffiliationDetails = () => {
  const { profile } = useAuth();
  const { isCompanyDriver, companyDriver } = useCompanyDriver();
  
  const { data: affiliationDetails, isLoading, error } = useQuery({
    queryKey: ['affiliation-details', profile?.id],
    queryFn: async (): Promise<AffiliationDetails | null> => {
      if (!profile?.id || !companyDriver?.company_id) return null;
      
      // Buscar dados do company_drivers com informações da empresa (sem join em profiles que causa 403)
      const { data, error } = await supabase
        .from('company_drivers')
        .select(`
          *,
          company:company_id(
            id,
            company_name,
            company_cnpj,
            address,
            city,
            state,
            antt_registration
          )
        `)
        .eq('driver_profile_id', profile.id)
        .eq('company_id', companyDriver.company_id)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) return null;
      
      const company = data.company as any;
      
      return {
        companyId: company?.id || '',
        companyName: company?.company_name || '',
        companyCnpj: company?.company_cnpj || '',
        companyAddress: company?.address,
        companyCity: company?.city,
        companyState: company?.state,
        companyAntt: company?.antt_registration,
        ownerName: 'Não informado',
        ownerEmail: 'Não informado',
        ownerPhone: undefined,
        affiliationType: (data.affiliation_type || 'AFFILIATED') as 'AFFILIATED' | 'EMPLOYEE',
        status: (data.status || 'PENDING') as 'ACTIVE' | 'PENDING' | 'INACTIVE' | 'LEFT',
        canAcceptFreights: data.can_accept_freights || false,
        canManageVehicles: data.can_manage_vehicles || false,
        affiliatedAt: data.accepted_at || data.created_at,
        createdAt: data.created_at,
      };
    },
    enabled: isCompanyDriver && !!profile?.id && !!companyDriver?.company_id,
  });
  
  return {
    affiliationDetails,
    isLoading,
    error,
    hasAffiliation: !!affiliationDetails,
  };
};
