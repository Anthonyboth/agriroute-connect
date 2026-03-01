import { Suspense } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChatConversation } from '@/hooks/useUnifiedChats';
import { FreightChat, ServiceChat } from './LazyComponents';
import { DriverChatTab } from './driver-details/DriverChatTab';
import { FreightShareCard } from './FreightShareCard';
import { ChatHeader } from './ChatHeader';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';
import { CenteredSpinner } from '@/components/ui/AppSpinner';

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

  // Buscar dados adicionais do frete incluindo telefones
  const { data: freightData } = useQuery({
    queryKey: ['freight-chat-data', conversation?.metadata?.freightId],
    queryFn: async () => {
      if (conversation?.type !== 'FREIGHT') return null;
      const { data } = await supabase
        .from('freights')
        .select(`
          *, 
          producer:profiles_secure!freights_producer_id_fkey(id, full_name, phone),
          driver:profiles_secure!freights_driver_id_fkey(id, full_name, phone)
        `)
        .eq('id', conversation.metadata.freightId)
        .single();
      return data;
    },
    enabled: conversation?.type === 'FREIGHT' && isOpen,
  });

  // Buscar última localização GPS do motorista
  const { data: lastGpsLocation } = useQuery({
    queryKey: ['driver-last-location', freightData?.driver_id],
    queryFn: async () => {
      if (!freightData?.driver_id) return null;
      const { data } = await supabase
        .from('driver_location_history')
        .select('lat, lng, captured_at')
        .eq('driver_profile_id', freightData.driver_id)
        .eq('freight_id', conversation?.metadata?.freightId)
        .order('captured_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!freightData?.driver_id && conversation?.hasGpsTracking,
    // ✅ REMOVIDO: refetchInterval: 30000 - localização atualiza via focus/visibilidade
    staleTime: 60 * 1000, // 1 minuto
    refetchOnWindowFocus: true,
  });

  // ✅ SEGURANÇA: Usar view segura - telefone mascarado para não-participantes
  // ✅ FIX: Queries separadas para evitar FK hints em views (que podem falhar silenciosamente)
  const { data: serviceData } = useQuery({
    queryKey: ['service-chat-data-secure', conversation?.metadata?.serviceRequestId],
    queryFn: async () => {
      if (conversation?.type !== 'SERVICE') return null;
      
      // Query 1: Dados básicos do serviço (sem FK joins na view)
      const { data: serviceReq, error: serviceErr } = await supabase
        .from('service_requests_secure')
        .select('id, status, service_type, client_id, provider_id, contact_phone, contact_name')
        .eq('id', conversation.metadata.serviceRequestId)
        .maybeSingle();
      
      if (serviceErr || !serviceReq) {
        console.error('[ChatModal] Erro ao buscar service_request:', serviceErr);
        return null;
      }
      
      // Query 2: Buscar perfis dos participantes separadamente (via profiles_secure)
      const profileIds = [serviceReq.client_id, serviceReq.provider_id].filter(Boolean);
      let profileMap = new Map<string, any>();
      
      if (profileIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from('profiles_secure')
          .select('id, full_name, phone')
          .in('id', profileIds);
        
        (profiles || []).forEach((p: any) => profileMap.set(p.id, p));
      }
      
      return {
        ...serviceReq,
        client: serviceReq.client_id ? profileMap.get(serviceReq.client_id) || null : null,
        provider: serviceReq.provider_id ? profileMap.get(serviceReq.provider_id) || null : null,
      };
    },
    enabled: conversation?.type === 'SERVICE' && isOpen,
  });

  if (!conversation) return null;

  // Determinar telefone do outro participante
  const getOtherParticipantPhone = (): string | null => {
    if (conversation.type === 'FREIGHT' && freightData) {
      if (userRole === 'PRODUTOR') {
        // driver pode ser array ou objeto
        const driver = Array.isArray(freightData.driver) 
          ? freightData.driver[0] 
          : freightData.driver;
        return driver?.phone || null;
      } else {
        const producer = Array.isArray(freightData.producer) 
          ? freightData.producer[0] 
          : freightData.producer;
        return producer?.phone || null;
      }
    }
    if (conversation.type === 'SERVICE' && serviceData) {
      if (userRole === 'PRODUTOR') {
        const provider = Array.isArray(serviceData.provider) 
          ? serviceData.provider[0] 
          : serviceData.provider;
        return provider?.phone || null;
      } else {
        const client = Array.isArray(serviceData.client) 
          ? serviceData.client[0] 
          : serviceData.client;
        return client?.phone || null;
      }
    }
    return null;
  };

  // Construir informações GPS
  const gpsInfo = conversation.hasGpsTracking ? {
    isActive: true,
    lastUpdate: lastGpsLocation?.captured_at,
    lat: lastGpsLocation?.lat,
    lng: lastGpsLocation?.lng,
  } : undefined;

  const renderChatContent = () => {
    switch (conversation.type) {
      case 'FREIGHT':
        if (!freightData) return <div className="p-4">Carregando...</div>;
        return (
          <Suspense fallback={<CenteredSpinner />}>
            <FreightChat
              freightId={conversation.metadata.freightId}
              currentUserProfile={{ id: userProfileId, role: userRole } as any}
            />
          </Suspense>
        );

      case 'SERVICE':
        // ✅ FIX: NÃO bloquear ServiceChat esperando serviceData
        // ServiceChat tem seu próprio carregamento via useServiceChatConnection
        return (
          <Suspense fallback={<CenteredSpinner />}>
            <ServiceChat
              serviceRequestId={conversation.metadata.serviceRequestId}
              currentUserProfile={{ id: userProfileId, role: userRole } as any}
            />
          </Suspense>
        );

      case 'DIRECT_CHAT':
        return (
          <DriverChatTab
            companyId={conversation.metadata.companyId}
            driverProfileId={conversation.metadata.driverProfileId}
            currentUserId={userProfileId}
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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader className="space-y-3 pr-12">
          <DialogTitle className="sr-only">{conversation.title}</DialogTitle>
          <ChatHeader
            title={conversation.title}
            phoneNumber={getOtherParticipantPhone()}
            participantName={conversation.otherParticipant.name}
            gpsInfo={gpsInfo}
            unreadCount={conversation.unreadCount}
          />
        </DialogHeader>
        <div className="overflow-hidden h-[65vh]">{renderChatContent()}</div>
      </DialogContent>
    </Dialog>
  );
};
