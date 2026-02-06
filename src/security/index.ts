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

// Freight Action Dispatcher
export {
  canDispatch,
  checkStateConsistency,
  getAvailableActions,
} from './freightActionDispatcher';

export type {
  FreightAction,
  DispatchInput,
  DispatchResult,
  ConsistencyCheck,
} from './freightActionDispatcher';

// Service Request Workflow Guard (Fretes Urbanos)
export {
  canTransitionSR,
  assertValidTransitionSR,
  getNextAllowedStatusSR,
  getAllowedActions as getServiceRequestAllowedActions,
  getServiceRequestStatusLabelPtBR,
  getServiceRequestActionLabelPtBR,
  getServiceTypeLabelPtBR,
  detectForbiddenServiceTerms,
  sanitizeServiceUiTextPtBR,
  canAutoExpire,
  getExpirationHours,
  ServiceRequestWorkflowError,
  SERVICE_REQUEST_WORKFLOW_ORDER,
  SERVICE_REQUEST_TERMINAL_STATUSES,
  SERVICE_REQUEST_STATUS_LABELS,
  SERVICE_REQUEST_ACTION_LABELS,
  SERVICE_TYPE_LABELS,
  SERVICE_REQUEST_EXPIRATION_HOURS,
} from './serviceRequestWorkflowGuard';

export type {
  ServiceRequestStatus,
  ServiceRequestType,
  ServiceRequestRole,
  ServiceRequestAction,
  ServiceRequestTransitionValidation,
} from './serviceRequestWorkflowGuard';

// Freight Action Matrix (Matriz de ações por status × papel)
export {
  queryActionMatrix,
  isActionAllowed,
  getRolesWithActions,
  shouldEnterSafeMode,
} from './freightActionMatrix';

export type {
  MatrixAction,
  ActionDefinition,
  MatrixQuery,
  MatrixResult,
} from './freightActionMatrix';

// Payment Closure Guard (Pagamento, Confirmação, Avaliação e Encerramento)
export {
  canCreateExternalPayment,
  canMarkPaidByProducer,
  canConfirmReceivedByDriver,
  assertValidPaymentTransition,
  canCloseFreightAsCompleted,
  canCloseMultiTruckFreight,
  canRateFreight,
  canRateServiceRequest,
  getPaymentUILabelPtBR,
  getPaymentActionLabelPtBR,
  getPaymentStatusExplanation,
  PaymentClosureError,
} from './paymentClosureGuard';

export type {
  PaymentStatus,
  PaymentActorRole,
  FreightClosureStatus,
  PaymentTransitionValidation,
  ClosureValidation,
  RatingValidation,
} from './paymentClosureGuard';
