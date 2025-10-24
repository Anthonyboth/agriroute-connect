import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useAvailableDrivers = (companyId: string) => {
  const queryClient = useQueryClient();

  // Buscar motoristas autônomos disponíveis (não afiliados)
  const { data: availableDrivers, isLoading } = useQuery({
    queryKey: ['available-drivers', companyId],
    queryFn: async () => {
      // Primeiro, buscar IDs de motoristas já afiliados
      const { data: affiliatedIds } = await supabase
        .from('company_drivers')
        .select('driver_profile_id')
        .eq('company_id', companyId)
        .in('status', ['ACTIVE', 'PENDING']);

      const excludeIds = affiliatedIds?.map(d => d.driver_profile_id) || [];

      // Buscar user_ids com role 'driver'
      const { data: driverRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'driver');

      if (rolesError) throw rolesError;

      const driverUserIds = driverRoles?.map(dr => dr.user_id) || [];

      if (driverUserIds.length === 0) {
        return [];
      }

      // Buscar profiles dos motoristas
      const { data: drivers, error: profilesError } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          phone,
          profile_photo_url,
          selfie_url,
          rating,
          total_ratings
        `)
        .in('id', driverUserIds)
        .eq('status', 'APPROVED')
        .order('rating', { ascending: false, nullsFirst: false })
        .order('total_ratings', { ascending: false });

      if (profilesError) throw profilesError;

      // Filtrar motoristas já afiliados
      const filteredDrivers = excludeIds.length > 0
        ? drivers?.filter(driver => !excludeIds.includes(driver.id)) || []
        : drivers || [];

      return filteredDrivers;
    },
    enabled: !!companyId,
  });

  // Mutation para convidar motorista
  const inviteDriverMutation = useMutation({
    mutationFn: async (driverProfileId: string) => {
      const { data, error } = await supabase
        .from('company_drivers')
        .insert({
          company_id: companyId,
          driver_profile_id: driverProfileId,
          status: 'PENDING',
          can_accept_autonomous_freights: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Convite enviado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['available-drivers', companyId] });
      queryClient.invalidateQueries({ queryKey: ['pending-drivers', companyId] });
      queryClient.invalidateQueries({ queryKey: ['company-drivers', companyId] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao enviar convite');
    },
  });

  return {
    availableDrivers,
    isLoading,
    inviteDriver: inviteDriverMutation.mutate,
    isInviting: inviteDriverMutation.isPending,
  };
};
