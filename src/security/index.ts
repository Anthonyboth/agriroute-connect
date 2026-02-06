/**
 * src/security/index.ts
 *
 * Ponto de entrada centralizado para todos os módulos de segurança do frete rural.
 *
 * Importações:
 *   import { assertValidTransition, formatPriceForUser, getStatusLabelPtBR } from '@/security';
 */

// Workflow Guard
export {
  canTransition,
  getNextAllowedStatus,
  assertValidTransition,
  getUserAllowedActions,
  canReportDelivery,
  canConfirmDelivery,
  canConfirmPayment,
  getStatusLabelPtBR as getWorkflowStatusLabel,
  FreightWorkflowError,
  WORKFLOW_ORDER,
  TERMINAL_STATUSES,
  STATUS_LABELS_PTBR,
} from './freightWorkflowGuard';

export type {
  FreightWorkflowStatus,
  UserRole,
  TransitionValidation,
} from './freightWorkflowGuard';

// Multi-Truck Price Guard
export {
  assertPriceIsPerTruck,
  getPricePerTruck,
  formatPriceForUser,
  validatePriceConsistency,
} from './multiTruckPriceGuard';

export type {
  PriceContext,
  PriceGuardInput,
  PriceGuardResult,
  PriceGuardError,
} from './multiTruckPriceGuard';

// i18n Guard
export {
  getStatusLabelPtBR,
  getActionLabelPtBR,
  detectForbiddenTerms,
  sanitizeForDisplay,
  guardStatusDisplay,
} from './i18nGuard';
