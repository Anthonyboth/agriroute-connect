/**
 * src/hooks/useFreightCalculator/index.ts
 * 
 * Hook centralizado calculadora da plataforma AgriRoute.
 * 
 * RESPONSABILIDADES:
 * - Calcular preços visíveis por tipo de usuário (Produtor, Motorista, Transportadora)
 * - Gerenciar cálculos multi-carreta
 * - Calcular propostas e contra-propostas
 * - Calcular pagamentos e valores líquidos
 * - Gerar resumos financeiros
 * - Validar preços (ANTT, limites, integridade)
 * 
 * USO:
 * const calc = useFreightCalculator('MOTORISTA');
 * const price = calc.getVisiblePrice(freight, assignment);
 * const proposal = calc.calculateProposal({ ... });
 * const payment = calc.getPaymentAmount(agreedPrice, freightPrice, trucks);
 */

import { useMemo } from 'react';
import type {
  CalcUserRole,
  FreightData,
  AssignmentData,
  PaymentData,
  ServicePaymentData,
  ProposalCalculationInput,
} from './types';
import {
  calculateVisiblePrice,
  resolveDriverUnitPrice,
  calculateCompanyFreight,
  calculateProposal,
  calculatePayment,
  calculateServicePayment,
  calculateFinancialSummary,
  validatePrice,
  validateAgreedPrice,
  calculatePricePerKm,
  calculatePricePerTon,
  calculateWeightPerTruck,
  estimateRequiredTrucks,
  getPaymentAmount,
} from './calculator';

// Re-exportar tipos e funções puras para uso direto
export type {
  CalcUserRole,
  PricingType,
  PaymentStatus,
  FreightData,
  AssignmentData,
  ProposalData,
  CounterProposalData,
  PaymentData,
  ServicePaymentData,
  RoleVisiblePrice,
  CompanyFreightCalculation,
  AssignmentCalculation,
  ProposalCalculation,
  ProposalCalculationInput,
  PaymentCalculation,
  FinancialSummary,
  PriceValidation,
} from './types';

// Re-exportar funções puras para uso fora de React
export {
  calculateVisiblePrice,
  resolveDriverUnitPrice,
  calculateCompanyFreight,
  calculateProposal,
  calculatePayment,
  calculateServicePayment,
  calculateFinancialSummary,
  validatePrice,
  validateAgreedPrice,
  calculatePricePerKm,
  calculatePricePerTon,
  calculateWeightPerTruck,
  estimateRequiredTrucks,
  getPaymentAmount,
} from './calculator';

/**
 * Hook centralizado de cálculos financeiros da plataforma.
 * 
 * @param userRole - Role do usuário logado
 * @param companyId - ID da transportadora (opcional, quando role = TRANSPORTADORA)
 * 
 * @example
 * ```tsx
 * const calc = useFreightCalculator('MOTORISTA');
 * 
 * // Preço visível para o motorista
 * const price = calc.getVisiblePrice(freight, assignment);
 * console.log(price.formattedPrice); // "R$ 10.800,00"
 * console.log(price.suffix); // "/carreta"
 * 
 * // Calcular proposta
 * const proposal = calc.calculateProposal({
 *   pricingType: 'PER_KM',
 *   pricePerKm: 8.50,
 *   distanceKm: 450,
 *   weightTons: 30,
 *   requiredTrucks: 3,
 * });
 * 
 * // Valor de pagamento
 * const amount = calc.getPaymentAmount(10800, 32400, 3);
 * ```
 */
export function useFreightCalculator(
  userRole: CalcUserRole,
  companyId?: string | null
) {
  return useMemo(() => ({
    /** Role atual */
    role: userRole,

    /** ID da transportadora (se aplicável) */
    companyId: companyId ?? null,

    // ============= VISIBILIDADE DE PREÇO =============

    /**
     * Calcula o preço que o usuário deve ver para um frete.
     */
    getVisiblePrice: (
      freight: FreightData,
      assignment?: AssignmentData | null,
      companyAssignments?: AssignmentData[]
    ) => calculateVisiblePrice(userRole, freight, assignment, companyAssignments),

    /**
     * Resolve o preço unitário (por carreta) do motorista com heurística defensiva.
     */
    resolveDriverUnitPrice,

    // ============= MULTI-CARRETA (TRANSPORTADORA) =============

    /**
     * Calcula tudo para a visão de transportadora.
     */
    getCompanyFreight: (
      freight: FreightData,
      allAssignments: AssignmentData[]
    ) => {
      const cid = companyId;
      if (!cid) {
        throw new Error('companyId é necessário para getCompanyFreight');
      }
      return calculateCompanyFreight(freight, allAssignments, cid);
    },

    // ============= PROPOSTAS =============

    /**
     * Calcula preço final de uma proposta/contra-proposta.
     */
    calculateProposal: (input: ProposalCalculationInput) => calculateProposal(input),

    // ============= PAGAMENTOS =============

    /**
     * Calcula pagamento para um motorista específico.
     */
    getPaymentCalc: (
      freight: FreightData,
      assignment: AssignmentData | null,
      payment?: PaymentData | null
    ) => calculatePayment(freight, assignment, payment),

    /**
     * Calcula pagamento de serviço (prestador).
     */
    getServicePaymentCalc: (payment: ServicePaymentData) =>
      calculateServicePayment(payment),

    /**
     * Retorna o valor correto para criar um external_payment.
     */
    getPaymentAmount,

    // ============= RESUMO FINANCEIRO =============

    /**
     * Gera resumo financeiro para dashboards e relatórios.
     */
    getFinancialSummary: (
      freights: FreightData[],
      assignments: AssignmentData[],
      payments: PaymentData[]
    ) => calculateFinancialSummary(
      userRole,
      freights,
      assignments,
      payments,
      companyId ?? undefined
    ),

    // ============= VALIDAÇÕES =============

    /** Valida um preço */
    validatePrice,

    /** Valida agreed_price (nunca zero) */
    validateAgreedPrice,

    // ============= UTILITÁRIOS =============

    /** Calcula preço por km */
    calculatePricePerKm,

    /** Calcula preço por tonelada */
    calculatePricePerTon,

    /** Peso por carreta em toneladas */
    calculateWeightPerTruck,

    /** Estima carretas necessárias pelo peso */
    estimateRequiredTrucks,

  }), [userRole, companyId]);
}

export default useFreightCalculator;
