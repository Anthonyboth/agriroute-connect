import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useDocumentRequest = (companyId?: string, driverProfileId?: string) => {
  const queryClient = useQueryClient();

  // Buscar solicitação pendente
  const { data: pendingRequest, isLoading } = useQuery({
    queryKey: ['document-request', companyId, driverProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_requests')
        .select('*')
        .eq('company_id', companyId!)
        .eq('driver_profile_id', driverProfileId!)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !!driverProfileId,
  });

  // Criar/atualizar solicitação
  const createRequest = useMutation({
    mutationFn: async ({ fields, notes }: { fields: string[]; notes?: string }) => {
      console.log('🔄 Criando solicitação de documentos:', { fields, notes, companyId, driverProfileId });

      // Buscar profile_id do usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) throw new Error('Perfil não encontrado');

      // Verificar se já existe uma pendente
      const { data: existing } = await supabase
        .from('document_requests')
        .select('id')
        .eq('company_id', companyId!)
        .eq('driver_profile_id', driverProfileId!)
        .eq('status', 'PENDING')
        .maybeSingle();

      if (existing) {
        // Atualizar existente
        const { data, error } = await supabase
          .from('document_requests')
          .update({
            requested_fields: fields,
            notes,
            requested_by: profile.id,
            requested_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        console.log('✅ Solicitação atualizada:', data);
        return data;
      } else {
        // Criar nova
        const { data, error } = await supabase
          .from('document_requests')
          .insert({
            company_id: companyId!,
            driver_profile_id: driverProfileId!,
            requested_fields: fields,
            notes,
            requested_by: profile.id,
            status: 'PENDING',
          })
          .select()
          .single();

        if (error) throw error;
        console.log('✅ Solicitação criada:', data);
        return data;
      }
    },
    onSuccess: async (data) => {
      // Enviar notificação ao motorista
      try {
        const { error: notifError } = await supabase.rpc('send_notification', {
          p_user_id: driverProfileId!,
          p_title: 'Documentos Solicitados',
          p_message: `A transportadora solicitou que você complete ${(data.requested_fields as string[]).length} informações do seu perfil.`,
          p_type: 'DOCUMENT_REQUEST',
          p_data: {
            requestId: data.id,
            companyId: companyId,
            fieldsCount: (data.requested_fields as string[]).length,
          },
        });

        if (notifError) {
          console.error('❌ Erro ao enviar notificação:', notifError);
        } else {
          console.log('✅ Notificação enviada ao motorista');
        }
      } catch (error) {
        console.error('❌ Erro ao enviar notificação:', error);
      }

      toast.success(`Solicitação enviada! O motorista receberá uma notificação.`);
      queryClient.invalidateQueries({ queryKey: ['document-request'] });
    },
    onError: (error: any) => {
      console.error('❌ Erro ao criar solicitação:', error);
      toast.error(`Erro ao enviar solicitação: ${error.message}`);
    },
  });

  // Marcar como completa (motorista)
  const completeRequest = useMutation({
    mutationFn: async (requestId: string) => {
      const { data, error } = await supabase
        .from('document_requests')
        .update({
          status: 'COMPLETED',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Documentos atualizados com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['document-request'] });
    },
  });

  return {
    pendingRequest,
    isLoading,
    createRequest,
    completeRequest,
  };
};
