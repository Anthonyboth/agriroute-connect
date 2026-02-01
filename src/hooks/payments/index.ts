/**
 * Payment hooks barrel export
 * 
 * Hooks dedicados para gerenciamento de pagamentos externos
 * - Produtor: criar/confirmar pagamentos
 * - Motorista: confirmar recebimento/contestar
 * - Transportadora: visão consolidada de pagamentos dos afiliados
 * 
 * @deprecated Stripe será removido em breve.
 * Use o hook useIntegrations() para novo sistema de pagamentos via Pagar.me.
 * Modelo: Cobrança por emissão de documento fiscal (NF-e, CT-e, MDF-e)
 */

export { useProducerPayments, type ProducerPayment } from '../useProducerPayments';
export { useDriverPayments, type DriverPayment } from '../useDriverPayments';
export { useCompanyPayments, type CompanyPayment } from '../useCompanyPayments';

// Novo hook centralizado de integrações (inclui pagamentos futuros via Pagar.me)
export { useIntegrations, type IntegrationName, type IntegrationStatus } from '../useIntegrations';
