/**
 * src/hooks/useFreightCalculator/types.ts
 * 
 * Tipos centralizados para o hook calculadora da plataforma.
 * Gerencia todos os cálculos de valores, visibilidade por role e pagamentos.
 */

// ============= ROLES =============

export type CalcUserRole = 
  | 'PRODUTOR' 
  | 'MOTORISTA' 
  | 'MOTORISTA_AFILIADO' 
  | 'TRANSPORTADORA' 
  | 'PRESTADOR_SERVICOS' 
  | 'ADMIN';

// ============= PRICING TYPES =============

export type PricingType = 'FIXED' | 'PER_KM' | 'PER_TON';

export type PaymentStatus = 'proposed' | 'paid_by_producer' | 'confirmed' | 'cancelled';

// ============= INPUTS =============

/** Dados do frete para cálculo */
export interface FreightData {
  id: string;
  price: number;                       // Preço base/total proposto pelo produtor
  required_trucks: number;             // Número total de carretas necessárias
  accepted_trucks?: number;            // Carretas já aceitas
  distance_km?: number | null;
  weight?: number | null;              // Peso em kg
  minimum_antt_price?: number | null;
  price_per_km?: number | null;
  commission_rate?: number | null;
  commission_amount?: number | null;
  extra_fees?: number | null;
  extra_fees_description?: string | null;
}

/** Dados do assignment (atribuição motorista ↔ frete) */
export interface AssignmentData {
  id: string;
  driver_id: string;
  agreed_price: number;                // Fonte da verdade para o motorista
  pricing_type: PricingType;
  price_per_km?: number | null;
  minimum_antt_price?: number | null;
  company_id?: string | null;
  status: string;
}

/** Dados de proposta */
export interface ProposalData {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  status: string;                      // PENDING, ACCEPTED, REJECTED, CANCELLED
  message?: string | null;
  created_at: string;
}

/** Dados de contra-proposta */
export interface CounterProposalData {
  id: string;
  freight_id: string;
  sender_id: string;
  counter_price: number;
  original_price: number;
  status: string;
  message?: string | null;
}

/** Dados de pagamento externo */
export interface PaymentData {
  id: string;
  freight_id: string;
  driver_id: string;
  producer_id: string;
  amount: number;
  status: PaymentStatus;
  created_at?: string | null;
  confirmed_at?: string | null;
}

/** Dados de pagamento de serviço */
export interface ServicePaymentData {
  id: string;
  service_request_id: string;
  client_id: string;
  provider_id: string;
  amount: number;
  platform_fee?: number | null;
  net_amount?: number | null;
  status: string;
}

// ============= OUTPUTS =============

/** Resultado de preço visível por role */
export interface RoleVisiblePrice {
  /** Valor a exibir para este role */
  displayPrice: number;
  /** Label formatado (R$) */
  formattedPrice: string;
  /** Modo de exibição */
  displayMode: 'TOTAL' | 'PER_TRUCK' | 'COMPANY_TOTAL';
  /** Número de carretas associadas */
  truckCount: number;
  /** Sufixo para exibição ("/carreta" etc) */
  suffix: string;
  /** Label completo para UI (ex: "R$ 10.800,00 /carreta (3 carretas)") */
  fullLabel: string;
}

/** Cálculo completo de frete multi-carreta para transportadora */
export interface CompanyFreightCalculation {
  /** Número de carretas da transportadora neste frete */
  companyTruckCount: number;
  /** Total de carretas do frete (global) */
  totalRequiredTrucks: number;
  /** Valor unitário por carreta */
  pricePerTruck: number;
  /** Valor total da transportadora (soma dos assignments dela) */
  companyTotal: number;
  /** Valor total global do frete (somente para o produtor) */
  freightGlobalTotal: number;
  /** Assignments individuais com valores */
  assignments: AssignmentCalculation[];
  /** Carretas restantes (vagas) */
  remainingSlots: number;
}

/** Cálculo individual de assignment */
export interface AssignmentCalculation {
  assignmentId: string;
  driverId: string;
  agreedPrice: number;
  formattedPrice: string;
  pricingType: PricingType;
  pricePerKm?: number | null;
  status: string;
}

/** Resultado de cálculo de proposta */
export interface ProposalCalculation {
  /** Preço final da proposta (por carreta) */
  finalPrice: number;
  formattedFinalPrice: string;
  /** Tipo de precificação */
  pricingType: PricingType;
  /** Detalhes do cálculo */
  pricePerKm?: number;
  pricePerTon?: number;
  /** Se está acima do mínimo ANTT */
  isAboveAnttMinimum: boolean;
  /** Diferença percentual em relação ao preço original */
  percentDifference: number;
  /** Mensagem formatada para envio */
  formattedMessage: string;
}

/** Resultado de cálculo de pagamento */
export interface PaymentCalculation {
  /** Valor do pagamento para o motorista */
  driverPaymentAmount: number;
  formattedDriverAmount: string;
  /** Valor total do frete para o produtor */
  producerTotalAmount: number;
  formattedProducerTotal: string;
  /** Comissão da plataforma (se aplicável) */
  platformFee: number;
  formattedPlatformFee: string;
  /** Valor líquido para o motorista */
  netDriverAmount: number;
  formattedNetDriverAmount: string;
  /** Status do pagamento */
  paymentStatus: PaymentStatus | null;
}

/** Resumo financeiro global */
export interface FinancialSummary {
  /** Total de receita (todos os fretes) */
  totalRevenue: number;
  formattedTotalRevenue: string;
  /** Total de pagamentos confirmados */
  totalConfirmedPayments: number;
  formattedConfirmedPayments: string;
  /** Total de pagamentos pendentes */
  totalPendingPayments: number;
  formattedPendingPayments: string;
  /** Comissão total da plataforma */
  totalPlatformFees: number;
  formattedPlatformFees: string;
  /** Número de fretes no resumo */
  freightCount: number;
  /** Número de pagamentos no resumo */
  paymentCount: number;
}

/** Resultado de validação de preço */
export interface PriceValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** Input para cálculo de proposta */
export interface ProposalCalculationInput {
  pricingType: PricingType;
  fixedPrice?: number;
  pricePerKm?: number;
  pricePerTon?: number;
  distanceKm: number;
  weightTons: number;          // Peso em toneladas POR CARRETA
  requiredTrucks: number;
  minimumAnttPrice?: number | null;
  originalPrice?: number;      // Para calcular diferença
  isCounterProposal?: boolean;
  customMessage?: string;
}
