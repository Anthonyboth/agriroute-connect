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

      // Atualizar o role do perfil para TRANSPORTADORA
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'TRANSPORTADORA' })
        .eq('id', profile.id);

      if (updateError) throw updateError;

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

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 dias a partir de agora

      const { data, error } = await supabase
        .from('company_invites')
        .insert({
          company_id: company.id,
          invited_by: profile.id,
          status: 'PENDING',
          expires_at: expiresAt.toISOString(),
          ...inviteData,
        })
        .select()
        .single();

      if (error) throw error;
      
      console.log('Convite criado com sucesso:', {
        invite_code: data.invite_code,
        company_id: data.company_id,
        invite_type: data.invite_type,
        expires_at: data.expires_at
      });
      
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

  // Buscar vínculos de veículos
  const { data: vehicleAssignments, isLoading: isLoadingAssignments } = useQuery({
    queryKey: ['company-vehicle-assignments', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data, error } = await supabase
        .from('company_vehicle_assignments')
        .select(`
          *,
          driver:driver_profile_id(id, full_name),
          vehicle:vehicle_id(id, license_plate, vehicle_type)
        `)
        .eq('company_id', company.id)
        .is('removed_at', null);
      
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id,
  });

  // Vincular veículo a motorista
  const assignVehicleToDriver = useMutation({
    mutationFn: async (data: {
      driverId: string;
      vehicleId: string;
      isPrimary?: boolean;
      notes?: string;
    }) => {
      if (!company?.id) throw new Error('Transportadora não encontrada');

      const { data: result, error } = await supabase
        .from('company_vehicle_assignments')
        .insert({
          company_id: company.id,
          driver_profile_id: data.driverId,
          vehicle_id: data.vehicleId,
          is_primary: data.isPrimary || false,
          notes: data.notes,
        })
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-vehicle-assignments'] });
      toast.success('Veículo vinculado com sucesso');
    },
    onError: (error: any) => {
      console.error('Erro ao vincular veículo:', error);
      toast.error('Erro ao vincular veículo');
    },
  });

  // Remover vínculo
  const removeVehicleAssignment = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('company_vehicle_assignments')
        .update({ removed_at: new Date().toISOString() })
        .eq('id', assignmentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-vehicle-assignments'] });
      toast.success('Vínculo removido');
    },
    onError: (error: any) => {
      console.error('Erro ao remover vínculo:', error);
      toast.error('Erro ao remover vínculo');
    },
  });

  // Criar convite de motorista com token
  const createDriverInvite = useMutation({
    mutationFn: async () => {
      if (!company?.id || !profile?.id) {
        throw new Error('Transportadora não encontrada');
      }

      const token = crypto.randomUUID().slice(0, 8).toUpperCase();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const { data, error } = await supabase
        .from('convites_motoristas')
        .insert({
          transportadora_id: profile.id,
          token,
          expira_em: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const link = `https://www.agriroute-connect.com.br/cadastro-motorista?inviteToken=${data.token}`;
      return link;
    },
    onError: (error: any) => {
      console.error('Erro ao gerar convite:', error);
      toast.error('Erro ao gerar link de convite');
    }
  });

  return {
    company,
    isLoadingCompany,
    drivers,
    isLoadingDrivers,
    vehicleAssignments,
    isLoadingAssignments,
    isTransportCompany: !!company,
    createCompany: createCompany.mutateAsync,
    createInvite: createInvite.mutateAsync,
    createDriverInvite,
    removeDriver: removeDriver.mutateAsync,
    assignVehicleToDriver: assignVehicleToDriver.mutateAsync,
    removeVehicleAssignment: removeVehicleAssignment.mutateAsync,
  };
};
