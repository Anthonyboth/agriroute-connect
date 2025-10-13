import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export const useTransportCompany = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Verificar se o usuário é uma transportadora
  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ['transport-company', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      
      const { data, error } = await supabase
        .from('transport_companies')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
  });

  // Buscar motoristas afiliados
  const { data: drivers, isLoading: isLoadingDrivers } = useQuery({
    queryKey: ['company-drivers', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data, error } = await supabase
        .from('company_drivers')
        .select(`
          *,
          driver:driver_profile_id (
            id,
            full_name,
            email,
            phone,
            rating,
            total_ratings
          )
        `)
        .eq('company_id', company.id)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id,
  });

  // Criar transportadora
  const createCompany = useMutation({
    mutationFn: async (companyData: {
      company_name: string;
      company_cnpj: string;
      address?: string;
      city?: string;
      state?: string;
      zip_code?: string;
      antt_registration?: string;
    }) => {
      if (!profile?.id) throw new Error('Perfil não encontrado');

      const { data, error } = await supabase
        .from('transport_companies')
        .insert({
          profile_id: profile.id,
          ...companyData,
        })
        .select()
        .single();

      if (error) throw error;

      // Note: Role is already included in profiles table
      // No need to update user_roles separately

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transport-company'] });
      toast.success('Transportadora criada com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao criar transportadora:', error);
      toast.error('Erro ao criar transportadora');
    },
  });

  // Criar convite
  const createInvite = useMutation({
    mutationFn: async (inviteData: {
      invite_type: 'EMAIL' | 'LINK' | 'CODE';
      invited_email?: string;
    }) => {
      if (!company?.id || !profile?.id) throw new Error('Transportadora não encontrada');

      const { data, error } = await supabase
        .from('company_invites')
        .insert({
          company_id: company.id,
          invited_by: profile.id,
          ...inviteData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-invites'] });
      toast.success('Convite criado com sucesso!');
    },
    onError: (error: any) => {
      console.error('Erro ao criar convite:', error);
      toast.error('Erro ao criar convite');
    },
  });

  // Remover motorista
  const removeDriver = useMutation({
    mutationFn: async (driverId: string) => {
      const { error } = await supabase
        .from('company_drivers')
        .update({ status: 'INACTIVE' })
        .eq('driver_profile_id', driverId)
        .eq('company_id', company?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-drivers'] });
      toast.success('Motorista removido da transportadora');
    },
    onError: (error: any) => {
      console.error('Erro ao remover motorista:', error);
      toast.error('Erro ao remover motorista');
    },
  });

  return {
    company,
    isLoadingCompany,
    drivers,
    isLoadingDrivers,
    isTransportCompany: !!company,
    createCompany: createCompany.mutateAsync,
    createInvite: createInvite.mutateAsync,
    removeDriver: removeDriver.mutateAsync,
  };
};
