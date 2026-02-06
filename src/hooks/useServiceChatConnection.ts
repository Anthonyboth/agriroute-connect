import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { queryWithTimeout } from '@/lib/query-utils';

export interface ChatMessage {
  id: string;
  service_request_id: string;
  sender_id: string;
  message: string;
  message_type: 'TEXT' | 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO';
  image_url?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  read_at?: string;
  delivered_at?: string;
  sender?: {
    id: string;
    full_name: string;
    role: string;
    profile_photo_url?: string;
  };
}

interface UseServiceChatConnectionOptions {
  serviceRequestId: string;
  currentUserProfileId?: string;
}

interface ServiceChatConnectionResult {
  messages: ChatMessage[];
  isLoading: boolean;
  isConnected: boolean;
  isSending: boolean;
  isUploading: boolean;
  error: string | null;
  isParticipant: boolean;
  sendTextMessage: (text: string) => Promise<boolean>;
  sendMediaMessage: (file: File, type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO') => Promise<boolean>;
  refresh: () => Promise<void>;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

/**
 * Regenera signed URL para mídias do Supabase Storage.
 * Extrai bucket/path de URLs expiradas (signed ou public) e gera nova signed URL.
 */
const resolveStorageUrl = async (url: string): Promise<string> => {
  if (!url) return url;

  // Match Supabase storage URLs: /storage/v1/object/(sign|public)/{bucket}/{path}
  const storageRegex = /\/storage\/v1\/object\/(?:sign|public)\/([^/?]+)\/(.+?)(?:\?|$)/;
  const match = url.match(storageRegex);

  if (!match) return url; // Não é URL de storage, retorna como está

  const bucket = match[1];
  const path = decodeURIComponent(match[2]);

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 86400); // 24h

    if (error || !data?.signedUrl) {
      console.warn('[ServiceChat] Falha ao renovar signed URL:', error);
      return url;
    }

    return data.signedUrl;
  } catch (err) {
    console.warn('[ServiceChat] Erro ao renovar signed URL:', err);
    return url;
  }
};

/**
 * Resolve todas as URLs de mídia em uma lista de mensagens.
 * Gera signed URLs frescas para evitar erros de expiração.
 */
const resolveMessageMediaUrls = async (msgs: any[]): Promise<any[]> => {
  if (!msgs || msgs.length === 0) return msgs;

  return Promise.all(
    msgs.map(async (msg) => {
      // Só processar mensagens com mídia
      if (msg.message_type === 'TEXT') return msg;

      const resolved = { ...msg };
      if (resolved.image_url) {
        resolved.image_url = await resolveStorageUrl(resolved.image_url);
      }
      if (resolved.file_url) {
        resolved.file_url = await resolveStorageUrl(resolved.file_url);
      }
      return resolved;
    })
  );
};

/**
 * Hook centralizado para gerenciar a conexão e operações do chat de serviço.
 * 
 * Responsabilidades:
 * - Validação de participante (somente client/provider do serviço)
 * - Carregamento e cache de mensagens
 * - Envio de texto, imagens, vídeos e arquivos
 * - Subscription realtime para mensagens novas
 * - Gestão de estado de loading/erro/conexão
 * - Renovação automática de signed URLs para mídias
 */
export function useServiceChatConnection({
  serviceRequestId,
  currentUserProfileId,
}: UseServiceChatConnectionOptions): ServiceChatConnectionResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);
  
  const channelRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  // ✅ Validar se o usuário é participante do serviço
  const validateParticipant = useCallback(async (): Promise<boolean> => {
    if (!currentUserProfileId || !serviceRequestId) return false;

    try {
      const { data, error: queryError } = await supabase
        .from('service_requests')
        .select('client_id, provider_id')
        .eq('id', serviceRequestId)
        .single();

      if (queryError || !data) {
        console.error('[ServiceChat] Erro ao validar participante:', queryError);
        return false;
      }

      const isValid = data.client_id === currentUserProfileId || 
                       data.provider_id === currentUserProfileId;
      
      if (!isValid) {
        console.warn('[ServiceChat] Usuário não é participante deste serviço');
      }
      
      return isValid;
    } catch (err) {
      console.error('[ServiceChat] Erro na validação:', err);
      return false;
    }
  }, [serviceRequestId, currentUserProfileId]);

  // ✅ Buscar mensagens com timeout e retry
  const fetchMessages = useCallback(async () => {
    if (!serviceRequestId || !currentUserProfileId) return;

    try {
      const data = await queryWithTimeout(
        async () => {
          const { data, error: queryError } = await supabase
            .from('service_messages')
            .select(`
              id, service_request_id, sender_id, message, message_type,
              image_url, file_url, file_name, file_size, created_at, read_at, delivered_at,
              sender:profiles!service_messages_sender_id_fkey(id, full_name, role, profile_photo_url)
            `)
            .eq('service_request_id', serviceRequestId)
            .order('created_at', { ascending: true });

          if (queryError) throw queryError;
          return data;
        },
        { timeoutMs: 8000, operationName: 'fetchServiceChatMessages', retries: 2, retryDelayMs: 1500 }
      );

      if (isMountedRef.current) {
        // Resolver signed URLs expiradas para mídias
        const resolvedData = await resolveMessageMediaUrls(data || []);
        if (isMountedRef.current) {
          setMessages(resolvedData as ChatMessage[]);
          setError(null);
        }
      }
    } catch (err: any) {
      console.error('[ServiceChat] Erro ao carregar mensagens:', err);
      if (isMountedRef.current) {
        const msg = err.message?.includes('Timeout') 
          ? 'Conexão lenta. Tente novamente.' 
          : 'Erro ao carregar mensagens.';
        setError(msg);
      }
    }
  }, [serviceRequestId, currentUserProfileId]);

  // ✅ Marcar mensagens como lidas
  const markAsRead = useCallback(async () => {
    if (!serviceRequestId || !currentUserProfileId) return;
    try {
      await supabase.rpc('mark_service_messages_as_read', { 
        p_service_request_id: serviceRequestId 
      });
    } catch (err) {
      console.error('[ServiceChat] Erro ao marcar como lidas:', err);
    }
  }, [serviceRequestId, currentUserProfileId]);

  // ✅ Upload de mídia para storage
  const uploadMedia = useCallback(async (
    file: File, 
    type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO'
  ): Promise<{ url: string; name: string; size: number } | null> => {
    if (!currentUserProfileId) return null;

    // Validação de tamanho
    const maxSize = type === 'VIDEO' ? MAX_VIDEO_SIZE 
      : type === 'AUDIO' ? MAX_AUDIO_SIZE
      : type === 'IMAGE' ? MAX_IMAGE_SIZE 
      : MAX_FILE_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      toast.error(`Arquivo muito grande. Máximo ${maxMB}MB.`);
      return null;
    }

    // Validação de tipo (usa startsWith para suportar codecs, ex: audio/webm;codecs=opus)
    const allowedTypes = type === 'VIDEO' ? ALLOWED_VIDEO_TYPES 
      : type === 'IMAGE' ? ALLOWED_IMAGE_TYPES 
      : type === 'AUDIO' ? ALLOWED_AUDIO_TYPES
      : ALLOWED_FILE_TYPES;
    
    const fileBaseType = file.type.split(';')[0].trim();
    if (!allowedTypes.some(allowed => fileBaseType === allowed || fileBaseType.startsWith(allowed.split('/')[0] + '/') && allowed === fileBaseType)) {
      // Fallback: checar se o base type está na lista OU se o tipo com codec começa com um tipo permitido
      const isValid = allowedTypes.some(allowed => {
        const baseAllowed = allowed.split(';')[0].trim();
        return fileBaseType === baseAllowed || fileBaseType === allowed;
      });
      if (!isValid) {
        const labels = type === 'VIDEO' ? 'MP4, WebM ou MOV' 
          : type === 'IMAGE' ? 'JPEG, PNG, WEBP ou GIF'
          : type === 'AUDIO' ? 'WebM, OGG, MP4, MP3 ou WAV'
          : 'PDF, Word, Excel, TXT ou CSV';
        toast.error(`Tipo não suportado. Use ${labels}.`);
        return null;
      }
    }

    setIsUploading(true);
    try {
      // CRÍTICO: usar auth.uid() para o path, não profileId!
      // A política RLS do storage valida: auth.uid()::text = foldername[1]
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sessão expirada. Faça login novamente.');
        return null;
      }
      const authUserId = user.id;

      const fileExt = file.name.split('.').pop();
      const fileName = `${authUserId}/${Date.now()}.${fileExt}`;
      // Rotear para bucket correto: imagens → chat-interno-images, demais → chat-interno-files
      const bucket = type === 'IMAGE' ? 'chat-interno-images' : 'chat-interno-files';
      
      // Para áudio/vídeo, forçar contentType sem codec para compatibilidade com bucket
      const uploadContentType = (type === 'AUDIO' || type === 'VIDEO') ? fileBaseType : file.type;

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { 
          cacheControl: '3600', 
          upsert: false,
          contentType: uploadContentType,
        });

      if (uploadError) throw uploadError;

      // CRÍTICO: Buckets são privados! Sempre usar signed URLs (24h de validade)
      const { data: signedData, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(data.path, 86400); // 24h

      if (signError || !signedData?.signedUrl) {
        throw new Error('Falha ao gerar URL de acesso');
      }

      return { url: signedData.signedUrl, name: file.name, size: file.size };
    } catch (err: any) {
      console.error('[ServiceChat] Erro no upload:', err);
      toast.error(err.message || 'Erro ao enviar mídia');
      return null;
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  }, [currentUserProfileId]);

  // ✅ Enviar mensagem de texto
  const sendTextMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!text.trim() || !currentUserProfileId || !serviceRequestId) return false;

    setIsSending(true);
    try {
      const { error: insertError } = await supabase
        .from('service_messages')
        .insert({
          service_request_id: serviceRequestId,
          sender_id: currentUserProfileId,
          message: text.trim(),
          message_type: 'TEXT',
        });

      if (insertError) throw insertError;
      return true;
    } catch (err: any) {
      console.error('[ServiceChat] Erro ao enviar:', err);
      toast.error('Erro ao enviar mensagem');
      return false;
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  }, [serviceRequestId, currentUserProfileId]);

  // ✅ Enviar mensagem com mídia (imagem, vídeo ou arquivo)
  const sendMediaMessage = useCallback(async (
    file: File, 
    type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO'
  ): Promise<boolean> => {
    if (!currentUserProfileId || !serviceRequestId) return false;

    const mediaData = await uploadMedia(file, type);
    if (!mediaData) return false;

    setIsSending(true);
    try {
      const messageLabel = type === 'VIDEO' ? 'Vídeo enviado' 
        : type === 'IMAGE' ? 'Imagem enviada' 
        : type === 'AUDIO' ? 'Áudio enviado'
        : `Arquivo enviado: ${mediaData.name}`;

      const { error: insertError } = await supabase
        .from('service_messages')
        .insert({
          service_request_id: serviceRequestId,
          sender_id: currentUserProfileId,
          message: messageLabel,
          message_type: type,
          ...(type === 'IMAGE' || type === 'VIDEO' || type === 'AUDIO'
            ? { image_url: mediaData.url } 
            : { file_url: mediaData.url, file_name: mediaData.name, file_size: mediaData.size }),
        });

      if (insertError) throw insertError;

      const successMsg = type === 'VIDEO' ? 'Vídeo enviado!' 
        : type === 'IMAGE' ? 'Imagem enviada!' 
        : type === 'AUDIO' ? 'Áudio enviado!'
        : 'Arquivo enviado!';
      toast.success(successMsg);
      return true;
    } catch (err: any) {
      console.error('[ServiceChat] Erro ao enviar mídia:', err);
      toast.error('Erro ao enviar mídia');
      return false;
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  }, [serviceRequestId, currentUserProfileId, uploadMedia]);

  // ✅ Inicialização: validar participante + carregar mensagens + subscription
  useEffect(() => {
    isMountedRef.current = true;

    if (!serviceRequestId || !currentUserProfileId) {
      setIsLoading(false);
      return;
    }

    let channel: any = null;

    const init = async () => {
      setIsLoading(true);
      setError(null);

      // 1. Validar participante
      const valid = await validateParticipant();
      if (!isMountedRef.current) return;
      
      setIsParticipant(valid);
      if (!valid) {
        setIsLoading(false);
        setError('Você não é participante deste serviço.');
        return;
      }

      // 2. Carregar mensagens
      await fetchMessages();
      if (!isMountedRef.current) return;
      setIsLoading(false);

      // 3. Marcar como lidas
      markAsRead();

      // 4. Subscription realtime
      channel = supabase
        .channel(`service-chat-${serviceRequestId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'service_messages',
          filter: `service_request_id=eq.${serviceRequestId}`,
        }, (payload) => {
          const newMsg = payload.new as any;
          if (!isMountedRef.current) return;

          // Refetch completo para ter sender info
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            fetchMessages();
            return prev;
          });

          // Marcar como entregue e lida se não for do próprio usuário
          if (newMsg.sender_id !== currentUserProfileId) {
            supabase
              .from('service_messages')
              .update({ delivered_at: new Date().toISOString() })
              .eq('id', newMsg.id)
              .is('delivered_at', null)
              .then(() => {});
            markAsRead();
          }
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_messages',
          filter: `service_request_id=eq.${serviceRequestId}`,
        }, (payload) => {
          const updated = payload.new as any;
          if (!isMountedRef.current) return;

          // Atualizar read_at/delivered_at em tempo real (checkmarks)
          setMessages(prev => prev.map(m => 
            m.id === updated.id 
              ? { ...m, read_at: updated.read_at, delivered_at: updated.delivered_at } 
              : m
          ));
        })
        .subscribe((status: string) => {
          if (isMountedRef.current) {
            setIsConnected(status === 'SUBSCRIBED');
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              console.error('[ServiceChat] Subscription error:', status);
              setError('Conexão perdida. Tentando reconectar...');
            }
          }
        });

      channelRef.current = channel;
    };

    init();

    return () => {
      isMountedRef.current = false;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [serviceRequestId, currentUserProfileId]);

  return {
    messages,
    isLoading,
    isConnected,
    isSending,
    isUploading,
    error,
    isParticipant,
    sendTextMessage,
    sendMediaMessage,
    refresh: fetchMessages,
  };
}
