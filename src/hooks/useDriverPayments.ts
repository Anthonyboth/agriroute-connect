/**
 * Hook dedicado para gerenciamento de pagamentos do motorista
 * 
 * Responsabilidades:
 * - Buscar pagamentos pendentes para o motorista
 * - Confirmar recebimento de pagamento
 * - Contestar pagamento
 * - Gerenciar estado de loading e erros
 */

import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

export interface DriverPayment {
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
  producer?: {
    id: string;
    full_name: string;
    contact_phone?: string;
    profile_photo_url?: string;
  };
}

interface UseDriverPaymentsReturn {
  payments: DriverPayment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  confirmReceipt: (paymentId: string) => Promise<boolean>;
  disputePayment: (paymentId: string, reason: string) => Promise<boolean>;
  // Estatísticas
  pendingPaymentsCount: number;
  awaitingReceiptCount: number;
  confirmedCount: number;
  totalPendingAmount: number;
}

export const useDriverPayments = (): UseDriverPaymentsReturn => {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<DriverPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Busca todos os pagamentos para o motorista
   */
  const fetchPayments = useCallback(async () => {
    if (!profile?.id) {
      console.log('[useDriverPayments] Skipping fetch - no profile');
      return;
    }

    // Aceitar MOTORISTA e MOTORISTA_AFILIADO
    if (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO') {
      console.log('[useDriverPayments] Skipping fetch - not a driver');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[useDriverPayments] Fetching payments for driver:', profile.id);

      // ✅ FIX: Buscar pagamentos SEM join em profiles (RLS pode bloquear motorista de ver perfil do produtor)
      // Resolver perfis via profiles_secure em etapa separada
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
            pricing_type,
            price_per_km,
            required_trucks,
            weight,
            distance_km
          )
        `)
        .eq('driver_id', profile.id)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useDriverPayments] Fetch error:', {
          code: fetchError.code,
          message: fetchError.message,
          details: fetchError.details,
        });
        setError(fetchError.message);
        setPayments([]);
        return;
      }

      console.log('[useDriverPayments] Fetched payments:', data?.length || 0);

      // ✅ FIX: Resolver perfis de produtores via profiles_secure (view segura)
      const producerIds = [...new Set((data || []).map((p: any) => p.producer_id).filter(Boolean))];
      let producerMap = new Map<string, any>();
      
      if (producerIds.length > 0) {
        const { data: producers, error: producersErr } = await supabase
          .from('profiles_secure' as any)
          .select('id, full_name, profile_photo_url')
          .in('id', producerIds);
        
        if (producersErr) {
          console.warn('[useDriverPayments] Erro ao buscar perfis via profiles_secure:', producersErr.message);
        } else if (producers?.length) {
          (producers as any[]).forEach((p: any) => producerMap.set(p.id, p));
        }
      }

      // Enriquecer pagamentos com dados do produtor
      const enrichedPayments = (data || []).map((p: any) => ({
        ...p,
        producer: producerMap.get(p.producer_id) || { id: p.producer_id, full_name: 'Produtor' },
      }));

      setPayments(enrichedPayments as unknown as DriverPayment[]);
    } catch (err: any) {
      console.error('[useDriverPayments] Unexpected error:', err);
      setError(err?.message || 'Erro ao carregar pagamentos');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role]);

  /**
   * Confirma o recebimento do pagamento
   */
  const confirmReceipt = useCallback(async (paymentId: string): Promise<boolean> => {
    if (!profile?.id) {
      toast.error('Você precisa estar logado');
      return false;
    }

    try {
      console.log('[useDriverPayments] Confirming receipt:', paymentId);

      // Verificar se o pagamento está no status correto
      const { data: existingPayment, error: checkError } = await supabase
        .from('external_payments')
        .select('id, status')
        .eq('id', paymentId)
        .eq('driver_id', profile.id)
        .maybeSingle();

      if (checkError || !existingPayment) {
        toast.error('Pagamento não encontrado');
        return false;
      }

      if (existingPayment.status !== 'paid_by_producer') {
        toast.error('Este pagamento não pode ser confirmado', {
          description: 'O produtor ainda não informou que efetuou o pagamento.'
        });
        return false;
      }

      const { error: updateError } = await supabase
        .from('external_payments')
        .update({
          status: 'confirmed',
          accepted_by_driver: true,
          accepted_at: new Date().toISOString(),
          confirmed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .eq('driver_id', profile.id);

      if (updateError) {
        console.error('[useDriverPayments] Error confirming receipt:', updateError);
        toast.error('Erro ao confirmar recebimento', {
          description: updateError.message
        });
        return false;
      }

      toast.success('Recebimento confirmado!', {
        description: 'O pagamento foi finalizado com sucesso.'
      });

      await fetchPayments();
      return true;
    } catch (err: any) {
      console.error('[useDriverPayments] Unexpected error confirming receipt:', err);
      toast.error('Erro ao confirmar recebimento');
      return false;
    }
  }, [profile?.id, fetchPayments]);

  /**
   * Contesta o pagamento
   */
  const disputePayment = useCallback(async (paymentId: string, reason: string): Promise<boolean> => {
    if (!profile?.id) {
      toast.error('Você precisa estar logado');
      return false;
    }

    try {
      console.log('[useDriverPayments] Disputing payment:', paymentId);

      const { error: updateError } = await supabase
        .from('external_payments')
        .update({
          status: 'disputed',
          notes: reason,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        .eq('driver_id', profile.id);

      if (updateError) {
        console.error('[useDriverPayments] Error disputing payment:', updateError);
        toast.error('Erro ao contestar pagamento', {
          description: updateError.message
        });
        return false;
      }

      toast.warning('Pagamento contestado', {
        description: 'O produtor será notificado.'
      });

      await fetchPayments();
      return true;
    } catch (err: any) {
      console.error('[useDriverPayments] Unexpected error disputing payment:', err);
      toast.error('Erro ao contestar pagamento');
      return false;
    }
  }, [profile?.id, fetchPayments]);

  // Estatísticas derivadas
  const pendingPaymentsCount = payments.filter(p => p.status === 'proposed').length;
  const awaitingReceiptCount = payments.filter(p => p.status === 'paid_by_producer').length;
  const confirmedCount = payments.filter(p => p.status === 'confirmed').length;
  const totalPendingAmount = payments
    .filter(p => p.status === 'paid_by_producer')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Fetch inicial
  useEffect(() => {
    if (profile?.id && (profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO')) {
      fetchPayments();
    }
  }, [profile?.id, profile?.role, fetchPayments]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.id) return;
    if (profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO') return;

    const channel = supabase
      .channel('driver-payments-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'external_payments',
        filter: `driver_id=eq.${profile.id}`
      }, (payload) => {
        console.log('[useDriverPayments] Realtime update:', payload.eventType);
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
    confirmReceipt,
    disputePayment,
    pendingPaymentsCount,
    awaitingReceiptCount,
    confirmedCount,
    totalPendingAmount,
  };
};
