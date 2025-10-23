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

      // Buscar motoristas autônomos não afiliados
      const query = supabase
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
        .eq('role', 'MOTORISTA')
        .order('rating', { ascending: false, nullsFirst: false })
        .order('total_ratings', { ascending: false });

      // Excluir motoristas já afiliados
      if (excludeIds.length > 0) {
        query.not('id', 'in', `(${excludeIds.map(id => `'${id}'`).join(',')})`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];
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
