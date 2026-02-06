/**
 * Hook dedicado para gerenciamento de pagamentos do produtor
 * 
 * Responsabilidades:
 * - Buscar pagamentos externos do produtor
 * - Confirmar que efetuou pagamento
 * - Criar novas solicitações de pagamento
 * - Gerenciar estado de loading e erros
 */

import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { sendPushNotification } from '@/utils/pushNotificationService';

export interface ProducerPayment {
  id: string;
  freight_id: string;
  driver_id: string;
  producer_id: string;
  amount: number;
  status: 'proposed' | 'paid_by_producer' | 'confirmed' | 'rejected' | 'cancelled' | 'disputed';
  notes?: string;
  created_at: string;
  updated_at?: string;
  proposed_at?: string;
  accepted_at?: string;
  confirmed_at?: string;
  freight?: {
    id: string;
    cargo_type: string;
    origin_city?: string;
    origin_state?: string;
    destination_city?: string;
    destination_state?: string;
    pickup_date?: string;
    status?: string;
    price?: number;
    distance_km?: number;
  };
  driver?: {
    id: string;
    full_name: string;
    contact_phone?: string;
    profile_photo_url?: string;
  };
}

interface UseProducerPaymentsReturn {
  payments: ProducerPayment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  confirmPaymentMade: (paymentId: string) => Promise<boolean>;
  createPaymentRequest: (freightId: string, driverId: string, amount: number, notes?: string) => Promise<boolean>;
  // Estatísticas
  pendingCount: number;
  awaitingConfirmationCount: number;
  completedCount: number;
  totalPending: number;
}

export const useProducerPayments = (): UseProducerPaymentsReturn => {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<ProducerPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Busca todos os pagamentos externos do produtor
   */
  const fetchPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      console.log('[useProducerPayments] Skipping fetch - not a producer');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[useProducerPayments] Fetching payments for producer:', profile.id);

      const { data, error: fetchError } = await supabase
        .from('external_payments')
        .select(`
          *,
          freight:freights!external_payments_freight_id_fkey(
            id,
            cargo_type,
            origin_city,
            origin_state,
            destination_city,
            destination_state,
            pickup_date,
            status,
            price,
            distance_km
          ),
          driver:profiles!external_payments_driver_id_fkey(
            id,
            full_name,
            contact_phone,
            profile_photo_url
          )
        `)
        .eq('producer_id', profile.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useProducerPayments] Fetch error:', {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
        });
        setError(fetchError.message);
        setPayments([]);
        return;
      }

      console.log('[useProducerPayments] Fetched payments:', data?.length || 0);
      // Cast para any para evitar erros de tipo - a query funciona mas os tipos não refletem corretamente
      setPayments((data || []) as unknown as ProducerPayment[]);
    } catch (err: any) {
      console.error('[useProducerPayments] Unexpected error:', err);
      setError(err?.message || 'Erro ao carregar pagamentos');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role]);

  /**
   * Confirma que o produtor efetuou o pagamento (externo à plataforma)
   */
  const confirmPaymentMade = useCallback(async (paymentId: string): Promise<boolean> => {
    if (!profile?.id) {
      toast.error('Você precisa estar logado');
      return false;
    }

    try {
      console.log('[useProducerPayments] Confirming payment made:', paymentId);

      // Buscar dados do pagamento ANTES de atualizar para ter info do motorista e frete
      const { data: paymentData } = await supabase
        .from('external_payments')
        .select(`
          id, driver_id, amount, freight_id,
          freight:freights!external_payments_freight_id_fkey(
            origin_city, destination_city, cargo_type
          )
        `)
        .eq('id', paymentId)
        .eq('producer_id', profile.id)
        .eq('status', 'proposed')
        .maybeSingle();

      if (!paymentData) {
        console.error('[useProducerPayments] Payment not found or not in proposed status');
        toast.error('Pagamento não encontrado ou já foi confirmado.');
        return false;
      }

      // ✅ Usar .select() para verificar se o update realmente afetou alguma linha
      const { data: updatedRows, error: updateError } = await supabase
        .from('external_payments')
        .update({
          status: 'paid_by_producer',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .eq('producer_id', profile.id)
        .eq('status', 'proposed')
        .select('id');

      if (updateError) {
        console.error('[useProducerPayments] Error confirming payment:', updateError);
        toast.error('Erro ao confirmar pagamento', {
          description: updateError.message
        });
        return false;
      }

      // ✅ Verificar se realmente atualizou
      if (!updatedRows || updatedRows.length === 0) {
        console.error('[useProducerPayments] Update affected 0 rows - RLS or status mismatch');
        toast.error('Não foi possível atualizar o pagamento.', {
          description: 'Verifique se o pagamento ainda está pendente.'
        });
        return false;
      }

      console.log('[useProducerPayments] ✅ Payment updated successfully:', updatedRows);

      toast.success('Pagamento confirmado!', {
        description: 'O motorista será notificado para confirmar o recebimento.'
      });

      // ✅ Enviar push notification + notificação no banco para o motorista
      if (paymentData.driver_id) {
        const freight = paymentData.freight as any;
        const amountFormatted = paymentData.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00';
        const routeInfo = freight?.origin_city && freight?.destination_city 
          ? `${freight.origin_city} → ${freight.destination_city}` 
          : 'Frete';

        // Criar notificação no banco (visível no painel do motorista)
        supabase.from('notifications').insert({
          user_id: paymentData.driver_id,
          title: '💰 Pagamento Confirmado pelo Produtor',
          message: `R$ ${amountFormatted} - ${routeInfo}. Acesse a aba Pagamentos para confirmar o recebimento.`,
          type: 'payment_confirmed_by_producer',
          read: false,
        }).then(({ error }) => {
          if (error) console.error('[useProducerPayments] Error creating notification:', error);
          else console.log('[useProducerPayments] ✅ Notification created for driver');
        });

        // Enviar push notification
        sendPushNotification({
          userIds: [paymentData.driver_id],
          title: '💰 Pagamento Confirmado pelo Produtor',
          message: `R$ ${amountFormatted} - ${routeInfo}. Confirme o recebimento no app.`,
          type: 'payment_confirmed_by_producer',
          data: {
            payment_id: paymentId,
            freight_id: paymentData.freight_id,
            amount: paymentData.amount,
          },
          url: '/dashboard?tab=payments',
          requireInteraction: true,
        }).catch(err => console.error('[useProducerPayments] Push notification error:', err));
      }

      // Refetch para atualizar a lista
      await fetchPayments();
      return true;
    } catch (err: any) {
      console.error('[useProducerPayments] Unexpected error confirming payment:', err);
      toast.error('Erro ao confirmar pagamento');
      return false;
    }
  }, [profile?.id, fetchPayments]);

  /**
   * Cria uma nova solicitação de pagamento para um frete
   */
  const createPaymentRequest = useCallback(async (
    freightId: string,
    driverId: string,
    amount: number,
    notes?: string
  ): Promise<boolean> => {
    if (!profile?.id) {
      toast.error('Você precisa estar logado');
      return false;
    }

    try {
      console.log('[useProducerPayments] Creating payment request:', { freightId, driverId, amount });

      const { error: insertError } = await supabase
        .from('external_payments')
        .insert({
          freight_id: freightId,
          driver_id: driverId,
          producer_id: profile.id,
          amount,
          notes: notes || null,
          status: 'proposed',
          proposed_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('[useProducerPayments] Error creating payment:', insertError);
        toast.error('Erro ao criar solicitação de pagamento', {
          description: insertError.message
        });
        return false;
      }

      toast.success('Solicitação de pagamento criada!', {
        description: 'O motorista será notificado.'
      });

      await fetchPayments();
      return true;
    } catch (err: any) {
      console.error('[useProducerPayments] Unexpected error creating payment:', err);
      toast.error('Erro ao criar solicitação de pagamento');
      return false;
    }
  }, [profile?.id, fetchPayments]);

  // Estatísticas derivadas
  const pendingCount = payments.filter(p => p.status === 'proposed').length;
  const awaitingConfirmationCount = payments.filter(p => p.status === 'paid_by_producer').length;
  const completedCount = payments.filter(p => p.status === 'confirmed').length;
  const totalPending = payments
    .filter(p => p.status === 'proposed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Fetch inicial
  useEffect(() => {
    if (profile?.id && profile.role === 'PRODUTOR') {
      fetchPayments();
    }
  }, [profile?.id, profile?.role, fetchPayments]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.id || profile.role !== 'PRODUTOR') return;

    const channel = supabase
      .channel('producer-payments-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'external_payments',
        filter: `producer_id=eq.${profile.id}`
      }, (payload) => {
        console.log('[useProducerPayments] Realtime update:', payload.eventType);
        fetchPayments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, profile?.role, fetchPayments]);

  return {
    payments,
    loading,
    error,
    refetch: fetchPayments,
    confirmPaymentMade,
    createPaymentRequest,
    pendingCount,
    awaitingConfirmationCount,
    completedCount,
    totalPending,
  };
};
