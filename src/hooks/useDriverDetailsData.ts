/**
 * Hook centralizado para gerenciar todos os dados do modal de detalhes do motorista afiliado.
 * Consolida perfil (via RPC), dados de afiliação, chat, localização e permissões.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useAffiliatedDriverProfile, type AffiliatedDriverProfile } from './useAffiliatedDriverProfile';

interface UseDriverDetailsDataOptions {
  driverProfileId: string | null;
  companyId: string | null;
  enabled?: boolean;
}

export interface DriverDetailsData {
  /** Perfil completo do motorista (via RPC bypass RLS) */
  profile: AffiliatedDriverProfile | null;
  /** Dados de afiliação (company_drivers) */
  affiliation: {
    id: string;
    status: string;
    can_accept_freights: boolean;
    can_manage_vehicles: boolean;
    chat_enabled_at: string | null;
    created_at: string | null;
    notes: string | null;
  } | null;
  /** Contagem de mensagens não lidas no chat */
  unreadChatCount: number;
  /** ID do perfil do usuário logado (dono da transportadora) */
  currentUserId: string | null;
  /** Estado de carregamento geral */
  isLoading: boolean;
  /** Erro geral */
  error: Error | null;
  /** Refetch todos os dados */
  refetchAll: () => void;
}

export const useDriverDetailsData = ({
  driverProfileId,
  companyId,
  enabled = true,
}: UseDriverDetailsDataOptions): DriverDetailsData => {
  const { profile: authProfile } = useAuth();
  const currentUserId = authProfile?.id || null;

  // 1. Perfil completo via RPC (SECURITY DEFINER)
  const {
    driverProfile,
    isLoading: isLoadingProfile,
    error: profileError,
    refetch: refetchProfile,
  } = useAffiliatedDriverProfile({
    driverProfileId,
    companyId,
    enabled: enabled && !!driverProfileId && !!companyId,
  });

  // 2. Dados de afiliação (company_drivers) - status, permissões, chat_enabled_at
  const {
    data: affiliation,
    isLoading: isLoadingAffiliation,
    refetch: refetchAffiliation,
  } = useQuery({
    queryKey: ['driver-affiliation-details', companyId, driverProfileId],
    queryFn: async () => {
      if (!driverProfileId || !companyId) return null;

      const { data, error } = await supabase
        .from('company_drivers')
        .select('id, status, can_accept_freights, can_manage_vehicles, chat_enabled_at, created_at, notes')
        .eq('company_id', companyId)
        .eq('driver_profile_id', driverProfileId)
        .maybeSingle();

      if (error) {
        console.error('[useDriverDetailsData] Erro ao buscar afiliação:', error);
        return null;
      }

      return data;
    },
    enabled: enabled && !!driverProfileId && !!companyId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // 3. Contagem de mensagens não lidas
  const { data: unreadChatCount = 0, refetch: refetchUnread } = useQuery({
    queryKey: ['driver-chat-unread', companyId, driverProfileId],
    queryFn: async () => {
      if (!driverProfileId || !companyId) return 0;

      const { count } = await supabase
        .from('company_driver_chats')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('driver_profile_id', driverProfileId)
        .eq('sender_type', 'DRIVER')
        .eq('is_read', false);

      return count || 0;
    },
    enabled: enabled && !!driverProfileId && !!companyId,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  const refetchAll = () => {
    refetchProfile();
    refetchAffiliation();
    refetchUnread();
  };

  return {
    profile: driverProfile ?? null,
    affiliation: affiliation ?? null,
    unreadChatCount,
    currentUserId,
    isLoading: isLoadingProfile || isLoadingAffiliation,
    error: profileError as Error | null,
    refetchAll,
  };
};
