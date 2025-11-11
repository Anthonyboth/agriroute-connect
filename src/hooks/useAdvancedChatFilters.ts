import { useState, useMemo } from 'react';
import { ChatConversation } from './useUnifiedChats';

export interface ChatFilters {
  searchQuery: string;
  driverName: string;
  freightRoute: string;
  status: 'open' | 'closed' | 'all';
  period: 'week' | 'month' | '3months' | 'all';
}

export function useAdvancedChatFilters(conversations: ChatConversation[]) {
  const [filters, setFilters] = useState<ChatFilters>({
    searchQuery: '',
    driverName: '',
    freightRoute: '',
    status: 'open',
    period: 'all',
  });

  const filteredConversations = useMemo(() => {
    let result = [...conversations];

    // Filtro por status
    if (filters.status === 'open') {
      result = result.filter((c) => !c.isClosed);
    } else if (filters.status === 'closed') {
      result = result.filter((c) => c.isClosed);
    }

    // Filtro por busca full-text (title, lastMessage, otherParticipant.name)
    if (filters.searchQuery.trim()) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.lastMessage.toLowerCase().includes(query) ||
          c.otherParticipant.name.toLowerCase().includes(query)
      );
    }

    // Filtro por nome do motorista/participante
    if (filters.driverName.trim()) {
      const query = filters.driverName.toLowerCase();
      result = result.filter((c) =>
        c.otherParticipant.name.toLowerCase().includes(query)
      );
    }

    // Filtro por rota do frete
    if (filters.freightRoute.trim()) {
      const query = filters.freightRoute.toLowerCase();
      result = result.filter((c) => c.title.toLowerCase().includes(query));
    }

    // Filtro por período
    if (filters.period !== 'all') {
      const now = new Date();
      const cutoffDate = new Date();

      switch (filters.period) {
        case 'week':
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
        case '3months':
          cutoffDate.setMonth(now.getMonth() - 3);
          break;
      }

      result = result.filter(
        (c) => new Date(c.lastMessageTime) >= cutoffDate
      );
    }

    // Ordenar por última mensagem (mais recente primeiro)
    result.sort(
      (a, b) =>
        new Date(b.lastMessageTime).getTime() -
        new Date(a.lastMessageTime).getTime()
    );

    return result;
  }, [conversations, filters]);

  const updateFilter = <K extends keyof ChatFilters>(
    key: K,
    value: ChatFilters[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      searchQuery: '',
      driverName: '',
      freightRoute: '',
      status: 'open',
      period: 'all',
    });
  };

  return {
    filters,
    filteredConversations,
    updateFilter,
    clearFilters,
    hasActiveFilters: !!(
      filters.searchQuery ||
      filters.driverName ||
      filters.freightRoute ||
      filters.period !== 'all'
    ),
  };
}
