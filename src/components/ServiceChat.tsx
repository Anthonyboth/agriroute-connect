import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Send, MessageSquare, User, Wrench, 
  Paperclip, Download, FileText, Loader2, WifiOff, 
  RefreshCw, ShieldAlert, Mic, MicOff, Camera, 
  Square, X, Video as VideoIcon
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useServiceChatConnection, ChatMessage } from '@/hooks/useServiceChatConnection';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface ServiceChatProps {
  serviceRequestId: string;
  currentUserProfile: any;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const ServiceChat: React.FC<ServiceChatProps> = ({ 
  serviceRequestId, 
  currentUserProfile 
}) => {
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    refresh,
  } = useServiceChatConnection({
    serviceRequestId,
    currentUserProfileId: currentUserProfile?.id,
  });

  const {
    isRecording,
    recordingType,
    recordingDuration,
    startAudioRecording,
    startVideoRecording,
    stopRecording,
    cancelRecording,
    videoPreviewRef,
  } = useMediaRecorder({
    onRecordingComplete: sendMediaMessage,
  });

  const isDisabled = isSending || isUploading || isRecording;

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

  const handleSend = async () => {
    if (!newMessage.trim() || isDisabled) return;
    const text = newMessage;
    setNewMessage('');
    const success = await sendTextMessage(text);
    if (!success) setNewMessage(text);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Detectar tipo automaticamente
    let type: 'IMAGE' | 'VIDEO' | 'FILE' = 'FILE';
    if (file.type.startsWith('image/')) type = 'IMAGE';
    else if (file.type.startsWith('video/')) type = 'VIDEO';

    await sendMediaMessage(file, type);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleStartAudio = async () => {
    try {
      await startAudioRecording();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar gravação de áudio');
    }
  };

  const handleStartVideo = async () => {
    try {
      await startVideoRecording();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao iniciar gravação de vídeo');
    }
  };

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
                        <AvatarImage src={msg.sender?.profile_photo_url} />
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
                      ) : (
                        /* Texto */
                        <p className="text-sm whitespace-pre-wrap" translate="no">{msg.message}</p>
                      )}
                      
                      <p className={`text-xs mt-1 ${isCurrentUser ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        {/* Upload / Sending status */}
        {(isUploading || (isSending && !newMessage)) && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Enviando mídia...
          </div>
        )}

        {/* Video recording preview */}
        {isRecording && recordingType === 'video' && (
          <div className="relative rounded-lg overflow-hidden bg-black">
            <video
              ref={videoPreviewRef}
              autoPlay
              muted
              playsInline
              className="w-full h-40 object-cover"
            />
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-destructive/90 text-destructive-foreground px-2 py-1 rounded-full text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              REC {formatDuration(recordingDuration)}
            </div>
            <div className="absolute bottom-2 right-2 flex gap-2">
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={cancelRecording}
              >
                <X className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="default"
                size="icon"
                className="h-9 w-9 rounded-full bg-white text-black hover:bg-white/90"
                onClick={stopRecording}
              >
                <Square className="h-4 w-4 fill-current" />
              </Button>
            </div>
          </div>
        )}

        {/* Audio recording indicator */}
        {isRecording && recordingType === 'audio' && (
          <div className="flex items-center gap-3 px-3 py-2.5 bg-destructive/10 border border-destructive/20 rounded-lg">
            <span className="h-3 w-3 rounded-full bg-destructive animate-pulse flex-shrink-0" />
            <div className="flex items-center gap-2 flex-1">
              <Mic className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium text-destructive">
                Gravando áudio... {formatDuration(recordingDuration)}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={cancelRecording}
              title="Cancelar"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="h-8 w-8"
              onClick={stopRecording}
              title="Enviar áudio"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Input de mensagem - WhatsApp style */}
        {!isRecording && (
          <div className="flex items-center gap-1.5">
            {/* Hidden file input - aceita tudo */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* 📎 Clipe - Esquerda do campo */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isDisabled}
              title="Enviar arquivo"
              className="flex-shrink-0 h-10 w-10"
            >
              <Paperclip className="h-5 w-5" />
            </Button>

            {/* Campo de texto */}
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Digite sua mensagem..."
              disabled={isDisabled}
              translate="no"
              className="flex-1"
            />

            {/* ➤ Enviar */}
            <Button
              type="button"
              onClick={handleSend}
              disabled={isDisabled || !newMessage.trim()}
              size="icon"
              title="Enviar mensagem"
              className="flex-shrink-0 h-10 w-10"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>

            {/* 🎤 Gravar áudio */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleStartAudio}
              disabled={isDisabled}
              title="Gravar áudio"
              className="flex-shrink-0 h-10 w-10"
            >
              <Mic className="h-5 w-5" />
            </Button>

            {/* 📹 Gravar vídeo */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleStartVideo}
              disabled={isDisabled}
              title="Gravar vídeo"
              className="flex-shrink-0 h-10 w-10"
            >
              <Camera className="h-5 w-5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
