import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Image, MessageCircle, User, Truck, MapPin, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { useLocationPermission } from '@/hooks/useLocationPermission';
import { queryWithTimeout, subscriptionWithErrorHandler } from '@/lib/query-utils';
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

interface Message {
  id: string;
  message: string;
  sender_id: string;
  message_type: string;
  image_url?: string;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  created_at: string;
  sender?: {
    full_name: string;
    role: string;
    profile_photo_url?: string;
  };
}

interface FreightChatProps {
  freightId: string;
  currentUserProfile: any;
}

export const FreightChat: React.FC<FreightChatProps> = ({
  freightId,
  currentUserProfile
}) => {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [isSendingLocation, setIsSendingLocation] = useState(false);
  const [showLocationConfirm, setShowLocationConfirm] = useState(false);
  const [freightInfo, setFreightInfo] = useState<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    unreadFreightMessages, 
    fetchUnreadFreightMessages, 
    markFreightMessagesAsRead 
  } = useUnreadMessages(currentUserProfile?.id);
  
  const { requestLocation, coords } = useLocationPermission(false);
  
  const unreadCount = unreadFreightMessages[freightId] || 0;
  const isProducer = freightInfo?.producer_id === currentUserProfile?.id;
  const isDriver = freightInfo?.driver_id === currentUserProfile?.id;
  const canShareLocation = freightInfo?.status && ['ACCEPTED', 'IN_TRANSIT'].includes(freightInfo.status);

  const fetchMessages = async () => {
    try {
      console.log('[FreightChat] Carregando mensagens...');
      
      const messages = await queryWithTimeout(
        async () => {
          const { data, error } = await supabase
            .from('freight_messages')
            .select(`
              *,
              sender:profiles!sender_id(full_name, role, profile_photo_url)
            `)
            .eq('freight_id', freightId)
            .order('created_at', { ascending: true });

          if (error) throw error;
          return data;
        },
        { timeoutMs: 5000, operationName: 'fetchFreightMessages' }
      );

      setMessages(messages || []);
    } catch (error: any) {
      console.error('[FreightChat] Erro ao carregar mensagens:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar o histórico. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const fetchFreightInfo = async () => {
    const { data } = await supabase
      .from('freights')
      .select('producer_id, driver_id, status')
      .eq('id', freightId)
      .single();
    setFreightInfo(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !currentUserProfile) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freightId,
          sender_id: currentUserProfile.id,
          message: newMessage.trim(),
          message_type: 'TEXT'
        });

      if (error) throw error;

      setNewMessage('');
      fetchMessages();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!currentUserProfile) return;

    setUploading(true);
    try {
      const fileName = `${currentUserProfile.user_id}/${Date.now()}_${file.name}`;
      
      const { error: uploadError } = await supabase.storage
        .from('freight-attachments')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('freight-attachments')
        .getPublicUrl(fileName);

      const { error } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freightId,
          sender_id: currentUserProfile.id,
          message: 'Imagem enviada',
          message_type: 'IMAGE',
          image_url: publicUrl
        });

      if (error) throw error;

      fetchMessages();
      toast({
        title: "Imagem enviada",
        description: "A imagem foi enviada com sucesso.",
      });
    } catch (error: any) {
      console.error('Error sending image:', error);
      toast({
        title: "Erro ao enviar imagem",
        description: "Não foi possível enviar a imagem. Verifique o tamanho do arquivo e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        uploadImage(file);
      } else {
        toast({
          title: "Arquivo não suportado",
          description: "Por favor, selecione uma imagem.",
          variant: "destructive",
        });
      }
    }
  };

  const requestDriverLocation = async () => {
    if (!currentUserProfile || !isProducer) return;

    setIsRequestingLocation(true);
    try {
      const { error } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freightId,
          sender_id: currentUserProfile.id,
          message: 'solicitou sua localização atual',
          message_type: 'LOCATION_REQUEST'
        });

      if (error) throw error;

      toast({
        title: "Solicitação enviada",
        description: "O motorista receberá sua solicitação de localização.",
      });
      
      fetchMessages();
    } catch (error: any) {
      console.error('Error requesting location:', error);
      toast({
        title: "Erro ao solicitar localização",
        description: "Não foi possível enviar a solicitação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsRequestingLocation(false);
    }
  };

  const sendCurrentLocation = async () => {
    if (!currentUserProfile || !isDriver) return;

    setIsSendingLocation(true);
    setShowLocationConfirm(false);
    try {
      const locationGranted = await requestLocation();
      if (!locationGranted || !coords) {
        throw new Error('Não foi possível obter sua localização');
      }

      let address = `${coords.latitude.toFixed(6)}, ${coords.longitude.toFixed(6)}`;

      const { error } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freightId,
          sender_id: currentUserProfile.id,
          message: `compartilhou sua localização: ${address}`,
          message_type: 'LOCATION_RESPONSE',
          location_lat: coords.latitude,
          location_lng: coords.longitude,
          location_address: address
        });

      if (error) throw error;

      toast({
        title: "Localização compartilhada",
        description: "O produtor poderá ver sua localização atual.",
      });
      
      fetchMessages();
    } catch (error: any) {
      console.error('Error sending location:', error);
      toast({
        title: "Erro ao compartilhar localização",
        description: error.message || 'Não foi possível compartilhar sua localização. Verifique as permissões.',
        variant: "destructive",
      });
    } finally {
      setIsSendingLocation(false);
    }
  };

  const isLocationRecent = (timestamp: string) => {
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);
    return new Date(timestamp) > hourAgo;
  };

  useEffect(() => {
    fetchMessages();
    fetchFreightInfo();
    fetchUnreadFreightMessages(freightId);
    
    // Marcar mensagens como lidas ao abrir o chat
    markFreightMessagesAsRead(freightId);

    // Real-time subscription com error handling
    const channel = subscriptionWithErrorHandler(
      supabase
        .channel('freight-chat')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'freight_messages',
            filter: `freight_id=eq.${freightId}` 
          }, 
          () => {
            console.log('[FreightChat] Nova mensagem recebida');
            fetchMessages();
          }
        ),
      (error) => {
        console.error('[FreightChat] Erro na subscription:', error);
        toast({
          title: "Erro na conexão",
          description: "O chat pode não atualizar automaticamente. Recarregue a página.",
          variant: "destructive",
        });
      }
    ).subscribe();

    return () => {
      console.log('[FreightChat] Removendo subscription');
      supabase.removeChannel(channel);
    };
  }, [freightId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <>
      <Card className="h-[500px] flex flex-col">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Chat do Frete
          </CardTitle>
          {unreadCount > 0 && (
            <Badge variant="destructive">
              {unreadCount} {unreadCount === 1 ? 'não lida' : 'não lidas'}
            </Badge>
          )}
        </CardHeader>

        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 px-4" ref={scrollRef}>
            <div className="space-y-4 pb-4">
              {messages.map((message) => {
                const isCurrentUser = message.sender_id === currentUserProfile?.id;
                const isSenderProducer = message.sender?.role === 'PRODUTOR';

                return (
                  <div
                    key={message.id}
                    className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[70%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      <Avatar className="h-8 w-8 mt-1">
                        <AvatarImage src={message.sender?.profile_photo_url} />
                        <AvatarFallback>
                          {isSenderProducer ? <User className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                        </AvatarFallback>
                      </Avatar>

                      <div className={`space-y-1 ${isCurrentUser ? 'text-right' : 'text-left'}`}>
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
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(message.created_at), 'HH:mm')}
                          </span>
                        </div>

                        <div
                          className={`p-3 rounded-lg ${
                            isCurrentUser 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-muted'
                          }`}
                        >
                          {message.message_type === 'IMAGE' && message.image_url && (
                            <img 
                              src={message.image_url} 
                              alt="Imagem compartilhada"
                              className="max-w-full h-auto rounded mb-2"
                              style={{ maxHeight: '200px' }}
                            />
                          )}
                          
                          {message.message_type === 'TEXT' && (
                            <p className="text-sm break-words">
                              {message.message}
                            </p>
                          )}

                          {message.message_type === 'LOCATION_REQUEST' && (
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4" />
                              <p className="text-sm">
                                {message.sender?.full_name} solicitou a localização do motorista
                              </p>
                            </div>
                          )}

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
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>

          {canShareLocation && (
            <div className="border-t p-2 bg-muted/30">
              <div className="flex gap-2 justify-center">
                {isProducer && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={requestDriverLocation}
                    disabled={isRequestingLocation}
                    className="flex items-center gap-2"
                  >
                    <MapPin className="h-4 w-4" />
                    {isRequestingLocation ? 'Solicitando...' : 'Solicitar Localização'}
                  </Button>
                )}
                
                {isDriver && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLocationConfirm(true)}
                    disabled={isSendingLocation}
                    className="flex items-center gap-2"
                  >
                    <Navigation className="h-4 w-4" />
                    {isSendingLocation ? 'Obtendo localização...' : 'Enviar Minha Localização'}
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Image className="h-4 w-4" />
              </Button>
              
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={loading}
              />
              
              <Button 
                onClick={sendMessage}
                disabled={loading || !newMessage.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showLocationConfirm} onOpenChange={setShowLocationConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Compartilhar sua localização?</AlertDialogTitle>
            <AlertDialogDescription>
              Sua localização atual será compartilhada com o produtor deste frete.
              Você deseja continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={sendCurrentLocation}>
              Compartilhar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};