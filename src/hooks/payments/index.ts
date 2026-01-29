/**
 * Payment hooks barrel export
 * 
 * Hooks dedicados para gerenciamento de pagamentos externos
 * - Produtor: criar/confirmar pagamentos
 * - Motorista: confirmar recebimento/contestar
 * - Transportadora: visão consolidada de pagamentos dos afiliados
 */

export { useProducerPayments, type ProducerPayment } from '../useProducerPayments';
export { useDriverPayments, type DriverPayment } from '../useDriverPayments';
export { useCompanyPayments, type CompanyPayment } from '../useCompanyPayments';
