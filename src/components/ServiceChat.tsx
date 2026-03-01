import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  MessageSquare, User, Wrench, 
  Download, FileText, WifiOff, 
  RefreshCw, ShieldAlert, Mic, Check, CheckCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useServiceChatConnection, ChatMessage } from '@/hooks/useServiceChatConnection';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { ChatLocationBubble } from '@/components/chat/ChatLocationBubble';
import { ChatLocationRouteModal } from '@/components/chat/ChatLocationRouteModal';
import { Skeleton } from '@/components/ui/skeleton';

interface ServiceChatProps {
  serviceRequestId: string;
  currentUserProfile: any;
}

export const ServiceChat: React.FC<ServiceChatProps> = ({ 
  serviceRequestId, 
  currentUserProfile 
}) => {
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [routeModal, setRouteModal] = useState<{ open: boolean; lat: number; lng: number; address?: string }>({
    open: false, lat: 0, lng: 0,
  });

  const {
    messages,
    isLoading,
    isConnected,
    isSending,
    isUploading,
    error,
    isParticipant,
    sendTextMessage,
    sendMediaMessage,
    sendLocationMessage,
    refresh,
  } = useServiceChatConnection({
    serviceRequestId,
    currentUserProfileId: currentUserProfile?.id,
  });

  // Auto-scroll ao receber novas mensagens
  useEffect(() => {
    if (scrollAreaRef.current) {
      const timer = setTimeout(() => {
        if (scrollAreaRef.current) {
          scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getRoleBadge = (role: string) => {
    const roleMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
      'PRODUTOR': { label: 'Cliente', variant: 'default' },
      'MOTORISTA': { label: 'Prestador', variant: 'secondary' },
      'PRESTADOR_SERVICOS': { label: 'Prestador', variant: 'secondary' }
    };
    return roleMap[role] || { label: role, variant: 'default' };
  };

  // ============ ESTADOS ESPECIAIS ============

  if (!isLoading && !isParticipant && error) {
    return (
      <Card className="h-full flex flex-col items-center justify-center">
        <CardContent className="text-center py-12">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="text-sm font-medium text-destructive">Acesso negado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Somente participantes do serviço podem acessar este chat.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isLoading && error && isParticipant) {
    return (
      <Card className="h-full flex flex-col items-center justify-center">
        <CardContent className="text-center py-12">
          <WifiOff className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" onClick={refresh} className="mt-3">
            <RefreshCw className="h-4 w-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5" />
            Chat do Serviço
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-4 space-y-4">
          <div className="flex-1 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className={`flex gap-2 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                {i % 2 !== 0 && <Skeleton className="h-8 w-8 rounded-full" />}
                <div className={`space-y-2 ${i % 2 === 0 ? 'items-end' : 'items-start'}`}>
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-12 w-48 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-md" />
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // ============ CHAT PRINCIPAL ============

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageSquare className="h-5 w-5" />
          Chat do Serviço
        </CardTitle>
        <div className="flex items-center gap-2">
          {!isConnected && (
            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
              <WifiOff className="h-3 w-3" />
              Reconectando
            </Badge>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={refresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Área de mensagens */}
        <ScrollArea 
          ref={scrollAreaRef}
          className="flex-1 pr-4"
        >
          <div className="space-y-3">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>Nenhuma mensagem ainda</p>
                <p className="text-sm">Inicie uma conversa!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isCurrentUser = msg.sender_id === currentUserProfile?.id;
                const roleBadge = msg.sender ? getRoleBadge(msg.sender.role) : null;
                const isProducer = msg.sender?.role === 'PRODUTOR';

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-2 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isCurrentUser && (
                      <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                        <SignedAvatarImage src={msg.sender?.profile_photo_url} />
                        <AvatarFallback>
                          {isProducer ? <User className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    
                    <div
                      className={`max-w-[75%] rounded-lg p-3 ${
                        isCurrentUser
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary'
                      }`}
                    >
                      {!isCurrentUser && msg.sender && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {msg.sender.full_name}
                          </span>
                          {roleBadge && (
                            <Badge variant={roleBadge.variant} className="text-xs">
                              {roleBadge.label}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {/* Imagem */}
                      {msg.message_type === 'IMAGE' && msg.image_url ? (
                        <div className="space-y-1">
                          <img 
                            src={msg.image_url} 
                            alt="Imagem enviada"
                            loading="lazy"
                            className="rounded max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                            style={{ maxHeight: '250px' }}
                            onClick={() => window.open(msg.image_url, '_blank')}
                          />
                        </div>
                      ) : msg.message_type === 'AUDIO' && msg.image_url ? (
                        /* Áudio */
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Mic className="h-4 w-4 flex-shrink-0 opacity-70" />
                            <audio 
                              src={msg.image_url} 
                              controls 
                              preload="metadata"
                              className="max-w-full h-8"
                              style={{ minWidth: '180px' }}
                            >
                              Seu navegador não suporta áudio.
                            </audio>
                          </div>
                        </div>
                      ) : msg.message_type === 'VIDEO' && msg.image_url ? (
                        /* Vídeo */
                        <div className="space-y-1">
                          <video 
                            src={msg.image_url} 
                            controls
                            preload="metadata"
                            className="rounded max-w-full h-auto"
                            style={{ maxHeight: '250px' }}
                          >
                            <track kind="captions" />
                            Seu navegador não suporta vídeos.
                          </video>
                        </div>
                      ) : msg.message_type === 'FILE' && msg.file_url ? (
                        /* Arquivo */
                        <a
                          href={msg.file_url}
                          download={msg.file_name}
                          className="flex items-center gap-2 p-2 bg-background/10 rounded hover:bg-background/20 transition-colors"
                        >
                          <FileText className="h-5 w-5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" translate="no">
                              {msg.file_name}
                            </p>
                            <p className="text-xs opacity-70">
                              {formatFileSize(msg.file_size)}
                            </p>
                          </div>
                          <Download className="h-4 w-4 flex-shrink-0" />
                        </a>
                      ) : msg.message_type === 'LOCATION' && msg.location_lat && msg.location_lng ? (
                        /* Localização */
                        <ChatLocationBubble
                          lat={msg.location_lat}
                          lng={msg.location_lng}
                          address={msg.location_address}
                          timestamp={msg.created_at}
                          isCurrentUser={isCurrentUser}
                          onOpenRouteModal={(lat, lng, addr) => setRouteModal({ open: true, lat, lng, address: addr })}
                        />
                      ) : (
                        /* Texto */
                        <p className="text-sm whitespace-pre-wrap" translate="no">{msg.message}</p>
                      )}
                      
                      <div className={`flex items-center gap-1 mt-1 ${isCurrentUser ? 'justify-end' : ''}`}>
                        <p className={`text-xs ${isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {format(new Date(msg.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                        </p>
                        {isCurrentUser && (
                          <span className="flex items-center">
                            {msg.read_at ? (
                              <CheckCheck className="h-3.5 w-3.5 text-blue-400" />
                            ) : msg.delivered_at ? (
                              <CheckCheck className="h-3.5 w-3.5 text-primary-foreground/70" />
                            ) : (
                              <Check className="h-3.5 w-3.5 text-primary-foreground/70" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* ✅ Input padronizado WhatsApp-style com áudio/vídeo */}
        <div className="border-t pt-3">
          <ChatInputBar
            onSendText={sendTextMessage}
            onSendMedia={sendMediaMessage}
            onSendLocation={sendLocationMessage}
            isSending={isSending}
            isUploading={isUploading}
            placeholder="Digite sua mensagem..."
          />
        </div>
      </CardContent>

      <ChatLocationRouteModal
        open={routeModal.open}
        onOpenChange={(open) => setRouteModal(prev => ({ ...prev, open }))}
        destinationLat={routeModal.lat}
        destinationLng={routeModal.lng}
        destinationAddress={routeModal.address}
      />
    </Card>
  );
};
