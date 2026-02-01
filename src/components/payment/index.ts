/**
 * Payment domain components - barrel export
 * 
 * @deprecated Stripe será removido em breve.
 * Use o hook useIntegrations() para novo sistema de pagamentos via Pagar.me.
 * Modelo: Cobrança por emissão de documento fiscal
 */
export { PaymentIntegration } from '../PaymentIntegration';
export { PaymentDeadlineAlert } from '../PaymentDeadlineAlert';
export { FreightPaymentModal } from '../FreightPaymentModal';
export { ServicePaymentModal } from '../ServicePaymentModal';
export { ServicePaymentHistory } from '../ServicePaymentHistory';
export { ClientServicePayment } from '../ClientServicePayment';
export { CompletedServicesPayment } from '../CompletedServicesPayment';
export { DriverPayouts } from '../DriverPayouts';
export { DriverPayoutModal } from '../DriverPayoutModal';
export { ServiceProviderPayouts } from '../ServiceProviderPayouts';

// @deprecated - Stripe será removido
export { StripePaymentForm } from '../StripePaymentForm';
export { StripePaymentProvider } from '../StripePaymentProvider';
