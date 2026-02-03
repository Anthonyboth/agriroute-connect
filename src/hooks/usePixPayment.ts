/**
 * Hook para gerenciar pagamentos PIX via Pagar.me
 * 
 * Usado para cobrar emissão de documentos fiscais (NF-e, CT-e, MDF-e, GTA)
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface PixPaymentData {
  charge_id: string;
  order_id?: string;
  qr_code: string;
  qr_code_url?: string;
  expires_at: string;
  amount_centavos: number;
  description: string;
  transaction_id?: string;
}

export interface PixPaymentStatus {
  status: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled' | 'unknown';
  charge_id: string | null;
  order_id?: string | null;
  amount_centavos: number;
  paid_at?: string | null;
  expires_at?: string | null;
  qr_code?: string | null;
  qr_code_url?: string | null;
}

export type DocumentType = 'nfe' | 'cte' | 'mdfe' | 'gta';

interface UsePixPaymentOptions {
  onPaymentConfirmed?: (chargeId: string) => void;
  onPaymentFailed?: (error: string) => void;
}

export function usePixPayment(options?: UsePixPaymentOptions) {
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState<PixPaymentData | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PixPaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  /**
   * Cria uma cobrança PIX para emissão de documento fiscal
   */
  const createPixPayment = useCallback(async (params: {
    issuer_id: string;
    document_type: DocumentType;
    document_ref: string;
    amount_centavos: number;
    description?: string;
    freight_id?: string;
  }): Promise<PixPaymentData | null> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('pagarme-create-pix', {
        body: {
          issuer_id: params.issuer_id,
          document_type: params.document_type,
          document_ref: params.document_ref,
          amount_centavos: params.amount_centavos,
          description: params.description || `Emissão de ${params.document_type.toUpperCase()}`,
          freight_id: params.freight_id,
        },
      });

      if (invokeError) {
        console.error('[usePixPayment] Erro ao criar PIX:', invokeError);
        throw new Error(invokeError.message || 'Erro ao criar cobrança PIX');
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Erro ao criar cobrança PIX');
      }

      const pixData: PixPaymentData = {
        charge_id: data.charge_id,
        order_id: data.order_id,
        qr_code: data.qr_code,
        qr_code_url: data.qr_code_url,
        expires_at: data.expires_at,
        amount_centavos: data.amount_centavos,
        description: data.description,
        transaction_id: data.transaction_id,
      };

      setPaymentData(pixData);
      return pixData;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast({
        title: 'Erro ao criar pagamento',
        description: errorMessage,
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  /**
   * Consulta o status de um pagamento PIX
   */
  const checkPaymentStatus = useCallback(async (params: {
    charge_id?: string;
    issuer_id?: string;
    document_ref?: string;
    document_type?: DocumentType;
  }): Promise<PixPaymentStatus | null> => {
    setLoading(true);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('pagarme-payment-status', {
        body: params,
      });

      if (invokeError) {
        console.error('[usePixPayment] Erro ao consultar status:', invokeError);
        throw new Error(invokeError.message || 'Erro ao consultar pagamento');
      }

      if (!data?.success) {
        throw new Error(data?.message || 'Erro ao consultar pagamento');
      }

      const status: PixPaymentStatus = {
        status: data.status,
        charge_id: data.charge_id,
        order_id: data.order_id,
        amount_centavos: data.amount_centavos,
        paid_at: data.paid_at,
        expires_at: data.expires_at,
        qr_code: data.qr_code,
        qr_code_url: data.qr_code_url,
      };

      setPaymentStatus(status);

      // Callbacks
      if (status.status === 'paid') {
        options?.onPaymentConfirmed?.(status.charge_id || '');
      } else if (status.status === 'failed' || status.status === 'canceled') {
        options?.onPaymentFailed?.(status.status);
      }

      return status;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [options]);

  /**
   * Copia o código PIX para a área de transferência
   */
  const copyPixCode = useCallback(async (code?: string) => {
    const pixCode = code || paymentData?.qr_code;
    if (!pixCode) {
      toast({
        title: 'Código PIX não disponível',
        variant: 'destructive',
      });
      return false;
    }

    try {
      await navigator.clipboard.writeText(pixCode);
      toast({
        title: 'Código PIX copiado!',
        description: 'Cole no seu app de banco para pagar.',
      });
      return true;
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Copie manualmente o código PIX.',
        variant: 'destructive',
      });
      return false;
    }
  }, [paymentData, toast]);

  /**
   * Limpa os dados de pagamento
   */
  const clearPayment = useCallback(() => {
    setPaymentData(null);
    setPaymentStatus(null);
    setError(null);
  }, []);

  /**
   * Calcula o valor da taxa baseado no tipo e valor do documento
   */
  const calculateFee = useCallback((documentType: DocumentType, totalValue?: number): number => {
    switch (documentType) {
      case 'nfe':
        // NF-e: R$ 10 (≤ R$ 1.000) ou R$ 25 (> R$ 1.000)
        if (totalValue && totalValue > 1000) {
          return 2500; // R$ 25,00
        }
        return 1000; // R$ 10,00
      
      case 'cte':
      case 'mdfe':
      case 'gta':
        // CT-e, MDF-e, GTA: sempre R$ 10,00
        return 1000;
      
      default:
        return 1000;
    }
  }, []);

  return {
    loading,
    paymentData,
    paymentStatus,
    error,
    createPixPayment,
    checkPaymentStatus,
    copyPixCode,
    clearPayment,
    calculateFee,
  };
}
