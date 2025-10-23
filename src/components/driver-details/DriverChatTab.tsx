import { useState, useEffect, useRef } from 'react';
import { useDriverChat } from '@/hooks/useDriverChat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Clock, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface DriverChatTabProps {
  companyId: string;
  driverProfileId: string;
  chatEnabledAt?: string | null;
}

export const DriverChatTab = ({ 
  companyId, 
  driverProfileId, 
  chatEnabledAt 
}: DriverChatTabProps) => {
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { messages, isLoading, sendMessage, markAsRead } = useDriverChat(
    companyId,
    driverProfileId
  );

  // Auto-scroll para última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Marcar mensagens como lidas ao abrir
  useEffect(() => {
    markAsRead.mutate();
  }, []);

  const isChatEnabled = () => {
    if (!chatEnabledAt) return true; // Se não tem restrição, está habilitado
    const enabledDate = new Date(chatEnabledAt);
    return enabledDate <= new Date();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sendMessage.isPending) return;
    
    await sendMessage.mutateAsync(newMessage);
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    );
  }

  if (!isChatEnabled()) {
    const enabledDate = new Date(chatEnabledAt!);
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          Chat será habilitado {formatDistanceToNow(enabledDate, { 
            addSuffix: true, 
            locale: ptBR 
          })}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Lista de mensagens */}
        <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-sm">Nenhuma mensagem ainda</p>
              <p className="text-xs mt-1">Envie a primeira mensagem para iniciar a conversa</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'flex',
                    msg.sender_type === 'COMPANY' ? 'justify-end' : 'justify-start'
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[70%] rounded-lg p-3',
                      msg.sender_type === 'COMPANY'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                    <span className="text-xs opacity-70 mt-1 block">
                      {formatDistanceToNow(new Date(msg.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Input de nova mensagem */}
        <div className="p-4 border-t flex gap-2">
          <Input
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={sendMessage.isPending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sendMessage.isPending}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
