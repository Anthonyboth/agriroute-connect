import React, { useState, useEffect, useRef } from 'react';
import { devLog } from '@/lib/devLogger';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FreightCard } from '@/components/FreightCard';
import { DocumentRequestCard } from '@/components/DocumentRequestCard';
import { CompanyFreightAcceptModal } from '@/components/CompanyFreightAcceptModal';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { MessageDateSeparator } from '@/components/chat/MessageDateSeparator';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { 
  MessageSquare, 
  Users,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Driver {
  id: string;
  full_name: string;
  status: string;
}

interface Message {
  id: string;
  message: string;
  sender_id: string;
  created_at: string;
  message_type: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  reply_to_message_id?: string;
  read_at?: string;
  delivered_at?: string;
  edited_at?: string;
  deleted_at?: string;
  sender_type?: string;
  sender?: {
    full_name: string;
  };
}

export function CompanyInternalChat() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const chatChannelRef = useRef<any>(null);
  
  const typingIndicator = useTypingIndicator({
    companyId: companyId || '',
    driverProfileId: selectedDriver?.id || '',
    userProfileId: profile?.id || '',
  });

  useEffect(() => {
    if (profile?.id) {
      loadCompanyAndDrivers();
    }
  }, [profile?.id]);

  // Auto-scroll to bottom when new messages arrive or driver changes
  useEffect(() => {
    if (scrollAreaRef.current) {
      const isNearBottom = scrollAreaRef.current.scrollHeight - scrollAreaRef.current.scrollTop - scrollAreaRef.current.clientHeight < 200;
      if (isNearBottom || messages.length === 0) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages]);

  useEffect(() => {
    // Force scroll on driver change
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [selectedDriver?.id]);

  // Subscribe to typing indicators
  useEffect(() => {
    if (!selectedDriver || !companyId) return;

    const typingChannel = supabase
      .channel(`typing-${companyId}-${selectedDriver.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_typing_indicators',
          filter: `company_id=eq.${companyId}`
        },
        (payload) => {
          const data = payload.new as any;
          if (data.driver_profile_id === selectedDriver.id && data.user_profile_id !== profile?.id) {
            setOtherUserTyping(data.is_typing);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(typingChannel);
    };
  }, [selectedDriver, companyId, profile?.id]);

  useEffect(() => {
    if (selectedDriver && companyId) {
      loadMessages();
      
      let pollingInterval: NodeJS.Timeout | null = null;

      // Subscribe to new messages from three tables
      const channel = supabase
        .channel(`company-chat-${companyId}-${selectedDriver.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'company_driver_chats',
            filter: `company_id=eq.${companyId}`
          },
          (payload) => {
            if ((payload.new as any).driver_profile_id === selectedDriver.id) {
              loadMessages();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'company_internal_messages',
            filter: `company_id=eq.${companyId}`
          },
          (payload) => {
            if ((payload.new as any).sender_id === selectedDriver.id && (payload.new as any).message_type === 'SYSTEM') {
              loadMessages();
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'document_request_messages',
          },
          async (payload) => {
            const { data: docRequest } = await supabase
              .from('document_requests')
              .select('driver_profile_id')
              .eq('id', (payload.new as any).document_request_id)
              .single();
            
            if (docRequest?.driver_profile_id === selectedDriver.id) {
              loadMessages();
            }
          }
        )
        .subscribe((status) => {
          devLog('📡 Realtime status:', status);
          
          // Ativar polling se o canal falhar
          if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
            if (!pollingInterval) {
              pollingInterval = setInterval(() => {
                devLog('🔄 Polling fallback ativo');
                loadMessages();
              }, 10000);
            }
          } else if (status === 'SUBSCRIBED') {
            if (pollingInterval) {
              clearInterval(pollingInterval);
              pollingInterval = null;
            }
          }
        });

      // Cleanup realtime and typing on unmount
      typingIndicator.setTyping(false);
      
      return () => {
        supabase.removeChannel(channel);
        if (pollingInterval) {
          clearInterval(pollingInterval);
        }
        if (chatChannelRef.current) {
          supabase.removeChannel(chatChannelRef.current);
        }
      };
    }
  }, [selectedDriver, companyId]);

  const loadCompanyAndDrivers = async () => {
    try {
      // Get company
      const { data: companyData } = await supabase
        .from('transport_companies')
        .select('id')
        .eq('profile_id', profile?.id)
        .single();

      if (companyData) {
        setCompanyId(companyData.id);

        // Get drivers (ACTIVE e APPROVED)
        const { data: driversData } = await supabase
          .from('company_drivers')
          .select(`
            driver_profile_id,
            status,
            driver:profiles!company_drivers_driver_profile_id_fkey(
              id,
              full_name
            )
          `)
          .eq('company_id', companyData.id)
          .in('status', ['ACTIVE', 'APPROVED'])
          .order('status', { ascending: false });

        // Buscar também motoristas que compartilharam fretes (últimos 30 dias)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: sharedFreightDrivers } = await supabase
          .from('company_internal_messages')
          .select('sender_id, sender:profiles!company_internal_messages_sender_id_fkey(id, full_name)')
          .eq('company_id', companyData.id)
          .eq('message_type', 'SYSTEM')
          .gte('created_at', thirtyDaysAgo.toISOString())
          .order('created_at', { ascending: false });

        const driverMap = new Map();
        
        // Adicionar drivers ACTIVE/APPROVED primeiro
        driversData?.forEach((d: any) => {
          driverMap.set(d.driver.id, {
            id: d.driver.id,
            full_name: d.driver.full_name,
            status: d.status
          });
        });

        // Adicionar drivers que compartilharam fretes (se não existirem)
        sharedFreightDrivers?.forEach((m: any) => {
          if (m.sender && !driverMap.has(m.sender.id)) {
            driverMap.set(m.sender.id, {
              id: m.sender.id,
              full_name: m.sender.full_name,
              status: 'SHARED' // Status especial para identificar na UI
            });
          }
        });

        setDrivers(Array.from(driverMap.values()));
      }
    } catch (error) {
      console.error('Error loading drivers:', error);
    }
  };

  const loadMessages = async () => {
    if (!companyId || !selectedDriver) return;

    try {
      setLoading(true);
      
      // 1. Buscar mensagens de texto do chat driver-empresa
      const { data: chatMessages } = await supabase
        .from('company_driver_chats')
        .select('*')
        .eq('company_id', companyId)
        .eq('driver_profile_id', selectedDriver.id)
        .order('created_at', { ascending: true });

      // 2. Buscar mensagens FREIGHT_SHARE enviadas pelo motorista
      const { data: freightShares } = await supabase
        .from('company_internal_messages')
        .select('*')
        .eq('company_id', companyId)
        .eq('sender_id', selectedDriver.id)
        .eq('message_type', 'SYSTEM')
        .order('created_at', { ascending: true });

      // 3. Buscar solicitações de documentos entre a empresa e o motorista
      const { data: documentRequests } = await supabase
        .from('document_requests')
        .select('id')
        .eq('company_id', companyId)
        .eq('driver_profile_id', selectedDriver.id);

      const docRequestIds = (documentRequests || []).map(dr => dr.id);

      let docRequestMessages = [];
      if (docRequestIds.length > 0) {
        const { data: docMessages } = await supabase
          .from('document_request_messages')
          .select('*')
          .in('document_request_id', docRequestIds)
          .order('created_at', { ascending: true });
        
        docRequestMessages = docMessages || [];
      }

      // 4. Mapear mensagens
      const chatMapped = (chatMessages || []).map(msg => ({
        ...msg,
        message_type: 'TEXT' as const,
        sender_type: msg.sender_type
      }));

      const freightMapped = (freightShares || []).map(msg => ({
        ...msg,
        message_type: 'SYSTEM' as const,
        sender_type: 'DRIVER' as const
      }));

      const docMapped = docRequestMessages.map(msg => ({
        ...msg,
        message_type: msg.message_type,
        sender_type: msg.sender_id === companyId ? 'COMPANY' : 'DRIVER'
      }));

      // 5. Mesclar TRÊS fontes e ordenar
      const allMessages = [...chatMapped, ...freightMapped, ...docMapped].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      setMessages(allMessages as any);

      // 6. Marcar mensagens do driver como lidas
      if (chatMessages && chatMessages.length > 0) {
        await supabase
          .from('company_driver_chats')
          .update({ is_read: true })
          .eq('company_id', companyId)
          .eq('driver_profile_id', selectedDriver.id)
          .eq('sender_type', 'DRIVER')
          .eq('is_read', false);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  // Estado para modal de aceite
  const [acceptModalOpen, setAcceptModalOpen] = useState(false);
  const [selectedSharedFreight, setSelectedSharedFreight] = useState<any>(null);

  const handleAcceptSharedFreight = (freightId: string, driverId: string) => {
    // Buscar dados completos do frete
    const freightMessage = messages.find(m => 
      m.message_type === 'SYSTEM' && m.message.includes(freightId)
    );
    
    if (freightMessage) {
      setSelectedSharedFreight({
        freight_id: freightId,
        driver_id: driverId,
        message: freightMessage.message
      });
      setAcceptModalOpen(true);
    }
  };

  const handleAcceptSuccess = () => {
    setAcceptModalOpen(false);
    setSelectedSharedFreight(null);
    toast.success('Frete aceito com sucesso!', {
      description: 'O frete foi atribuído à transportadora.'
    });
    loadMessages();
  };

  const sendMessage = async (message: string, imageUrl?: string, fileData?: any) => {
    if ((!message.trim() && !imageUrl && !fileData) || !companyId || !selectedDriver) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('company_driver_chats')
        .insert({
          company_id: companyId,
          driver_profile_id: selectedDriver.id,
          message: message,
          image_url: imageUrl,
          file_url: fileData?.url,
          file_name: fileData?.name,
          file_type: fileData?.type,
          file_size: fileData?.size,
          reply_to_message_id: replyingTo?.id,
          sender_type: 'COMPANY',
          is_read: false,
          delivered_at: new Date().toISOString()
        });

      if (error) {
        // Handle storage permission errors
        if (error.message?.includes('storage') || error.message?.includes('permission')) {
          throw new Error('Erro de permissão ao enviar arquivo. Contate o administrador.');
        }
        throw error;
      }

      setReplyingTo(null);
      loadMessages();
      
      // Scroll to bottom after sending
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
      
      toast.success('Mensagem enviada!');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error(error.message || 'Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Lista de Motoristas */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Motoristas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum motorista ativo</p>
            </div>
          ) : (
            <div className="space-y-2">
              {drivers.map((driver) => (
                <Button
                  key={driver.id}
                  variant={selectedDriver?.id === driver.id ? 'default' : 'ghost'}
                  className="w-full justify-start"
                  onClick={() => setSelectedDriver(driver)}
                >
                  <Avatar className="h-8 w-8 mr-2">
                    <AvatarFallback>{driver.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate">{driver.full_name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    {driver.status}
                  </Badge>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Área de Chat */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {selectedDriver ? `Chat com ${selectedDriver.full_name}` : 'Selecione um motorista'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!selectedDriver ? (
            <div className="text-center py-12">
              <MessageSquare className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Selecione um motorista para iniciar uma conversa
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Messages Area */}
              <ScrollArea className="flex-1 h-[500px] border rounded-lg p-4" ref={scrollAreaRef}>
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    // Show date separator
                    const showDateSeparator = 
                      index === 0 || 
                      !isSameDay(
                        new Date(messages[index - 1].created_at),
                        new Date(message.created_at)
                      );

                    // Verificar se é mensagem de solicitação de documentos
                    if (message.message_type === 'DOCUMENT_REQUEST') {
                      try {
                        const requestData = JSON.parse(message.message);
                        return (
                          <React.Fragment key={message.id}>
                            {showDateSeparator && (
                              <MessageDateSeparator date={new Date(message.created_at)} />
                            )}
                            <div className="mb-4">
                              <div className="mb-2 p-2 bg-warning/10 border border-warning/30 rounded-t-lg">
                                <p className="text-sm text-warning-foreground font-medium">
                                  📄 Solicitação de Documentos
                                  {' • '}
                                  {new Date(message.created_at).toLocaleString('pt-BR', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </p>
                              </div>
                              <DocumentRequestCard
                                requestData={{
                                  requested_fields: requestData.requested_fields,
                                  notes: requestData.notes,
                                  company_name: requestData.company_name,
                                  status: requestData.status || 'PENDING',
                                  created_at: requestData.created_at
                                }}
                                onGoToProfile={() => {
                                  window.location.href = '/profile';
                                }}
                                onReplyInChat={() => {
                                  // Focus on chat input
                                }}
                              />
                            </div>
                          </React.Fragment>
                        );
                      } catch (e) {
                        console.error('Erro ao parsear documento:', e);
                        return null;
                      }
                    }

                    // Verificar se é mensagem de compartilhamento de frete
                    let freightData = null;
                    try {
                      const parsed = JSON.parse(message.message);
                      if (parsed.type === 'FREIGHT_SHARE') {
                        freightData = parsed;
                      }
                    } catch {
                      // Mensagem normal, não é JSON
                    }

                    if (freightData) {
                      // Converter dados do compartilhamento para formato do FreightCard
                      const freightForCard = {
                        id: freightData.freight_id,
                        cargo_type: freightData.cargo_type,
                        weight: freightData.weight || 0,
                        origin_address: freightData.origin_address,
                        destination_address: freightData.destination_address,
                        origin_city: freightData.origin_city,
                        origin_state: freightData.origin_state,
                        destination_city: freightData.destination_city,
                        destination_state: freightData.destination_state,
                        pickup_date: freightData.pickup_date,
                        delivery_date: freightData.delivery_date,
                        price: freightData.price,
                        minimum_antt_price: freightData.minimum_antt_price || 0,
                        distance_km: freightData.distance_km || 0,
                        urgency: freightData.urgency as 'LOW' | 'MEDIUM' | 'HIGH',
                        status: 'OPEN' as const,
                        service_type: freightData.service_type as 'CARGA' | 'GUINCHO' | 'MUDANCA' | 'FRETE_MOTO',
                        required_trucks: freightData.required_trucks || 1,
                        accepted_trucks: freightData.accepted_trucks || 0,
                        pricing_type: (freightData.pricing_type as 'FIXED' | 'PER_KM' | 'PER_TON') || 'FIXED',
                        price_per_km: freightData.price_per_km != null ? Number(freightData.price_per_km) : undefined,
                      };

                      return (
                        <React.Fragment key={message.id}>
                          {showDateSeparator && (
                            <MessageDateSeparator date={new Date(message.created_at)} />
                          )}
                          <div className="mb-4">
                            {/* Header do compartilhamento */}
                            <div className="mb-2 p-2 bg-primary/5 border border-primary/20 rounded-t-lg">
                              <p className="text-sm text-primary font-medium">
                                🔗 Frete compartilhado por <strong>{freightData.shared_by}</strong>
                                {' • '}
                                {new Date(freightData.shared_at).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            
                            {/* Card completo do frete */}
                            <FreightCard
                              freight={freightForCard}
                              showActions={true}
                              canAcceptFreights={true}
                              onAction={async (action) => {
                                if (action === 'accept') {
                                  await handleAcceptSharedFreight(freightData.freight_id, freightData.shared_by);
                                }
                                loadMessages();
                              }}
                            />
                          </div>
                        </React.Fragment>
                      );
                    }

                    // Mensagem normal (company_driver_chats)
                    const isFromCompany = (message as any).sender_type === 'COMPANY';
                    const replyToMsg = message.reply_to_message_id 
                      ? messages.find(m => m.id === message.reply_to_message_id)
                      : undefined;

                    return (
                      <React.Fragment key={message.id}>
                        {showDateSeparator && (
                          <MessageDateSeparator date={new Date(message.created_at)} />
                        )}
                        <ChatMessage
                          message={message}
                          isSender={isFromCompany}
                          senderName={isFromCompany ? 'Você' : selectedDriver?.full_name || 'Motorista'}
                          replyToMessage={replyToMsg ? {
                            senderName: replyToMsg.sender_type === 'COMPANY' ? 'Você' : selectedDriver?.full_name || 'Motorista',
                            message: replyToMsg.message
                          } : undefined}
                          onReply={() => {
                            setReplyingTo({
                              id: message.id,
                              message: message.message,
                              senderName: isFromCompany ? 'Você' : selectedDriver?.full_name || 'Motorista'
                            });
                          }}
                          onDelete={async () => {
                            if (!isFromCompany) return;
                            try {
                              await supabase
                                .from('company_driver_chats')
                                .update({ deleted_at: new Date().toISOString() })
                                .eq('id', message.id);
                              loadMessages();
                              toast.success('Mensagem removida');
                            } catch (error) {
                              toast.error('Erro ao remover mensagem');
                            }
                          }}
                        />
                      </React.Fragment>
                    );
                  })
                )}
                
                {/* Typing Indicator */}
                {otherUserTyping && selectedDriver && (
                  <TypingIndicator userName={selectedDriver.full_name} />
                )}
                
                <div ref={messagesEndRef} />
              </ScrollArea>

              {/* Chat Input */}
              <div className="mt-4">
                <ChatInput
                  onSendMessage={sendMessage}
                  replyingTo={replyingTo}
                  onCancelReply={() => setReplyingTo(null)}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Aceite para Transportadora */}
      <CompanyFreightAcceptModal
        isOpen={acceptModalOpen && !!companyId && !!selectedSharedFreight}
        onClose={() => {
          setAcceptModalOpen(false);
          handleAcceptSuccess();
        }}
        freight={{
          id: selectedSharedFreight?.freight_id || '',
          cargo_type: 'Frete',
          weight: 0,
          origin_address: '',
          destination_address: '',
          pickup_date: new Date().toISOString(),
          price: 0
        }}
        driverId={selectedSharedFreight?.driver_id || ''}
        driverName="Motorista"
        companyOwnerId={profile?.id || ''}
        companyId={companyId || ''}
      />
    </div>
  );
}
