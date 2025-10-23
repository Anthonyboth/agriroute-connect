import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatConversation } from '@/hooks/useUnifiedChats';
import { FreightChat } from './FreightChat';
import { ServiceChat } from './ServiceChat';
import { DocumentRequestModal } from './DocumentRequestModal';
import { DriverChatTab } from './driver-details/DriverChatTab';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ChatModalProps {
  conversation: ChatConversation | null;
  isOpen: boolean;
  onClose: () => void;
  userProfileId: string;
  userRole: string;
}

export const ChatModal = ({
  conversation,
  isOpen,
  onClose,
  userProfileId,
  userRole,
}: ChatModalProps) => {
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
          <DocumentRequestModal
            request={documentRequest}
            isOpen={true}
            onClose={onClose}
          />
        );

      default:
        return <div className="p-4">Tipo de conversa não suportado</div>;
    }
  };

  // Para DOCUMENT_REQUEST, não renderizar Dialog (DocumentRequestModal já é um Dialog)
  if (conversation.type === 'DOCUMENT_REQUEST') {
    return renderChatContent() as any;
  }

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
