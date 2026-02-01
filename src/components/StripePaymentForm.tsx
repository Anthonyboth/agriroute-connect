/**
 * @deprecated Este componente será removido em breve.
 * A integração Stripe será substituída pelo Pagar.me.
 * Use o hook useIntegrations() para o novo sistema de pagamentos.
 */
import { useState, useEffect } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface StripePaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function StripePaymentForm({ amount, onSuccess, onCancel }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!stripe) return;

    let isMounted = true;

    const clientSecret = new URLSearchParams(window.location.search).get(
      'payment_intent_client_secret'
    );

    if (!clientSecret) return;

    stripe.retrievePaymentIntent(clientSecret).then(({ paymentIntent }) => {
      if (!isMounted) return;
      switch (paymentIntent?.status) {
        case 'succeeded':
          setMessage('Pagamento realizado com sucesso!');
          onSuccess();
          break;
        case 'processing':
          setMessage('Seu pagamento está sendo processado.');
          break;
        case 'requires_payment_method':
          setMessage('Seu pagamento não foi processado, tente novamente.');
          break;
        default:
          setMessage('Algo deu errado.');
          break;
      }
    });

    return () => {
      isMounted = false;
    };
  }, [stripe, onSuccess]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/payment/success`,
        },
      });

      if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
          setMessage(error.message || 'Erro no pagamento');
        } else {
          setMessage('Ocorreu um erro inesperado.');
        }
        toast.error('Erro no pagamento. Verifique os dados e tente novamente.');
      } else {
        toast.success('Pagamento processado!');
        onSuccess();
      }
    } catch (error) {
      console.error('Payment error:', error);
      toast.error('Erro ao processar pagamento');
    } finally {
      setIsLoading(false);
    }
  };

  const paymentElementOptions = {
    layout: 'tabs' as const,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement options={paymentElementOptions} />
      
      {message && (
        <div className="text-sm text-center p-3 rounded-md bg-muted">
          {message}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} type="button" className="flex-1">
          Voltar
        </Button>
        <Button 
          disabled={isLoading || !stripe || !elements} 
          type="submit"
          className="flex-1"
        >
          {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Pagar R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </Button>
      </div>
    </form>
  );
}