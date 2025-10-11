import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Image as ImageIcon, MessageSquare, User, Wrench } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Message {
  id: string;
  service_request_id: string;
  sender_id: string;
  message: string;
  message_type: 'TEXT' | 'IMAGE';
  image_url?: string;
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
  const [uploading, setUploading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Buscar mensagens
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('service_messages')
        .select(`
          *,
          sender:profiles!service_messages_sender_id_fkey(id, full_name, role, profile_photo_url)
        `)
        .eq('service_request_id', serviceRequestId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      toast.error('Erro ao carregar mensagens');
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
  const uploadImage = async (file: File) => {
    if (!currentUserProfile?.id) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentUserProfile.id}-${Date.now()}.${fileExt}`;
      const filePath = `service-chat/${serviceRequestId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('service-chat-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('service-chat-images')
        .getPublicUrl(filePath);

      const { error: messageError } = await supabase
        .from('service_messages')
        .insert({
          service_request_id: serviceRequestId,
          sender_id: currentUserProfile.id,
          message: 'Imagem enviada',
          message_type: 'IMAGE',
          image_url: publicUrl
        });

      if (messageError) throw messageError;

      await fetchMessages();
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      console.error('Erro ao enviar imagem:', error);
      toast.error('Erro ao enviar imagem');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
  };

  useEffect(() => {
    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`service-messages-${serviceRequestId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'service_messages',
        filter: `service_request_id=eq.${serviceRequestId}`
      }, () => {
        fetchMessages();
      })
      .subscribe();

    return () => {
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Chat do Serviço
        </CardTitle>
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
                            className="rounded max-w-full h-auto"
                          />
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
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
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Digite sua mensagem..."
            disabled={loading || uploading}
          />

          <Button
            onClick={sendMessage}
            disabled={loading || uploading || !newMessage.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
