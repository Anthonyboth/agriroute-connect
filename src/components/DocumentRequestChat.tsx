import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Badge } from '@/components/ui/badge';
import { Send, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { DocumentRequestCard } from './DocumentRequestCard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { SignedStorageImage } from '@/components/ui/signed-storage-image';

interface Message {
  id: string;
  sender_id: string;
  message: string;
  message_type: string;
  image_url?: string;
  created_at: string;
  read_at?: string;
  metadata?: any;
  sender?: {
    full_name: string;
    profile_photo_url?: string;
    role: string;
  };
}

interface DocumentRequestChatProps {
  documentRequestId: string;
  currentUserProfile: {
    id: string;
    role: string;
  };
}

export const DocumentRequestChat = ({
  documentRequestId,
  currentUserProfile
}: DocumentRequestChatProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Fetch document request details
  const { data: documentRequest } = useQuery({
    queryKey: ['document-request', documentRequestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('document_requests')
        .select(`
          *,
          company:transport_companies!document_requests_company_id_fkey(company_name)
        `)
        .eq('id', documentRequestId)
        .single();

      if (error) throw error;
      return data;
    }
  });

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('document_request_messages')
        .select(`
          *,
          sender:profiles!document_request_messages_sender_id_fkey(
            full_name,
            profile_photo_url,
            role
          )
        `)
        .eq('document_request_id', documentRequestId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
      
      // Mark messages as read
      await markMessagesAsRead();
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  // Mark messages as read
  const markMessagesAsRead = async () => {
    try {
      await supabase
        .from('document_request_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('document_request_id', documentRequestId)
        .neq('sender_id', currentUserProfile.id)
        .is('read_at', null);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  // Send text message
  const sendMessage = async () => {
    if (!newMessage.trim() || isLoading) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('document_request_messages')
        .insert({
          document_request_id: documentRequestId,
          sender_id: currentUserProfile.id,
          message: newMessage.trim(),
          message_type: 'TEXT'
        });

      if (error) throw error;

      setNewMessage('');
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: 'Erro ao enviar mensagem',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Upload and send image
  const uploadImage = async (file: File) => {
    if (!file || isUploading) return;

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O tamanho máximo é 5MB',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${documentRequestId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Use signed URL for private bucket (1 hour expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('chat-images')
        .createSignedUrl(fileName, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Falha ao gerar URL de acesso');
      }

      const { error: messageError } = await supabase
        .from('document_request_messages')
        .insert({
          document_request_id: documentRequestId,
          sender_id: currentUserProfile.id,
          message: 'Imagem enviada',
          message_type: 'IMAGE',
          image_url: signedUrlData.signedUrl
        });

      if (messageError) throw messageError;

      toast({
        title: 'Imagem enviada',
        description: 'A imagem foi enviada com sucesso'
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Erro ao enviar imagem',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Load messages on mount
  useEffect(() => {
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`document-request-messages:${documentRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'document_request_messages',
          filter: `document_request_id=eq.${documentRequestId}`
        },
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentRequestId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleGoToProfile = () => {
    navigate('/profile');
  };

  const getRoleBadge = (role: string) => {
    if (role === 'TRANSPORTADORA') {
      return <Badge variant="secondary" className="text-xs">Transportadora</Badge>;
    }
    if (role.includes('MOTORISTA')) {
      return <Badge variant="default" className="text-xs">Motorista</Badge>;
    }
    return null;
  };

  const unreadCount = messages.filter(
    m => !m.read_at && m.sender_id !== currentUserProfile.id
  ).length;

  return (
    <Card className="flex flex-col h-[600px]">
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Chat - Solicitação de Documentos</CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} não lida{unreadCount !== 1 && 's'}</Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full p-4">
          <div className="space-y-4">
            {messages.map((message) => {
              const isSender = message.sender_id === currentUserProfile.id;

              // Render document request card
              if (message.message_type === 'DOCUMENT_REQUEST') {
                const requestData = JSON.parse(message.message);
                return (
                  <div key={message.id} className="my-4">
                    <DocumentRequestCard
                      requestData={{
                        requested_fields: requestData.requested_fields,
                        notes: requestData.notes,
                        company_name: requestData.company_name,
                        status: documentRequest?.status || 'PENDING',
                        created_at: requestData.created_at
                      }}
                      onGoToProfile={handleGoToProfile}
                      onReplyInChat={() => {
                        // Focus input
                        document.querySelector<HTMLInputElement>('input[placeholder="Digite sua mensagem..."]')?.focus();
                      }}
                    />
                  </div>
                );
              }

              // Render text/image message
              return (
                <div
                  key={message.id}
                  className={`flex gap-2 ${isSender ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <Avatar className="h-8 w-8">
                    <SignedAvatarImage src={message.sender?.profile_photo_url} />
                    <AvatarFallback>
                      {message.sender?.full_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>

                  <div className={`flex flex-col gap-1 max-w-[70%] ${isSender ? 'items-end' : 'items-start'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{message.sender?.full_name}</span>
                      {message.sender && getRoleBadge(message.sender.role)}
                    </div>

                    <div
                      className={`rounded-lg p-3 ${
                        isSender
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}
                    >
                      {message.message_type === 'IMAGE' && message.image_url ? (
                        <SignedStorageImage
                          src={message.image_url}
                          alt="Imagem enviada"
                          className="max-w-full rounded-md cursor-pointer"
                          onClick={() => {
                            // Open in new tab with fresh signed URL
                            const storageMatch = message.image_url?.match(/\/storage\/v1\/object\/(?:sign|public)\/([^/]+)\/([^?]+)/);
                            if (storageMatch) {
                              supabase.storage
                                .from(storageMatch[1])
                                .createSignedUrl(decodeURIComponent(storageMatch[2]), 3600)
                                .then(({ data }) => {
                                  if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                });
                            }
                          }}
                        />
                      ) : (
                        <p className="text-sm whitespace-pre-wrap">{message.message}</p>
                      )}
                    </div>

                    <span className="text-xs text-muted-foreground">
                      {format(new Date(message.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
      </CardContent>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadImage(file);
            }}
          />
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
          </Button>

          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Digite sua mensagem..."
            disabled={isLoading}
          />

          <Button onClick={sendMessage} disabled={isLoading || !newMessage.trim()}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
