import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { devLog } from '@/lib/devLogger';

export interface ChatParticipant {
  id: string;
  name: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA' | 'MOTORISTA_AFILIADO' | 'PRESTADOR_SERVICO';
  avatar?: string;
}

export interface ChatConversation {
  id: string;
  type: 'FREIGHT' | 'SERVICE' | 'DIRECT_CHAT' | 'DOCUMENT_REQUEST' | 'FREIGHT_SHARE';
  title: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  otherParticipant: {
    name: string;
    avatar?: string;
    phone?: string;
  };
  participants: ChatParticipant[];
  metadata: any;
  isClosed: boolean;
  isAutoClosedByRatings?: boolean;
  freightStatus?: string;
  hasGpsTracking?: boolean;
  gpsLastUpdate?: string;
}

export const useUnifiedChats = (userProfileId: string, userRole: string) => {
  const queryClient = useQueryClient();

  // Buscar todas as conversas baseado no perfil
  const { data: rawConversations = [], isLoading } = useQuery({
    queryKey: ['unified-chats', userProfileId, userRole],
    queryFn: async () => {
      devLog('[useUnifiedChats] queryFn executando para:', { userProfileId, userRole });
      const allConversations: ChatConversation[] = [];

      // 1. FRETES COM CHAT - Query refatorada em 3 etapas para evitar 400
      if (['MOTORISTA', 'MOTORISTA_AFILIADO', 'PRODUTOR', 'TRANSPORTADORA'].includes(userRole)) {
        // Etapa 1: Buscar fretes básicos do usuário
        let freightQuery = supabase
          .from('freights')
          .select('id, producer_id, driver_id, cargo_type, origin_city, destination_city, origin_address, destination_address, status, company_id');

        if (userRole === 'MOTORISTA' || userRole === 'MOTORISTA_AFILIADO') {
          freightQuery = freightQuery.eq('driver_id', userProfileId);
        } else if (userRole === 'PRODUTOR') {
          freightQuery = freightQuery.eq('producer_id', userProfileId);
        } else if (userRole === 'TRANSPORTADORA') {
          // Transportadora vê fretes de seus motoristas afiliados
          const { data: companyData } = await supabase
            .from('transport_companies')
            .select('id')
            .eq('profile_id', userProfileId)
            .maybeSingle();
          
          if (companyData?.id) {
            freightQuery = freightQuery.eq('company_id', companyData.id);
          } else {
            // Sem transportadora ainda - retornar array vazio sem fazer query inválida
            return allConversations;
          }
        }

        const { data: userFreights, error: freightsError } = await freightQuery;

        if (freightsError) {
          console.error('[useUnifiedChats] Erro ao buscar fretes:', freightsError);
        }

        // ✅ Regra de segurança: fretes sem produtor cadastrado não devem abrir chat de frete
        const eligibleFreights = (userFreights || []).filter((f: any) => Boolean(f?.producer_id));
        const freightIds = eligibleFreights.map((f: any) => f.id);

        if (freightIds.length > 0) {
          // Etapa 2: Buscar mensagens SEM JOINS
          const { data: messages } = await supabase
            .from('freight_messages')
            .select('freight_id, message, created_at, sender_id, read_at, chat_closed_by')
            .in('freight_id', freightIds)
            .order('created_at', { ascending: false });

          // Etapa 3: Buscar perfis necessários incluindo company_id (usando view segura)
          const producerIds = [...new Set(eligibleFreights.map((f: any) => f.producer_id).filter(Boolean))];
          const driverIds = [...new Set(eligibleFreights.map((f: any) => f.driver_id).filter(Boolean))];
          const companyIds = [...new Set(eligibleFreights.map((f: any) => f.company_id).filter(Boolean))];
          
          // Usar profiles_secure para mascarar PII de outros usuários
          const allProfileIdsForFreights = [...new Set([...producerIds, ...driverIds])];
          let profiles: any[] | null = null;
          if (allProfileIdsForFreights.length > 0) {
            const { data } = await (supabase as any)
              .from('profiles_secure')
              .select('id, full_name, role, phone, profile_photo_url')
              .in('id', allProfileIdsForFreights);
            profiles = data;
          }

          // Buscar últimas localizações GPS dos motoristas
          let gpsLocationMap = new Map();
          if (driverIds.length > 0) {
            const { data: locations } = await supabase
              .from('driver_location_history')
              .select('driver_profile_id, freight_id, captured_at')
              .in('driver_profile_id', driverIds)
              .order('captured_at', { ascending: false });
            
            // Agrupar por driver_id, pegando a mais recente
            locations?.forEach((loc: any) => {
              const key = `${loc.driver_profile_id}-${loc.freight_id}`;
              if (!gpsLocationMap.has(key)) {
                gpsLocationMap.set(key, loc.captured_at);
              }
            });
          }

          // Buscar transportadoras se existirem
          let companyMap = new Map();
          if (companyIds.length > 0) {
            const { data: companies } = await supabase
              .from('transport_companies')
              .select('id, company_name, profile_id')
              .in('id', companyIds);
            companyMap = new Map(companies?.map((c: any) => [c.id, c]) || []);
          }

          // Buscar ratings para verificar fechamento automático
          // CORREÇÃO: Dividir em lotes de 50 para evitar erro HTTP 400
          let allRatings: any[] = [];
          const batchSize = 50;
          for (let i = 0; i < freightIds.length; i += batchSize) {
            const batch = freightIds.slice(i, i + batchSize);
            try {
              const { data: batchRatings } = await supabase
                .from('ratings')
                .select('freight_id, rater_id')
                .in('freight_id', batch);
              if (batchRatings) allRatings.push(...batchRatings);
            } catch (e) {
              console.warn('[useUnifiedChats] Erro ao buscar ratings batch:', e);
            }
          }
          const ratings = allRatings;
          
          const ratingsMap = new Map<string, Set<string>>();
          ratings?.forEach((r: any) => {
            if (!ratingsMap.has(r.freight_id)) {
              ratingsMap.set(r.freight_id, new Set());
            }
            ratingsMap.get(r.freight_id)?.add(r.rater_id);
          });

          // Criar mapa de perfis para lookup rápido (tipagem explícita para profiles_secure)
          interface SecureProfile { id: string; full_name?: string; role?: string; phone?: string; active_mode?: string; profile_photo_url?: string; }
          const profileMap = new Map<string, SecureProfile>((profiles as SecureProfile[] || []).map((p) => [p.id, p]));
          const freightMap = new Map((eligibleFreights || []).map((f: any) => [f.id, f]) || []);

          // Agrupar mensagens por freight_id
          const conversationMap = new Map();
          messages?.forEach((msg: any) => {
            const freight = freightMap.get(msg.freight_id);
            if (!freight) return;

            if (!conversationMap.has(msg.freight_id)) {
              const producerProfile = profileMap.get(freight.producer_id);
              if (!producerProfile) return; // frete guest/sem produtor cadastrado não abre chat
              const driverProfile = profileMap.get(freight.driver_id);
              const company = companyMap.get(freight.company_id);
              const isClosed = msg.chat_closed_by?.[userProfileId] === true;
              
              // Verificar fechamento automático de CHATS:
              // Chats fecham quando o frete atinge status terminal OU entrega reportada
              const freightRatings = ratingsMap.get(freight.id);
              const CHAT_CLOSE_STATUSES = ['COMPLETED', 'CANCELLED', 'CONCLUIDO', 'CANCELADO', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION'];
              const isFreightDone = CHAT_CLOSE_STATUSES.includes(freight.status);
              const bothRated = freightRatings && freightRatings.size >= 2;
              const isAutoClosedByRatings = isFreightDone && bothRated;
              
              // Chat fecha automaticamente quando frete está entregue ou finalizado
              const shouldAutoClose = isFreightDone;

              // Corrigir cidades null
              const originCity = freight.origin_city || freight.origin_address?.split(',')[0] || 'Origem';
              const destinationCity = freight.destination_city || freight.destination_address?.split(',')[0] || 'Destino';

              // Construir lista de participantes (suporte a 3+)
              const participants: ChatParticipant[] = [];
              if (producerProfile) {
                participants.push({
                  id: freight.producer_id,
                  name: producerProfile.full_name || 'Produtor',
                  role: 'PRODUTOR',
                  avatar: producerProfile.profile_photo_url || undefined,
                });
              }
              if (driverProfile) {
                participants.push({
                  id: freight.driver_id,
                  name: driverProfile.full_name || 'Motorista',
                  role: (driverProfile.active_mode as ChatParticipant['role']) || 'MOTORISTA',
                  avatar: driverProfile.profile_photo_url || undefined,
                });
              }
              if (company) {
                participants.push({
                  id: company.profile_id,
                  name: company.company_name || 'Transportadora',
                  role: 'TRANSPORTADORA',
                });
              }

              // Determinar "outro participante" principal para exibição
              let otherParticipantName = 'Participante';
              let otherParticipantPhone: string | undefined;
              let otherParticipantAvatar: string | undefined;
              if (userRole === 'PRODUTOR') {
                otherParticipantName = driverProfile?.full_name || 'Motorista';
                otherParticipantPhone = driverProfile?.phone;
                otherParticipantAvatar = driverProfile?.profile_photo_url || undefined;
              } else if (userRole === 'TRANSPORTADORA') {
                otherParticipantName = producerProfile?.full_name || 'Produtor';
                otherParticipantPhone = producerProfile?.phone;
                otherParticipantAvatar = producerProfile?.profile_photo_url || undefined;
              } else {
                otherParticipantName = producerProfile?.full_name || 'Produtor';
                otherParticipantPhone = producerProfile?.phone;
                otherParticipantAvatar = producerProfile?.profile_photo_url || undefined;
              }

              // Verificar se GPS está ativo (frete em andamento)
              const hasGpsTracking = ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED'].includes(freight.status);
              
              // Buscar última atualização GPS
              const gpsKey = `${freight.driver_id}-${freight.id}`;
              const gpsLastUpdate = gpsLocationMap.get(gpsKey);
              
              conversationMap.set(msg.freight_id, {
                id: `freight-${msg.freight_id}`,
                type: 'FREIGHT' as const,
                title: `Frete: ${freight.cargo_type || 'Carga'} - ${originCity} → ${destinationCity}`,
                lastMessage: msg.message,
                lastMessageTime: msg.created_at,
                unreadCount: 0,
                otherParticipant: {
                  name: otherParticipantName,
                  phone: otherParticipantPhone,
                  avatar: otherParticipantAvatar,
                },
                participants,
                metadata: { freightId: freight.id, companyId: freight.company_id },
                isClosed: isClosed || isAutoClosedByRatings || shouldAutoClose,
                isAutoClosedByRatings,
                freightStatus: freight.status,
                hasGpsTracking,
                gpsLastUpdate,
              });
            }
            
            const conv = conversationMap.get(msg.freight_id);
            if (!msg.read_at && msg.sender_id !== userProfileId) {
              conv.unreadCount++;
            }
          });
          
          allConversations.push(...Array.from(conversationMap.values()));
        }
      }

      // 2. SERVIÇOS - Query refatorada em 3 etapas
      if (['PRODUTOR', 'PRESTADOR_SERVICO', 'PRESTADOR_SERVICOS', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA'].includes(userRole)) {
        // Etapa 1: Buscar serviços básicos do usuário
        // Determinar se o usuário é prestador ou cliente
        const isProvider = userRole === 'PRESTADOR_SERVICO' || userRole === 'PRESTADOR_SERVICOS';
        
        let serviceQuery = supabase
          .from('service_requests')
          .select('id, service_type, client_id, provider_id, status');

        if (isProvider) {
          serviceQuery = serviceQuery.eq('provider_id', userProfileId);
        } else {
          // PRODUTOR busca como cliente E também como provider (pode ter ambos os papéis)
          serviceQuery = serviceQuery.or(`client_id.eq.${userProfileId},provider_id.eq.${userProfileId}`);
        }

        const { data: userServices, error: servicesError } = await serviceQuery;

        if (servicesError) {
          console.error('[useUnifiedChats] Erro ao buscar serviços:', servicesError);
        }
        devLog('[useUnifiedChats] Serviços encontrados:', userServices?.length || 0, 'error:', servicesError?.message || 'none');

        const serviceIds = (userServices || []).map((s: any) => s.id);

        if (serviceIds.length > 0) {
          // Etapa 2: Buscar mensagens SEM JOINS
          const { data: messages, error: messagesError } = await supabase
            .from('service_messages')
            .select('service_request_id, message, created_at, sender_id, read_at, chat_closed_by')
            .in('service_request_id', serviceIds)
            .order('created_at', { ascending: false });

          if (messagesError) {
            console.error('[useUnifiedChats] Erro ao buscar service_messages:', messagesError);
          }
          devLog('[useUnifiedChats] Service messages encontradas:', messages?.length || 0, 'para serviceIds:', serviceIds.length);

          // Etapa 3: Buscar perfis necessários (usar profiles_secure para respeitar PII)
          const clientIds = [...new Set((userServices || []).map((s: any) => s.client_id).filter(Boolean))];
          const providerIds = [...new Set((userServices || []).map((s: any) => s.provider_id).filter(Boolean))];
          const allProfileIds = [...new Set([...clientIds, ...providerIds])];
          
          let profileMap = new Map<string, any>();
          if (allProfileIds.length > 0) {
            const { data: profiles } = await (supabase as any)
              .from('profiles_secure')
              .select('id, full_name, profile_photo_url')
              .in('id', allProfileIds);
            profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));
          }

          const serviceMap = new Map((userServices || []).map((s: any) => [s.id, s]) || []);

          // Agrupar mensagens por service_request_id
          const conversationMap = new Map();
          (messages || []).forEach((msg: any) => {
            const service = serviceMap.get(msg.service_request_id);
            if (!service) return;

            if (!conversationMap.has(msg.service_request_id)) {
              const clientProfile = profileMap.get(service.client_id);
              const providerProfile = profileMap.get(service.provider_id);
              const isManualClosed = msg.chat_closed_by?.[userProfileId] === true;
              
              // Auto-fechar serviços com status final (mesma lógica dos fretes)
              const SERVICE_FINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'CONCLUIDO', 'CANCELADO'];
              const isServiceCompleted = SERVICE_FINAL_STATUSES.includes(service.status);
              const isClosed = isManualClosed || isServiceCompleted;
              
              // Determinar o "outro participante" baseado no papel do usuário
              const isCurrentUserProvider = service.provider_id === userProfileId;
              
              conversationMap.set(msg.service_request_id, {
                id: `service-${msg.service_request_id}`,
                type: 'SERVICE' as const,
                title: `Serviço: ${service.service_type}`,
                lastMessage: msg.message,
                lastMessageTime: msg.created_at,
                unreadCount: 0,
                otherParticipant: {
                  name: isCurrentUserProvider
                    ? clientProfile?.full_name || 'Cliente'
                    : providerProfile?.full_name || 'Prestador',
                  avatar: isCurrentUserProvider
                    ? clientProfile?.profile_photo_url || undefined
                    : providerProfile?.profile_photo_url || undefined,
                },
                participants: [
                  { id: service.client_id, name: clientProfile?.full_name || 'Cliente', role: 'PRODUTOR' as const, avatar: clientProfile?.profile_photo_url || undefined },
                  ...(service.provider_id ? [{ id: service.provider_id, name: providerProfile?.full_name || 'Prestador', role: 'PRESTADOR_SERVICO' as const, avatar: providerProfile?.profile_photo_url || undefined }] : []),
                ],
                metadata: { serviceRequestId: service.id },
                isClosed,
              });
            }
            
            const conv = conversationMap.get(msg.service_request_id);
            if (!msg.read_at && msg.sender_id !== userProfileId) {
              conv.unreadCount++;
            }
          });
          
          allConversations.push(...Array.from(conversationMap.values()));
        }
      }

      // ... keep existing code (3. CHAT DIRETO, 4. FRETES COMPARTILHADOS, 5. SOLICITAÇÕES DE DOCUMENTOS)
      if (['MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA'].includes(userRole)) {
        let directChats: any[] = [];
        
        if (userRole === 'MOTORISTA' || userRole === 'MOTORISTA_AFILIADO') {
          // Motorista: buscar por driver_profile_id
          const { data } = await supabase
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
              company:transport_companies(company_name, profile_id),
              driver:profiles!company_driver_chats_driver_profile_id_fkey(full_name)
            `)
            .eq('driver_profile_id', userProfileId)
            .order('created_at', { ascending: false });
          directChats = data || [];
        } else if (userRole === 'TRANSPORTADORA') {
          // Transportadora: buscar company_id primeiro
          const { data: company } = await supabase
            .from('transport_companies')
            .select('id')
            .eq('profile_id', userProfileId)
            .maybeSingle();
            
          if (company) {
            const { data } = await supabase
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
                company:transport_companies(company_name, profile_id),
                driver:profiles!company_driver_chats_driver_profile_id_fkey(full_name)
              `)
              .eq('company_id', company.id)
              .order('created_at', { ascending: false });
            directChats = data || [];
          }
        }

        const chatMap = new Map();
        directChats.forEach((msg: any) => {
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
              participants: [
                { id: msg.driver_profile_id, name: msg.driver?.full_name || 'Motorista', role: 'MOTORISTA_AFILIADO' as const },
                { id: msg.company?.profile_id || msg.company_id, name: msg.company?.company_name || 'Transportadora', role: 'TRANSPORTADORA' as const },
              ],
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

      // 4. FRETES COMPARTILHADOS (apenas TRANSPORTADORA)
      if (userRole === 'TRANSPORTADORA') {
        const { data: companyData } = await supabase
          .from('transport_companies')
          .select('id')
          .eq('profile_id', userProfileId)
          .single();

        if (companyData) {
          const { data: internalMessages } = await supabase
            .from('company_internal_messages')
            .select('id, message, created_at, read_at, chat_closed_by, sender_id, sender:profiles!company_internal_messages_sender_id_fkey(full_name)')
            .eq('company_id', companyData.id)
            .eq('message_type', 'SYSTEM')
            .order('created_at', { ascending: false });

          internalMessages?.forEach((msg: any) => {
            try {
              const messageData = JSON.parse(msg.message);
              if (messageData.type === 'FREIGHT_SHARE') {
                // Normalizar freightData: aceitar payload.freightData OU payload direto
                const raw = messageData.freightData || messageData;
                const freightData = {
                  freight_id: raw.freight_id,
                  cargo_type: raw.cargo_type || 'Carga',
                  origin: raw.origin || raw.origin_address || '',
                  destination: raw.destination || raw.destination_address || '',
                  origin_city: raw.origin_city || raw.origin?.split('|')[0] || raw.origin_address?.split('|')[0] || '',
                  destination_city: raw.destination_city || raw.destination?.split('|')[0] || raw.destination_address?.split('|')[0] || '',
                  pickup_date: raw.pickup_date,
                  delivery_date: raw.delivery_date,
                  price: Number(raw.price || 0),
                  distance_km: Number(raw.distance_km || 0),
                  weight: Number(raw.weight || 0),
                  urgency: raw.urgency,
                  service_type: raw.service_type,
                  shared_by: raw.shared_by,
                  shared_at: raw.shared_at,
                };
                
                const closedBy = (msg.chat_closed_by as any) || {};

                allConversations.push({
                  id: `freight-share-${msg.id}`,
                  type: 'FREIGHT_SHARE' as const,
                  title: `Frete Compartilhado: ${freightData.cargo_type} - ${freightData.origin_city} → ${freightData.destination_city}`,
                  lastMessage: `Compartilhado por ${msg.sender?.full_name || 'Motorista'} - R$ ${freightData.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
                  lastMessageTime: msg.created_at,
                  unreadCount: msg.read_at ? 0 : 1,
                  otherParticipant: {
                    name: msg.sender?.full_name || 'Motorista',
                  },
                  participants: [{
                    id: msg.sender_id,
                    name: msg.sender?.full_name || 'Motorista',
                    role: 'MOTORISTA' as const,
                  }],
                  metadata: {
                    messageId: msg.id,
                    freightData: freightData,
                  },
                  isClosed: closedBy[userProfileId] === true,
                });
              }
            } catch (e) {
              console.error('Error parsing freight share message:', e);
            }
          });
        }
      }

      // 5. SOLICITAÇÕES DE DOCUMENTOS agora aparecem dentro do DIRECT_CHAT
      // Não precisamos criar conversas separadas para document_requests

      // ✅ Deduplicate conversations by id to prevent React duplicate key errors
      const deduped = Array.from(
        new Map(allConversations.map(c => [c.id, c])).values()
      );
      devLog('[useUnifiedChats] Total conversas retornadas:', deduped.length);
      return deduped;
    },
    enabled: !!userProfileId && !!userRole,
    staleTime: 60 * 1000, // 1 minuto
    refetchOnWindowFocus: false,
    // ❌ REMOVIDO: refetchInterval de 10s - realtime subscription já cuida de novas mensagens
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

    // Company internal messages (freight shares)
    const internalChannel = supabase
      .channel('company-internal-messages-unified')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'company_internal_messages',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['unified-chats'] });
        }
      )
      .subscribe();
    channels.push(internalChannel);

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
      } else if (type === 'FREIGHT_SHARE') {
        const messageId = conversationId;
        const { data: message } = await supabase
          .from('company_internal_messages')
          .select('id, chat_closed_by')
          .eq('id', messageId)
          .single();

        if (message) {
          const currentClosedBy = (message.chat_closed_by as any) || {};
          const updatedClosedBy = { ...currentClosedBy, [userProfileId]: true };
          await supabase
            .from('company_internal_messages')
            .update({ chat_closed_by: updatedClosedBy })
            .eq('id', message.id);
        }
      }
    },
    onMutate: async ({ id, type }) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: ['unified-chats', userProfileId, userRole] });
      
      // Salvar estado anterior para rollback
      const previousData = queryClient.getQueryData(['unified-chats', userProfileId, userRole]);
      
      // Atualização otimista: marcar conversa como fechada imediatamente
      queryClient.setQueryData(['unified-chats', userProfileId, userRole], (old: ChatConversation[] | undefined) => {
        if (!old) return old;
        return old.map((conv: ChatConversation) => 
          conv.id === id ? { ...conv, isClosed: true } : conv
        );
      });
      
      return { previousData };
    },
    onSuccess: () => {
      toast.success('Conversa movida para Fechadas');
    },
    onError: (err, variables, context) => {
      // Rollback em caso de erro
      if (context?.previousData) {
        queryClient.setQueryData(['unified-chats', userProfileId, userRole], context.previousData);
      }
      toast.error('Erro ao fechar conversa');
    },
    onSettled: () => {
      // Sempre invalidar para garantir sincronização com servidor
      queryClient.invalidateQueries({ queryKey: ['unified-chats'] });
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
      } else if (type === 'FREIGHT_SHARE') {
        const messageId = conversationId;
        const { data: message } = await supabase
          .from('company_internal_messages')
          .select('id, chat_closed_by')
          .eq('id', messageId)
          .single();

        if (message) {
          const currentClosedBy = (message.chat_closed_by as any) || {};
          const updatedClosedBy = { ...currentClosedBy, [userProfileId]: false };
          await supabase
            .from('company_internal_messages')
            .update({ chat_closed_by: updatedClosedBy })
            .eq('id', message.id);
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

  const markFreightShareAsRead = useMutation({
    mutationFn: async (messageId: string) => {
      await supabase
        .from('company_internal_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['unified-chats'] });
    },
  });

  const totalUnread = rawConversations
    .filter((c) => !c.isClosed && c.unreadCount > 0)
    .length;

  return {
    conversations: rawConversations,
    isLoading,
    totalUnread,
    closeConversation,
    reopenConversation,
    markFreightShareAsRead,
  };
};

// Hook auxiliar para contador de não lidas
export const useUnreadChatsCount = (userProfileId: string, userRole: string) => {
  const { totalUnread } = useUnifiedChats(userProfileId, userRole);
  return { unreadCount: totalUnread };
};
