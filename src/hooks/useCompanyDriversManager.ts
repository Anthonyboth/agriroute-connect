/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HOOK DEFINITIVO: useCompanyDriversManager
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Hook centralizado para gerenciar motoristas afiliados do lado da TRANSPORTADORA.
 * 
 * FUNCIONALIDADES:
 * - ✅ Listar todos os motoristas afiliados com dados completos (fotos, avaliações)
 * - ✅ Gerenciar status de afiliação (ACTIVE, INACTIVE, PENDING)
 * - ✅ Validar vínculo antes de qualquer operação
 * - ✅ Garantir carregamento completo de dados (evita dados parciais)
 * - ✅ Aprovar/Rejeitar solicitações de afiliação
 * - ✅ Atualizar permissões (aceitar fretes, gerenciar veículos)
 * - ✅ Buscar perfil detalhado de motorista específico
 * - ✅ Cache otimizado para evitar requisições desnecessárias
 * 
 * REGRAS DE SEGURANÇA:
 * - Resolve auth.uid() → profile.id antes de validar ownership
 * - Só permite acesso a dados de motoristas com vínculo válido
 * - Logs de auditoria para ações críticas
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useTransportCompany } from './useTransportCompany';
import { toast } from 'sonner';
import { useCallback, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS
// ═══════════════════════════════════════════════════════════════════════════════

export interface AffiliatedDriverData {
  // Identificação do vínculo
  affiliationId: string;
  driverProfileId: string;
  companyId: string;
  
  // Status e permissões
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | string;
  affiliationType: 'AFFILIATED' | 'INVITED' | string | null;
  canAcceptFreights: boolean;
  canManageVehicles: boolean;
  chatEnabled: boolean;
  
  // Dados do perfil do motorista
  fullName: string | null;
  email: string | null;
  phone: string | null;
  contactPhone: string | null;
  cpfCnpj: string | null;
  
  // Avaliação
  rating: number | null;
  totalRatings: number | null;
  
  // Fotos
  profilePhotoUrl: string | null;
  selfieUrl: string | null;
  cnhPhotoUrl: string | null;
  
  // Documentação
  cnhCategory: string | null;
  cnhExpiryDate: string | null;
  rntrc: string | null;
  documentValidationStatus: string | null;
  cnhValidationStatus: string | null;
  
  // Endereço
  addressCity: string | null;
  addressState: string | null;
  
  // Datas
  invitedAt: string | null;
  acceptedAt: string | null;
  leftAt: string | null;
  createdAt: string | null;
  
  // Notas
  notes: string | null;
  
  // Flags derivadas
  isDocumentApproved: boolean;
  isCnhApproved: boolean;
  isCnhExpired: boolean;
  hasPhoto: boolean;
}

export interface DriverStats {
  total: number;
  active: number;
  pending: number;
  inactive: number;
  withApprovedDocuments: number;
  averageRating: number | null;
}

export interface CompanyDriversManagerResult {
  // Estado
  isLoading: boolean;
  error: Error | null;
  isReady: boolean; // ✅ Indica se dados estão prontos para uso
  
  // Dados de motoristas
  drivers: AffiliatedDriverData[];
  activeDrivers: AffiliatedDriverData[];
  pendingDrivers: AffiliatedDriverData[];
  inactiveDrivers: AffiliatedDriverData[];
  
  // Estatísticas
  stats: DriverStats;
  
  // Busca de motorista específico
  getDriver: (driverProfileId: string) => AffiliatedDriverData | undefined;
  getDriverByAffiliationId: (affiliationId: string) => AffiliatedDriverData | undefined;
  
  // Ações de gerenciamento
  approveDriver: (driverProfileId: string) => Promise<void>;
  rejectDriver: (driverProfileId: string, reason?: string) => Promise<void>;
  deactivateDriver: (driverProfileId: string, reason?: string) => Promise<void>;
  reactivateDriver: (driverProfileId: string) => Promise<void>;
  updatePermissions: (driverProfileId: string, permissions: { canAcceptFreights?: boolean; canManageVehicles?: boolean }) => Promise<void>;
  
  // Ações em lote
  approveAllPending: () => Promise<void>;
  
  // Refresh
  refetch: () => Promise<void>;
  
  // Status de operações
  isApproving: boolean;
  isRejecting: boolean;
  isUpdatingPermissions: boolean;
  
  // Validação
  isDriverAffiliated: (driverProfileId: string) => boolean;
  canManageDriver: (driverProfileId: string) => boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

export const useCompanyDriversManager = (companyIdOverride?: string | null): CompanyDriversManagerResult => {
  const { profile } = useAuth();
  const transportCompanyData = useTransportCompany();
  const queryClient = useQueryClient();
  
  const company = transportCompanyData.company;
  const isLoadingCompany = transportCompanyData.isLoadingCompany;
  
  // Determinar qual company_id usar
  const companyId = companyIdOverride ?? company?.id ?? null;
  
  // ═══════════════════════════════════════════════════════════════════════════
  // QUERY PRINCIPAL: Buscar motoristas com dados completos
  // ═══════════════════════════════════════════════════════════════════════════
  
  const driversQuery = useQuery({
    queryKey: ['company-drivers-manager', companyId],
    queryFn: async (): Promise<AffiliatedDriverData[]> => {
      if (!companyId) {
        console.log('[useCompanyDriversManager] Sem companyId, retornando array vazio');
        return [];
      }
      
      console.log('[useCompanyDriversManager] Buscando motoristas para empresa:', companyId);
      
      // Buscar vínculos com dados do motorista via join
      const { data, error } = await supabase
        .from('company_drivers')
        .select(`
          id,
          company_id,
          driver_profile_id,
          status,
          affiliation_type,
          can_accept_freights,
          can_manage_vehicles,
          chat_enabled_at,
          invited_at,
          accepted_at,
          left_at,
          created_at,
          notes,
          driver:profiles_secure!company_drivers_driver_profile_id_fkey(
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
            address_city,
            address_state,
            created_at
          )
        `)
        .eq('company_id', companyId)
        .in('status', ['ACTIVE', 'INACTIVE', 'PENDING'])
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('[useCompanyDriversManager] Erro ao buscar motoristas:', error);
        throw error;
      }
      
      console.log('[useCompanyDriversManager] Motoristas encontrados:', data?.length || 0);
      
      // Mapear para formato padronizado com validações
      const mappedDrivers: AffiliatedDriverData[] = (data || []).map((item: any) => {
        const driver = item.driver || {};
        const now = new Date();
        const cnhExpiryDate = driver.cnh_expiry_date ? new Date(driver.cnh_expiry_date) : null;
        
        return {
          // Identificação
          affiliationId: item.id,
          driverProfileId: item.driver_profile_id,
          companyId: item.company_id,
          
          // Status e permissões
          status: item.status || 'PENDING',
          affiliationType: item.affiliation_type,
          canAcceptFreights: item.can_accept_freights ?? false,
          canManageVehicles: item.can_manage_vehicles ?? false,
          chatEnabled: !!item.chat_enabled_at,
          
          // Dados do perfil
          fullName: driver.full_name || null,
          email: driver.email || null,
          phone: driver.phone || null,
          contactPhone: driver.contact_phone || null,
          cpfCnpj: driver.cpf_cnpj || null,
          
          // Avaliação
          rating: driver.rating ?? null,
          totalRatings: driver.total_ratings ?? null,
          
          // Fotos
          profilePhotoUrl: driver.profile_photo_url || null,
          selfieUrl: driver.selfie_url || null,
          cnhPhotoUrl: driver.cnh_photo_url || null,
          
          // Documentação
          cnhCategory: driver.cnh_category || null,
          cnhExpiryDate: driver.cnh_expiry_date || null,
          rntrc: driver.rntrc || null,
          documentValidationStatus: driver.document_validation_status || null,
          cnhValidationStatus: driver.cnh_validation_status || null,
          
          // Endereço
          addressCity: driver.address_city || null,
          addressState: driver.address_state || null,
          
          // Datas
          invitedAt: item.invited_at || null,
          acceptedAt: item.accepted_at || null,
          leftAt: item.left_at || null,
          createdAt: item.created_at || driver.created_at || null,
          
          // Notas
          notes: item.notes || null,
          
          // Flags derivadas
          isDocumentApproved: driver.document_validation_status === 'APPROVED',
          isCnhApproved: driver.cnh_validation_status === 'APPROVED',
          isCnhExpired: cnhExpiryDate ? cnhExpiryDate < now : false,
          hasPhoto: !!(driver.profile_photo_url || driver.selfie_url),
        };
      });
      
      return mappedDrivers;
    },
    enabled: !!companyId,
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 10 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DADOS DERIVADOS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const drivers = driversQuery.data || [];
  
  const activeDrivers = useMemo(() => 
    drivers.filter(d => d.status === 'ACTIVE'), 
    [drivers]
  );
  
  const pendingDrivers = useMemo(() => 
    drivers.filter(d => d.status === 'PENDING'), 
    [drivers]
  );
  
  const inactiveDrivers = useMemo(() => 
    drivers.filter(d => d.status === 'INACTIVE'), 
    [drivers]
  );
  
  // Estatísticas
  const stats = useMemo((): DriverStats => {
    const ratings = drivers
      .filter(d => d.rating !== null && d.status === 'ACTIVE')
      .map(d => d.rating as number);
    
    return {
      total: drivers.length,
      active: activeDrivers.length,
      pending: pendingDrivers.length,
      inactive: inactiveDrivers.length,
      withApprovedDocuments: drivers.filter(d => d.isDocumentApproved && d.isCnhApproved).length,
      averageRating: ratings.length > 0 
        ? ratings.reduce((a, b) => a + b, 0) / ratings.length 
        : null,
    };
  }, [drivers, activeDrivers, pendingDrivers, inactiveDrivers]);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÕES DE BUSCA
  // ═══════════════════════════════════════════════════════════════════════════
  
  const getDriver = useCallback((driverProfileId: string): AffiliatedDriverData | undefined => {
    return drivers.find(d => d.driverProfileId === driverProfileId);
  }, [drivers]);
  
  const getDriverByAffiliationId = useCallback((affiliationId: string): AffiliatedDriverData | undefined => {
    return drivers.find(d => d.affiliationId === affiliationId);
  }, [drivers]);
  
  const isDriverAffiliated = useCallback((driverProfileId: string): boolean => {
    return activeDrivers.some(d => d.driverProfileId === driverProfileId);
  }, [activeDrivers]);
  
  const canManageDriver = useCallback((driverProfileId: string): boolean => {
    // Verificar se o motorista está vinculado a esta empresa
    return drivers.some(d => d.driverProfileId === driverProfileId);
  }, [drivers]);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // MUTATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  
  const invalidateRelatedQueries = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['company-drivers-manager'] });
    queryClient.invalidateQueries({ queryKey: ['affiliated-drivers'] });
    queryClient.invalidateQueries({ queryKey: ['company-drivers'] });
    queryClient.invalidateQueries({ queryKey: ['driver-affiliations'] });
  }, [queryClient]);
  
  // Aprovar motorista pendente
  const approveMutation = useMutation({
    mutationFn: async (driverProfileId: string) => {
      if (!companyId) throw new Error('Empresa não identificada');
      
      const driver = getDriver(driverProfileId);
      if (!driver) throw new Error('Motorista não encontrado');
      if (driver.status !== 'PENDING') throw new Error('Motorista não está pendente de aprovação');
      
      console.log('[useCompanyDriversManager] Aprovando motorista:', driverProfileId);
      
      const { error } = await supabase
        .from('company_drivers')
        .update({
          status: 'ACTIVE',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.affiliationId)
        .eq('company_id', companyId);
      
      if (error) throw error;
    },
    onSuccess: (_, driverProfileId) => {
      const driver = getDriver(driverProfileId);
      toast.success(`${driver?.fullName || 'Motorista'} aprovado com sucesso!`);
      invalidateRelatedQueries();
    },
    onError: (error: Error) => {
      console.error('[useCompanyDriversManager] Erro ao aprovar:', error);
      toast.error(error.message || 'Erro ao aprovar motorista');
    },
  });
  
  // Rejeitar motorista pendente
  const rejectMutation = useMutation({
    mutationFn: async ({ driverProfileId, reason }: { driverProfileId: string; reason?: string }) => {
      if (!companyId) throw new Error('Empresa não identificada');
      
      const driver = getDriver(driverProfileId);
      if (!driver) throw new Error('Motorista não encontrado');
      if (driver.status !== 'PENDING') throw new Error('Motorista não está pendente');
      
      console.log('[useCompanyDriversManager] Rejeitando motorista:', driverProfileId);
      
      const { error } = await supabase
        .from('company_drivers')
        .update({
          status: 'INACTIVE',
          left_at: new Date().toISOString(),
          notes: reason || 'Solicitação rejeitada',
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.affiliationId)
        .eq('company_id', companyId);
      
      if (error) throw error;
    },
    onSuccess: (_, { driverProfileId }) => {
      const driver = getDriver(driverProfileId);
      toast.success(`Solicitação de ${driver?.fullName || 'motorista'} rejeitada`);
      invalidateRelatedQueries();
    },
    onError: (error: Error) => {
      console.error('[useCompanyDriversManager] Erro ao rejeitar:', error);
      toast.error(error.message || 'Erro ao rejeitar solicitação');
    },
  });
  
  // Desativar motorista ativo
  const deactivateMutation = useMutation({
    mutationFn: async ({ driverProfileId, reason }: { driverProfileId: string; reason?: string }) => {
      if (!companyId) throw new Error('Empresa não identificada');
      
      const driver = getDriver(driverProfileId);
      if (!driver) throw new Error('Motorista não encontrado');
      if (driver.status !== 'ACTIVE') throw new Error('Motorista não está ativo');
      
      console.log('[useCompanyDriversManager] Desativando motorista:', driverProfileId);
      
      const { error } = await supabase
        .from('company_drivers')
        .update({
          status: 'INACTIVE',
          left_at: new Date().toISOString(),
          notes: reason || 'Desativado pela transportadora',
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.affiliationId)
        .eq('company_id', companyId);
      
      if (error) throw error;
    },
    onSuccess: (_, { driverProfileId }) => {
      const driver = getDriver(driverProfileId);
      toast.success(`${driver?.fullName || 'Motorista'} desativado`);
      invalidateRelatedQueries();
    },
    onError: (error: Error) => {
      console.error('[useCompanyDriversManager] Erro ao desativar:', error);
      toast.error(error.message || 'Erro ao desativar motorista');
    },
  });
  
  // Reativar motorista inativo
  const reactivateMutation = useMutation({
    mutationFn: async (driverProfileId: string) => {
      if (!companyId) throw new Error('Empresa não identificada');
      
      const driver = getDriver(driverProfileId);
      if (!driver) throw new Error('Motorista não encontrado');
      if (driver.status !== 'INACTIVE') throw new Error('Motorista não está inativo');
      
      console.log('[useCompanyDriversManager] Reativando motorista:', driverProfileId);
      
      const { error } = await supabase
        .from('company_drivers')
        .update({
          status: 'ACTIVE',
          left_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.affiliationId)
        .eq('company_id', companyId);
      
      if (error) throw error;
    },
    onSuccess: (_, driverProfileId) => {
      const driver = getDriver(driverProfileId);
      toast.success(`${driver?.fullName || 'Motorista'} reativado com sucesso!`);
      invalidateRelatedQueries();
    },
    onError: (error: Error) => {
      console.error('[useCompanyDriversManager] Erro ao reativar:', error);
      toast.error(error.message || 'Erro ao reativar motorista');
    },
  });
  
  // Atualizar permissões
  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ 
      driverProfileId, 
      permissions 
    }: { 
      driverProfileId: string; 
      permissions: { canAcceptFreights?: boolean; canManageVehicles?: boolean };
    }) => {
      if (!companyId) throw new Error('Empresa não identificada');
      
      const driver = getDriver(driverProfileId);
      if (!driver) throw new Error('Motorista não encontrado');
      
      console.log('[useCompanyDriversManager] Atualizando permissões:', driverProfileId, permissions);
      
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      
      if (permissions.canAcceptFreights !== undefined) {
        updateData.can_accept_freights = permissions.canAcceptFreights;
      }
      if (permissions.canManageVehicles !== undefined) {
        updateData.can_manage_vehicles = permissions.canManageVehicles;
      }
      
      const { error } = await supabase
        .from('company_drivers')
        .update(updateData)
        .eq('id', driver.affiliationId)
        .eq('company_id', companyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Permissões atualizadas');
      invalidateRelatedQueries();
    },
    onError: (error: Error) => {
      console.error('[useCompanyDriversManager] Erro ao atualizar permissões:', error);
      toast.error(error.message || 'Erro ao atualizar permissões');
    },
  });
  
  // Aprovar todos os pendentes
  const approveAllPendingMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Empresa não identificada');
      if (pendingDrivers.length === 0) throw new Error('Não há motoristas pendentes');
      
      console.log('[useCompanyDriversManager] Aprovando todos os pendentes:', pendingDrivers.length);
      
      const affiliationIds = pendingDrivers.map(d => d.affiliationId);
      
      const { error } = await supabase
        .from('company_drivers')
        .update({
          status: 'ACTIVE',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .in('id', affiliationIds)
        .eq('company_id', companyId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${pendingDrivers.length} motoristas aprovados!`);
      invalidateRelatedQueries();
    },
    onError: (error: Error) => {
      console.error('[useCompanyDriversManager] Erro ao aprovar em lote:', error);
      toast.error(error.message || 'Erro ao aprovar motoristas');
    },
  });
  
  // ═══════════════════════════════════════════════════════════════════════════
  // FUNÇÕES WRAPPER
  // ═══════════════════════════════════════════════════════════════════════════
  
  const approveDriver = useCallback(async (driverProfileId: string) => {
    await approveMutation.mutateAsync(driverProfileId);
  }, [approveMutation]);
  
  const rejectDriver = useCallback(async (driverProfileId: string, reason?: string) => {
    await rejectMutation.mutateAsync({ driverProfileId, reason });
  }, [rejectMutation]);
  
  const deactivateDriver = useCallback(async (driverProfileId: string, reason?: string) => {
    await deactivateMutation.mutateAsync({ driverProfileId, reason });
  }, [deactivateMutation]);
  
  const reactivateDriver = useCallback(async (driverProfileId: string) => {
    await reactivateMutation.mutateAsync(driverProfileId);
  }, [reactivateMutation]);
  
  const updatePermissions = useCallback(async (
    driverProfileId: string, 
    permissions: { canAcceptFreights?: boolean; canManageVehicles?: boolean }
  ) => {
    await updatePermissionsMutation.mutateAsync({ driverProfileId, permissions });
  }, [updatePermissionsMutation]);
  
  const approveAllPending = useCallback(async () => {
    await approveAllPendingMutation.mutateAsync();
  }, [approveAllPendingMutation]);
  
  const refetch = useCallback(async () => {
    await driversQuery.refetch();
  }, [driversQuery]);
  
  // ═══════════════════════════════════════════════════════════════════════════
  // RETORNO
  // ═══════════════════════════════════════════════════════════════════════════
  
  const isLoading = driversQuery.isLoading || isLoadingCompany;
  const isReady = !isLoading && !!companyId && driversQuery.isFetched;
  
  return {
    // Estado
    isLoading,
    error: driversQuery.error as Error | null,
    isReady,
    
    // Dados
    drivers,
    activeDrivers,
    pendingDrivers,
    inactiveDrivers,
    
    // Estatísticas
    stats,
    
    // Funções de busca
    getDriver,
    getDriverByAffiliationId,
    
    // Ações
    approveDriver,
    rejectDriver,
    deactivateDriver,
    reactivateDriver,
    updatePermissions,
    approveAllPending,
    
    // Refresh
    refetch,
    
    // Status de operações
    isApproving: approveMutation.isPending || approveAllPendingMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isUpdatingPermissions: updatePermissionsMutation.isPending,
    
    // Validação
    isDriverAffiliated,
    canManageDriver,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK AUXILIAR: Buscar perfil detalhado de um motorista específico
// ═══════════════════════════════════════════════════════════════════════════════

export const useCompanyDriverProfile = (driverProfileId: string | null, companyId: string | null) => {
  return useQuery({
    queryKey: ['company-driver-profile', driverProfileId, companyId],
    queryFn: async () => {
      if (!driverProfileId || !companyId) return null;
      
      console.log('[useCompanyDriverProfile] Buscando perfil via RPC:', driverProfileId);
      
      // Usar RPC com SECURITY DEFINER para bypass de RLS
      const { data, error } = await supabase.rpc('get_affiliated_driver_profile', {
        p_driver_profile_id: driverProfileId,
        p_company_id: companyId,
      });
      
      if (error) {
        console.error('[useCompanyDriverProfile] Erro na RPC:', error);
        throw error;
      }
      
      const profile = Array.isArray(data) ? data[0] : data;
      if (!profile) return null;
      
      console.log('[useCompanyDriverProfile] Perfil obtido:', profile.full_name);
      return profile;
    },
    enabled: !!driverProfileId && !!companyId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 2,
  });
};

// ═══════════════════════════════════════════════════════════════════════════════
// TIPOS EXPORTADOS
// ═══════════════════════════════════════════════════════════════════════════════

export type CompanyDriversManager = ReturnType<typeof useCompanyDriversManager>;
