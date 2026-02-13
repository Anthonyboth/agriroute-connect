import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type DocumentType = 'nfe' | 'cte' | 'mdfe' | 'nfse';

export interface DocumentCredit {
  id: string;
  chargeId: string;
  issuerId: string;
  documentType: DocumentType;
  amountCentavos: number;
  status: 'available' | 'in_use' | 'consumed' | 'expired';
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
  expiresAt: Date;
  lastAttemptAt?: Date;
  consumedAt?: Date;
  emissionId?: string;
}

interface CreditCheckResult {
  hasCredit: boolean;
  credit?: DocumentCredit;
  reason?: string;
}

interface UseDocumentCreditsReturn {
  loading: boolean;
  error: string | null;
  checkAvailableCredit: (issuerId: string, documentType: DocumentType) => Promise<CreditCheckResult>;
  reserveCredit: (creditId: string) => Promise<boolean>;
  consumeCredit: (creditId: string, emissionId: string) => Promise<boolean>;
  releaseCredit: (creditId: string, reason: string) => Promise<boolean>;
  getCreditsHistory: (issuerId: string) => Promise<DocumentCredit[]>;
}

// Configurações anti-fraude
const ANTI_FRAUD_CONFIG = {
  MAX_ATTEMPTS_PER_CREDIT: 5,      // Máximo de tentativas por crédito
  CREDIT_EXPIRY_HOURS: 48,          // Crédito expira em 48 horas
  MIN_INTERVAL_SECONDS: 30,         // Intervalo mínimo entre tentativas (30s)
  MAX_CREDITS_PER_DAY: 20,          // Máximo de créditos por dia por emissor
  SUSPICIOUS_ATTEMPT_THRESHOLD: 3,  // Tentativas rápidas = suspeito
};

export function useFiscalDocumentCredits(): UseDocumentCreditsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Verifica se existe crédito disponível para emissão
   */
  const checkAvailableCredit = useCallback(async (
    issuerId: string, 
    documentType: DocumentType
  ): Promise<CreditCheckResult> => {
    setLoading(true);
    setError(null);

    try {
      if (import.meta.env.DEV) console.log('[Credits] Verificando créditos disponíveis:', { issuerId, documentType });

      // Buscar transações PIX pagas para este emissor/documento
      const { data: transactions, error: txError } = await supabase
        .from('fiscal_wallet_transactions')
        .select('id, amount, metadata, created_at')
        .eq('reference_type', 'pix_payment')
        .eq('transaction_type', 'pix_paid')
        .order('created_at', { ascending: false })
        .limit(50);

      if (txError) {
        console.error('[Credits] Erro ao buscar transações:', txError);
        throw new Error('Falha ao verificar créditos disponíveis');
      }

      if (!transactions || transactions.length === 0) {
        return { hasCredit: false, reason: 'Nenhum pagamento encontrado' };
      }

      // Filtrar créditos válidos
      const now = new Date();
      const expiryThreshold = new Date(now.getTime() - ANTI_FRAUD_CONFIG.CREDIT_EXPIRY_HOURS * 60 * 60 * 1000);

      for (const tx of transactions) {
        const meta = tx.metadata as Record<string, any> || {};
        
        // Verificar se é para o emissor e tipo de documento corretos
        if (meta.issuer_id !== issuerId || meta.document_type !== documentType) {
          continue;
        }

        // Verificar se já foi consumido (emissão bem-sucedida)
        if (meta.consumed_at || meta.emission_id) {
          continue;
        }

        // Verificar expiração
        const createdAt = new Date(tx.created_at);
        if (createdAt < expiryThreshold) {
          if (import.meta.env.DEV) console.log('[Credits] Crédito expirado:', tx.id);
          continue;
        }

        // Verificar limite de tentativas
        const attempts = meta.attempts || 0;
        if (attempts >= ANTI_FRAUD_CONFIG.MAX_ATTEMPTS_PER_CREDIT) {
          if (import.meta.env.DEV) console.log('[Credits] Crédito esgotou tentativas:', tx.id, attempts);
          continue;
        }

        // Verificar intervalo mínimo entre tentativas (anti-spam)
        const lastAttemptAt = meta.last_attempt_at ? new Date(meta.last_attempt_at) : null;
        if (lastAttemptAt) {
          const secondsSinceLastAttempt = (now.getTime() - lastAttemptAt.getTime()) / 1000;
          if (secondsSinceLastAttempt < ANTI_FRAUD_CONFIG.MIN_INTERVAL_SECONDS) {
            if (import.meta.env.DEV) console.log('[Credits] Intervalo muito curto:', secondsSinceLastAttempt, 's');
            return { 
              hasCredit: false, 
              reason: `Aguarde ${Math.ceil(ANTI_FRAUD_CONFIG.MIN_INTERVAL_SECONDS - secondsSinceLastAttempt)}s antes de tentar novamente` 
            };
          }
        }

        // Verificar se está em uso (outra aba/dispositivo)
        if (meta.in_use && meta.in_use_since) {
          const inUseSince = new Date(meta.in_use_since);
          const inUseMinutes = (now.getTime() - inUseSince.getTime()) / 1000 / 60;
          // Se está em uso há mais de 5 minutos, liberar automaticamente
          if (inUseMinutes < 5) {
            console.log('[Credits] Crédito em uso por outra sessão:', tx.id);
            continue;
          }
        }

        // Crédito válido encontrado!
        const credit: DocumentCredit = {
          id: tx.id,
          chargeId: meta.charge_id || '',
          issuerId: meta.issuer_id,
          documentType: meta.document_type,
          amountCentavos: Math.abs(tx.amount * 100),
          status: 'available',
          attempts: attempts,
          maxAttempts: ANTI_FRAUD_CONFIG.MAX_ATTEMPTS_PER_CREDIT,
          createdAt: createdAt,
          expiresAt: new Date(createdAt.getTime() + ANTI_FRAUD_CONFIG.CREDIT_EXPIRY_HOURS * 60 * 60 * 1000),
          lastAttemptAt: lastAttemptAt || undefined,
        };

        console.log('[Credits] ✅ Crédito disponível encontrado:', credit);
        return { hasCredit: true, credit };
      }

      return { hasCredit: false, reason: 'Nenhum crédito disponível para este documento' };
    } catch (err: any) {
      console.error('[Credits] Erro:', err);
      setError(err.message);
      return { hasCredit: false, reason: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Reserva um crédito para uso (marca como "em uso")
   */
  const reserveCredit = useCallback(async (creditId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      console.log('[Credits] Reservando crédito:', creditId);

      // Buscar transação atual
      const { data: tx, error: fetchError } = await supabase
        .from('fiscal_wallet_transactions')
        .select('metadata')
        .eq('id', creditId)
        .single();

      if (fetchError || !tx) {
        throw new Error('Crédito não encontrado');
      }

      const currentMeta = tx.metadata as Record<string, any> || {};
      const newAttempts = (currentMeta.attempts || 0) + 1;

      // Verificar anti-fraude: muitas tentativas rápidas
      if (currentMeta.last_attempt_at) {
        const lastAttempt = new Date(currentMeta.last_attempt_at);
        const secondsSince = (Date.now() - lastAttempt.getTime()) / 1000;
        if (secondsSince < ANTI_FRAUD_CONFIG.MIN_INTERVAL_SECONDS) {
          throw new Error('Muitas tentativas em sequência. Aguarde alguns segundos.');
        }
      }

      // Atualizar metadata
      const updatedMeta = {
        ...currentMeta,
        in_use: true,
        in_use_since: new Date().toISOString(),
        attempts: newAttempts,
        last_attempt_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from('fiscal_wallet_transactions')
        .update({ metadata: updatedMeta })
        .eq('id', creditId);

      if (updateError) {
        throw new Error('Falha ao reservar crédito');
      }

      console.log('[Credits] ✅ Crédito reservado. Tentativa:', newAttempts);
      return true;
    } catch (err: any) {
      console.error('[Credits] Erro ao reservar:', err);
      setError(err.message);
      toast.error(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Consome um crédito após emissão bem-sucedida
   */
  const consumeCredit = useCallback(async (creditId: string, emissionId: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      console.log('[Credits] Consumindo crédito:', { creditId, emissionId });

      // Buscar transação atual
      const { data: tx, error: fetchError } = await supabase
        .from('fiscal_wallet_transactions')
        .select('metadata')
        .eq('id', creditId)
        .single();

      if (fetchError || !tx) {
        throw new Error('Crédito não encontrado');
      }

      const currentMeta = tx.metadata as Record<string, any> || {};

      // Atualizar como consumido
      const updatedMeta = {
        ...currentMeta,
        in_use: false,
        consumed_at: new Date().toISOString(),
        emission_id: emissionId,
        used_for_emission: true,
      };

      const { error: updateError } = await supabase
        .from('fiscal_wallet_transactions')
        .update({ metadata: updatedMeta })
        .eq('id', creditId);

      if (updateError) {
        throw new Error('Falha ao marcar crédito como consumido');
      }

      console.log('[Credits] ✅ Crédito consumido com sucesso');
      return true;
    } catch (err: any) {
      console.error('[Credits] Erro ao consumir:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Libera um crédito após falha na emissão (permite nova tentativa)
   */
  const releaseCredit = useCallback(async (creditId: string, reason: string): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      console.log('[Credits] Liberando crédito:', { creditId, reason });

      // Buscar transação atual
      const { data: tx, error: fetchError } = await supabase
        .from('fiscal_wallet_transactions')
        .select('metadata')
        .eq('id', creditId)
        .single();

      if (fetchError || !tx) {
        throw new Error('Crédito não encontrado');
      }

      const currentMeta = tx.metadata as Record<string, any> || {};
      const attempts = currentMeta.attempts || 1;

      // Registrar falha
      const failHistory = currentMeta.fail_history || [];
      failHistory.push({
        at: new Date().toISOString(),
        reason: reason.substring(0, 200), // Limitar tamanho
        attempt: attempts,
      });

      // Atualizar metadata
      const updatedMeta = {
        ...currentMeta,
        in_use: false,
        fail_history: failHistory,
        last_fail_reason: reason.substring(0, 200),
      };

      const { error: updateError } = await supabase
        .from('fiscal_wallet_transactions')
        .update({ metadata: updatedMeta })
        .eq('id', creditId);

      if (updateError) {
        throw new Error('Falha ao liberar crédito');
      }

      const remainingAttempts = ANTI_FRAUD_CONFIG.MAX_ATTEMPTS_PER_CREDIT - attempts;
      if (remainingAttempts > 0) {
        console.log('[Credits] ✅ Crédito liberado. Tentativas restantes:', remainingAttempts);
        toast.info(`Falha na emissão. Você tem ${remainingAttempts} tentativa(s) restante(s) com este pagamento.`);
      } else {
        console.log('[Credits] ⚠️ Crédito esgotado após múltiplas falhas');
        toast.warning('Este pagamento atingiu o limite de tentativas. Um novo pagamento será necessário.');
      }

      return true;
    } catch (err: any) {
      console.error('[Credits] Erro ao liberar:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Obtém histórico de créditos de um emissor
   */
  const getCreditsHistory = useCallback(async (issuerId: string): Promise<DocumentCredit[]> => {
    setLoading(true);
    setError(null);

    try {
      const { data: transactions, error: txError } = await supabase
        .from('fiscal_wallet_transactions')
        .select('id, amount, metadata, created_at')
        .eq('reference_type', 'pix_payment')
        .eq('transaction_type', 'pix_paid')
        .order('created_at', { ascending: false })
        .limit(100);

      if (txError) {
        throw new Error('Falha ao buscar histórico');
      }

      const credits: DocumentCredit[] = [];
      const now = new Date();
      const expiryThreshold = new Date(now.getTime() - ANTI_FRAUD_CONFIG.CREDIT_EXPIRY_HOURS * 60 * 60 * 1000);

      for (const tx of transactions || []) {
        const meta = tx.metadata as Record<string, any> || {};
        
        if (meta.issuer_id !== issuerId) continue;

        const createdAt = new Date(tx.created_at);
        let status: DocumentCredit['status'] = 'available';

        if (meta.consumed_at || meta.emission_id) {
          status = 'consumed';
        } else if (createdAt < expiryThreshold) {
          status = 'expired';
        } else if (meta.in_use) {
          status = 'in_use';
        } else if ((meta.attempts || 0) >= ANTI_FRAUD_CONFIG.MAX_ATTEMPTS_PER_CREDIT) {
          status = 'expired'; // Esgotou tentativas
        }

        credits.push({
          id: tx.id,
          chargeId: meta.charge_id || '',
          issuerId: meta.issuer_id,
          documentType: meta.document_type,
          amountCentavos: Math.abs(tx.amount * 100),
          status,
          attempts: meta.attempts || 0,
          maxAttempts: ANTI_FRAUD_CONFIG.MAX_ATTEMPTS_PER_CREDIT,
          createdAt,
          expiresAt: new Date(createdAt.getTime() + ANTI_FRAUD_CONFIG.CREDIT_EXPIRY_HOURS * 60 * 60 * 1000),
          lastAttemptAt: meta.last_attempt_at ? new Date(meta.last_attempt_at) : undefined,
          consumedAt: meta.consumed_at ? new Date(meta.consumed_at) : undefined,
          emissionId: meta.emission_id,
        });
      }

      return credits;
    } catch (err: any) {
      console.error('[Credits] Erro ao buscar histórico:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    loading,
    error,
    checkAvailableCredit,
    reserveCredit,
    consumeCredit,
    releaseCredit,
    getCreditsHistory,
  };
}
