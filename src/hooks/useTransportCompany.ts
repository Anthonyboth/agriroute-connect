// Transport Company Hook - Cache Fix 2026-01-28
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
export const useTransportCompany = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Verificar se o usuário é uma transportadora
  // ✅ REMOVIDA mutação de dentro do queryFn para evitar loop infinito
  const {
    data: company,
    isLoading: isLoadingCompany,
    error: companyError,
    refetch: refetchCompany,
  } = useQuery({
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
    // ✅ CRITICAL: Cache agressivo para evitar requisições repetidas
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
    gcTime: 10 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Buscar motoristas afiliados
  const { data: drivers, isLoading: isLoadingDrivers } = useQuery({
    queryKey: ['company-drivers', company?.id],
    queryFn: async () => {
      if (!company?.id) {
        return [];
      }
      
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
          driver:profiles!company_drivers_driver_profile_id_fkey(
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
        .eq('company_id', company.id)
        .in('status', ['ACTIVE', 'INACTIVE'])
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }
      
      return data;
    },
    enabled: !!company?.id,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
    refetchOnMount: false,
    refetchOnWindowFocus: false,
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
      cnpj_document_url?: string;
      antt_document_url?: string;
    }) => {
      if (!profile?.id) throw new Error('Perfil não encontrado');

      const { data, error } = await supabase
        .from('transport_companies')
        .insert({
          profile_id: profile.id,
          company_name: companyData.company_name,
          company_cnpj: companyData.company_cnpj.replace(/\D/g, ''),
          antt_registration: companyData.antt_registration,
          address: companyData.address,
          city: companyData.city,
          state: companyData.state,
          zip_code: companyData.zip_code,
          cnpj_document_url: companyData.cnpj_document_url,
          antt_document_url: companyData.antt_document_url,
          status: 'APPROVED', // ✅ Aprovação automática
          approved_at: new Date().toISOString(),
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
      toast.success('Transportadora criada e aprovada com sucesso!');
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

  const { data: pendingDrivers, isLoading: isLoadingPending } = useQuery({
    queryKey: ['pending-drivers', company?.id],
    queryFn: async () => {
      if (!company?.id) return [];
      
      const { data, error } = await supabase
        .from('company_drivers')
        .select(`
          *,
          driver:profiles!company_drivers_driver_profile_id_fkey (
            id,
            full_name,
            email,
            contact_phone,
            rating,
            total_ratings,
            profile_photo_url,
            selfie_url,
            cnh_photo_url,
            cpf_cnpj,
            document,
            rntrc,
            document_validation_status,
            cnh_validation_status,
            cnh_expiry_date
          )
        `)
        .eq('company_id', company.id)
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id,
  });

  // Aprovar motorista
  const approveDriver = useMutation({
    mutationFn: async (driverProfileId: string) => {
      if (!company?.id) throw new Error('Empresa não encontrada');
      
      console.log('🔄 Aprovando motorista:', driverProfileId, 'para empresa:', company.id);
      
      const { data, error } = await supabase
        .from('company_drivers')
        .update({ 
          status: 'ACTIVE', 
          accepted_at: new Date().toISOString(),
          can_accept_freights: true,
          updated_at: new Date().toISOString()
        })
        .eq('company_id', company.id)
        .eq('driver_profile_id', driverProfileId)
        .select();
        
      if (error) {
        console.error('❌ Erro ao aprovar:', error);
        throw error;
      }
      
      console.log('✅ Motorista aprovado:', data);
      
      // ✅ CRÍTICO: Atualizar role do perfil para MOTORISTA_AFILIADO e limpar active_mode
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          role: 'MOTORISTA_AFILIADO',
          active_mode: null  // Limpar active_mode para evitar redirecionamento incorreto
        })
        .eq('id', driverProfileId);

      if (profileError) {
        console.error('❌ Erro ao atualizar profile do motorista:', profileError);
        throw profileError;
      }
      
      console.log('✅ Profile atualizado para MOTORISTA_AFILIADO');
      
      return { driverProfileId, companyId: company.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['company-drivers'],
        exact: false 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['pending-drivers'],
        exact: false 
      });
      
      queryClient.refetchQueries({ 
        queryKey: ['company-drivers', data.companyId] 
      });
      queryClient.refetchQueries({ 
        queryKey: ['pending-drivers', data.companyId] 
      });
      
      toast.success('Motorista aprovado e já pode aceitar fretes!', {
        duration: 5000
      });
    },
    onError: (error: any) => {
      console.error('❌ Erro na aprovação:', error);
      
      // Mensagens de erro específicas
      if (error.code === '42501') {
        toast.error('Sem permissão para aprovar. Verifique se você é o administrador da transportadora.');
      } else if (error.message?.includes('RLS') || error.message?.includes('policy')) {
        toast.error('Erro de permissão no banco de dados. Entre em contato com o suporte.');
      } else {
        toast.error(`Erro ao aprovar: ${error.message || 'Tente novamente'}`);
      }
    },
  });

  // Rejeitar motorista
  const rejectDriver = useMutation({
    mutationFn: async (driverProfileId: string) => {
      if (!company?.id) throw new Error('Empresa não encontrada');
      
      console.log('🔄 Rejeitando motorista:', driverProfileId);
      
      const { error } = await supabase
        .from('company_drivers')
        .update({ status: 'REJECTED' })
        .eq('company_id', company.id)
        .eq('driver_profile_id', driverProfileId);
        
      if (error) {
        console.error('❌ Erro ao rejeitar:', error);
        throw error;
      }
      
      console.log('✅ Motorista rejeitado');
      return { driverProfileId, companyId: company.id };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ 
        queryKey: ['company-drivers'],
        exact: false 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['pending-drivers'],
        exact: false 
      });
      
      queryClient.refetchQueries({ 
        queryKey: ['pending-drivers', data.companyId] 
      });
      
      toast.success('Motorista rejeitado');
    },
    onError: (error: any) => {
      console.error('❌ Erro ao rejeitar motorista:', error);
      
      if (error.code === '42501') {
        toast.error('Sem permissão para rejeitar. Verifique se você é o administrador da transportadora.');
      } else if (error.message?.includes('RLS') || error.message?.includes('policy')) {
        toast.error('Erro de permissão no banco de dados. Entre em contato com o suporte.');
      } else {
        toast.error(`Erro ao rejeitar: ${error.message || 'Tente novamente'}`);
      }
    },
  });

  // Desligar motorista da transportadora
  const leaveCompany = useMutation({
    mutationFn: async (driverProfileId: string) => {
      if (!company?.id) {
        console.warn('[leaveCompany] Tentativa de desligar motorista sem company carregado');
        throw new Error('Transportadora não está carregada. Atualize a página e tente novamente.');
      }
      
      if (!driverProfileId) {
        throw new Error('ID do motorista não fornecido');
      }
      
      console.log('[leaveCompany] Desligando motorista:', driverProfileId, 'da empresa:', company.id);
      
      const { error } = await supabase
        .from('company_drivers')
        .update({ 
          status: 'LEFT',
          left_at: new Date().toISOString()
        })
        .eq('company_id', company.id)
        .eq('driver_profile_id', driverProfileId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-drivers'] });
      queryClient.invalidateQueries({ queryKey: ['pending-drivers'] });
      toast.success('Motorista desligado da transportadora');
    },
    onError: (error: any) => {
      console.error('Erro ao desligar motorista:', error);
      toast.error(error.message || 'Erro ao desligar motorista. Tente novamente.');
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

  // Atualizar permissão de autonomia para motorista afiliado
  const updateDriverAutonomyPermission = useMutation({
    mutationFn: async ({ 
      driverProfileId, 
      canAcceptAutonomous 
    }: { 
      driverProfileId: string; 
      canAcceptAutonomous: boolean; 
    }) => {
      if (!company?.id) {
        console.warn('[updateDriverAutonomyPermission] Tentativa sem company carregado');
        throw new Error('Transportadora não está carregada. Atualize a página e tente novamente.');
      }
      
      const { error } = await supabase
        .from('affiliated_drivers_tracking')
        .update({ 
          can_accept_autonomous_freights: canAcceptAutonomous,
          updated_at: new Date().toISOString()
        })
        .eq('driver_profile_id', driverProfileId)
        .eq('company_id', company.id);
      
      if (error) throw error;
      
      toast.success(
        canAcceptAutonomous 
          ? '✅ Motorista pode aceitar fretes como autônomo' 
          : '🔒 Motorista restrito a fretes da empresa'
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-drivers', company?.id] });
      queryClient.invalidateQueries({ queryKey: ['drivers-tracking', company?.id] });
      queryClient.invalidateQueries({ queryKey: ['driver-autonomy'] });
    },
    onError: (error: any) => {
      console.error('[updateDriverAutonomyPermission] Error:', error);
      toast.error('Erro ao atualizar permissão: ' + error.message);
    }
  });

  return {
    company,
    isLoadingCompany,
    companyError,
    refetchCompany,
    drivers,
    isLoadingDrivers,
    pendingDrivers,
    isLoadingPending,
    vehicleAssignments,
    isLoadingAssignments,
    isTransportCompany: !!company,
    createCompany: createCompany.mutateAsync,
    createInvite: createInvite.mutateAsync,
    createDriverInvite,
    removeDriver: removeDriver.mutateAsync,
    approveDriver,
    rejectDriver,
    leaveCompany,
    assignVehicleToDriver: assignVehicleToDriver.mutateAsync,
    removeVehicleAssignment: removeVehicleAssignment.mutateAsync,
    updateDriverAutonomyPermission,
  };
};
