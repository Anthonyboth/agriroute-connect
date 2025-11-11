import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Image as ImageIcon, MessageSquare, User, Wrench, Paperclip, Download, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { queryWithTimeout, subscriptionWithErrorHandler } from '@/lib/query-utils';
import { useChatAttachments } from '@/hooks/useChatAttachments';

interface Message {
  id: string;
  service_request_id: string;
  sender_id: string;
  message: string;
  message_type: 'TEXT' | 'IMAGE' | 'FILE';
  image_url?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  sender?: {
    id: string;
    full_name: string;
    role: string;
    profile_photo_url?: string;
  };
}

interface ServiceChatProps {
  serviceRequestId: string;
  currentUserProfile: any;
}

export const ServiceChat: React.FC<ServiceChatProps> = ({ 
  serviceRequestId, 
  currentUserProfile 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Hook para upload de anexos
  const { uploadImage: uploadImageAttachment, uploadFile: uploadFileAttachment, isUploading } = useChatAttachments(currentUserProfile?.id);
  
  const { 
    unreadServiceMessages, 
    fetchUnreadServiceMessages, 
    markServiceMessagesAsRead 
  } = useUnreadMessages(currentUserProfile?.id);
  
  const unreadCount = unreadServiceMessages[serviceRequestId] || 0;

  // Buscar mensagens
  const fetchMessages = async () => {
    try {
      console.log('[ServiceChat] Carregando mensagens...');
      
      const messages = await queryWithTimeout(
        async () => {
          const { data, error } = await supabase
            .from('service_messages')
            .select(`
              *,
              sender:profiles!service_messages_sender_id_fkey(id, full_name, role, profile_photo_url)
            `)
            .eq('service_request_id', serviceRequestId)
            .order('created_at', { ascending: true });

          if (error) throw error;
          return data;
        },
        { timeoutMs: 5000, operationName: 'fetchServiceMessages' }
      );

      setMessages((messages || []) as Message[]);
    } catch (error) {
      console.error('[ServiceChat] Erro ao carregar mensagens:', error);
      toast.error('Erro ao carregar mensagens. Tente novamente.');
    }
  };

  // Enviar mensagem
  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserProfile?.id) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('service_messages')
        .insert({
          service_request_id: serviceRequestId,
          sender_id: currentUserProfile.id,
          message: newMessage,
          message_type: 'TEXT'
        });

      if (error) throw error;

      setNewMessage('');
      await fetchMessages();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setLoading(false);
    }
  };

  // Upload de imagem
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserProfile?.id) return;

    const imageUrl = await uploadImageAttachment(file);
    if (!imageUrl) return;

    try {
      const { error } = await supabase
        .from('service_messages')
        .insert({
          service_request_id: serviceRequestId,
          sender_id: currentUserProfile.id,
          message: 'Imagem enviada',
          message_type: 'IMAGE',
          image_url: imageUrl
        });

      if (error) throw error;

      await fetchMessages();
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      toast.error('Erro ao enviar imagem');
    }
    
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Upload de arquivo
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserProfile?.id) return;

    const fileData = await uploadFileAttachment(file);
    if (!fileData) return;

    try {
      const { error } = await supabase
        .from('service_messages')
        .insert({
          service_request_id: serviceRequestId,
          sender_id: currentUserProfile.id,
          message: `Arquivo enviado: ${fileData.name}`,
          message_type: 'FILE',
          file_url: fileData.url,
          file_name: fileData.name,
          file_size: fileData.size,
        });

      if (error) throw error;

      await fetchMessages();
      toast.success('Arquivo enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar arquivo:', error);
      toast.error('Erro ao enviar arquivo');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  useEffect(() => {
    fetchMessages();
    fetchUnreadServiceMessages(serviceRequestId);
    
    // Marcar mensagens como lidas ao abrir o chat
    markServiceMessagesAsRead(serviceRequestId);

    // Realtime subscription com error handling
    const channel = subscriptionWithErrorHandler(
      supabase
        .channel(`service-messages-${serviceRequestId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'service_messages',
          filter: `service_request_id=eq.${serviceRequestId}`
        }, () => {
          console.log('[ServiceChat] Nova mensagem recebida');
          fetchMessages();
        }),
      (error) => {
        console.error('[ServiceChat] Erro na subscription:', error);
        toast.error('Erro na conexão do chat. Recarregue a página.');
      }
    ).subscribe();

    return () => {
      console.log('[ServiceChat] Removendo subscription');
      supabase.removeChannel(channel);
    };
  }, [serviceRequestId]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      'PRODUTOR': { label: 'Cliente', variant: 'default' },
      'MOTORISTA': { label: 'Prestador', variant: 'secondary' },
      'PRESTADOR_SERVICOS': { label: 'Prestador', variant: 'secondary' }
    };
    return roleMap[role] || { label: role, variant: 'default' };
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Chat do Serviço
        </CardTitle>
        {unreadCount > 0 && (
          <Badge variant="destructive">
            {unreadCount} {unreadCount === 1 ? 'não lida' : 'não lidas'}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 space-y-4">
        {/* Área de mensagens */}
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 pr-4"
        >
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma mensagem ainda</p>
                <p className="text-sm">Inicie uma conversa!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isCurrentUser = msg.sender_id === currentUserProfile?.id;
                const roleBadge = msg.sender ? getRoleBadge(msg.sender.role) : null;
                const isProducer = msg.sender?.role === 'PRODUTOR';

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isCurrentUser && (
                      <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                        <AvatarImage src={msg.sender?.profile_photo_url} />
                        <AvatarFallback>
                          {isProducer ? <User className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        isCurrentUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary'
                      }`}
                    >
                      {!isCurrentUser && msg.sender && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {msg.sender.full_name}
                          </span>
                          {roleBadge && (
                            <Badge variant={roleBadge.variant} className="text-xs">
                              {roleBadge.label}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {msg.message_type === 'IMAGE' && msg.image_url ? (
                        <div className="space-y-2">
                          <img 
                            src={msg.image_url} 
                            alt="Imagem enviada" 
                            className="rounded max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ maxHeight: '300px' }}
                            onClick={() => window.open(msg.image_url, '_blank')}
                          />
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      ) : msg.message_type === 'FILE' && msg.file_url ? (
                        <a
                          href={msg.file_url}
                          download={msg.file_name}
                          className="flex items-center gap-2 p-2 bg-background/10 rounded hover:bg-background/20 transition-colors"
                        >
                          <FileText className="h-5 w-5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" translate="no">
                              {msg.file_name}
                            </p>
                            <p className="text-xs opacity-70">
                              {formatFileSize(msg.file_size)}
                            </p>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0" />
                        </a>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap" translate="no">{msg.message}</p>
                      )}
                      
                      <p className={`text-xs mt-1 ${isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Input de mensagem */}
        <div className="flex gap-2">
          <input
            type="file"
            ref={imageInputRef}
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <input
            type="file"
            ref={fileInputRef}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => imageInputRef.current?.click()}
            disabled={loading || isUploading}
            title="Enviar imagem"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || isUploading}
            title="Enviar arquivo"
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Digite sua mensagem..."
            disabled={loading || isUploading}
            translate="no"
          />

          <Button
            onClick={sendMessage}
            disabled={loading || isUploading || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
