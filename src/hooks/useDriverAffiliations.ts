import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

/**
 * Hook para gerenciar múltiplas afiliações de motoristas a transportadoras.
 * Um motorista pode estar afiliado a várias empresas simultaneamente.
 * Pode sair e voltar a qualquer momento.
 */
export const useDriverAffiliations = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // ✅ Buscar TODAS as afiliações (ativas e inativas)
  const { data: affiliations = [], isLoading, error } = useQuery({
    queryKey: ['driver-affiliations', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      
      const { data, error } = await supabase
        .from('company_drivers')
        .select(`
          *,
          company:company_id(
            id,
            company_name,
            company_cnpj,
            city,
            state
          )
        `)
        .eq('driver_profile_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!profile?.id && (profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO'),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // ✅ Separar por status
  const activeAffiliations = affiliations.filter((a: any) => a.status === 'ACTIVE');
  const inactiveAffiliations = affiliations.filter((a: any) => a.status === 'INACTIVE');

  // ✅ Obter todas as cidades de todas as transportadoras ativas
  const allActiveCities = activeAffiliations
    .map((a: any) => {
      const city = a.company?.city;
      const state = a.company?.state;
      if (city && state) {
        return `${city}|${state}`;
      }
      return null;
    })
    .filter(Boolean) as string[];

  // ✅ Obter todos os estados das transportadoras ativas (para matching permissivo)
  const allActiveStates = [...new Set(
    activeAffiliations
      .map((a: any) => a.company?.state)
      .filter(Boolean)
  )] as string[];

  // ✅ Mutation: Sair de uma transportadora específica
  const leaveCompanyMutation = useMutation({
    mutationFn: async ({ companyId }: { companyId: string }) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase
        .from('company_drivers')
        .update({
          status: 'INACTIVE',
          left_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('driver_profile_id', profile.id)
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE');
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-affiliations'] });
      queryClient.invalidateQueries({ queryKey: ['available-freights'] });
      queryClient.invalidateQueries({ queryKey: ['company-driver'] });
      toast.success('Você saiu da transportadora com sucesso');
    },
    onError: (error: any) => {
      console.error('Erro ao sair da transportadora:', error);
      toast.error(error.message || 'Erro ao sair da transportadora');
    }
  });

  // ✅ Mutation: Reativar afiliação anterior
  const rejoinCompanyMutation = useMutation({
    mutationFn: async ({ companyId }: { companyId: string }) => {
      if (!profile?.id) throw new Error('Usuário não autenticado');

      // Verificar se existe afiliação inativa
      const { data: existing, error: checkError } = await supabase
        .from('company_drivers')
        .select('*')
        .eq('driver_profile_id', profile.id)
        .eq('company_id', companyId)
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
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
      
      if (error) throw error;
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-affiliations'] });
      queryClient.invalidateQueries({ queryKey: ['available-freights'] });
      queryClient.invalidateQueries({ queryKey: ['company-driver'] });
      toast.success('Afiliação reativada com sucesso');
    },
    onError: (error: any) => {
      console.error('Erro ao reativar afiliação:', error);
      toast.error(error.message || 'Erro ao reativar afiliação');
    }
  });

  // ✅ Funções auxiliares
  const isInCompany = (companyId: string) => {
    return activeAffiliations.some((a: any) => a.company_id === companyId);
  };

  const leaveCompany = async (companyId: string) => {
    return leaveCompanyMutation.mutateAsync({ companyId });
  };

  const rejoinCompany = async (companyId: string) => {
    return rejoinCompanyMutation.mutateAsync({ companyId });
  };

  return {
    // Dados
    affiliations,
    activeAffiliations,
    inactiveAffiliations,
    allActiveCities,
    allActiveStates,
    
    // Estados
    isLoading,
    error,
    isLeaving: leaveCompanyMutation.isPending,
    isRejoining: rejoinCompanyMutation.isPending,
    
    // Ações
    leaveCompany,
    rejoinCompany,
    isInCompany,
    
    // Permissões
    hasActiveAffiliations: activeAffiliations.length > 0,
    canAcceptIndependentFreights: true, // ✅ Motorista SEMPRE pode aceitar fretes independentes
  };
};
