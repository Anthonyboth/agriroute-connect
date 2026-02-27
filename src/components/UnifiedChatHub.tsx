import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useUnifiedChats } from '@/hooks/useUnifiedChats';
import { useAdvancedChatFilters } from '@/hooks/useAdvancedChatFilters';
import { ChatConversationCard } from './ChatConversationCard';
import { ChatModal } from './ChatModal';
import { AdvancedChatFilters } from './AdvancedChatFilters';
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
    markFreightShareAsRead,
  } = useUnifiedChats(userProfileId, userRole);

  const [selectedConversation, setSelectedConversation] = useState<any>(null);

  // Filtros avançados
  const {
    filters,
    filteredConversations,
    updateFilter,
    clearFilters,
    hasActiveFilters,
  } = useAdvancedChatFilters(conversations);

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
        {/* Filtros Avançados */}
        <AdvancedChatFilters
          filters={filters}
          onFilterChange={updateFilter}
          onClearFilters={clearFilters}
          hasActiveFilters={hasActiveFilters}
          resultsCount={filteredConversations.length}
          totalCount={conversations.length}
        />

        <Tabs value={filters.status} onValueChange={(v) => updateFilter('status', v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="open">Abertas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="closed">Fechadas</TabsTrigger>
          </TabsList>

          <TabsContent value={filters.status} className="mt-4">
            <ScrollArea className="h-[calc(100vh-280px)]">
              {filteredConversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <MessageSquareOff className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2" translate="no">
                    {filters.status === 'open' && 'Nenhuma conversa ativa'}
                    {filters.status === 'closed' && 'Nenhuma conversa fechada'}
                    {filters.status === 'all' && 'Nenhuma conversa'}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-sm" translate="no">
                    {hasActiveFilters
                      ? 'Nenhuma conversa encontrada com os filtros aplicados. Tente ajustar os filtros.'
                      : filters.status === 'open'
                      ? 'Suas conversas aparecerão aqui quando você aceitar fretes ou serviços.'
                      : filters.status === 'closed'
                      ? 'Conversas fechadas aparecerão aqui.'
                      : 'Comece aceitando fretes ou serviços para iniciar conversas.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                  {filteredConversations.map((conversation) => (
                    <ChatConversationCard
                      key={conversation.id}
                      conversation={conversation}
                      onClick={() => setSelectedConversation(conversation)}
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
        onMarkFreightShareAsRead={(messageId) => markFreightShareAsRead.mutate(messageId)}
      />
    </>
  );
};
