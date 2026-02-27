/**
 * FreightChat.tsx
 * 
 * Chat do frete com suporte padronizado a:
 * - Texto, imagens, vídeos, áudios, arquivos
 * - Gravação de áudio e vídeo (WhatsApp-style)
 * - Compartilhamento de localização
 * - Compartilhamento de frete entre motorista/transportadora
 * - Acesso restrito a participantes do frete (produtor, motorista, transportadora)
 */
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Send, MessageCircle, User, Truck, MapPin, Navigation, Check,
  Package, DollarSign, Download, FileText, WifiOff, RefreshCw,
  ShieldAlert, Mic,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFreightChatConnection } from '@/hooks/useFreightChatConnection';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CompanyFreightAcceptModal } from './CompanyFreightAcceptModal';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface FreightChatProps {
  freightId: string;
  currentUserProfile: any;
}

export const FreightChat: React.FC<FreightChatProps> = ({
  freightId,
  currentUserProfile
}) => {
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [selectedSharedFreight, setSelectedSharedFreight] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    freightInfo,
    isLoading,
    isConnected,
    isSending,
    isUploading,
    error,
    isParticipant,
    sendTextMessage,
    sendMediaMessage,
    sendLocationMessage,
    sendSystemMessage,
    refresh,
  } = useFreightChatConnection({
    freightId,
    currentUserProfileId: currentUserProfile?.id,
  });

  const { requestLocation, coords } = useLocationPermission(false);
  const { company } = useTransportCompany();

  const isProducer = freightInfo?.producer_id === currentUserProfile?.id;
  const isDriver = freightInfo?.driver_id === currentUserProfile?.id;
  const canShareLocation = freightInfo?.status && ['ACCEPTED', 'IN_TRANSIT'].includes(freightInfo.status);
  const isCompanyOwner = currentUserProfile?.role === 'TRANSPORTADORA' || !!currentUserProfile?.transport_company;

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      const timer = setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  const requestDriverLocation = async () => {
    await sendSystemMessage('solicitou sua localização atual', 'LOCATION_REQUEST');
  };

  const sendCurrentLocation = async () => {
    setShowLocationConfirm(false);
    try {
      const locationGranted = await requestLocation();
      if (!locationGranted || !coords) {
        throw new Error('Não foi possível obter sua localização');
      }
      const address = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;
      await sendLocationMessage(coords.latitude, coords.longitude, address);
    } catch (error: any) {
      console.error('Error sending location:', error);
    }
  };

  const isLocationRecent = (timestamp: string) => {
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);
    return new Date(timestamp) > hourAgo;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  // ============ ESTADOS ESPECIAIS ============

  if (!isLoading && !isParticipant && error) {
    return (
      <Card className="h-[500px] flex flex-col items-center justify-center">
        <CardContent className="text-center py-12">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="text-sm font-medium text-destructive">Acesso negado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Somente participantes do frete podem acessar este chat.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isLoading && error && isParticipant) {
    return (
      <Card className="h-[500px] flex flex-col items-center justify-center">
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
      <Card className="h-[500px] flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat do Frete
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

  const locationBar = canShareLocation ? (
    <div className="border-t p-2 bg-muted/30 rounded-lg">
      <div className="flex gap-2 justify-center">
        {isProducer && (
          <Button
            variant="outline"
            size="sm"
            onClick={requestDriverLocation}
            disabled={isSending}
            className="flex items-center gap-2"
          >
            <MapPin className="h-4 w-4" />
            Solicitar Localização
          </Button>
        )}
        {isDriver && (
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowLocationConfirm(true)}
            disabled={isSending}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white"
          >
            <Navigation className="h-4 w-4" />
            Enviar Localização / SOS
          </Button>
        )}
      </div>
    </div>
  ) : undefined;

  return (
    <>
      <Card className="h-[500px] flex flex-col">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat do Frete
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
          <ScrollArea ref={scrollRef} className="flex-1 pr-4">
            <div className="space-y-4 pb-4">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma mensagem ainda</p>
                  <p className="text-sm">Inicie uma conversa!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isCurrentUser = message.sender_id === currentUserProfile?.id;
                  const isSenderProducer = message.sender?.role === 'PRODUTOR';

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[75%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        {!isCurrentUser && (
                          <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                            <SignedAvatarImage src={message.sender?.profile_photo_url} />
                            <AvatarFallback>
                              {isSenderProducer ? <User className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                            </AvatarFallback>
                          </Avatar>
                        )}

                        <div className={`space-y-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
                          {!isCurrentUser && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-muted-foreground">
                                {message.sender?.full_name || 'Usuário'}
                              </span>
                              <Badge
                                variant={isSenderProducer ? 'default' : 'secondary'}
                                className="text-xs"
                              >
                                {isSenderProducer ? 'Produtor' : 'Motorista'}
                              </Badge>
                            </div>
                          )}

                          <div
                            className={`p-3 rounded-lg ${
                              isCurrentUser
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            {/* Imagem */}
                            {message.message_type === 'IMAGE' && message.image_url && (
                              <img
                                src={message.image_url}
                                alt="Imagem compartilhada"
                                loading="lazy"
                                className="max-w-full h-auto rounded mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ maxHeight: '250px' }}
                                onClick={() => window.open(message.image_url, '_blank')}
                              />
                            )}

                            {/* Áudio */}
                            {message.message_type === 'AUDIO' && message.image_url && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <Mic className="h-4 w-4 flex-shrink-0 opacity-70" />
                                  <audio
                                    src={message.image_url}
                                    controls
                                    preload="metadata"
                                    className="max-w-full h-8"
                                    style={{ minWidth: '180px' }}
                                  >
                                    Seu navegador não suporta áudio.
                                  </audio>
                                </div>
                              </div>
                            )}

                            {/* Vídeo */}
                            {message.message_type === 'VIDEO' && message.image_url && (
                              <div className="space-y-1">
                                <video
                                  src={message.image_url}
                                  controls
                                  preload="metadata"
                                  className="rounded max-w-full h-auto"
                                  style={{ maxHeight: '250px' }}
                                >
                                  <track kind="captions" />
                                  Seu navegador não suporta vídeos.
                                </video>
                              </div>
                            )}

                            {/* Arquivo */}
                            {message.message_type === 'FILE' && message.file_url && (
                              <a
                                href={message.file_url}
                                download={message.file_name}
                                className="flex items-center gap-2 p-2 bg-background/10 rounded hover:bg-background/20 transition-colors"
                              >
                                <FileText className="h-5 w-5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" translate="no">
                                    {message.file_name}
                                  </p>
                                  <p className="text-xs opacity-70">
                                    {formatFileSize(message.file_size)}
                                  </p>
                                </div>
                                <Download className="h-4 w-4 flex-shrink-0" />
                              </a>
                            )}

                            {/* Texto */}
                            {message.message_type === 'TEXT' && (
                              <p className="text-sm break-words whitespace-pre-wrap" translate="no">
                                {message.message}
                              </p>
                            )}

                            {/* Solicitação de localização */}
                            {message.message_type === 'LOCATION_REQUEST' && (
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4" />
                                <p className="text-sm">
                                  {message.sender?.full_name} solicitou a localização do motorista
                                </p>
                              </div>
                            )}

                            {/* Resposta de localização */}
                            {message.message_type === 'LOCATION_RESPONSE' && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Navigation className="h-4 w-4" />
                                  <p className="text-sm font-medium">Localização compartilhada</p>
                                  {isLocationRecent(message.created_at) && (
                                    <Badge variant="default" className="text-xs">
                                      Recente
                                    </Badge>
                                  )}
                                </div>
                                {message.location_address && (
                                  <p className="text-xs opacity-90">{message.location_address}</p>
                                )}
                                {message.location_lat && message.location_lng && (
                                  <Button
                                    size="sm"
                                    variant={isCurrentUser ? "secondary" : "outline"}
                                    asChild
                                    className="w-fit"
                                  >
                                    <a
                                      href={`https://www.google.com/maps?q=${message.location_lat},${message.location_lng}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1"
                                    >
                                      <MapPin className="h-3 w-3" />
                                      Ver no Mapa
                                    </a>
                                  </Button>
                                )}
                              </div>
                            )}

                            {/* Compartilhamento de frete */}
                            {message.message_type === 'FREIGHT_SHARE' && message.metadata && (
                              <Card className="bg-blue-50/50 border-blue-200 mt-2">
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex items-start gap-2">
                                    <Truck className="h-5 w-5 text-blue-600 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="font-semibold text-blue-900 text-sm">🚛 Frete Compartilhado</p>
                                      <p className="text-xs text-blue-700 mt-1">{message.message}</p>
                                    </div>
                                  </div>
                                  {message.metadata.freight_data && (
                                    <div className="space-y-2 p-3 bg-white rounded border text-xs">
                                      <div className="flex items-center gap-2">
                                        <Package className="h-3 w-3 text-muted-foreground" />
                                        <span><strong>Carga:</strong> {message.metadata.freight_data.cargo_type}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MapPin className="h-3 w-3 text-green-600" />
                                        <span><strong>Origem:</strong> {message.metadata.freight_data.origin_address}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <MapPin className="h-3 w-3 text-red-600" />
                                        <span><strong>Destino:</strong> {message.metadata.freight_data.destination_address}</span>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <DollarSign className="h-3 w-3 text-primary" />
                                        <span><strong>Preço:</strong> R$ {message.metadata.freight_data.price?.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  )}
                                  {isCompanyOwner && message.metadata.freight_data && (
                                    <div className="flex gap-2 pt-2">
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setSelectedSharedFreight({
                                            freight: message.metadata.freight_data,
                                            driverId: message.metadata.shared_by,
                                            driverName: message.sender?.full_name
                                          });
                                          setShowAcceptModal(true);
                                        }}
                                        className="flex-1"
                                      >
                                        <Check className="mr-2 h-3 w-3" />
                                        Aceitar Frete
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setSelectedSharedFreight({
                                            freight: message.metadata.freight_data,
                                            driverId: message.metadata.shared_by,
                                            driverName: message.sender?.full_name
                                          });
                                          setShowAcceptModal(true);
                                        }}
                                        className="flex-1"
                                      >
                                        <MessageCircle className="mr-2 h-3 w-3" />
                                        Contra-propor
                                      </Button>
                                    </div>
                                  )}
                                </CardContent>
                              </Card>
                            )}

                            {/* Contraproposta */}
                            {message.message_type === 'COUNTER_PROPOSAL' && message.metadata && (
                              <Card className="bg-orange-50/50 border-orange-200 mt-2">
                                <CardContent className="p-4 space-y-2">
                                  <div className="flex items-start gap-2">
                                    <DollarSign className="h-5 w-5 text-orange-600 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="font-semibold text-orange-900 text-sm">💰 Contraproposta</p>
                                      <div className="text-xs text-orange-700 mt-2 space-y-1">
                                        <p><strong>Valor Original:</strong> R$ {message.metadata.original_price?.toFixed(2)}</p>
                                        <p><strong>Novo Valor:</strong> R$ {message.metadata.counter_price?.toFixed(2)}</p>
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            )}

                            {/* Timestamp */}
                            <div className={`flex items-center gap-1 mt-1 ${isCurrentUser ? 'justify-end' : ''}`}>
                              <span className={`text-xs ${isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {format(new Date(message.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Input padronizado com áudio/vídeo */}
          <div className="border-t pt-3">
            <ChatInputBar
              onSendText={sendTextMessage}
              onSendMedia={sendMediaMessage}
              isSending={isSending}
              isUploading={isUploading}
              placeholder="Digite sua mensagem..."
              extraTopContent={locationBar}
            />
          </div>
        </CardContent>
      </Card>

      {/* Modal de confirmação de localização */}
      <AlertDialog open={showLocationConfirm} onOpenChange={setShowLocationConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Navigation className="h-5 w-5" />
              Compartilhar Localização / Botão de Pânico
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>Sua localização atual será compartilhada com o produtor deste frete.</p>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm">
                <p className="font-semibold text-red-800 mb-1">🚨 Função de Emergência (SOS)</p>
                <p className="text-red-700">
                  Em situação de perigo, este botão também pode ativar o modo de emergência,
                  onde sua localização é monitorada continuamente e o áudio ambiente pode ser
                  gravado por até 30 minutos para sua segurança.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                O envio automático de localização a cada 30 minutos continua funcionando normalmente.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={sendCurrentLocation}
              className="bg-primary hover:bg-primary/90"
            >
              Enviar Localização
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de aceitar frete compartilhado */}
      {showAcceptModal && selectedSharedFreight && company && (
        <CompanyFreightAcceptModal
          isOpen={showAcceptModal}
          onClose={() => {
            setShowAcceptModal(false);
            setSelectedSharedFreight(null);
          }}
          freight={selectedSharedFreight.freight}
          driverId={selectedSharedFreight.driverId}
          driverName={selectedSharedFreight.driverName}
          companyOwnerId={currentUserProfile?.id || ''}
          companyId={company.id}
        />
      )}
    </>
  );
};
