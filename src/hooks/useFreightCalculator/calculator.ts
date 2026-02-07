/**
 * src/hooks/useFreightCalculator/calculator.ts
 * 
 * Funções puras de cálculo. Sem side-effects, sem hooks React.
 * Todas as regras de negócio de valores da plataforma ficam aqui.
 * 
 * REGRAS CRÍTICAS:
 * 1. O agreed_price do assignment é a FONTE DA VERDADE para pagamentos
 * 2. Motorista/Transportadora NUNCA vê o valor total global multi-carreta
 * 3. Produtor vê o valor total de TODAS as carretas
 * 4. Transportadora vê apenas o valor total das SUAS carretas
 * 5. Valores de proposta são sempre POR CARRETA
 */

import { formatBRL } from '@/lib/formatters';
import type {
  CalcUserRole,
  PricingType,
  FreightData,
  AssignmentData,
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
  PaymentStatus,
} from './types';

// ============= CONSTANTES =============

const TOLERANCE = 0.01;

// ============= HELPERS INTERNOS =============

const safeNumber = (val: number | null | undefined): number => {
  if (typeof val !== 'number' || !Number.isFinite(val)) return 0;
  return val;
};

const safeTrucks = (val: number | null | undefined): number => {
  return Math.max(safeNumber(val) || 1, 1);
};

const fmtBRL = (value: number): string => formatBRL(value, true);

// ============= 1. PREÇO VISÍVEL POR ROLE =============

/**
 * Calcula o preço que deve ser exibido para cada tipo de usuário.
 * 
 * PRODUTOR → vê o valor TOTAL do frete (todas as carretas)
 * MOTORISTA → vê apenas o valor da SUA carreta (agreed_price ou price/trucks)
 * TRANSPORTADORA → vê o total das suas carretas (soma dos assignments)
 * ADMIN → vê tudo
 */
export function calculateVisiblePrice(
  role: CalcUserRole,
  freight: FreightData,
  assignment?: AssignmentData | null,
  companyAssignments?: AssignmentData[]
): RoleVisiblePrice {
  const requiredTrucks = safeTrucks(freight.required_trucks);
  const isMultiTruck = requiredTrucks > 1;

  // ADMIN: valor total
  if (role === 'ADMIN') {
    return {
      displayPrice: freight.price,
      formattedPrice: fmtBRL(freight.price),
      displayMode: 'TOTAL',
      truckCount: requiredTrucks,
      suffix: isMultiTruck ? ` (${requiredTrucks} carretas)` : '',
      fullLabel: isMultiTruck
        ? `${fmtBRL(freight.price)} (${requiredTrucks} carretas)`
        : fmtBRL(freight.price),
    };
  }

  // PRODUTOR: valor total global
  if (role === 'PRODUTOR') {
    return {
      displayPrice: freight.price,
      formattedPrice: fmtBRL(freight.price),
      displayMode: 'TOTAL',
      truckCount: requiredTrucks,
      suffix: isMultiTruck ? ` (${requiredTrucks} carretas)` : '',
      fullLabel: isMultiTruck
        ? `${fmtBRL(freight.price)} (${requiredTrucks} carretas)`
        : fmtBRL(freight.price),
    };
  }

  // TRANSPORTADORA: soma dos assignments da empresa
  if (role === 'TRANSPORTADORA' && companyAssignments && companyAssignments.length > 0) {
    const companyTruckCount = companyAssignments.length;
    const companyTotal = companyAssignments.reduce((sum, a) => {
      return sum + resolveDriverUnitPrice(a.agreed_price, freight.price, requiredTrucks);
    }, 0);
    const pricePerTruck = companyTruckCount > 0 ? companyTotal / companyTruckCount : 0;

    return {
      displayPrice: companyTotal,
      formattedPrice: fmtBRL(companyTotal),
      displayMode: 'COMPANY_TOTAL',
      truckCount: companyTruckCount,
      suffix: companyTruckCount > 1
        ? `\n${fmtBRL(pricePerTruck)}/carreta (${companyTruckCount} carretas)`
        : '',
      fullLabel: companyTruckCount > 1
        ? `${fmtBRL(companyTotal)}\n${fmtBRL(pricePerTruck)}/carreta(${companyTruckCount} carretas)`
        : fmtBRL(companyTotal),
    };
  }

  // MOTORISTA / MOTORISTA_AFILIADO / fallback TRANSPORTADORA sem assignments
  const unitPrice = assignment
    ? resolveDriverUnitPrice(assignment.agreed_price, freight.price, requiredTrucks)
    : freight.price / requiredTrucks;

  return {
    displayPrice: unitPrice,
    formattedPrice: fmtBRL(unitPrice),
    displayMode: isMultiTruck ? 'PER_TRUCK' : 'TOTAL',
    truckCount: requiredTrucks,
    suffix: isMultiTruck ? '/carreta' : '',
    fullLabel: isMultiTruck
      ? `${fmtBRL(unitPrice)}/carreta(${requiredTrucks} carretas)`
      : fmtBRL(unitPrice),
  };
}

/**
 * Resolve o preço unitário (por carreta) do motorista.
 * 
 * Heurística defensiva: se agreed_price ≈ freight.price em frete multi-carreta,
 * significa que foi salvo erroneamente como total → dividir.
 */
export function resolveDriverUnitPrice(
  agreedPrice: number,
  freightPrice: number,
  requiredTrucks: number
): number {
  const trucks = safeTrucks(requiredTrucks);
  const agreed = safeNumber(agreedPrice);
  const total = safeNumber(freightPrice);

  if (agreed <= 0) {
    return total / trucks;
  }

  // Heurística: se agreed_price ≈ total e multi-carreta, dividir
  if (trucks > 1 && total > 0 && Math.abs(agreed - total) <= TOLERANCE) {
    return total / trucks;
  }

  return agreed;
}

// ============= 2. CÁLCULO MULTI-CARRETA TRANSPORTADORA =============

/**
 * Calcula os valores completos para a visão da transportadora.
 * Agrega assignments e calcula totais para a empresa.
 */
export function calculateCompanyFreight(
  freight: FreightData,
  allAssignments: AssignmentData[],
  companyId: string
): CompanyFreightCalculation {
  const requiredTrucks = safeTrucks(freight.required_trucks);

  // Separar assignments da empresa
  const companyAssignments = allAssignments.filter(a => a.company_id === companyId);

  const assignments: AssignmentCalculation[] = companyAssignments.map(a => {
    const unitPrice = resolveDriverUnitPrice(a.agreed_price, freight.price, requiredTrucks);
    return {
      assignmentId: a.id,
      driverId: a.driver_id,
      agreedPrice: unitPrice,
      formattedPrice: fmtBRL(unitPrice),
      pricingType: a.pricing_type as PricingType,
      pricePerKm: a.price_per_km,
      status: a.status,
    };
  });

  const companyTotal = assignments.reduce((sum, a) => sum + a.agreedPrice, 0);
  const pricePerTruck = assignments.length > 0 ? companyTotal / assignments.length : freight.price / requiredTrucks;
  const totalAccepted = allAssignments.filter(a => 
    !['CANCELLED', 'REJECTED'].includes(a.status)
  ).length;

  return {
    companyTruckCount: companyAssignments.length,
    totalRequiredTrucks: requiredTrucks,
    pricePerTruck,
    companyTotal,
    freightGlobalTotal: freight.price,
    assignments,
    remainingSlots: Math.max(requiredTrucks - totalAccepted, 0),
  };
}

// ============= 3. CÁLCULO DE PROPOSTAS =============

/**
 * Calcula o preço final de uma proposta/contra-proposta.
 * Retorna valor POR CARRETA.
 */
export function calculateProposal(input: ProposalCalculationInput): ProposalCalculation {
  const {
    pricingType,
    fixedPrice = 0,
    pricePerKm = 0,
    pricePerTon = 0,
    distanceKm,
    weightTons,
    requiredTrucks,
    minimumAnttPrice,
    originalPrice = 0,
    isCounterProposal = false,
    customMessage,
  } = input;

  // Calcular preço final baseado no tipo
  let finalPrice: number;
  switch (pricingType) {
    case 'PER_KM':
      finalPrice = pricePerKm * distanceKm;
      break;
    case 'PER_TON':
      finalPrice = pricePerTon * weightTons;
      break;
    case 'FIXED':
    default:
      finalPrice = fixedPrice;
  }

  // Validar ANTT
  const anttMin = safeNumber(minimumAnttPrice);
  const isAboveAnttMinimum = anttMin <= 0 || finalPrice >= anttMin;

  // Diferença percentual
  const percentDifference = originalPrice > 0
    ? ((finalPrice - originalPrice) / originalPrice) * 100
    : 0;

  // Montar mensagem formatada
  const trucks = safeTrucks(requiredTrucks);
  const hasMultipleTrucks = trucks > 1;
  const prefix = hasMultipleTrucks ? '[Proposta para 1 carreta] ' : '';
  const type = isCounterProposal ? 'CONTRA-PROPOSTA' : 'PROPOSTA';

  let priceInfo = fmtBRL(finalPrice);
  if (pricingType === 'PER_KM' && pricePerKm > 0) {
    priceInfo = `R$ ${pricePerKm.toLocaleString('pt-BR')}/km (Total: ${fmtBRL(finalPrice)} para ${distanceKm} km)`;
  } else if (pricingType === 'PER_TON' && pricePerTon > 0) {
    priceInfo = `R$ ${pricePerTon.toLocaleString('pt-BR')}/ton (Total: ${fmtBRL(finalPrice)} para ${weightTons.toFixed(1)} ton)`;
  }

  let formattedMessage = `${prefix}${type}: ${priceInfo}`;
  if (customMessage?.trim()) {
    formattedMessage += `\n\n${customMessage.trim()}`;
  }

  return {
    finalPrice,
    formattedFinalPrice: fmtBRL(finalPrice),
    pricingType,
    pricePerKm: pricingType === 'PER_KM' ? pricePerKm : undefined,
    pricePerTon: pricingType === 'PER_TON' ? pricePerTon : undefined,
    isAboveAnttMinimum,
    percentDifference,
    formattedMessage,
  };
}

// ============= 4. CÁLCULO DE PAGAMENTOS =============

/**
 * Calcula o valor de pagamento para um motorista específico.
 * 
 * REGRA CRÍTICA: usar agreed_price do assignment como fonte da verdade.
 * Nunca dividir freight.price por required_trucks para pagamento.
 */
export function calculatePayment(
  freight: FreightData,
  assignment: AssignmentData | null,
  payment?: PaymentData | null
): PaymentCalculation {
  const requiredTrucks = safeTrucks(freight.required_trucks);

  // Valor do motorista: agreed_price do assignment
  let driverPaymentAmount: number;
  if (assignment && assignment.agreed_price > 0) {
    driverPaymentAmount = resolveDriverUnitPrice(
      assignment.agreed_price,
      freight.price,
      requiredTrucks
    );
  } else {
    // Fallback (sem assignment)
    driverPaymentAmount = freight.price / requiredTrucks;
  }

  // Comissão da plataforma
  const commissionRate = safeNumber(freight.commission_rate) / 100;
  const platformFee = commissionRate > 0
    ? driverPaymentAmount * commissionRate
    : safeNumber(freight.commission_amount);

  const netDriverAmount = driverPaymentAmount - platformFee;

  return {
    driverPaymentAmount,
    formattedDriverAmount: fmtBRL(driverPaymentAmount),
    producerTotalAmount: freight.price,
    formattedProducerTotal: fmtBRL(freight.price),
    platformFee,
    formattedPlatformFee: fmtBRL(platformFee),
    netDriverAmount,
    formattedNetDriverAmount: fmtBRL(netDriverAmount),
    paymentStatus: (payment?.status as PaymentStatus) ?? null,
  };
}

/**
 * Calcula o pagamento de serviço (prestador de serviços).
 */
export function calculateServicePayment(
  servicePayment: ServicePaymentData
): PaymentCalculation {
  const amount = safeNumber(servicePayment.amount);
  const fee = safeNumber(servicePayment.platform_fee);
  const net = safeNumber(servicePayment.net_amount) || (amount - fee);

  return {
    driverPaymentAmount: amount,
    formattedDriverAmount: fmtBRL(amount),
    producerTotalAmount: amount,
    formattedProducerTotal: fmtBRL(amount),
    platformFee: fee,
    formattedPlatformFee: fmtBRL(fee),
    netDriverAmount: net,
    formattedNetDriverAmount: fmtBRL(net),
    paymentStatus: servicePayment.status as PaymentStatus,
  };
}

// ============= 5. RESUMO FINANCEIRO =============

/**
 * Calcula resumo financeiro para qualquer role.
 * Usado em dashboards e relatórios.
 */
export function calculateFinancialSummary(
  role: CalcUserRole,
  freights: FreightData[],
  assignments: AssignmentData[],
  payments: PaymentData[],
  companyId?: string
): FinancialSummary {
  let totalRevenue = 0;
  let totalConfirmed = 0;
  let totalPending = 0;
  let totalFees = 0;

  if (role === 'PRODUTOR' || role === 'ADMIN') {
    // Produtor/Admin: valor total de todos os fretes
    totalRevenue = freights.reduce((sum, f) => sum + safeNumber(f.price), 0);
  } else if (role === 'TRANSPORTADORA' && companyId) {
    // Transportadora: soma dos assignments da empresa
    const companyAssignments = assignments.filter(a => a.company_id === companyId);
    companyAssignments.forEach(a => {
      const freight = freights.find(f => f.id === (a as any).freight_id);
      if (freight) {
        totalRevenue += resolveDriverUnitPrice(
          a.agreed_price,
          freight.price,
          safeTrucks(freight.required_trucks)
        );
      } else {
        totalRevenue += safeNumber(a.agreed_price);
      }
    });
  } else {
    // Motorista: soma dos seus agreed_prices
    assignments.forEach(a => {
      const freight = freights.find(f => f.id === (a as any).freight_id);
      if (freight) {
        totalRevenue += resolveDriverUnitPrice(
          a.agreed_price,
          freight.price,
          safeTrucks(freight.required_trucks)
        );
      } else {
        totalRevenue += safeNumber(a.agreed_price);
      }
    });
  }

  // Pagamentos
  payments.forEach(p => {
    const amount = safeNumber(p.amount);
    if (p.status === 'confirmed') {
      totalConfirmed += amount;
    } else if (p.status === 'proposed' || p.status === 'paid_by_producer') {
      totalPending += amount;
    }
  });

  // Fees
  freights.forEach(f => {
    totalFees += safeNumber(f.commission_amount);
  });

  return {
    totalRevenue,
    formattedTotalRevenue: fmtBRL(totalRevenue),
    totalConfirmedPayments: totalConfirmed,
    formattedConfirmedPayments: fmtBRL(totalConfirmed),
    totalPendingPayments: totalPending,
    formattedPendingPayments: fmtBRL(totalPending),
    totalPlatformFees: totalFees,
    formattedPlatformFees: fmtBRL(totalFees),
    freightCount: freights.length,
    paymentCount: payments.length,
  };
}

// ============= 6. VALIDAÇÕES =============

/**
 * Valida um preço em contexto de frete.
 */
export function validatePrice(
  price: number,
  options?: {
    minimumAnttPrice?: number | null;
    requiredTrucks?: number;
    pricingType?: PricingType;
    distanceKm?: number;
    weightTons?: number;
  }
): PriceValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!Number.isFinite(price)) {
    errors.push('Preço inválido. Digite apenas números.');
    return { isValid: false, errors, warnings };
  }

  if (price <= 0) {
    errors.push('Preço deve ser maior que zero.');
    return { isValid: false, errors, warnings };
  }

  if (price > 10_000_000) {
    errors.push('Preço excede o limite máximo (R$ 10.000.000).');
    return { isValid: false, errors, warnings };
  }

  // Validar ANTT
  const anttMin = safeNumber(options?.minimumAnttPrice);
  if (anttMin > 0 && price < anttMin) {
    warnings.push(
      `⚠️ Preço (${fmtBRL(price)}) abaixo do mínimo ANTT (${fmtBRL(anttMin)}).`
    );
  }

  // Validar tipo de precificação
  if (options?.pricingType === 'PER_KM' && (!options.distanceKm || options.distanceKm <= 0)) {
    errors.push('Para proposta por KM, o frete precisa ter a distância configurada.');
  }

  if (options?.pricingType === 'PER_TON' && (!options.weightTons || options.weightTons <= 0)) {
    errors.push('Para proposta por tonelada, o frete precisa ter o peso configurado.');
  }

  // Avisos de valor
  if (price < 100) {
    warnings.push('💡 Valor muito baixo. Confirme se está correto.');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Valida que agreed_price nunca é zero (regra de integridade).
 */
export function validateAgreedPrice(agreedPrice: number): PriceValidation {
  if (agreedPrice === 0) {
    return {
      isValid: false,
      errors: ['agreed_price não pode ser zero.'],
      warnings: [],
    };
  }
  return validatePrice(agreedPrice);
}

// ============= 7. UTILITÁRIOS DE CONVERSÃO =============

/**
 * Calcula preço por km a partir do preço total e distância.
 */
export function calculatePricePerKm(
  totalPrice: number,
  distanceKm: number | null | undefined
): number | null {
  const dist = safeNumber(distanceKm);
  if (dist <= 0) return null;
  return totalPrice / dist;
}

/**
 * Calcula preço por tonelada a partir do preço total e peso.
 */
export function calculatePricePerTon(
  totalPrice: number,
  weightKg: number | null | undefined
): number | null {
  const weight = safeNumber(weightKg);
  if (weight <= 0) return null;
  return totalPrice / (weight / 1000);
}

/**
 * Calcula peso por carreta em toneladas.
 */
export function calculateWeightPerTruck(
  totalWeightKg: number | null | undefined,
  requiredTrucks: number | null | undefined
): number {
  const weight = safeNumber(totalWeightKg);
  const trucks = safeTrucks(requiredTrucks);
  return weight / trucks / 1000; // kg → ton, dividido por carretas
}

/**
 * Calcula o número de carretas necessárias baseado no peso.
 * Padrão: 30 toneladas por carreta.
 */
export function estimateRequiredTrucks(
  totalWeightKg: number,
  maxWeightPerTruckKg: number = 30_000
): number {
  if (totalWeightKg <= 0) return 1;
  return Math.ceil(totalWeightKg / maxWeightPerTruckKg);
}

/**
 * Retorna o valor correto para criar um external_payment.
 * REGRA: usar agreed_price do assignment como fonte da verdade.
 */
export function getPaymentAmount(
  agreedPrice: number | null,
  freightPrice: number,
  requiredTrucks: number
): number {
  if (agreedPrice !== null && agreedPrice > 0) {
    return resolveDriverUnitPrice(agreedPrice, freightPrice, requiredTrucks);
  }
  return freightPrice / safeTrucks(requiredTrucks);
}
