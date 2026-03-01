/**
 * Hook dedicado para gerenciamento de pagamentos do produtor
 */

import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { sendPushNotification } from '@/utils/pushNotificationService';
import { devLog } from '@/lib/devLogger';

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
    pricing_type?: string;
    price_per_km?: number;
    
    required_trucks?: number;
    weight?: number;
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

  const fetchPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== 'PRODUTOR') {
      devLog('[useProducerPayments] Skipping fetch - not a producer');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      devLog('[useProducerPayments] Fetching payments for producer:', profile.id);
      const { data, error: fetchError } = await supabase
        .from('external_payments')
        .select(`*, freight:freights!external_payments_freight_id_fkey(id, cargo_type, origin_city, origin_state, destination_city, destination_state, pickup_date, status, price, pricing_type, price_per_km, required_trucks, weight, distance_km)`)
        .eq('producer_id', profile.id)
        .not('status', 'in', '("cancelled")')
        .order('created_at', { ascending: false });
      if (fetchError) {
        console.error('[useProducerPayments] Fetch error:', { code: fetchError.code, message: fetchError.message, details: fetchError.details });
        setError(fetchError.message);
        setPayments([]);
        return;
      }
      devLog('[useProducerPayments] Fetched payments:', data?.length || 0);
      const activePayments = (data || []).filter((p: any) => {
        const freightStatus = p.freight?.status;
        if (freightStatus === 'CANCELLED') {
          devLog('[useProducerPayments] Filtrado pagamento de frete cancelado:', p.id);
          return false;
        }
        return true;
      });
      const driverIds = [...new Set(activePayments.map((p: any) => p.driver_id).filter(Boolean))];
      let driverMap = new Map<string, any>();
      if (driverIds.length > 0) {
        const { data: drivers, error: driversErr } = await supabase
          .from('profiles_secure' as any).select('id, full_name, profile_photo_url').in('id', driverIds);
        if (driversErr) {
          console.warn('[useProducerPayments] Erro ao buscar perfis via profiles_secure:', driversErr.message);
        } else if (drivers?.length) {
          (drivers as any[]).forEach((d: any) => driverMap.set(d.id, d));
        }
      }
      const enrichedPayments = activePayments.map((p: any) => ({
        ...p, driver: driverMap.get(p.driver_id) || { id: p.driver_id, full_name: 'Motorista' },
      }));
      setPayments(enrichedPayments as unknown as ProducerPayment[]);
    } catch (err: any) {
      console.error('[useProducerPayments] Unexpected error:', err);
      setError(err?.message || 'Erro ao carregar pagamentos');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role]);

  const confirmPaymentMade = useCallback(async (paymentId: string): Promise<boolean> => {
    if (!profile?.id) { toast.error('Você precisa estar logado'); return false; }
    try {
      devLog('[useProducerPayments] Confirming payment made:', paymentId);
      const { data: paymentData } = await supabase
        .from('external_payments')
        .select(`id, driver_id, amount, freight_id, freight:freights!external_payments_freight_id_fkey(origin_city, destination_city, cargo_type)`)
        .eq('id', paymentId).eq('producer_id', profile.id).eq('status', 'proposed').maybeSingle();
      if (!paymentData) {
        console.error('[useProducerPayments] Payment not found or not in proposed status');
        toast.error('Pagamento não encontrado ou já foi confirmado.');
        return false;
      }
      const { data: updatedRows, error: updateError } = await supabase
        .from('external_payments')
        .update({ status: 'paid_by_producer', updated_at: new Date().toISOString() })
        .eq('id', paymentId).eq('producer_id', profile.id).eq('status', 'proposed').select('id');
      if (updateError) {
        console.error('[useProducerPayments] Error confirming payment:', updateError);
        toast.error('Erro ao confirmar pagamento', { description: updateError.message });
        return false;
      }
      if (!updatedRows || updatedRows.length === 0) {
        console.error('[useProducerPayments] Update affected 0 rows - RLS or status mismatch');
        toast.error('Não foi possível atualizar o pagamento.', { description: 'Verifique se o pagamento ainda está pendente.' });
        return false;
      }
      devLog('[useProducerPayments] ✅ Payment updated successfully:', updatedRows);
      toast.success('Pagamento confirmado!', { description: 'O motorista será notificado para confirmar o recebimento.' });
      // ✅ Notificação do motorista é feita pelo trigger notify_external_payment() no banco
      // NÃO inserir notificação manual aqui para evitar duplicação
      // Apenas enviar push notification (que é separado do banco)
      if (paymentData.driver_id) {
        const freight = paymentData.freight as any;
        const routeInfo = freight?.origin_city && freight?.destination_city ? `${freight.origin_city} → ${freight.destination_city}` : 'Frete';
        sendPushNotification({
          userIds: [paymentData.driver_id],
          title: '💰 Pagamento Confirmado pelo Produtor',
          message: `${routeInfo}. Confirme o recebimento no app.`,
          type: 'payment_confirmed_by_producer',
          data: { payment_id: paymentId, freight_id: paymentData.freight_id },
          url: '/dashboard?tab=payments', requireInteraction: true,
        }).catch(err => console.error('[useProducerPayments] Push notification error:', err));
      }
      await fetchPayments();
      return true;
    } catch (err: any) {
      console.error('[useProducerPayments] Unexpected error confirming payment:', err);
      toast.error('Erro ao confirmar pagamento');
      return false;
    }
  }, [profile?.id, fetchPayments]);

  const createPaymentRequest = useCallback(async (freightId: string, driverId: string, amount: number, notes?: string): Promise<boolean> => {
    if (!profile?.id) { toast.error('Você precisa estar logado'); return false; }
    try {
      devLog('[useProducerPayments] Creating payment request:', { freightId, driverId, amount });
      const { error: insertError } = await supabase
        .from('external_payments')
        .insert({ freight_id: freightId, driver_id: driverId, producer_id: profile.id, amount, notes: notes || null, status: 'proposed', proposed_at: new Date().toISOString() });
      if (insertError) {
        console.error('[useProducerPayments] Error creating payment:', insertError);
        toast.error('Erro ao criar solicitação de pagamento', { description: insertError.message });
        return false;
      }
      toast.success('Solicitação de pagamento criada!', { description: 'O motorista será notificado.' });
      await fetchPayments();
      return true;
    } catch (err: any) {
      console.error('[useProducerPayments] Unexpected error creating payment:', err);
      toast.error('Erro ao criar solicitação de pagamento');
      return false;
    }
  }, [profile?.id, fetchPayments]);

  const pendingCount = payments.filter(p => p.status === 'proposed').length;
  const awaitingConfirmationCount = payments.filter(p => p.status === 'paid_by_producer').length;
  const completedCount = payments.filter(p => p.status === 'confirmed').length;
  // ✅ HARDENING v9: Usar freight.price (total) para resumo do produtor, NUNCA payment.amount nem unit rate
  const totalPending = payments.filter(p => p.status === 'proposed').reduce((sum, p) => {
    const total = p.freight?.price;
    return sum + (typeof total === 'number' && Number.isFinite(total) && total > 0 ? total : 0);
  }, 0);

  useEffect(() => {
    if (profile?.id && profile.role === 'PRODUTOR') fetchPayments();
  }, [profile?.id, profile?.role, fetchPayments]);

  useEffect(() => {
    if (!profile?.id || profile.role !== 'PRODUTOR') return;
    const channel = supabase
      .channel('producer-payments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'external_payments', filter: `producer_id=eq.${profile.id}` },
        (payload) => { devLog('[useProducerPayments] Realtime update:', payload.eventType); fetchPayments(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, profile?.role, fetchPayments]);

  return { payments, loading, error, refetch: fetchPayments, confirmPaymentMade, createPaymentRequest, pendingCount, awaitingConfirmationCount, completedCount, totalPending };
};
