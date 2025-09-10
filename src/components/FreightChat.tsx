import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Image, MessageCircle, User, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface Message {
  id: string;
  message: string;
  sender_id: string;
  message_type: string;
  image_url?: string;
  created_at: string;
  sender?: {
    full_name: string;
    role: string;
  };
}

interface FreightChatProps {
  freightId: string;
  currentUserProfile: any;
}

export const FreightChat: React.FC<FreightChatProps> = ({
  freightId,
  currentUserProfile
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('freight_messages')
        .select(`
          *,
          sender:profiles!sender_id(full_name, role)
        `)
        .eq('freight_id', freightId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar mensagens:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserProfile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freightId,
          sender_id: currentUserProfile.id,
          message: newMessage.trim(),
          message_type: 'TEXT'
        });

      if (error) throw error;

      setNewMessage('');
      fetchMessages();
    } catch (error: any) {
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!currentUserProfile) return;

    setUploading(true);
    try {
      const fileName = `${currentUserProfile.user_id}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('freight-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('freight-attachments')
        .getPublicUrl(fileName);

      const { error } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freightId,
          sender_id: currentUserProfile.id,
          message: 'Imagem enviada',
          message_type: 'IMAGE',
          image_url: publicUrl
        });

      if (error) throw error;

      fetchMessages();
      toast({
        title: "Imagem enviada",
        description: "A imagem foi enviada com sucesso.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        uploadImage(file);
      } else {
        toast({
          title: "Arquivo não suportado",
          description: "Por favor, selecione uma imagem.",
          variant: "destructive",
        });
      }
    }
  };

  useEffect(() => {
    fetchMessages();

    // Real-time subscription
    const channel = supabase
      .channel('freight-chat')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'freight_messages',
          filter: `freight_id=eq.${freightId}` 
        }, 
        () => {
          fetchMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [freightId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <Card className="h-[500px] flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Chat do Frete
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea className="flex-1 px-4" ref={scrollRef}>
          <div className="space-y-4 pb-4">
            {messages.map((message) => {
              const isCurrentUser = message.sender_id === currentUserProfile?.id;
              const isProducer = message.sender?.role === 'PRODUTOR';

              return (
                <div
                  key={message.id}
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[70%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarFallback>
                        {isProducer ? <User className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                      </AvatarFallback>
                    </Avatar>

                    <div className={`space-y-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {message.sender?.full_name || 'Usuário'}
                        </span>
                        <Badge 
                          variant={isProducer ? 'default' : 'secondary'} 
                          className="text-xs"
                        >
                          {isProducer ? 'Produtor' : 'Motorista'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(message.created_at), 'HH:mm')}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-lg ${
                          isCurrentUser 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}
                      >
                        {message.message_type === 'IMAGE' && message.image_url && (
                          <img 
                            src={message.image_url} 
                            alt="Imagem compartilhada"
                            className="max-w-full h-auto rounded mb-2"
                            style={{ maxHeight: '200px' }}
                          />
                        )}
                        
                        <p className="text-sm break-words">
                          {message.message}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Image className="h-4 w-4" />
            </Button>
            
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading}
            />
            
            <Button 
              onClick={sendMessage}
              disabled={loading || !newMessage.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
};