import { useState, useEffect, useRef } from 'react';
import { useDriverChat } from '@/hooks/useDriverChat';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Send, Clock, MessageCircle, Image as ImageIcon, Paperclip, Download, FileText, MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { useChatAttachments } from '@/hooks/useChatAttachments';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { ChatLocationBubble } from '@/components/chat/ChatLocationBubble';
import { ChatLocationRouteModal } from '@/components/chat/ChatLocationRouteModal';
import { getCurrentPositionSafe } from '@/utils/location';

interface DriverChatTabProps {
  companyId: string;
  driverProfileId: string;
  chatEnabledAt?: string | null;
  currentUserId?: string;
}

export const DriverChatTab = ({ 
  companyId, 
  driverProfileId, 
  chatEnabledAt,
  currentUserId: propCurrentUserId
}: DriverChatTabProps) => {
  const { profile } = useAuth();
  const currentUserId = propCurrentUserId || profile?.id || null;
  
  const [newMessage, setNewMessage] = useState('');
  const [sendingLocation, setSendingLocation] = useState(false);
  const [routeModalLocation, setRouteModalLocation] = useState<{ lat: number; lng: number; address?: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { messages, isLoading, sendMessage, markAsRead, unreadCount } = useDriverChat(
    companyId,
    driverProfileId
  );
  
  const { uploadImage: uploadImageAttachment, uploadFile: uploadFileAttachment, isUploading } = useChatAttachments(currentUserId || driverProfileId);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    markAsRead.mutate();
  }, []);

  const isChatEnabled = () => {
    if (!chatEnabledAt) return true;
    const enabledDate = new Date(chatEnabledAt);
    return enabledDate <= new Date();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sendMessage.isPending) return;
    await sendMessage.mutateAsync(newMessage);
    setNewMessage('');
  };

  const handleSendLocation = async () => {
    if (!currentUserId || sendingLocation) return;
    setSendingLocation(true);
    try {
      const position = await getCurrentPositionSafe();
      if (!position) {
        toast.error('Não foi possível obter sua localização. Verifique as permissões de GPS.');
        return;
      }

      const address = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
      
      const { error } = await supabase
        .from('company_driver_chats')
        .insert({
          company_id: companyId,
          driver_profile_id: driverProfileId,
          sender_type: 'COMPANY',
          message: `📍 Localização compartilhada: ${address}`,
          message_type: 'LOCATION',
          location_lat: position.coords.latitude,
          location_lng: position.coords.longitude,
          location_address: address,
        });

      if (error) throw error;
      toast.success('Localização compartilhada!');
    } catch (error: any) {
      console.error('Error sending location:', error);
      toast.error(error?.message || 'Erro ao compartilhar localização');
    } finally {
      setSendingLocation(false);
    }
  };
  
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    const imageUrl = await uploadImageAttachment(file);
    if (!imageUrl) return;

    try {
      const { error } = await supabase
        .from('company_driver_chats')
        .insert({
          company_id: companyId,
          driver_profile_id: driverProfileId,
          sender_type: 'COMPANY',
          message: 'Imagem enviada',
          image_url: imageUrl,
        });

      if (error) throw error;
      toast.success('Imagem enviada!');
    } catch (error: any) {
      console.error('Error sending image:', error);
      toast.error('Erro ao enviar imagem');
    }
    
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUserId) return;

    const fileData = await uploadFileAttachment(file);
    if (!fileData) return;

    try {
      const { error } = await supabase
        .from('company_driver_chats')
        .insert({
          company_id: companyId,
          driver_profile_id: driverProfileId,
          sender_type: 'COMPANY',
          message: `Arquivo enviado: ${fileData.name}`,
          file_url: fileData.url,
          file_name: fileData.name,
          file_size: fileData.size,
        });

      if (error) throw error;
      toast.success('Arquivo enviado!');
    } catch (error: any) {
      console.error('Error sending file:', error);
      toast.error('Erro ao enviar arquivo');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const isLocationMessage = (msg: any) => {
    return msg.message_type === 'LOCATION' || (msg.location_lat && msg.location_lng);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[400px] w-full" />
        <div className="flex gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-20" />
        </div>
      </div>
    );
  }

  if (!isChatEnabled()) {
    const enabledDate = new Date(chatEnabledAt!);
    return (
      <Alert>
        <Clock className="h-4 w-4" />
        <AlertDescription>
          Chat será habilitado {formatDistanceToNow(enabledDate, { 
            addSuffix: true, 
            locale: ptBR 
          })}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px] p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-sm">Nenhuma mensagem ainda</p>
                <p className="text-xs mt-1">Envie a primeira mensagem para iniciar a conversa</p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => {
                  const isCompany = msg.sender_type === 'COMPANY';

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex',
                        isCompany ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[70%] rounded-lg p-3',
                          isCompany
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        {/* Location message */}
                        {isLocationMessage(msg) && (msg as any).location_lat && (msg as any).location_lng ? (
                          <ChatLocationBubble
                            lat={(msg as any).location_lat}
                            lng={(msg as any).location_lng}
                            address={(msg as any).location_address}
                            timestamp={msg.created_at}
                            isCurrentUser={isCompany}
                            onOpenRouteModal={(lat, lng, addr) => setRouteModalLocation({ lat, lng, address: addr })}
                          />
                        ) : (
                          <>
                            {(msg as any).image_url && (
                              <img 
                                src={(msg as any).image_url} 
                                alt="Imagem enviada" 
                                className="rounded max-w-full h-auto mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                                style={{ maxHeight: '300px' }}
                                onClick={() => window.open((msg as any).image_url, '_blank')}
                              />
                            )}
                            
                            {(msg as any).file_url && (
                              <a
                                href={(msg as any).file_url}
                                download={(msg as any).file_name}
                                className="flex items-center gap-2 p-2 bg-background/10 rounded hover:bg-background/20 transition-colors mb-2"
                              >
                                <FileText className="h-5 w-5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" translate="no">
                                    {(msg as any).file_name}
                                  </p>
                                  <p className="text-xs opacity-70">
                                    {formatFileSize((msg as any).file_size)}
                                  </p>
                                </div>
                                <Download className="h-4 w-4 flex-shrink-0" />
                              </a>
                            )}
                            
                            <p className="text-sm whitespace-pre-wrap break-words" translate="no">{msg.message}</p>
                          </>
                        )}
                        <span className="text-xs opacity-70 mt-1 block">
                          {formatDistanceToNow(new Date(msg.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-4 border-t flex gap-2">
            <input
              type="file"
              ref={imageInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <input
              type="file"
              ref={fileInputRef}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => imageInputRef.current?.click()}
              disabled={sendMessage.isPending || isUploading}
              title="Enviar imagem"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
            
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={sendMessage.isPending || isUploading}
              title="Enviar arquivo"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleSendLocation}
              disabled={sendMessage.isPending || isUploading || sendingLocation}
              title="Compartilhar localização"
            >
              <MapPin className="h-4 w-4" />
            </Button>
            
            <Input
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sendMessage.isPending || isUploading}
              translate="no"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sendMessage.isPending || isUploading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Route modal */}
      {routeModalLocation && (
        <ChatLocationRouteModal
          open={!!routeModalLocation}
          onOpenChange={(open) => { if (!open) setRouteModalLocation(null); }}
          destinationLat={routeModalLocation.lat}
          destinationLng={routeModalLocation.lng}
          destinationAddress={routeModalLocation.address}
        />
      )}
    </>
  );
};
