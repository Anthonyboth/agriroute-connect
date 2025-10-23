import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUnifiedChats } from '@/hooks/useUnifiedChats';
import { ChatConversationCard } from './ChatConversationCard';
import { ChatModal } from './ChatModal';
import { Loader2, MessageSquareOff } from 'lucide-react';

interface UnifiedChatHubProps {
  userProfileId: string;
  userRole: string;
}

export const UnifiedChatHub = ({ userProfileId, userRole }: UnifiedChatHubProps) => {
  const {
    conversations,
    isLoading,
    closeConversation,
    reopenConversation,
  } = useUnifiedChats(userProfileId, userRole);

  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [filter, setFilter] = useState<'open' | 'all' | 'closed'>('open');

  const filteredConversations = conversations.filter((c) => {
    if (filter === 'open') return !c.isClosed;
    if (filter === 'closed') return c.isClosed;
    return true;
  });

  const handleCloseConversation = (conversation: any) => {
    closeConversation.mutate({
      id: conversation.id,
      type: conversation.type,
    });
  };

  const handleReopenConversation = (conversation: any) => {
    reopenConversation.mutate({
      id: conversation.id,
      type: conversation.type,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="open">Abertas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="closed">Fechadas</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-4">
            <ScrollArea className="h-[calc(100vh-280px)]">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <MessageSquareOff className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    {filter === 'open' && 'Nenhuma conversa ativa'}
                    {filter === 'closed' && 'Nenhuma conversa fechada'}
                    {filter === 'all' && 'Nenhuma conversa'}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {filter === 'open' &&
                      'Suas conversas aparecerão aqui quando você aceitar fretes ou serviços.'}
                    {filter === 'closed' &&
                      'Conversas fechadas aparecerão aqui.'}
                    {filter === 'all' &&
                      'Comece aceitando fretes ou serviços para iniciar conversas.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {filteredConversations.map((conversation) => (
                    <ChatConversationCard
                      key={conversation.id}
                      conversation={conversation}
                      onClick={() => setSelectedConversation(conversation)}
                      onClose={
                        conversation.isClosed
                          ? () => handleReopenConversation(conversation)
                          : () => handleCloseConversation(conversation)
                      }
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      <ChatModal
        conversation={selectedConversation}
        isOpen={!!selectedConversation}
        onClose={() => setSelectedConversation(null)}
        userProfileId={userProfileId}
        userRole={userRole}
      />
    </>
  );
};
