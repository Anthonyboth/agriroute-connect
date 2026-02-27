/**
 * useFreightChatConnection.ts
 * 
 * Hook centralizado para gerenciar a conexão e operações do chat de frete.
 * Espelha a API do useServiceChatConnection para padronização.
 * 
 * Responsabilidades:
 * - Validação de participante (produtor, motorista, transportadora)
 * - Carregamento e cache de mensagens
 * - Envio de texto, imagens, vídeos, áudios e arquivos
 * - Subscription realtime para mensagens novas
 * - Gestão de estado de loading/erro/conexão
 * - Renovação automática de signed URLs para mídias
 * - Compartilhamento de localização
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { queryWithTimeout, subscriptionWithErrorHandler } from '@/lib/query-utils';

export interface FreightChatMessage {
  id: string;
  freight_id: string;
  sender_id: string;
  message: string;
  message_type: string;
  image_url?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  location_lat?: number;
  location_lng?: number;
  location_address?: string;
  created_at: string;
  read_at?: string;
  target_driver_id?: string;
  metadata?: any;
  sender?: {
    id: string;
    full_name: string;
    role: string;
    profile_photo_url?: string;
  };
}

interface UseFreightChatConnectionOptions {
  freightId: string;
  currentUserProfileId?: string;
}

interface FreightChatConnectionResult {
  messages: FreightChatMessage[];
  freightInfo: { producer_id: string; driver_id: string; status: string } | null;
  isLoading: boolean;
  isConnected: boolean;
  isSending: boolean;
  isUploading: boolean;
  error: string | null;
  isParticipant: boolean;
  sendTextMessage: (text: string) => Promise<boolean>;
  sendMediaMessage: (file: File, type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO') => Promise<boolean>;
  sendLocationMessage: (lat: number, lng: number, address: string) => Promise<boolean>;
  sendSystemMessage: (message: string, type: string, metadata?: any) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const ALLOWED_AUDIO_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
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
 */
const resolveStorageUrl = async (url: string): Promise<string> => {
  if (!url) return url;

  const storageRegex = /\/storage\/v1\/object\/(?:sign|public)\/([^/?]+)\/(.+?)(?:\?|$)/;
  const match = url.match(storageRegex);
  if (!match) return url;

  const bucket = match[1];
  const path = decodeURIComponent(match[2]);

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 86400);

    if (error || !data?.signedUrl) return url;
    return data.signedUrl;
  } catch {
    return url;
  }
};

const resolveMessageMediaUrls = async (msgs: any[]): Promise<any[]> => {
  if (!msgs || msgs.length === 0) return msgs;

  return Promise.all(
    msgs.map(async (msg) => {
      if (msg.message_type === 'TEXT' || msg.message_type === 'LOCATION_REQUEST') return msg;
      const resolved = { ...msg };
      if (resolved.image_url) resolved.image_url = await resolveStorageUrl(resolved.image_url);
      if (resolved.file_url) resolved.file_url = await resolveStorageUrl(resolved.file_url);
      return resolved;
    })
  );
};

export function useFreightChatConnection({
  freightId,
  currentUserProfileId,
}: UseFreightChatConnectionOptions): FreightChatConnectionResult {
  const [messages, setMessages] = useState<FreightChatMessage[]>([]);
  const [freightInfo, setFreightInfo] = useState<{ producer_id: string; driver_id: string; status: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isParticipant, setIsParticipant] = useState(false);

  const isMountedRef = useRef(true);

  // Validar participante
  const validateParticipant = useCallback(async (): Promise<boolean> => {
    if (!currentUserProfileId || !freightId) return false;

    try {
      // Check if user is producer, driver, or company owner via assignment
      const { data: freight, error: freightError } = await supabase
        .from('freights')
        .select('producer_id, driver_id, status, company_id')
        .eq('id', freightId)
        .single();

      if (freightError || !freight) return false;
      
      if (isMountedRef.current) setFreightInfo(freight);

      // Direct participant (producer or driver)
      if (freight.producer_id === currentUserProfileId || freight.driver_id === currentUserProfileId) {
        return true;
      }

      // Check if user is a transport company owner via freights.company_id
      if (freight.company_id) {
        const { data: company } = await supabase
          .from('transport_companies')
          .select('profile_id')
          .eq('id', freight.company_id)
          .single();

        if (company?.profile_id === currentUserProfileId) return true;
      }

      // Check if user is a company owner of an assigned driver
      const { data: assignments } = await supabase
        .from('freight_assignments')
        .select('driver_id, company_id')
        .eq('freight_id', freightId)
        .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED', 'DELIVERED']);

      if (assignments && assignments.length > 0) {
        for (const assignment of assignments) {
          if (assignment.company_id) {
            const { data: company } = await supabase
              .from('transport_companies')
              .select('profile_id')
              .eq('id', assignment.company_id)
              .single();

            if (company?.profile_id === currentUserProfileId) return true;
          }
        }
      }

      return false;
    } catch (err) {
      console.error('[FreightChat] Erro na validação:', err);
      return false;
    }
  }, [freightId, currentUserProfileId]);

  // Buscar mensagens
  const fetchMessages = useCallback(async () => {
    if (!freightId || !currentUserProfileId) return;

    try {
      const data = await queryWithTimeout(
        async () => {
          const { data, error: queryError } = await supabase
            .from('freight_messages')
            .select(`
              *,
              sender:profiles!sender_id(id, full_name, role, profile_photo_url)
            `)
            .eq('freight_id', freightId)
            .order('created_at', { ascending: true });

          if (queryError) throw queryError;
          return data;
        },
        { timeoutMs: 8000, operationName: 'fetchFreightChatMessages', retries: 2, retryDelayMs: 1500 }
      );

      if (isMountedRef.current) {
        const resolvedData = await resolveMessageMediaUrls(data || []);
        if (isMountedRef.current) {
          setMessages(resolvedData as FreightChatMessage[]);
          setError(null);
        }
      }
    } catch (err: any) {
      console.error('[FreightChat] Erro ao carregar mensagens:', err);
      if (isMountedRef.current) {
        const msg = err.message?.includes('Timeout')
          ? 'Conexão lenta. Tente novamente.'
          : 'Erro ao carregar mensagens.';
        setError(msg);
      }
    }
  }, [freightId, currentUserProfileId]);

  // Upload de mídia
  const uploadMedia = useCallback(async (
    file: File,
    type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO'
  ): Promise<{ url: string; name: string; size: number } | null> => {
    if (!currentUserProfileId) return null;

    const maxSize = type === 'VIDEO' ? MAX_VIDEO_SIZE
      : type === 'AUDIO' ? MAX_AUDIO_SIZE
      : type === 'IMAGE' ? MAX_IMAGE_SIZE
      : MAX_FILE_SIZE;

    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      toast.error(`Arquivo muito grande. Máximo ${maxMB}MB.`);
      return null;
    }

    const allowedTypes = type === 'VIDEO' ? ALLOWED_VIDEO_TYPES
      : type === 'IMAGE' ? ALLOWED_IMAGE_TYPES
      : type === 'AUDIO' ? ALLOWED_AUDIO_TYPES
      : ALLOWED_FILE_TYPES;

    const fileBaseType = file.type.split(';')[0].trim();
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

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Sessão expirada. Faça login novamente.');
        return null;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const bucket = type === 'IMAGE' ? 'chat-interno-images' : 'chat-interno-files';
      const uploadContentType = (type === 'AUDIO' || type === 'VIDEO') ? fileBaseType : file.type;

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: uploadContentType,
        });

      if (uploadError) throw uploadError;

      const { data: signedData, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(data.path, 86400);

      if (signError || !signedData?.signedUrl) {
        throw new Error('Falha ao gerar URL de acesso');
      }

      return { url: signedData.signedUrl, name: file.name, size: file.size };
    } catch (err: any) {
      console.error('[FreightChat] Erro no upload:', err);
      toast.error(err.message || 'Erro ao enviar mídia');
      return null;
    } finally {
      if (isMountedRef.current) setIsUploading(false);
    }
  }, [currentUserProfileId]);

  // Determinar target_driver_id com base em quem é o sender
  const getTargetDriverId = useCallback((): string | null => {
    if (!freightInfo || !currentUserProfileId) return null;
    // Se o sender é o produtor, o target é o motorista
    if (currentUserProfileId === freightInfo.producer_id) {
      return freightInfo.driver_id || null;
    }
    // Se o sender é o motorista (ou empresa), o target é ele mesmo (driver do frete)
    return freightInfo.driver_id || currentUserProfileId;
  }, [freightInfo, currentUserProfileId]);

  // Enviar mensagem de texto
  const sendTextMessage = useCallback(async (text: string): Promise<boolean> => {
    if (!text.trim() || !currentUserProfileId || !freightId) return false;

    const targetDriverId = getTargetDriverId();
    if (!targetDriverId) {
      console.error('[FreightChat] target_driver_id não disponível');
      toast.error('Erro: motorista não identificado no frete');
      return false;
    }

    setIsSending(true);
    try {
      const { error: insertError } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freightId,
          sender_id: currentUserProfileId,
          target_driver_id: targetDriverId,
          message: text.trim(),
          message_type: 'TEXT',
        });

      if (insertError) throw insertError;
      return true;
    } catch (err: any) {
      console.error('[FreightChat] Erro ao enviar:', err);
      toast.error('Erro ao enviar mensagem');
      return false;
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  }, [freightId, currentUserProfileId, getTargetDriverId]);

  // Enviar mensagem com mídia
  const sendMediaMessage = useCallback(async (
    file: File,
    type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO'
  ): Promise<boolean> => {
    if (!currentUserProfileId || !freightId) return false;

    const targetDriverId = getTargetDriverId();
    if (!targetDriverId) {
      console.error('[FreightChat] target_driver_id não disponível para mídia');
      toast.error('Erro: motorista não identificado no frete');
      return false;
    }

    const mediaData = await uploadMedia(file, type);
    if (!mediaData) return false;

    setIsSending(true);
    try {
      const messageLabel = type === 'VIDEO' ? 'Vídeo enviado'
        : type === 'IMAGE' ? 'Imagem enviada'
        : type === 'AUDIO' ? 'Áudio enviado'
        : `Arquivo enviado: ${mediaData.name}`;

      const { error: insertError } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freightId,
          sender_id: currentUserProfileId,
          target_driver_id: targetDriverId,
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
      console.error('[FreightChat] Erro ao enviar mídia:', err);
      toast.error('Erro ao enviar mídia');
      return false;
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  }, [freightId, currentUserProfileId, uploadMedia, getTargetDriverId]);

  // Enviar localização
  const sendLocationMessage = useCallback(async (
    lat: number, lng: number, address: string
  ): Promise<boolean> => {
    if (!currentUserProfileId || !freightId) return false;

    const targetDriverId = getTargetDriverId();
    if (!targetDriverId) {
      toast.error('Erro: motorista não identificado no frete');
      return false;
    }

    setIsSending(true);
    try {
      const { error: insertError } = await supabase
        .from('freight_messages')
        .insert({
          freight_id: freightId,
          sender_id: currentUserProfileId,
          target_driver_id: targetDriverId,
          message: `compartilhou sua localização: ${address}`,
          message_type: 'LOCATION_RESPONSE',
          location_lat: lat,
          location_lng: lng,
          location_address: address,
        });

      if (insertError) throw insertError;
      toast.success('Localização compartilhada');
      return true;
    } catch (err: any) {
      console.error('[FreightChat] Erro ao enviar localização:', err);
      toast.error('Erro ao compartilhar localização');
      return false;
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  }, [freightId, currentUserProfileId, getTargetDriverId]);

  // Enviar mensagem de sistema (location request, freight share, etc.)
  const sendSystemMessage = useCallback(async (
    message: string, type: string, metadata?: any
  ): Promise<boolean> => {
    if (!currentUserProfileId || !freightId) return false;

    const targetDriverId = getTargetDriverId();
    if (!targetDriverId) {
      toast.error('Erro: motorista não identificado no frete');
      return false;
    }

    setIsSending(true);
    try {
      const insertData: any = {
        freight_id: freightId,
        sender_id: currentUserProfileId,
        target_driver_id: targetDriverId,
        message,
        message_type: type,
      };
      
      const { error: insertError } = await supabase
        .from('freight_messages')
        .insert(insertData);

      if (insertError) throw insertError;
      return true;
    } catch (err: any) {
      console.error('[FreightChat] Erro ao enviar mensagem de sistema:', err);
      toast.error('Erro ao enviar');
      return false;
    } finally {
      if (isMountedRef.current) setIsSending(false);
    }
  }, [freightId, currentUserProfileId, getTargetDriverId]);

  // Inicialização
  useEffect(() => {
    isMountedRef.current = true;

    if (!freightId || !currentUserProfileId) {
      setIsLoading(false);
      return;
    }

    let channel: any = null;
    let pollingInterval: any = null;

    const startPolling = () => {
      if (!pollingInterval) {
        pollingInterval = setInterval(fetchMessages, 8000);
      }
    };

    const stopPolling = () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
    };

    const init = async () => {
      setIsLoading(true);
      setError(null);

      const valid = await validateParticipant();
      if (!isMountedRef.current) return;

      setIsParticipant(valid);
      if (!valid) {
        setIsLoading(false);
        setError('Você não é participante deste frete.');
        return;
      }

      await fetchMessages();
      if (!isMountedRef.current) return;
      setIsLoading(false);

      // Marcar como lidas
      void supabase.rpc('mark_freight_messages_as_read', { p_freight_id: freightId });

      // Subscription realtime
      channel = subscriptionWithErrorHandler(
        supabase
          .channel(`freight-chat-v2:${freightId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'freight_messages',
            filter: `freight_id=eq.${freightId}`,
          }, () => {
            if (isMountedRef.current) {
              fetchMessages();
              stopPolling();
              void supabase.rpc('mark_freight_messages_as_read', { p_freight_id: freightId });
            }
          }),
        (err) => {
          console.warn('[FreightChat] Subscription falhou, usando polling:', err.message);
          startPolling();
        }
      ).subscribe((status: string) => {
        if (isMountedRef.current) {
          setIsConnected(status === 'SUBSCRIBED');
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            startPolling();
          }
        }
      });
    };

    init();

    return () => {
      isMountedRef.current = false;
      stopPolling();
      if (channel) supabase.removeChannel(channel);
    };
  }, [freightId, currentUserProfileId]);

  return {
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
    refresh: fetchMessages,
  };
}
