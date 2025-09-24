import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ServicePayment {
  id: string;
  service_request_id: string;
  client_id: string;
  provider_id: string;
  amount: number;
  platform_fee: number;
  net_amount: number;
  status: string;
  payment_method: string;
  stripe_session_id?: string;
  stripe_payment_intent_id?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
  metadata?: any;
  service_request?: {
    id: string;
    service_type: string;
    problem_description: string;
    location_address: string;
    final_price: number;
    estimated_price: number;
    status: string;
  };
}

export const useServicePayments = () => {
  const [payments, setPayments] = useState<ServicePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('service_payments')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }

      setPayments(data || []);
    } catch (err) {
      console.error('Error fetching service payments:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const createServicePayment = async (serviceRequestId: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('create-service-payment', {
        body: { serviceRequestId }
      });
      
      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      // Redirecionar para checkout
      if (data.url) {
        window.open(data.url, '_blank');
        
        toast({
          title: "Checkout Iniciado",
          description: "Redirecionando para pagamento seguro via Stripe",
        });

        // Recarregar pagamentos após criar um novo
        await fetchPayments();
        
        return { success: true, url: data.url, paymentId: data.paymentId };
      }

      throw new Error('No checkout URL received');
    } catch (err) {
      console.error('Error creating service payment:', err);
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar pagamento';
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  // Recarregar pagamentos quando há mudanças em tempo real
  useEffect(() => {
    const channel = supabase
      .channel('service-payments-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_payments'
        },
        () => {
          fetchPayments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    payments,
    loading,
    error,
    fetchPayments,
    createServicePayment,
    // Helper functions
    getPendingPayments: () => payments.filter(p => p.status === 'PENDING'),
    getCompletedPayments: () => payments.filter(p => p.status === 'COMPLETED'),
    getTotalPaid: () => payments
      .filter(p => p.status === 'COMPLETED')
      .reduce((sum, p) => sum + p.amount, 0),
  };
};