import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Send, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AffiliationDirectChatProps {
  companyId: string;
  companyName: string;
}

interface ChatMessage {
  id: string;
  message: string;
  sender_type: 'DRIVER' | 'COMPANY';
  created_at: string;
  is_read: boolean | null;
  driver_profile_id: string;
  company_id: string;
}

export const AffiliationDirectChat: React.FC<AffiliationDirectChatProps> = ({
  companyId,
  companyName,
}) => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  // Buscar mensagens
  const fetchMessages = async () => {
    if (!profile?.id || !companyId) return;
    try {
      const { data, error } = await supabase
        .from('company_driver_chats')
        .select('*')
        .eq('company_id', companyId)
        .eq('driver_profile_id', profile.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data as ChatMessage[]) || []);
    } catch (e) {
      console.error('Erro ao buscar mensagens:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [profile?.id, companyId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Marcar mensagens da empresa como lidas
  useEffect(() => {
    if (!profile?.id || !companyId || messages.length === 0) return;
    const unread = messages.filter((m) => m.sender_type === 'COMPANY' && !m.is_read);
    if (unread.length === 0) return;
    supabase
      .from('company_driver_chats')
      .update({ is_read: true })
      .eq('company_id', companyId)
      .eq('driver_profile_id', profile.id)
      .eq('sender_type', 'COMPANY')
      .eq('is_read', false)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['driver-chat'] });
      });
  }, [messages, profile?.id, companyId]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.id || !companyId) return;

    const channel = supabase
      .channel(`affiliation-chat-${companyId}-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'company_driver_chats',
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          if (newMsg.driver_profile_id === profile.id) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profile?.id, companyId]);

  const handleSend = async () => {
    if (!newMessage.trim() || !profile?.id || !companyId || isSending) return;

    const msgText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const { error } = await supabase.from('company_driver_chats').insert({
        company_id: companyId,
        driver_profile_id: profile.id,
        sender_type: 'DRIVER',
        message: msgText,
      });

      if (error) throw error;
      inputRef.current?.focus();
    } catch (e: any) {
      console.error('Erro ao enviar mensagem:', e);
      toast.error('Erro ao enviar mensagem');
      setNewMessage(msgText);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), 'HH:mm', { locale: ptBR });
    } catch {
      return '';
    }
  };

  const formatDateSeparator = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd 'de' MMMM", { locale: ptBR });
    } catch {
      return '';
    }
  };

  // Group messages by date
  const groupedMessages = messages.reduce<{ date: string; msgs: ChatMessage[] }[]>((acc, msg) => {
    const dateKey = msg.created_at.split('T')[0];
    const lastGroup = acc[acc.length - 1];
    if (lastGroup && lastGroup.date === dateKey) {
      lastGroup.msgs.push(msg);
    } else {
      acc.push({ date: dateKey, msgs: [msg] });
    }
    return acc;
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px] border rounded-lg overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <MessageSquare className="h-4 w-4 text-primary" />
        <span className="font-semibold text-sm">{companyName}</span>
        <span className="text-xs text-muted-foreground ml-auto">Chat permanente</span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm">
            <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
            <p>Nenhuma mensagem ainda.</p>
            <p className="text-xs mt-1">Envie uma mensagem para a transportadora!</p>
          </div>
        ) : (
          <div className="space-y-1">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date separator */}
                <div className="flex items-center gap-2 my-3">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground px-2">
                    {formatDateSeparator(group.date)}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {group.msgs.map((msg) => {
                  const isDriver = msg.sender_type === 'DRIVER';
                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex gap-2 mb-2',
                        isDriver ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {!isDriver && (
                        <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {companyName.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      <div
                        className={cn(
                          'max-w-[75%] rounded-2xl px-3 py-2 text-sm break-words',
                          isDriver
                            ? 'bg-primary text-primary-foreground rounded-br-sm'
                            : 'bg-muted text-foreground rounded-bl-sm'
                        )}
                      >
                        <p className="leading-relaxed">{msg.message}</p>
                        <p
                          className={cn(
                            'text-[10px] mt-1 text-right',
                            isDriver ? 'text-primary-foreground/70' : 'text-muted-foreground'
                          )}
                        >
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                      {isDriver && (
                        <Avatar className="h-7 w-7 flex-shrink-0 mt-1">
                          <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            EU
                          </AvatarFallback>
                        </Avatar>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t bg-muted/20">
        <Input
          ref={inputRef}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Mensagem para a transportadora..."
          className="flex-1 text-sm"
          disabled={isSending}
          maxLength={1000}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!newMessage.trim() || isSending}
          className="h-9 w-9 flex-shrink-0"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
