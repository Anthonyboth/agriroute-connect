/**
 * @deprecated Use `calculateVisiblePrice` e `resolveDriverUnitPrice` de `@/hooks/useFreightCalculator` em vez deste módulo.
 * 
 * Este arquivo foi substituído pelo hook centralizado useFreightCalculator.
 * Mantido temporariamente para compatibilidade reversa.
 * Todos os componentes já foram migrados.
 */

import { calculateVisiblePrice, resolveDriverUnitPrice } from '@/hooks/useFreightCalculator';

export type PriceDisplayMode = 'TOTAL' | 'PER_TRUCK';

export interface DriverPriceVisibilityInput {
  freightPrice: number | null | undefined;
  requiredTrucks: number | null | undefined;
  assignmentAgreedPrice?: number | null | undefined;
}

export interface DriverPriceVisibilityResult {
  displayPrice: number;
  displayMode: PriceDisplayMode;
  originalRequiredTrucks: number;
}

/**
 * @deprecated Use `calculateVisiblePrice('MOTORISTA', freight, assignment)` do hook centralizado.
 */
export function getDriverVisibleFreightPrice(
  input: DriverPriceVisibilityInput
): DriverPriceVisibilityResult {
  const required = Math.max(input.requiredTrucks || 1, 1);
  const freightPrice = typeof input.freightPrice === 'number' && Number.isFinite(input.freightPrice)
    ? input.freightPrice
    : 0;

  const visible = calculateVisiblePrice(
    'MOTORISTA',
    { id: '', price: freightPrice, required_trucks: required },
    input.assignmentAgreedPrice != null && input.assignmentAgreedPrice > 0
      ? {
          id: '',
          driver_id: '',
          agreed_price: input.assignmentAgreedPrice,
          pricing_type: 'FIXED' as const,
          status: 'ACCEPTED',
        }
      : null,
  );

  return {
    displayPrice: visible.displayPrice,
    displayMode: visible.displayMode === 'PER_TRUCK' ? 'PER_TRUCK' : 'TOTAL',
    originalRequiredTrucks: visible.truckCount,
  };
}
