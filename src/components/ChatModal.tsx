import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatConversation } from '@/hooks/useUnifiedChats';
import { FreightChat } from './FreightChat';
import { ServiceChat } from './ServiceChat';
import { DocumentRequestChat } from './DocumentRequestChat';
import { DriverChatTab } from './driver-details/DriverChatTab';
import { FreightShareCard } from './FreightShareCard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

interface ChatModalProps {
  conversation: ChatConversation | null;
  isOpen: boolean;
  onClose: () => void;
  userProfileId: string;
  userRole: string;
  onMarkFreightShareAsRead?: (messageId: string) => void;
}

export const ChatModal = ({
  conversation,
  isOpen,
  onClose,
  userProfileId,
  userRole,
  onMarkFreightShareAsRead,
}: ChatModalProps) => {
  // Mark freight share as read when opened
  useEffect(() => {
    if (conversation?.type === 'FREIGHT_SHARE' && isOpen && onMarkFreightShareAsRead) {
      onMarkFreightShareAsRead(conversation.metadata.messageId);
    }
  }, [conversation, isOpen, onMarkFreightShareAsRead]);
  // Buscar dados adicionais conforme necessário
  const { data: freightData } = useQuery({
    queryKey: ['freight-chat-data', conversation?.metadata?.freightId],
    queryFn: async () => {
      if (conversation?.type !== 'FREIGHT') return null;
      const { data } = await supabase
        .from('freights')
        .select('*, producer:profiles!freights_producer_id_fkey(*), driver:profiles!freights_driver_id_fkey(*)')
        .eq('id', conversation.metadata.freightId)
        .single();
      return data;
    },
    enabled: conversation?.type === 'FREIGHT' && isOpen,
  });

  const { data: serviceData } = useQuery({
    queryKey: ['service-chat-data', conversation?.metadata?.serviceRequestId],
    queryFn: async () => {
      if (conversation?.type !== 'SERVICE') return null;
      const { data } = await supabase
        .from('service_requests')
        .select('*')
        .eq('id', conversation.metadata.serviceRequestId)
        .single();
      return data;
    },
    enabled: conversation?.type === 'SERVICE' && isOpen,
  });

  const { data: documentRequest } = useQuery({
    queryKey: ['doc-request-data', conversation?.metadata?.documentRequestId],
    queryFn: async () => {
      if (conversation?.type !== 'DOCUMENT_REQUEST') return null;
      const { data } = await supabase
        .from('document_requests')
        .select('*')
        .eq('id', conversation.metadata.documentRequestId)
        .single();
      return data;
    },
    enabled: conversation?.type === 'DOCUMENT_REQUEST' && isOpen,
  });

  if (!conversation) return null;

  const renderChatContent = () => {
    switch (conversation.type) {
      case 'FREIGHT':
        if (!freightData) return <div className="p-4">Carregando...</div>;
        return (
          <FreightChat
            freightId={conversation.metadata.freightId}
            currentUserProfile={{ id: userProfileId, role: userRole } as any}
          />
        );

      case 'SERVICE':
        if (!serviceData) return <div className="p-4">Carregando...</div>;
        return (
          <ServiceChat
            serviceRequestId={conversation.metadata.serviceRequestId}
            currentUserProfile={{ id: userProfileId, role: userRole } as any}
          />
        );

      case 'DIRECT_CHAT':
        return (
          <DriverChatTab
            companyId={conversation.metadata.companyId}
            driverProfileId={conversation.metadata.driverProfileId}
          />
        );

      case 'DOCUMENT_REQUEST':
        if (!documentRequest) return <div className="p-4">Carregando...</div>;
        return (
          <DocumentRequestChat
            documentRequestId={conversation.metadata.documentRequestId}
            currentUserProfile={{ id: userProfileId, role: userRole } as any}
          />
        );

      case 'FREIGHT_SHARE':
        return (
          <div className="p-4">
            <FreightShareCard
              freightData={conversation.metadata.freightData}
              messageId={conversation.metadata.messageId}
              onAccept={() => {
                onClose();
              }}
            />
          </div>
        );

      default:
        return <div className="p-4">Tipo de conversa não suportado</div>;
    }
  };

  // Document requests are now rendered as inline chat, no special handling needed

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{conversation.title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto">{renderChatContent()}</div>
      </DialogContent>
    </Dialog>
  );
};
