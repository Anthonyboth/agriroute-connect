/**
 * useFreightHistoryPersistence.ts
 *
 * Hook de fixação do histórico de fretes.
 * Garante que ao confirmar entrega ou pagamento, um snapshot imutável
 * seja salvo nas tabelas freight_history e freight_assignment_history
 * via RPC save_freight_completion_snapshot.
 *
 * - Chamado automaticamente quando o produtor confirma a entrega (DELIVERED)
 * - Chamado automaticamente quando o produtor marca pagamento (paid_by_producer)
 * - Chamado automaticamente quando o motorista confirma recebimento (confirmed)
 *
 * O snapshot inclui todas as datas críticas da viagem e não pode ser apagado.
 */
import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface PersistenceOptions {
  freightId: string;
  /** Quem está confirmando entrega (produtor) — passa userId do produtor */
  deliveryConfirmedBy?: string;
  /** Quando o produtor marcou como pago */
  paymentConfirmedByProducerAt?: string;
  /** Quando o motorista confirmou recebimento */
  paymentConfirmedByDriverAt?: string;
}

interface PersistenceResult {
  ok: boolean;
  freight_history_id?: string;
  error?: string;
}

export function useFreightHistoryPersistence() {
  const { profile } = useAuth();
  // Rastreia quais fretes já tiveram snapshot salvo nessa sessão (evita chamadas duplicadas)
  const persistedSet = useRef<Set<string>>(new Set());

  /**
   * Persiste o snapshot do frete no histórico imutável.
   * Seguro para chamar múltiplas vezes — idempotente via ON CONFLICT DO NOTHING.
   */
  const persistFreightSnapshot = useCallback(
    async (options: PersistenceOptions): Promise<PersistenceResult> => {
      const { freightId, deliveryConfirmedBy, paymentConfirmedByProducerAt, paymentConfirmedByDriverAt } = options;

      if (!freightId) return { ok: false, error: 'freightId obrigatório' };

      try {
        const { data, error } = await supabase.rpc('save_freight_completion_snapshot', {
          p_freight_id: freightId,
          p_delivery_confirmed_by: deliveryConfirmedBy ?? null,
          p_payment_confirmed_by_producer_at: paymentConfirmedByProducerAt ?? null,
          p_payment_confirmed_by_driver_at: paymentConfirmedByDriverAt ?? null,
        });

        if (error) {
          console.error('[useFreightHistoryPersistence] Erro ao salvar snapshot:', error);
          return { ok: false, error: error.message };
        }

        const result = data as any;
        if (result?.ok) {
          persistedSet.current.add(freightId);
          if (import.meta.env.DEV) {
            console.log('[useFreightHistoryPersistence] Snapshot salvo:', result);
          }
        }

        return {
          ok: !!result?.ok,
          freight_history_id: result?.freight_history_id,
          error: result?.error,
        };
      } catch (err: any) {
        console.error('[useFreightHistoryPersistence] Exceção:', err);
        return { ok: false, error: err?.message };
      }
    },
    []
  );

  /**
   * Chamado pelo PRODUTOR ao confirmar a entrega (DELIVERED_PENDING_CONFIRMATION → DELIVERED).
   * Fixa o snapshot com a data de confirmação de entrega.
   */
  const onDeliveryConfirmedByProducer = useCallback(
    async (freightId: string) => {
      return persistFreightSnapshot({
        freightId,
        deliveryConfirmedBy: profile?.id,
        paymentConfirmedByProducerAt: undefined,
        paymentConfirmedByDriverAt: undefined,
      });
    },
    [profile?.id, persistFreightSnapshot]
  );

  /**
   * Chamado quando o PRODUTOR registra que efetuou o pagamento (paid_by_producer).
   * Fixa a data de pagamento no snapshot.
   */
  const onPaymentMarkedByProducer = useCallback(
    async (freightId: string) => {
      return persistFreightSnapshot({
        freightId,
        deliveryConfirmedBy: undefined,
        paymentConfirmedByProducerAt: new Date().toISOString(),
        paymentConfirmedByDriverAt: undefined,
      });
    },
    [persistFreightSnapshot]
  );

  /**
   * Chamado quando o MOTORISTA confirma que recebeu o pagamento (confirmed).
   * Finaliza o snapshot com a data de confirmação do motorista.
   */
  const onPaymentConfirmedByDriver = useCallback(
    async (freightId: string) => {
      return persistFreightSnapshot({
        freightId,
        deliveryConfirmedBy: undefined,
        paymentConfirmedByProducerAt: undefined,
        paymentConfirmedByDriverAt: new Date().toISOString(),
      });
    },
    [persistFreightSnapshot]
  );

  /**
   * Verifica se o frete já teve snapshot salvo nessa sessão.
   */
  const isAlreadyPersisted = useCallback(
    (freightId: string) => persistedSet.current.has(freightId),
    []
  );

  return {
    persistFreightSnapshot,
    onDeliveryConfirmedByProducer,
    onPaymentMarkedByProducer,
    onPaymentConfirmedByDriver,
    isAlreadyPersisted,
  };
}
