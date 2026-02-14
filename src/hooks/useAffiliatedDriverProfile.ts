/**
 * Hook para gerenciar perfis de motoristas afiliados
 * Busca dados completos do motorista via RPC SECURITY DEFINER
 * Resolve problemas de RLS onde transportadora não consegue ver perfil do motorista
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AffiliatedDriverProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  contact_phone: string | null;
  cpf_cnpj: string | null;
  rating: number | null;
  total_ratings: number | null;
  profile_photo_url: string | null;
  selfie_url: string | null;
  cnh_photo_url: string | null;
  cnh_category: string | null;
  cnh_expiry_date: string | null;
  rntrc: string | null;
  document_validation_status: string | null;
  cnh_validation_status: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  created_at: string | null;
  role: string | null;
  status: string | null;
  can_accept_freights: boolean | null;
  can_manage_vehicles: boolean | null;
}

interface UseAffiliatedDriverProfileOptions {
  driverProfileId: string | null;
  companyId: string | null;
  enabled?: boolean;
}

/**
 * Busca perfil completo de motorista afiliado usando RPC
 * Bypass RLS usando SECURITY DEFINER com validação de permissão
 */
export const useAffiliatedDriverProfile = ({
  driverProfileId,
  companyId,
  enabled = true,
}: UseAffiliatedDriverProfileOptions) => {
  const query = useQuery<AffiliatedDriverProfile | null>({
    queryKey: ['affiliated-driver-profile', driverProfileId, companyId],
    queryFn: async () => {
      if (!driverProfileId || !companyId) return null;

      console.log('[useAffiliatedDriverProfile] Buscando perfil via RPC:', {
        driverProfileId,
        companyId,
      });

      // Tentar buscar via RPC (SECURITY DEFINER com validação)
      const { data, error } = await supabase.rpc('get_affiliated_driver_profile', {
        p_driver_profile_id: driverProfileId,
        p_company_id: companyId,
      });

      if (error) {
        console.error('[useAffiliatedDriverProfile] Erro na RPC:', error);
        
        // Fallback: tentar buscar diretamente (nova política RLS pode permitir)
        console.log('[useAffiliatedDriverProfile] Tentando fallback via select direto...');
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('profiles_secure')
          .select(`
            id,
            full_name,
            email,
            phone,
            contact_phone,
            cpf_cnpj,
            rating,
            total_ratings,
            profile_photo_url,
            selfie_url,
            cnh_photo_url,
            cnh_category,
            cnh_expiry_date,
            rntrc,
            document_validation_status,
            cnh_validation_status,
            address_street,
            address_number,
            address_complement,
            address_neighborhood,
            address_city,
            address_state,
            address_zip,
            created_at,
            role
          `)
          .eq('id', driverProfileId)
          .single();

        if (fallbackError) {
          console.error('[useAffiliatedDriverProfile] Fallback também falhou:', fallbackError);
          throw fallbackError;
        }

        // Buscar dados de afiliação separadamente
        const { data: affiliationData } = await supabase
          .from('company_drivers')
          .select('status, can_accept_freights, can_manage_vehicles')
          .eq('driver_profile_id', driverProfileId)
          .eq('company_id', companyId)
          .single();

        return {
          ...(fallbackData as any),
          status: affiliationData?.status || null,
          can_accept_freights: affiliationData?.can_accept_freights || null,
          can_manage_vehicles: affiliationData?.can_manage_vehicles || null,
        } as AffiliatedDriverProfile;
      }

      if (!data || (Array.isArray(data) && data.length === 0)) {
        console.warn('[useAffiliatedDriverProfile] Nenhum dado retornado');
        return null;
      }

      const profile = Array.isArray(data) ? data[0] : data;
      console.log('[useAffiliatedDriverProfile] Perfil obtido:', {
        name: profile.full_name,
        hasSelfie: !!profile.selfie_url,
        hasCpf: !!profile.cpf_cnpj,
      });

      return profile as AffiliatedDriverProfile;
    },
    enabled: enabled && !!driverProfileId && !!companyId,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });

  return {
    driverProfile: query.data,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
};

/**
 * Hook para buscar lista de motoristas afiliados com dados completos
 */
export const useAffiliatedDrivers = (companyId: string | null) => {
  return useQuery({
    queryKey: ['affiliated-drivers-full', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      // Buscar via join que agora deve funcionar com a nova política RLS
      const { data, error } = await supabase
        .from('company_drivers')
        .select(`
          id,
          company_id,
          driver_profile_id,
          status,
          created_at,
          can_accept_freights,
          can_manage_vehicles,
          notes,
          driver:profiles_secure!company_drivers_driver_profile_id_fkey(
            id,
            full_name,
            email,
            phone,
            contact_phone,
            rating,
            total_ratings,
            profile_photo_url,
            selfie_url,
            cnh_photo_url,
            cnh_category,
            cnh_expiry_date,
            cpf_cnpj,
            document,
            rntrc,
            document_validation_status,
            cnh_validation_status,
            address_street,
            address_number,
            address_complement,
            address_neighborhood,
            address_city,
            address_state,
            address_zip,
            created_at,
            role
          )
        `)
        .eq('company_id', companyId)
        .in('status', ['ACTIVE', 'INACTIVE', 'PENDING'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useAffiliatedDrivers] Erro:', error);
        throw error;
      }

      console.log('[useAffiliatedDrivers] Motoristas carregados:', data?.length);
      return data || [];
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000,
  });
};
