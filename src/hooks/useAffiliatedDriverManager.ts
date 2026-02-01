/**
 * Hook centralizado para provisionamento e gestão COMPLETA do Motorista Afiliado.
 *
 * Responsabilidades:
 * 1. Provisionamento de perfil + vínculo (evita auth ok / profile missing)
 * 2. Gestão de múltiplas afiliações (ACTIVE/INACTIVE/PENDING)
 * 3. Gestão de veículos atribuídos por cada transportadora
 * 4. Status de aprovação e permissões
 * 5. Ações: sair de transportadora, reativar afiliação
 */

import { useMutation } from './useAsyncOperation';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { useAuth } from './useAuth';
import { useQuery, useQueryClient, useMutation as useRQMutation } from '@tanstack/react-query';
import { toast } from 'sonner';

// ============================================================================
// SCHEMAS
// ============================================================================

const ProvisionAffiliatedDriverInputSchema = z.object({
  companyId: z.string().uuid(),
  fullName: z.string().min(2).max(200),
  cpfCnpj: z
    .string()
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 11 || v.length === 14, 'CPF/CNPJ inválido'),
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

export type ProvisionAffiliatedDriverInput = z.infer<typeof ProvisionAffiliatedDriverInputSchema>;

// ============================================================================
// TYPES
// ============================================================================

export interface ProvisionAffiliatedDriverResult {
  profileId: string;
  companyDriverId?: string;
  profileStatus?: string;
  companyDriverStatus?: string;
}

export interface DriverAffiliation {
  id: string;
  company_id: string;
  driver_profile_id: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING' | string | null;
  affiliation_type: 'AFFILIATED' | 'INVITED' | string | null;
  can_accept_freights: boolean | null;
  can_manage_vehicles: boolean | null;
  invited_at: string | null;
  accepted_at: string | null;
  left_at: string | null;
  notes: string | null;
  company?: {
    id: string;
    company_name: string | null;
    company_cnpj: string | null;
    city: string | null;
    state: string | null;
  };
}

export interface DriverVehicleAssignment {
  id: string;
  company_id: string;
  driver_profile_id: string;
  vehicle_id: string;
  is_primary: boolean | null;
  assigned_at: string | null;
  removed_at: string | null;
  notes: string | null;
  vehicle?: {
    id: string;
    license_plate: string;
    vehicle_type?: string | null;
    max_capacity_tons?: number | null;
    axle_count?: number | null;
    brand?: string | null;
    model?: string | null;
  };
}

export interface AffiliatedDriverStats {
  totalAffiliations: number;
  activeAffiliations: number;
  pendingAffiliations: number;
  totalVehiclesAssigned: number;
  canAcceptFreights: boolean;
}

interface UseAffiliatedDriverManagerParams {
  /** Quando informado, carrega os vínculos de veículos desta transportadora para o motorista logado */
  companyId?: string | null;
  /** Desabilitar queries automáticas (útil para páginas que não precisam dos dados) */
  skipQueries?: boolean;
}

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export const useAffiliatedDriverManager = (params?: UseAffiliatedDriverManagerParams) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const companyId = params?.companyId ?? null;
  const skipQueries = params?.skipQueries ?? false;

  const isAffiliatedDriver = profile?.role === 'MOTORISTA_AFILIADO' || 
                             profile?.active_mode === 'MOTORISTA_AFILIADO';

  // ==========================================================================
  // PROVISIONING (Edge Function - Determinístico)
  // ==========================================================================

  const provisionMutation = useMutation<ProvisionAffiliatedDriverResult, [ProvisionAffiliatedDriverInput]>(
    async (input) => {
      const parsed = ProvisionAffiliatedDriverInputSchema.parse(input);

      const { data, error } = await supabase.functions.invoke('provision-affiliated-driver', {
        body: {
          company_id: parsed.companyId,
          full_name: parsed.fullName,
          cpf_cnpj: parsed.cpfCnpj,
          phone: parsed.phone,
          email: parsed.email,
        },
      });

      if (error) throw error;
      
      // Invalidar cache após provisionamento bem-sucedido
      queryClient.invalidateQueries({ queryKey: ['affiliated-driver'] });
      
      return data as ProvisionAffiliatedDriverResult;
    },
    {
      maxRetries: 2,
      timeout: 15000,
    }
  );

  // ==========================================================================
  // AFFILIATIONS QUERY
  // ==========================================================================

  const affiliationsQuery = useQuery({
    queryKey: ['affiliated-driver', 'affiliations', profile?.id],
    enabled: !!profile?.id && !skipQueries,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<DriverAffiliation[]> => {
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
          invited_at,
          accepted_at,
          left_at,
          notes,
          company:transport_companies!company_drivers_company_id_fkey(
            id,
            company_name,
            company_cnpj,
            city,
            state
          )
        `)
        .eq('driver_profile_id', profile!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DriverAffiliation[];
    },
  });

  // Derived data from affiliations
  const affiliations = affiliationsQuery.data || [];
  const activeAffiliations = affiliations.filter((a) => a.status === 'ACTIVE');
  const pendingAffiliations = affiliations.filter((a) => a.status === 'PENDING');
  const inactiveAffiliations = affiliations.filter((a) => a.status === 'INACTIVE');

  // Cidades de todas as transportadoras ativas (para matching de fretes)
  const allActiveCities = activeAffiliations
    .map((a) => {
      const city = a.company?.city;
      const state = a.company?.state;
      if (city && state) {
        return `${city}|${state}`;
      }
      return null;
    })
    .filter(Boolean) as string[];

  // Estados das transportadoras ativas
  const allActiveStates = [...new Set(
    activeAffiliations
      .map((a) => a.company?.state)
      .filter(Boolean)
  )] as string[];

  // ==========================================================================
  // VEHICLE ASSIGNMENTS QUERY
  // ==========================================================================

  const vehicleAssignmentsQuery = useQuery({
    queryKey: ['affiliated-driver', 'vehicle-assignments', profile?.id, companyId],
    enabled: !!profile?.id && !!companyId && !skipQueries,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async (): Promise<DriverVehicleAssignment[]> => {
      const { data, error } = await supabase
        .from('company_vehicle_assignments')
        .select(`
          id,
          company_id,
          driver_profile_id,
          vehicle_id,
          is_primary,
          assigned_at,
          removed_at,
          notes,
          vehicle:vehicles!company_vehicle_assignments_vehicle_id_fkey(
            id,
            license_plate,
            vehicle_type,
            max_capacity_tons,
            axle_count,
            brand,
            model
          )
        `)
        .eq('driver_profile_id', profile!.id)
        .eq('company_id', companyId!)
        .is('removed_at', null)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DriverVehicleAssignment[];
    },
  });

  // All vehicle assignments (across all companies)
  const allVehicleAssignmentsQuery = useQuery({
    queryKey: ['affiliated-driver', 'all-vehicle-assignments', profile?.id],
    enabled: !!profile?.id && !skipQueries && !companyId, // Only when no specific company
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<DriverVehicleAssignment[]> => {
      const { data, error } = await supabase
        .from('company_vehicle_assignments')
        .select(`
          id,
          company_id,
          driver_profile_id,
          vehicle_id,
          is_primary,
          assigned_at,
          removed_at,
          notes,
          vehicle:vehicles!company_vehicle_assignments_vehicle_id_fkey(
            id,
            license_plate,
            vehicle_type,
            max_capacity_tons,
            axle_count,
            brand,
            model
          )
        `)
        .eq('driver_profile_id', profile!.id)
        .is('removed_at', null)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as DriverVehicleAssignment[];
    },
  });

  // ==========================================================================
  // MUTATIONS: Leave Company
  // ==========================================================================

  const leaveCompanyMutation = useRQMutation({
    mutationFn: async ({ companyId: targetCompanyId }: { companyId: string }) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('company_drivers')
        .update({
          status: 'INACTIVE',
          left_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('driver_profile_id', profile.id)
        .eq('company_id', targetCompanyId)
        .eq('status', 'ACTIVE')
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error('Não foi possível sair da transportadora. Você pode já ter saído ou não tem permissão.');
      }

      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliated-driver'] });
      queryClient.invalidateQueries({ queryKey: ['driver-affiliations'] });
      queryClient.invalidateQueries({ queryKey: ['company-driver'] });
      toast.success('Você saiu da transportadora com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao sair da transportadora:', error);
      toast.error(error.message || 'Erro ao sair da transportadora');
    },
  });

  // ==========================================================================
  // MUTATIONS: Rejoin Company
  // ==========================================================================

  const rejoinCompanyMutation = useRQMutation({
    mutationFn: async ({ companyId: targetCompanyId }: { companyId: string }) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      // Verificar se existe afiliação inativa
      const { data: existing, error: checkError } = await supabase
        .from('company_drivers')
        .select('id, status')
        .eq('driver_profile_id', profile.id)
        .eq('company_id', targetCompanyId)
        .eq('status', 'INACTIVE')
        .maybeSingle();

      if (checkError) throw checkError;
      if (!existing) throw new Error('Afiliação não encontrada');

      // Reativar
      const { error } = await supabase
        .from('company_drivers')
        .update({
          status: 'ACTIVE',
          left_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliated-driver'] });
      queryClient.invalidateQueries({ queryKey: ['driver-affiliations'] });
      queryClient.invalidateQueries({ queryKey: ['company-driver'] });
      toast.success('Afiliação reativada com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao reativar afiliação:', error);
      toast.error(error.message || 'Erro ao reativar afiliação');
    },
  });

  // ==========================================================================
  // MUTATIONS: Accept Pending Affiliation
  // ==========================================================================

  const acceptAffiliationMutation = useRQMutation({
    mutationFn: async ({ affiliationId }: { affiliationId: string }) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('company_drivers')
        .update({
          status: 'ACTIVE',
          accepted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', affiliationId)
        .eq('driver_profile_id', profile.id)
        .eq('status', 'PENDING');

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliated-driver'] });
      queryClient.invalidateQueries({ queryKey: ['driver-affiliations'] });
      toast.success('Afiliação aceita com sucesso');
    },
    onError: (error: Error) => {
      console.error('Erro ao aceitar afiliação:', error);
      toast.error(error.message || 'Erro ao aceitar afiliação');
    },
  });

  // ==========================================================================
  // MUTATIONS: Reject Pending Affiliation
  // ==========================================================================

  const rejectAffiliationMutation = useRQMutation({
    mutationFn: async ({ affiliationId }: { affiliationId: string }) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('company_drivers')
        .update({
          status: 'INACTIVE',
          left_at: new Date().toISOString(),
          notes: 'Convite recusado pelo motorista',
          updated_at: new Date().toISOString(),
        })
        .eq('id', affiliationId)
        .eq('driver_profile_id', profile.id)
        .eq('status', 'PENDING');

      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['affiliated-driver'] });
      queryClient.invalidateQueries({ queryKey: ['driver-affiliations'] });
      toast.success('Convite recusado');
    },
    onError: (error: Error) => {
      console.error('Erro ao recusar afiliação:', error);
      toast.error(error.message || 'Erro ao recusar afiliação');
    },
  });

  // ==========================================================================
  // HELPER FUNCTIONS
  // ==========================================================================

  const isInCompany = (targetCompanyId: string): boolean => {
    return activeAffiliations.some((a) => a.company_id === targetCompanyId);
  };

  const hasPendingInvite = (targetCompanyId: string): boolean => {
    return pendingAffiliations.some((a) => a.company_id === targetCompanyId);
  };

  const getAffiliationForCompany = (targetCompanyId: string): DriverAffiliation | undefined => {
    return affiliations.find((a) => a.company_id === targetCompanyId);
  };

  const canAcceptFreightsForCompany = (targetCompanyId: string): boolean => {
    const affiliation = activeAffiliations.find((a) => a.company_id === targetCompanyId);
    return affiliation?.can_accept_freights === true;
  };

  const canManageVehiclesForCompany = (targetCompanyId: string): boolean => {
    const affiliation = activeAffiliations.find((a) => a.company_id === targetCompanyId);
    return affiliation?.can_manage_vehicles === true;
  };

  // ==========================================================================
  // COMPUTED STATS
  // ==========================================================================

  const stats: AffiliatedDriverStats = {
    totalAffiliations: affiliations.length,
    activeAffiliations: activeAffiliations.length,
    pendingAffiliations: pendingAffiliations.length,
    totalVehiclesAssigned: vehicleAssignmentsQuery.data?.length || allVehicleAssignmentsQuery.data?.length || 0,
    canAcceptFreights: activeAffiliations.some((a) => a.can_accept_freights === true),
  };

  // ==========================================================================
  // RETURN
  // ==========================================================================

  return {
    // Identity
    isAffiliatedDriver,
    profile,

    // Provisioning (for signup flow)
    provisionAffiliatedDriver: provisionMutation.execute,
    isProvisioning: provisionMutation.isLoading,
    provisionError: provisionMutation.error,
    provisionResult: provisionMutation.data,
    resetProvision: provisionMutation.reset,

    // Affiliations Data
    affiliations,
    activeAffiliations,
    pendingAffiliations,
    inactiveAffiliations,
    affiliationsLoading: affiliationsQuery.isLoading,
    affiliationsError: affiliationsQuery.error,
    refetchAffiliations: affiliationsQuery.refetch,

    // Location Data (for freight matching)
    allActiveCities,
    allActiveStates,

    // Vehicle Assignments
    vehicleAssignments: vehicleAssignmentsQuery.data || [],
    allVehicleAssignments: allVehicleAssignmentsQuery.data || [],
    vehicleAssignmentsLoading: vehicleAssignmentsQuery.isLoading || allVehicleAssignmentsQuery.isLoading,

    // Actions
    leaveCompany: (companyId: string) => leaveCompanyMutation.mutateAsync({ companyId }),
    rejoinCompany: (companyId: string) => rejoinCompanyMutation.mutateAsync({ companyId }),
    acceptAffiliation: (affiliationId: string) => acceptAffiliationMutation.mutateAsync({ affiliationId }),
    rejectAffiliation: (affiliationId: string) => rejectAffiliationMutation.mutateAsync({ affiliationId }),

    // Action States
    isLeaving: leaveCompanyMutation.isPending,
    isRejoining: rejoinCompanyMutation.isPending,
    isAccepting: acceptAffiliationMutation.isPending,
    isRejecting: rejectAffiliationMutation.isPending,

    // Helpers
    isInCompany,
    hasPendingInvite,
    getAffiliationForCompany,
    canAcceptFreightsForCompany,
    canManageVehiclesForCompany,

    // Stats
    stats,

    // Permissions
    hasActiveAffiliations: activeAffiliations.length > 0,
    canAcceptIndependentFreights: true, // Motorista SEMPRE pode aceitar fretes independentes

    // Raw queries (for advanced usage)
    affiliationsQuery,
    vehicleAssignmentsQuery,
    allVehicleAssignmentsQuery,
  };
};

// ============================================================================
// TIPOS EXPORTADOS PARA USO EXTERNO
// ============================================================================

export type AffiliatedDriverManager = ReturnType<typeof useAffiliatedDriverManager>;
