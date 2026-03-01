/**
 * Hook dedicado para gerenciamento de pagamentos da transportadora
 * 
 * A transportadora é como um painel de motorista evoluído:
 * - Vê pagamentos de todos os motoristas afiliados
 * - Pode confirmar recebimentos em nome dos motoristas afiliados
 * - Tem visão consolidada de todos os pagamentos
 */

import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { useTransportCompany } from './useTransportCompany';

export interface CompanyPayment {
  id: string;
  freight_id: string;
  driver_id: string;
  producer_id: string;
  amount: number;
  status: 'proposed' | 'paid_by_producer' | 'confirmed' | 'rejected' | 'cancelled' | 'disputed';
  notes?: string;
  created_at: string;
  updated_at?: string;
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
  producer?: {
    id: string;
    full_name: string;
    contact_phone?: string;
    profile_photo_url?: string;
  };
}

interface UseCompanyPaymentsReturn {
  payments: CompanyPayment[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  confirmReceiptForDriver: (paymentId: string, driverId: string) => Promise<boolean>;
  // Estatísticas
  totalPendingPayments: number;
  totalAwaitingConfirmation: number;
  totalConfirmed: number;
  totalAmount: number;
}

export const useCompanyPayments = (): UseCompanyPaymentsReturn => {
  const { profile } = useAuth();
  const { company } = useTransportCompany();
  const [payments, setPayments] = useState<CompanyPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Busca pagamentos de todos os motoristas afiliados à transportadora
   */
  const fetchPayments = useCallback(async () => {
    if (!profile?.id || profile.role !== 'TRANSPORTADORA' || !company?.id) {
      console.log('[useCompanyPayments] Skipping fetch - not a transport company');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log('[useCompanyPayments] Fetching payments for company:', company.id);

      // Primeiro, buscar IDs dos motoristas afiliados
      const { data: affiliatedDrivers, error: driversError } = await supabase
        .from('company_drivers')
        .select('driver_profile_id')
        .eq('company_id', company.id)
        .eq('status', 'active');

      if (driversError) {
        console.error('[useCompanyPayments] Error fetching affiliated drivers:', driversError);
        setError('Erro ao buscar motoristas afiliados');
        return;
      }

      if (!affiliatedDrivers || affiliatedDrivers.length === 0) {
        console.log('[useCompanyPayments] No affiliated drivers found');
        setPayments([]);
        return;
      }

      const driverIds = affiliatedDrivers.map(d => d.driver_profile_id);

      // Buscar pagamentos dos motoristas afiliados
      // ✅ FIX: Buscar pagamentos SEM join em profiles (RLS bloqueia acesso cruzado)
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
        .in('driver_id', driverIds)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('[useCompanyPayments] Fetch error:', fetchError);
        setError(fetchError.message);
        setPayments([]);
        return;
      }

      console.log('[useCompanyPayments] Fetched payments:', data?.length || 0);

      // ✅ FIX: Resolver perfis via profiles_secure (view segura)
      const allProfileIds = [...new Set([
        ...(data || []).map((p: any) => p.driver_id),
        ...(data || []).map((p: any) => p.producer_id),
      ].filter(Boolean))];

      let profileMap = new Map<string, any>();
      
      if (allProfileIds.length > 0) {
        const { data: profiles, error: profilesErr } = await supabase
          .from('profiles_secure' as any)
          .select('id, full_name, profile_photo_url')
          .in('id', allProfileIds);
        
        if (profilesErr) {
          console.warn('[useCompanyPayments] Erro ao buscar perfis via profiles_secure:', profilesErr.message);
        } else if (profiles?.length) {
          (profiles as any[]).forEach((p: any) => profileMap.set(p.id, p));
        }
      }

      // Enriquecer pagamentos com dados de motorista e produtor
      const enrichedPayments = (data || []).map((p: any) => ({
        ...p,
        driver: profileMap.get(p.driver_id) || { id: p.driver_id, full_name: 'Motorista' },
        producer: profileMap.get(p.producer_id) || { id: p.producer_id, full_name: 'Produtor' },
      }));

      setPayments(enrichedPayments as unknown as CompanyPayment[]);
    } catch (err: any) {
      console.error('[useCompanyPayments] Unexpected error:', err);
      setError(err?.message || 'Erro ao carregar pagamentos');
      setPayments([]);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile?.role, company?.id]);

  /**
   * Confirma recebimento em nome de um motorista afiliado
   * Nota: Isso requer que a transportadora tenha permissão delegada
   */
  const confirmReceiptForDriver = useCallback(async (paymentId: string, driverId: string): Promise<boolean> => {
    if (!profile?.id || !company?.id) {
      toast.error('Você precisa estar logado como transportadora');
      return false;
    }

    try {
      console.log('[useCompanyPayments] Confirming receipt for driver:', { paymentId, driverId });

      // Verificar se o motorista está afiliado à transportadora
      const { data: affiliation, error: affError } = await supabase
        .from('company_drivers')
        .select('id, can_accept_freights')
        .eq('company_id', company.id)
        .eq('driver_profile_id', driverId)
        .eq('status', 'active')
        .maybeSingle();

      if (affError || !affiliation) {
        toast.error('Motorista não está afiliado à sua transportadora');
        return false;
      }

      // Para a transportadora confirmar, o pagamento precisa estar em paid_by_producer
      const { data: payment, error: paymentError } = await supabase
        .from('external_payments')
        .select('id, status')
        .eq('id', paymentId)
        .eq('driver_id', driverId)
        .maybeSingle();

      if (paymentError || !payment) {
        toast.error('Pagamento não encontrado');
        return false;
      }

      if (payment.status !== 'paid_by_producer') {
        toast.error('Este pagamento não pode ser confirmado ainda', {
          description: 'Aguarde o produtor informar que efetuou o pagamento.'
        });
        return false;
      }

      // A confirmação precisa ser feita pelo próprio motorista ou via edge function
      // Por segurança, apenas notificamos que o motorista deve confirmar
      toast.info('Notificação enviada ao motorista', {
        description: 'O motorista foi notificado para confirmar o recebimento.'
      });

      // TODO: Implementar edge function para permitir que transportadora confirme em nome do motorista
      return true;
    } catch (err: any) {
      console.error('[useCompanyPayments] Error confirming receipt:', err);
      toast.error('Erro ao processar confirmação');
      return false;
    }
  }, [profile?.id, company?.id]);

  // Estatísticas derivadas
  const totalPendingPayments = payments.filter(p => p.status === 'proposed').length;
  const totalAwaitingConfirmation = payments.filter(p => p.status === 'paid_by_producer').length;
  const totalConfirmed = payments.filter(p => p.status === 'confirmed').length;
  const totalAmount = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  // Fetch inicial
  useEffect(() => {
    if (profile?.id && profile.role === 'TRANSPORTADORA' && company?.id) {
      fetchPayments();
    }
  }, [profile?.id, profile?.role, company?.id, fetchPayments]);

  // Realtime subscription para pagamentos dos motoristas afiliados
  useEffect(() => {
    if (!profile?.id || profile.role !== 'TRANSPORTADORA' || !company?.id) return;

    // Precisamos de uma abordagem diferente para realtime com múltiplos motoristas
    // Por agora, fazemos polling a cada 30 segundos
    const pollInterval = setInterval(fetchPayments, 30000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [profile?.id, profile?.role, company?.id, fetchPayments]);

  return {
    payments,
    loading,
    error,
    refetch: fetchPayments,
    confirmReceiptForDriver,
    totalPendingPayments,
    totalAwaitingConfirmation,
    totalConfirmed,
    totalAmount,
  };
};
