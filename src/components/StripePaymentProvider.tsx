import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { ReactNode } from 'react';

const stripePromise = loadStripe(
  'pk_test_51PU0MKBwKFCfq3PUCI4pLNxEpCQTRdKgBxdmLiPvvhg2iICHzK0qnUHhIJNRQoM1cHLxNhAAqn2fHe7sUbdgEjqq00VDqJW7L8'
);

interface StripePaymentProviderProps {
  children: ReactNode;
  clientSecret?: string;
}

export function StripePaymentProvider({ children, clientSecret }: StripePaymentProviderProps) {
  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: 'hsl(var(--primary))',
        colorBackground: 'hsl(var(--background))',
        colorText: 'hsl(var(--foreground))',
        colorDanger: 'hsl(var(--destructive))',
        fontFamily: 'system-ui, sans-serif',
        spacingUnit: '2px',
        borderRadius: '6px'
      }
    }
  };

  return (
    <Elements stripe={stripePromise} options={clientSecret ? options : undefined}>
      {children}
    </Elements>
  );
}