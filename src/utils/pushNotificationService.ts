import { supabase } from '@/integrations/supabase/client';
import { devLog } from '@/lib/devLogger';

interface SendPushNotificationParams {
  userIds: string[];
  title: string;
  message: string;
  type: string;
  data?: Record<string, any>;
  url?: string;
  requireInteraction?: boolean;
}

/**
 * Envia notificação push para usuários específicos
 */
export const sendPushNotification = async ({
  userIds,
  title,
  message,
  type,
  data = {},
  url = '/',
  requireInteraction = false
}: SendPushNotificationParams): Promise<boolean> => {
  try {
    devLog('[PushNotificationService] Enviando push:', { userIds, title, type });
    
    const { data: result, error } = await supabase.functions.invoke('send-push-notification', {
      body: {
        user_ids: userIds,
        title,
        message,
        type,
        data,
        url,
        requireInteraction,
        actions: []
      }
    });

    if (error) {
      console.error('[PushNotificationService] ❌ Erro ao enviar:', error);
      return false;
    }

    devLog('[PushNotificationService] ✅ Push enviado:', result);
    return true;
  } catch (error) {
    console.error('[PushNotificationService] ❌ Exceção:', error);
    return false;
  }
};

/**
 * Envia push notification quando nova mensagem no chat de proposta
 */
export const sendProposalChatPush = async (
  proposalId: string,
  senderId: string,
  messageContent: string,
  messageType: 'text' | 'image' | 'file'
) => {
  try {
    // Buscar dados da proposta e participantes
    const { data: proposal, error: proposalError } = await supabase
      .from('freight_proposals')
      .select(`
        id,
        freight_id,
        driver_id,
        proposed_price,
        freights!inner(
          id,
          producer_id,
          cargo_type,
          origin_city,
          destination_city
        )
      `)
      .eq('id', proposalId)
      .single();

    if (proposalError || !proposal) {
      console.error('[ProposalChatPush] Proposta não encontrada:', proposalError);
      return;
    }

    // Buscar nome do remetente
    const { data: senderProfile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', senderId)
      .single();

    const senderName = senderProfile?.full_name || 'Usuário';
    const senderRole = senderProfile?.role === 'MOTORISTA' ? 'Motorista' : 'Produtor';

    // Determinar destinatário (quem deve receber o push)
    const freight = proposal.freights as any;
    const recipientId = senderId === proposal.driver_id 
      ? freight.producer_id  // Se motorista enviou, notifica produtor
      : proposal.driver_id;  // Se produtor enviou, notifica motorista

    if (!recipientId) {
      devLog('[ProposalChatPush] Sem destinatário válido');
      return;
    }

    // Formatar mensagem baseado no tipo
    let displayMessage = messageContent;
    if (messageType === 'image') {
      displayMessage = '📷 Enviou uma imagem';
    } else if (messageType === 'file') {
      displayMessage = '📎 Enviou um arquivo';
    } else {
      // Limitar tamanho da mensagem
      displayMessage = messageContent.length > 50 
        ? messageContent.substring(0, 50) + '...' 
        : messageContent;
    }

    // Enviar push notification
    await sendPushNotification({
      userIds: [recipientId],
      title: `💬 ${senderRole}: ${senderName}`,
      message: displayMessage,
      type: 'proposal_chat_message',
      data: {
        proposal_id: proposalId,
        freight_id: proposal.freight_id,
        sender_id: senderId,
        message_type: messageType
      },
      url: `/dashboard?openProposal=${proposalId}`,
      requireInteraction: false
    });

    devLog('[ProposalChatPush] ✅ Push enviado para chat de proposta');
  } catch (error) {
    console.error('[ProposalChatPush] ❌ Erro:', error);
  }
};

/**
 * Envia push notifications para transportadora
 * TODO: Verificar estrutura correta da tabela company_drivers
 */
export const sendCompanyPushNotification = async (
  companyId: string,
  type: 'company_new_proposal' | 'company_freight_status_change' | 'company_driver_assignment' | 'company_delivery_confirmation',
  data: {
    title: string;
    message: string;
    freightId?: string;
    driverId?: string;
    proposalId?: string;
    url?: string;
  }
) => {
  try {
    devLog('[CompanyPush] Enviando notificação para transportadora:', type, companyId);
    
    // Por enquanto, buscar todos os usuários da transportadora
    // TODO: Implementar lógica correta após verificar estrutura da tabela
    devLog('[CompanyPush] ⚠️ Função em desenvolvimento - verificar estrutura company_drivers');
    
  } catch (error) {
    console.error('[CompanyPush] ❌ Erro:', error);
  }
};
