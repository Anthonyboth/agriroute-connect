import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface ProposalChatMessage {
  id: string;
  proposal_id: string;
  sender_id: string;
  message_type: string;
  content: string | null;
  image_url: string | null;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  read_at: string | null;
  sender?: {
    id: string;
    full_name: string;
    avatar_url?: string | null;
  };
}

export const useProposalChat = (proposalId: string, currentUserId: string) => {
  const [messages, setMessages] = useState<ProposalChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch messages
  const fetchMessages = async () => {
    try {
      const { data: messagesData, error } = await supabase
        .from('proposal_chat_messages')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch sender profiles separately
      const senderIds = [...new Set(messagesData?.map(m => m.sender_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles_secure')
        .select('id, full_name, profile_photo_url')
        .in('id', senderIds);

      const profileMap = new Map(profiles?.map(p => [p.id, { ...p, avatar_url: p.profile_photo_url }]) || []);

      const enrichedMessages = messagesData?.map(msg => ({
        ...msg,
        sender: profileMap.get(msg.sender_id)
      })) || [];

      setMessages(enrichedMessages);
    } catch (error: any) {
      console.error('Erro ao buscar mensagens:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Mark messages as read
  const markMessagesAsRead = async () => {
    try {
      const unreadMessages = messages.filter(
        m => m.sender_id !== currentUserId && !m.read_at
      );

      if (unreadMessages.length === 0) return;

      const { error } = await supabase
        .from('proposal_chat_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadMessages.map(m => m.id));

      if (error) throw error;
    } catch (error: any) {
      console.error('Erro ao marcar mensagens como lidas:', error);
    }
  };

  // Send text message
  const sendMessage = async (content: string) => {
    if (!content.trim()) return;

    setIsSending(true);
    try {
      const { error } = await supabase
        .from('proposal_chat_messages')
        .insert({
          proposal_id: proposalId,
          sender_id: currentUserId,
          message_type: 'text',
          content: content.trim(),
        });

      if (error) throw error;

      // Enviar push notification
      const { sendProposalChatPush } = await import('@/utils/pushNotificationService');
      await sendProposalChatPush(proposalId, currentUserId, content.trim(), 'text');

      toast({
        title: "Mensagem enviada",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Upload image
  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, selecione uma imagem",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 5MB",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${proposalId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('proposal-chat-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Use signed URL for private bucket (1 hour expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('proposal-chat-images')
        .createSignedUrl(fileName, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Falha ao gerar URL de acesso');
      }

      const { error: insertError } = await supabase
        .from('proposal_chat_messages')
        .insert({
          proposal_id: proposalId,
          sender_id: currentUserId,
          message_type: 'image',
          image_url: signedUrlData.signedUrl,
        });

      if (insertError) throw insertError;

      // Enviar push notification
      const { sendProposalChatPush } = await import('@/utils/pushNotificationService');
      await sendProposalChatPush(proposalId, currentUserId, 'Imagem', 'image');

      toast({
        title: "Imagem enviada",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Erro ao enviar imagem:', error);
      toast({
        title: "Erro ao enviar imagem",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Upload file
  const uploadFile = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O tamanho máximo é 10MB",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${proposalId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('proposal-chat-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Use signed URL for private bucket (1 hour expiry)
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('proposal-chat-files')
        .createSignedUrl(fileName, 3600);

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new Error('Falha ao gerar URL de acesso');
      }

      const { error: insertError } = await supabase
        .from('proposal_chat_messages')
        .insert({
          proposal_id: proposalId,
          sender_id: currentUserId,
          message_type: 'file',
          file_url: signedUrlData.signedUrl,
          file_name: file.name,
          file_size: file.size,
        });

      if (insertError) throw insertError;

      // Enviar push notification
      const { sendProposalChatPush } = await import('@/utils/pushNotificationService');
      await sendProposalChatPush(proposalId, currentUserId, file.name, 'file');

      toast({
        title: "Arquivo enviado",
        variant: "default",
      });
    } catch (error: any) {
      console.error('Erro ao enviar arquivo:', error);
      toast({
        title: "Erro ao enviar arquivo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Setup realtime subscription
  useEffect(() => {
    fetchMessages();
    markMessagesAsRead();

    const channel = supabase
      .channel(`proposal-chat:${proposalId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proposal_chat_messages',
          filter: `proposal_id=eq.${proposalId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ProposalChatMessage]);
          
          // Invalidate proposal queries to update unread counts
          queryClient.invalidateQueries({ queryKey: ['freight-proposals'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [proposalId, currentUserId]);

  // Mark as read when messages change
  useEffect(() => {
    markMessagesAsRead();
  }, [messages.length]);

  const unreadCount = messages.filter(
    m => m.sender_id !== currentUserId && !m.read_at
  ).length;

  return {
    messages,
    isLoading,
    isSending,
    unreadCount,
    sendMessage,
    uploadImage,
    uploadFile,
  };
};
