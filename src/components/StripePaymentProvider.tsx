import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { ReactNode, useState } from 'react';

// Publishable key from env with safe fallback
const PUBLISHABLE_KEY: string = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string) ||
  'pk_test_51PU0MKBwKFCfq3PUCI4pLNxEpCQTRdKgBxdmLiPvvhg2iICHzK0qnUHhIJNRQoM1cHLxNhAAqn2fHe7sUbdgEjqq00VDqJW7L8';

// True singleton for Stripe instance
let stripePromiseRef: Promise<Stripe | null> | null = null;
const getStripePromise = () => {
  if (!stripePromiseRef) {
    stripePromiseRef = loadStripe(PUBLISHABLE_KEY);
  }
  return stripePromiseRef;
};

interface StripePaymentProviderProps {
  children: ReactNode;
  clientSecret?: string;
}

export function StripePaymentProvider({ children, clientSecret }: StripePaymentProviderProps) {
  const [stripe] = useState(getStripePromise);

  // Render children until we have a clientSecret to avoid premature Elements mount
  if (!clientSecret) {
    return <>{children}</>;
  }

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
        borderRadius: '6px',
      },
    },
  } as const;

  return (
    <Elements stripe={stripe} options={options} key={clientSecret}>
      {children}
    </Elements>
  );
}