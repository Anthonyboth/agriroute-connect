import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ChatConversation {
  id: string;
  type: 'FREIGHT' | 'SERVICE' | 'DIRECT_CHAT' | 'DOCUMENT_REQUEST';
  title: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  otherParticipant: {
    name: string;
    avatar?: string;
  };
  metadata: any;
  isClosed: boolean;
}

export const useUnifiedChats = (userProfileId: string, userRole: string) => {
  const queryClient = useQueryClient();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);

  // Buscar todas as conversas baseado no perfil
  const { data: rawConversations = [], isLoading } = useQuery({
    queryKey: ['unified-chats', userProfileId, userRole],
    queryFn: async () => {
      const allConversations: ChatConversation[] = [];

      // 1. FRETES COM CHAT
      if (['MOTORISTA', 'MOTORISTA_AFILIADO', 'PRODUTOR'].includes(userRole)) {
        const { data: freightChats } = await supabase
          .from('freight_messages')
          .select(`
            freight_id,
            message,
            created_at,
            sender_id,
            read_at,
            chat_closed_by,
            freights!inner(
              id,
              product_type,
              origin_city,
              destination_city,
              producer_id,
              driver_id,
              profiles!freights_producer_id_fkey(full_name),
              driver:profiles!freights_driver_id_fkey(full_name)
            )
          `)
          .or(
            userRole === 'MOTORISTA' || userRole === 'MOTORISTA_AFILIADO'
              ? `freights.driver_id.eq.${userProfileId}`
              : `freights.producer_id.eq.${userProfileId}`
          )
          .order('created_at', { ascending: false });

        // Agrupar por freight_id
        const freightMap = new Map();
        freightChats?.forEach((msg: any) => {
          const freightId = msg.freight_id;
          if (!freightMap.has(freightId)) {
            const freight = msg.freights;
            const isClosed = msg.chat_closed_by?.[userProfileId] === true;
            const isUnread = !msg.read_at && msg.sender_id !== userProfileId;
            
            freightMap.set(freightId, {
              id: `freight-${freightId}`,
              type: 'FREIGHT' as const,
              title: `Frete: ${freight.product_type} - ${freight.origin_city} → ${freight.destination_city}`,
              lastMessage: msg.message,
              lastMessageTime: msg.created_at,
              unreadCount: 0,
              otherParticipant: {
                name:
                  userRole === 'PRODUTOR'
                    ? freight.driver?.full_name || 'Motorista'
                    : freight.profiles?.full_name || 'Produtor',
              },
              metadata: { freightId: freight.id },
              isClosed,
            });
          }
          
          const conv = freightMap.get(freightId);
          if (!msg.read_at && msg.sender_id !== userProfileId) {
            conv.unreadCount++;
          }
        });
        
        allConversations.push(...Array.from(freightMap.values()));
      }

      // 2. SERVIÇOS
      if (['PRODUTOR', 'PRESTADOR_SERVICO'].includes(userRole)) {
        const { data: serviceChats } = await supabase
          .from('service_messages')
          .select(`
            service_request_id,
            message,
            created_at,
            sender_id,
            read_at,
            chat_closed_by,
            service_requests!inner(
              id,
              service_type,
              client_id,
              provider_id,
              client:profiles!service_requests_client_id_fkey(full_name),
              provider:profiles!service_requests_provider_id_fkey(full_name)
            )
          `)
          .or(
            userRole === 'PRESTADOR_SERVICO'
              ? `service_requests.provider_id.eq.${userProfileId}`
              : `service_requests.client_id.eq.${userProfileId}`
          )
          .order('created_at', { ascending: false });

        const serviceMap = new Map();
        serviceChats?.forEach((msg: any) => {
          const serviceId = msg.service_request_id;
          if (!serviceMap.has(serviceId)) {
            const service = msg.service_requests;
            const isClosed = msg.chat_closed_by?.[userProfileId] === true;
            
            serviceMap.set(serviceId, {
              id: `service-${serviceId}`,
              type: 'SERVICE' as const,
              title: `Serviço: ${service.service_type}`,
              lastMessage: msg.message,
              lastMessageTime: msg.created_at,
              unreadCount: 0,
              otherParticipant: {
                name:
                  userRole === 'PRESTADOR_SERVICO'
                    ? service.client?.full_name || 'Cliente'
                    : service.provider?.full_name || 'Prestador',
              },
              metadata: { serviceRequestId: service.id },
              isClosed,
            });
          }
          
          const conv = serviceMap.get(serviceId);
          if (!msg.read_at && msg.sender_id !== userProfileId) {
            conv.unreadCount++;
          }
        });
        
        allConversations.push(...Array.from(serviceMap.values()));
      }

      // 3. CHAT DIRETO TRANSPORTADORA-MOTORISTA
      if (['MOTORISTA_AFILIADO', 'TRANSPORTADORA'].includes(userRole)) {
        const { data: directChats } = await supabase
          .from('company_driver_chats')
          .select(`
            id,
            message,
            created_at,
            sender_type,
            is_read,
            chat_closed_by,
            company_id,
            driver_profile_id,
            company:transport_companies!inner(company_name, profile_id),
            driver:profiles!company_driver_chats_driver_profile_id_fkey(full_name)
          `)
          .or(
            userRole === 'MOTORISTA_AFILIADO'
              ? `driver_profile_id.eq.${userProfileId}`
              : `company.profile_id.eq.${userProfileId}`
          )
          .order('created_at', { ascending: false });

        const chatMap = new Map();
        directChats?.forEach((msg: any) => {
          const chatKey = `${msg.company_id}-${msg.driver_profile_id}`;
          if (!chatMap.has(chatKey)) {
            const isClosed = msg.chat_closed_by?.[userProfileId] === true;
            
            chatMap.set(chatKey, {
              id: `direct-${chatKey}`,
              type: 'DIRECT_CHAT' as const,
              title:
                userRole === 'MOTORISTA_AFILIADO'
                  ? `Chat: ${msg.company?.company_name || 'Transportadora'}`
                  : `Chat: ${msg.driver?.full_name || 'Motorista'}`,
              lastMessage: msg.message,
              lastMessageTime: msg.created_at,
              unreadCount: 0,
              otherParticipant: {
                name:
                  userRole === 'MOTORISTA_AFILIADO'
                    ? msg.company?.company_name || 'Transportadora'
                    : msg.driver?.full_name || 'Motorista',
              },
              metadata: {
                companyId: msg.company_id,
                driverProfileId: msg.driver_profile_id,
              },
              isClosed,
            });
          }
          
          const conv = chatMap.get(chatKey);
          const isUnread =
            (userRole === 'MOTORISTA_AFILIADO' && msg.sender_type === 'COMPANY' && !msg.is_read) ||
            (userRole === 'TRANSPORTADORA' && msg.sender_type === 'DRIVER' && !msg.is_read);
          
          if (isUnread) {
            conv.unreadCount++;
          }
        });
        
        allConversations.push(...Array.from(chatMap.values()));
      }

      // 4. SOLICITAÇÕES DE DOCUMENTOS (apenas MOTORISTA)
      if (['MOTORISTA', 'MOTORISTA_AFILIADO'].includes(userRole)) {
        const { data: docRequests } = await supabase
          .from('document_requests')
          .select(`
            id,
            requested_fields,
            status,
            notes,
            created_at,
            company:transport_companies!inner(company_name)
          `)
          .eq('driver_profile_id', userProfileId)
          .eq('status', 'PENDING')
          .order('created_at', { ascending: false });

        docRequests?.forEach((req: any) => {
          allConversations.push({
            id: `doc-${req.id}`,
            type: 'DOCUMENT_REQUEST' as const,
            title: `Solicitação de Documentos - ${req.company?.company_name || 'Transportadora'}`,
            lastMessage: `${req.requested_fields?.length || 0} campos solicitados`,
            lastMessageTime: req.created_at,
            unreadCount: 1,
            otherParticipant: {
              name: req.company?.company_name || 'Transportadora',
            },
            metadata: { documentRequestId: req.id },
            isClosed: false,
          });
        });
      }

      return allConversations;
    },
    enabled: !!userProfileId && !!userRole,
    refetchInterval: 10000, // Polling a cada 10s
  });

  // Real-time subscriptions
  useEffect(() => {
    if (!userProfileId) return;

    const channels: any[] = [];

    // Freight messages
    const freightChannel = supabase
      .channel('freight-messages-unified')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified-chats'] });
        }
      )
      .subscribe();
    channels.push(freightChannel);

    // Service messages
    const serviceChannel = supabase
      .channel('service-messages-unified')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified-chats'] });
        }
      )
      .subscribe();
    channels.push(serviceChannel);

    // Direct chats
    const directChannel = supabase
      .channel('driver-chats-unified')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_driver_chats',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified-chats'] });
        }
      )
      .subscribe();
    channels.push(directChannel);

    // Document requests
    const docChannel = supabase
      .channel('doc-requests-unified')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'document_requests',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified-chats'] });
        }
      )
      .subscribe();
    channels.push(docChannel);

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, [userProfileId, queryClient]);

  // Fechar conversa (atualizar apenas a última mensagem)
  const closeConversation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const conversationId = id.split('-').slice(1).join('-');

      if (type === 'FREIGHT') {
        // Buscar última mensagem do freight
        const { data: lastMessage } = await supabase
          .from('freight_messages')
          .select('id, chat_closed_by')
          .eq('freight_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMessage) {
          const currentClosedBy = (lastMessage.chat_closed_by as any) || {};
          const updatedClosedBy = { ...currentClosedBy, [userProfileId]: true };
          await supabase
            .from('freight_messages')
            .update({ chat_closed_by: updatedClosedBy })
            .eq('id', lastMessage.id);
        }
      } else if (type === 'SERVICE') {
        const { data: lastMessage } = await supabase
          .from('service_messages')
          .select('id, chat_closed_by')
          .eq('service_request_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMessage) {
          const currentClosedBy = (lastMessage.chat_closed_by as any) || {};
          const updatedClosedBy = { ...currentClosedBy, [userProfileId]: true };
          await supabase
            .from('service_messages')
            .update({ chat_closed_by: updatedClosedBy })
            .eq('id', lastMessage.id);
        }
      } else if (type === 'DIRECT_CHAT') {
        const [companyId, driverProfileId] = conversationId.split('-');
        const { data: lastMessage } = await supabase
          .from('company_driver_chats')
          .select('id, chat_closed_by')
          .eq('company_id', companyId)
          .eq('driver_profile_id', driverProfileId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMessage) {
          const currentClosedBy = (lastMessage.chat_closed_by as any) || {};
          const updatedClosedBy = { ...currentClosedBy, [userProfileId]: true };
          await supabase
            .from('company_driver_chats')
            .update({ chat_closed_by: updatedClosedBy })
            .eq('id', lastMessage.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-chats'] });
      toast.success('Conversa fechada');
    },
    onError: () => {
      toast.error('Erro ao fechar conversa');
    },
  });

  // Reabrir conversa
  const reopenConversation = useMutation({
    mutationFn: async ({ id, type }: { id: string; type: string }) => {
      const conversationId = id.split('-').slice(1).join('-');

      if (type === 'FREIGHT') {
        const { data: lastMessage } = await supabase
          .from('freight_messages')
          .select('id, chat_closed_by')
          .eq('freight_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMessage) {
          const currentClosedBy = (lastMessage.chat_closed_by as any) || {};
          const updatedClosedBy = { ...currentClosedBy, [userProfileId]: false };
          await supabase
            .from('freight_messages')
            .update({ chat_closed_by: updatedClosedBy })
            .eq('id', lastMessage.id);
        }
      } else if (type === 'SERVICE') {
        const { data: lastMessage } = await supabase
          .from('service_messages')
          .select('id, chat_closed_by')
          .eq('service_request_id', conversationId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMessage) {
          const currentClosedBy = (lastMessage.chat_closed_by as any) || {};
          const updatedClosedBy = { ...currentClosedBy, [userProfileId]: false };
          await supabase
            .from('service_messages')
            .update({ chat_closed_by: updatedClosedBy })
            .eq('id', lastMessage.id);
        }
      } else if (type === 'DIRECT_CHAT') {
        const [companyId, driverProfileId] = conversationId.split('-');
        const { data: lastMessage } = await supabase
          .from('company_driver_chats')
          .select('id, chat_closed_by')
          .eq('company_id', companyId)
          .eq('driver_profile_id', driverProfileId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (lastMessage) {
          const currentClosedBy = (lastMessage.chat_closed_by as any) || {};
          const updatedClosedBy = { ...currentClosedBy, [userProfileId]: false };
          await supabase
            .from('company_driver_chats')
            .update({ chat_closed_by: updatedClosedBy })
            .eq('id', lastMessage.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-chats'] });
      toast.success('Conversa reaberta');
    },
    onError: () => {
      toast.error('Erro ao reabrir conversa');
    },
  });

  useEffect(() => {
    setConversations(rawConversations);
  }, [rawConversations]);

  const totalUnread = conversations
    .filter((c) => !c.isClosed)
    .reduce((sum, c) => sum + c.unreadCount, 0);

  return {
    conversations,
    isLoading,
    totalUnread,
    closeConversation,
    reopenConversation,
  };
};
