/**
 * @deprecated Este componente será removido em breve.
 * A integração Stripe será substituída pelo Pagar.me.
 * Use o hook useIntegrations() para o novo sistema de pagamentos.
 * 
 * Modelo de cobrança: Por emissão de documento fiscal
 * - NF-e: R$ 0,35/emissão
 * - CT-e: R$ 0,25/emissão
 * - MDF-e: R$ 0,15/emissão
 * - NFS-e: R$ 0,40/emissão
 */
import { loadStripe, type Stripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import { ReactNode, useState } from 'react';

// @deprecated - Stripe será removido
// Publishable key from env - optional for Stripe features
const PUBLISHABLE_KEY: string = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string;

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
  // If Stripe is not configured, render children without payment features
  if (!PUBLISHABLE_KEY) {
    return <>{children}</>;
  }

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