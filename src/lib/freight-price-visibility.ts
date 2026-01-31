/**
 * Centraliza regras de exibição de valores (dados sensíveis) por público.
 *
 * Objetivo (Motorista): nunca expor o valor total do frete multi-carreta;
 * exibir somente o valor unitário (por carreta) referente ao trabalho do motorista.
 */

export type PriceDisplayMode = 'TOTAL' | 'PER_TRUCK';

export interface DriverPriceVisibilityInput {
  freightPrice: number | null | undefined;
  requiredTrucks: number | null | undefined;
  assignmentAgreedPrice?: number | null | undefined;
}

export interface DriverPriceVisibilityResult {
  /** Valor seguro para exibição no painel do motorista */
  displayPrice: number;
  /** Como o componente deve rotular/interpretar o preço */
  displayMode: PriceDisplayMode;
  /** Mantém a informação de multi-carreta para label (ex: "/carreta") */
  originalRequiredTrucks: number;
}

export function getDriverVisibleFreightPrice(
  input: DriverPriceVisibilityInput
): DriverPriceVisibilityResult {
  const required = Math.max(input.requiredTrucks || 1, 1);

  const tol = 0.01;

  // Regra: se houver agreed_price no assignment, esse é o valor do motorista.
  // Importante: este valor deve ser unitário (por carreta) para multi-carreta.
  if (typeof input.assignmentAgreedPrice === 'number' && input.assignmentAgreedPrice > 0) {
    // ✅ Correção defensiva (somente UI): em alguns fluxos legados,
    // agreed_price foi salvo erroneamente como preço TOTAL do frete.
    // Heurística segura: se agreed_price ~ freight.price e é multi-carreta,
    // exibir por carreta para o motorista.
    const freightPrice =
      typeof input.freightPrice === 'number' && Number.isFinite(input.freightPrice)
        ? input.freightPrice
        : null;

    if (required > 1 && freightPrice !== null && Math.abs(input.assignmentAgreedPrice - freightPrice) <= tol) {
      return {
        displayPrice: freightPrice / required,
        displayMode: 'PER_TRUCK',
        originalRequiredTrucks: required,
      };
    }

    return {
      displayPrice: input.assignmentAgreedPrice,
      displayMode: required > 1 ? 'PER_TRUCK' : 'TOTAL',
      originalRequiredTrucks: required,
    };
  }

  // Fallback: se ainda não houver assignment (caso excepcional), dividir apenas para exibição do motorista.
  const base = typeof input.freightPrice === 'number' && Number.isFinite(input.freightPrice)
    ? input.freightPrice
    : 0;

  const displayPrice = required > 1 ? base / required : base;

  return {
    displayPrice,
    displayMode: required > 1 ? 'PER_TRUCK' : 'TOTAL',
    originalRequiredTrucks: required,
  };
}
