/**
 * Hook para buscar dados do Comprovante Operacional Financeiro Automático (COFA)
 * Liga evento operacional ao evento financeiro de forma auditável.
 */
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ReceiptOperationalEvent {
  label: string;
  timestamp: string | null;
  responsible: string | null;
  status: 'completed' | 'pending' | 'skipped';
}

export interface FreightReceiptData {
  freight: {
    id: string;
    short_id: string;
    cargo_type: string;
    origin_city: string;
    origin_state: string;
    destination_city: string;
    destination_state: string;
    producer_name: string | null;
    driver_name: string | null;
    company_name: string | null;
    status: string;
    created_at: string;
  };
  financial: {
    gross_amount: number;
    platform_fee: number;
    advance_deduction: number;
    credit_deduction: number;
    net_amount: number;
    payment_order_id: string | null;
    status_financial: string;
  };
  events: ReceiptOperationalEvent[];
}

export const useFreightReceipt = () => {
  const [loading, setLoading] = useState(false);
  const [receipt, setReceipt] = useState<FreightReceiptData | null>(null);

  const fetchReceipt = useCallback(async (freightId: string) => {
    setLoading(true);
    try {
      // Fetch freight + participants
      const { data: freight, error: freightErr } = await supabase
        .from('freights')
        .select(`
          id, cargo_type, status, created_at,
          origin_city, origin_state, destination_city, destination_state,
          producer:profiles!freights_producer_id_fkey(full_name),
          driver:profiles!freights_driver_id_fkey(full_name)
        `)
        .eq('id', freightId)
        .maybeSingle();

      if (freightErr || !freight) throw new Error('Frete não encontrado');

      // Fetch payment order for this freight
      const { data: paymentOrder } = await supabase
        .from('payment_orders')
        .select('*')
        .eq('freight_id', freightId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch status history for operational events
      const { data: statusHistory } = await supabase
        .from('freight_status_history')
        .select(`
          status, created_at, notes,
          changed_by_profile:profiles!freight_status_history_changed_by_fkey(full_name)
        `)
        .eq('freight_id', freightId)
        .order('created_at', { ascending: true });

      // Build operational events from status history
      const statusMap: Record<string, { label: string; order: number }> = {
        'ACCEPTED': { label: 'Frete aceito', order: 1 },
        'LOADING': { label: 'Coleta iniciada', order: 2 },
        'LOADED': { label: 'Coleta confirmada', order: 3 },
        'IN_TRANSIT': { label: 'Em trânsito', order: 4 },
        'DELIVERED_PENDING_CONFIRMATION': { label: 'Entrega confirmada', order: 5 },
        'DELIVERED': { label: 'Documento validado', order: 6 },
        'COMPLETED': { label: 'Pagamento liberado', order: 7 },
      };

      const events: ReceiptOperationalEvent[] = Object.entries(statusMap).map(([status, info]) => {
        const historyEntry = (statusHistory || []).find((h: any) => h.status === status);
        return {
          label: info.label,
          timestamp: historyEntry?.created_at || null,
          responsible: historyEntry?.changed_by_profile?.full_name || null,
          status: historyEntry ? 'completed' : 'pending',
        };
      });

      // If there's a contestation window, add it
      if (paymentOrder?.contestation_window_ends_at) {
        const windowEnded = new Date(paymentOrder.contestation_window_ends_at) <= new Date();
        events.splice(6, 0, {
          label: 'Janela de contestação encerrada',
          timestamp: windowEnded ? paymentOrder.contestation_window_ends_at : null,
          responsible: 'Sistema',
          status: windowEnded ? 'completed' : 'pending',
        });
      }

      const producerName = (freight.producer as any)?.full_name || null;
      const driverName = (freight.driver as any)?.full_name || null;

      setReceipt({
        freight: {
          id: freight.id,
          short_id: freight.id.slice(0, 8).toUpperCase(),
          cargo_type: freight.cargo_type || 'Carga geral',
          origin_city: freight.origin_city || '—',
          origin_state: freight.origin_state || '',
          destination_city: freight.destination_city || '—',
          destination_state: freight.destination_state || '',
          producer_name: producerName,
          driver_name: driverName,
          company_name: null,
          status: freight.status,
          created_at: freight.created_at,
        },
        financial: {
          gross_amount: paymentOrder?.gross_amount || 0,
          platform_fee: paymentOrder?.platform_fee_amount || 0,
          advance_deduction: paymentOrder?.advance_deduction || 0,
          credit_deduction: paymentOrder?.credit_deduction || 0,
          net_amount: paymentOrder?.net_amount || 0,
          payment_order_id: paymentOrder?.id || null,
          status_financial: paymentOrder?.status_financial || 'pending_payment',
        },
        events,
      });

      return true;
    } catch (err) {
      console.error('Fetch receipt error:', err);
      setReceipt(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { receipt, loading, fetchReceipt };
};
