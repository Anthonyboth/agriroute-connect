/**
 * ChatInputBar.tsx
 * 
 * Componente PADRONIZADO de input de chat, usado por FreightChat e ServiceChat.
 * Layout WhatsApp-style:
 *   [📎 Clipe] [Campo de texto] [➤ Enviar] [🎤 Áudio] [📹 Vídeo]
 * 
 * Suporta: texto, anexos, gravação de áudio e vídeo.
 */
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Send, Paperclip, Mic, Camera, X, Square, Loader2,
} from 'lucide-react';
import { useMediaRecorder } from '@/hooks/useMediaRecorder';
import { toast } from 'sonner';

interface ChatInputBarProps {
  onSendText: (text: string) => Promise<boolean> | void;
  onSendMedia: (file: File, type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO') => Promise<boolean>;
  isSending?: boolean;
  isUploading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  /** Elementos extras à esquerda do campo (ex: seletor de motorista) */
  extraLeftContent?: React.ReactNode;
  /** Elementos extras acima do input (ex: barra de localização) */
  extraTopContent?: React.ReactNode;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const ChatInputBar: React.FC<ChatInputBarProps> = ({
  onSendText,
  onSendMedia,
  isSending = false,
  isUploading = false,
  disabled = false,
  placeholder = 'Digite sua mensagem...',
  extraLeftContent,
  extraTopContent,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onRecordingComplete: onSendMedia,
  });

  const isDisabled = isSending || isUploading || isRecording || disabled;

  const handleSend = async () => {
    if (!newMessage.trim() || isDisabled) return;
    const text = newMessage;
    setNewMessage('');
    const result = await onSendText(text);
    if (result === false) setNewMessage(text);
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

    let type: 'IMAGE' | 'VIDEO' | 'FILE' = 'FILE';
    if (file.type.startsWith('image/')) type = 'IMAGE';
    else if (file.type.startsWith('video/')) type = 'VIDEO';

    await onSendMedia(file, type);
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

  return (
    <div className="space-y-2">
      {/* Extra top content (ex: barra de localização) */}
      {extraTopContent}

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
          {/* Hidden file input */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,video/mp4,video/webm,video/quicktime,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,audio/*"
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

          {/* Extra left content */}
          {extraLeftContent}

          {/* Campo de texto */}
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={placeholder}
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
    </div>
  );
};
