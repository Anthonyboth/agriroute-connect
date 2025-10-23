import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useDriverChat = (companyId: string, driverProfileId: string) => {
  const queryClient = useQueryClient();
  const [unreadCount, setUnreadCount] = useState(0);

  // Buscar mensagens existentes com polling fallback
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['driver-chat', companyId, driverProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_driver_chats')
        .select('*')
        .eq('company_id', companyId)
        .eq('driver_profile_id', driverProfileId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !!driverProfileId,
    refetchInterval: 5000, // Polling fallback when Realtime fails
  });

  // Contar mensagens não lidas
  useEffect(() => {
    const unread = messages.filter(
      (msg) => msg.sender_type === 'DRIVER' && !msg.is_read
    ).length;
    setUnreadCount(unread);
  }, [messages]);

  // Realtime subscription
  useEffect(() => {
    if (!companyId || !driverProfileId) return;

    const channel = supabase
      .channel(`chat-${companyId}-${driverProfileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_driver_chats',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          if (payload.new.driver_profile_id === driverProfileId) {
            queryClient.setQueryData(
              ['driver-chat', companyId, driverProfileId],
              (old: any[]) => [...(old || []), payload.new]
            );
            
            if (payload.new.sender_type === 'DRIVER') {
              setUnreadCount((prev) => prev + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [companyId, driverProfileId, queryClient]);

  // Enviar mensagem
  const sendMessage = useMutation({
    mutationFn: async (message: string) => {
      const { error } = await supabase
        .from('company_driver_chats')
        .insert({
          company_id: companyId,
          driver_profile_id: driverProfileId,
          sender_type: 'COMPANY',
          message,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-chat', companyId, driverProfileId] });
    },
    onError: (error: any) => {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    },
  });

  // Marcar mensagens como lidas
  const markAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('company_driver_chats')
        .update({ is_read: true })
        .eq('company_id', companyId)
        .eq('driver_profile_id', driverProfileId)
        .eq('sender_type', 'DRIVER')
        .eq('is_read', false);
      
      if (error) throw error;
    },
    onSuccess: () => {
      setUnreadCount(0);
      queryClient.invalidateQueries({ queryKey: ['driver-chat', companyId, driverProfileId] });
    },
  });

  return {
    messages,
    unreadCount,
    isLoading,
    sendMessage,
    markAsRead,
  };
};
