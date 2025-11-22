import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

/**
 * ⚠️ HOOK LEGACY - Mantido por compatibilidade
 * 
 * Este hook retorna apenas a PRIMEIRA afiliação ativa do motorista.
 * Para gerenciar múltiplas afiliações, use o hook useDriverAffiliations().
 * 
 * @deprecated Prefira usar useDriverAffiliations para suporte completo a múltiplas afiliações
 */
export const useCompanyDriver = () => {
  const { profile } = useAuth();
  
  const { data: companyDriver, isLoading } = useQuery({
    queryKey: ['company-driver', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      // ⚠️ NOTA: Retorna apenas a PRIMEIRA afiliação ativa
      // Para ver todas as afiliações, use useDriverAffiliations()
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
        .limit(1) // ✅ Explicitamente limitar a 1 registro
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id && (profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO'),
  });
  
  const result = {
    companyDriver,
    isCompanyDriver: !!companyDriver,
    companyId: companyDriver?.company_id,
    companyName: companyDriver?.company?.company_name,
    canAcceptFreights: companyDriver?.can_accept_freights || false,
    canManageVehicles: companyDriver?.can_manage_vehicles || false,
    isAffiliated: companyDriver?.affiliation_type === 'AFFILIATED',
    isLoading,
  };
  
  // 🐛 DEBUG: Log do retorno
  console.log('[useCompanyDriver] Return:', {
    hasCompanyDriver: !!companyDriver,
    canAcceptFreights: result.canAcceptFreights,
    isLoading,
    profileId: profile?.id
  });
  
  return result;
};
