import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HOOK EXCLUSIVO: useDriverTransportCompanyLink
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Hook dedicado para gerenciar a relação entre MOTORISTAS e TRANSPORTADORAS.
 * 
 * FUNCIONALIDADES:
 * - ✅ Verificar se motorista tem vínculo(s) ativo(s)
 * - ✅ Listar todas as transportadoras vinculadas
 * - ✅ Suporta MÚLTIPLAS transportadoras simultaneamente
 * - ✅ Verificar permissões específicas por transportadora
 * - ✅ Gerenciar chat direto com transportadoras
 * - ✅ Verificar fretes recebidos via transportadora
 * 
 * REGRAS DE NEGÓCIO:
 * - Motoristas PODEM aceitar fretes independentes mesmo com vínculo
 * - Motoristas PODEM enviar contra-propostas mesmo com vínculo
 * - Transportadoras PODEM enviar fretes para a agenda do motorista
 * - Transportadoras PODEM ter chat direto com motoristas vinculados
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

export interface TransportCompanyLink {
  id: string;
  companyId: string;
  companyName: string;
  companyCnpj?: string;
  companyCity?: string;
  companyState?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'LEFT' | 'REJECTED';
  canAcceptFreights: boolean;
  canManageVehicles: boolean;
  chatEnabled: boolean;
  affiliationType: string | null;
  acceptedAt: string | null;
  leftAt: string | null;
  createdAt: string;
}

export interface DriverTransportCompanyLinkResult {
  // Estado de carregamento
  isLoading: boolean;
  error: Error | null;
  
  // Dados de vínculos
  allLinks: TransportCompanyLink[];
  activeLinks: TransportCompanyLink[];
  pendingLinks: TransportCompanyLink[];
  inactiveLinks: TransportCompanyLink[];
  
  // Verificações rápidas
  hasActiveLink: boolean;
  hasAnyLink: boolean;
  activeCompanyCount: number;
  
  // Permissões globais
  canAcceptIndependentFreights: boolean; // ✅ SEMPRE true
  canSendProposals: boolean; // ✅ SEMPRE true
  
  // Funções utilitárias
  isLinkedToCompany: (companyId: string) => boolean;
  getCompanyLink: (companyId: string) => TransportCompanyLink | undefined;
  getCompanyPermissions: (companyId: string) => { canAcceptFreights: boolean; canManageVehicles: boolean; chatEnabled: boolean };
  
  // Ações
  refreshLinks: () => Promise<void>;
  
  // Status de operações
  isPending: boolean;
}

export const useDriverTransportCompanyLink = (): DriverTransportCompanyLinkResult => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // ✅ Query principal - buscar todos os vínculos do motorista
  const { 
    data: rawLinks = [], 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['driver-transport-company-links', profile?.id],
    queryFn: async (): Promise<TransportCompanyLink[]> => {
      if (!profile?.id) return [];
      
      // Buscar vínculos
      const { data: linksData, error: linksError } = await supabase
        .from('company_drivers')
        .select('id, company_id, status, can_accept_freights, can_manage_vehicles, chat_enabled_at, affiliation_type, accepted_at, left_at, created_at')
        .eq('driver_profile_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (linksError) throw linksError;
      if (!linksData || linksData.length === 0) return [];
      
      // Buscar dados das empresas separadamente
      const companyIds = [...new Set(linksData.map(l => l.company_id))];
      const { data: companiesData } = await supabase
        .from('transport_companies')
        .select('id, company_name, company_cnpj, city, state')
        .in('id', companyIds);
      
      const companiesMap = new Map(
        (companiesData || []).map(c => [c.id, c])
      );
      
      // Mapear dados para formato padronizado
      return linksData.map((link) => {
        const company = companiesMap.get(link.company_id);
        return {
          id: link.id,
          companyId: link.company_id,
          companyName: company?.company_name || 'Nome não disponível',
          companyCnpj: company?.company_cnpj || undefined,
          companyCity: company?.city || undefined,
          companyState: company?.state || undefined,
          status: link.status as TransportCompanyLink['status'],
          canAcceptFreights: link.can_accept_freights || false,
          canManageVehicles: link.can_manage_vehicles || false,
          chatEnabled: !!link.chat_enabled_at,
          affiliationType: link.affiliation_type,
          acceptedAt: link.accepted_at,
          leftAt: link.left_at,
          createdAt: link.created_at,
        };
      });
    },
    enabled: !!profile?.id && ['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(profile?.active_mode || profile?.role || ''),
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FILTROS DE STATUS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const activeLinks = rawLinks.filter(link => link.status === 'ACTIVE');
  const pendingLinks = rawLinks.filter(link => link.status === 'PENDING');
  const inactiveLinks = rawLinks.filter(link => ['INACTIVE', 'LEFT'].includes(link.status));

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICAÇÕES RÁPIDAS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const hasActiveLink = activeLinks.length > 0;
  const hasAnyLink = rawLinks.length > 0;
  const activeCompanyCount = activeLinks.length;

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÕES UTILITÁRIAS
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Verifica se o motorista está vinculado a uma transportadora específica (ativo)
   */
  const isLinkedToCompany = (companyId: string): boolean => {
    return activeLinks.some(link => link.companyId === companyId);
  };

  /**
   * Retorna o vínculo com uma transportadora específica (qualquer status)
   */
  const getCompanyLink = (companyId: string): TransportCompanyLink | undefined => {
    return rawLinks.find(link => link.companyId === companyId);
  };

  /**
   * Retorna as permissões específicas para uma transportadora
   */
  const getCompanyPermissions = (companyId: string): { 
    canAcceptFreights: boolean; 
    canManageVehicles: boolean; 
    chatEnabled: boolean;
  } => {
    const link = activeLinks.find(l => l.companyId === companyId);
    if (!link) {
      return {
        canAcceptFreights: false,
        canManageVehicles: false,
        chatEnabled: false,
      };
    }
    return {
      canAcceptFreights: link.canAcceptFreights,
      canManageVehicles: link.canManageVehicles,
      chatEnabled: link.chatEnabled,
    };
  };

  /**
   * Força atualização dos vínculos
   */
  const refreshLinks = async (): Promise<void> => {
    await refetch();
    // Também invalidar caches relacionados
    queryClient.invalidateQueries({ queryKey: ['company-driver'] });
    queryClient.invalidateQueries({ queryKey: ['driver-affiliations'] });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RETORNO
  // ═══════════════════════════════════════════════════════════════════════════
  
  return {
    // Estado
    isLoading,
    error: error as Error | null,
    
    // Dados
    allLinks: rawLinks,
    activeLinks,
    pendingLinks,
    inactiveLinks,
    
    // Verificações
    hasActiveLink,
    hasAnyLink,
    activeCompanyCount,
    
    // Permissões globais - SEMPRE true para motoristas
    canAcceptIndependentFreights: true,
    canSendProposals: true,
    
    // Funções utilitárias
    isLinkedToCompany,
    getCompanyLink,
    getCompanyPermissions,
    
    // Ações
    refreshLinks,
    
    // Status
    isPending: isLoading,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK AUXILIAR: Verificar se um frete veio via transportadora
// ═══════════════════════════════════════════════════════════════════════════════

interface FreightCompanySource {
  isFromCompany: boolean;
  companyId: string | null;
  companyName: string | null;
}

export const useFreightCompanySource = (freightId: string | null) => {
  const { profile } = useAuth();
  
  return useQuery<FreightCompanySource | null>({
    queryKey: ['freight-company-source', freightId, profile?.id],
    queryFn: async () => {
      if (!freightId || !profile?.id) return null;
      
      // Verificar se o frete foi atribuído via transportadora
      // Nota: freight_assignments usa driver_id, não driver_profile_id
      const { data, error } = await supabase
        .from('freight_assignments')
        .select('id, company_id')
        .eq('freight_id', freightId)
        .eq('driver_id', profile.id)
        .limit(1)
        .maybeSingle();
      
      if (error || !data) return null;
      
      const assignment = data as { id: string; company_id: string | null };
      
      // Buscar nome da empresa separadamente se houver company_id
      let companyName: string | null = null;
      if (assignment.company_id) {
        const { data: companyData } = await supabase
          .from('transport_companies')
          .select('company_name')
          .eq('id', assignment.company_id)
          .limit(1)
          .maybeSingle();
        companyName = (companyData as { company_name: string } | null)?.company_name || null;
      }
      
      return {
        isFromCompany: !!assignment.company_id,
        companyId: assignment.company_id,
        companyName,
      };
    },
    enabled: !!freightId && !!profile?.id,
    staleTime: 10 * 60 * 1000,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK AUXILIAR: Chat com transportadoras
// ═══════════════════════════════════════════════════════════════════════════════

interface ChatMessage {
  id: string;
  company_id: string;
  driver_profile_id: string;
  message: string;
  sender_type: string;
  is_read: boolean | null;
  read_at: string | null;
  created_at: string | null;
  image_url: string | null;
}

export const useDriverCompanyChat = (companyId: string | null) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Buscar mensagens do chat
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['driver-company-chat', companyId, profile?.id],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!companyId || !profile?.id) return [];
      
      const { data, error } = await supabase
        .from('company_driver_chats')
        .select('id, company_id, driver_profile_id, message, sender_type, is_read, read_at, created_at, image_url')
        .eq('company_id', companyId)
        .eq('driver_profile_id', profile.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
    enabled: !!companyId && !!profile?.id,
    staleTime: 30 * 1000,
  });
  
  // Enviar mensagem
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      if (!companyId || !profile?.id) throw new Error('Dados inválidos');
      
      const { data, error } = await supabase
        .from('company_driver_chats')
        .insert({
          company_id: companyId,
          driver_profile_id: profile.id,
          message,
          sender_type: 'DRIVER',
        })
        .select('id')
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['driver-company-chat', companyId, profile?.id] 
      });
    },
    onError: (error: Error) => {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    },
  });
  
  // Marcar mensagens como lidas
  const markAsRead = useMutation({
    mutationFn: async () => {
      if (!companyId || !profile?.id) return;
      
      await supabase
        .from('company_driver_chats')
        .update({ 
          is_read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('company_id', companyId)
        .eq('driver_profile_id', profile.id)
        .eq('sender_type', 'COMPANY')
        .eq('is_read', false);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        queryKey: ['driver-company-chat', companyId, profile?.id] 
      });
    },
  });
  
  return {
    messages,
    isLoading,
    sendMessage: sendMessage.mutateAsync,
    markAsRead: markAsRead.mutateAsync,
    isSending: sendMessage.isPending,
  };
};
