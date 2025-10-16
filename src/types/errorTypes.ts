export type ErrorType = 'FRONTEND' | 'BACKEND' | 'DATABASE' | 'NETWORK' | 'PAYMENT';
export type ErrorCategory = 'SIMPLE' | 'CRITICAL';
export type ErrorStatus = 'NEW' | 'AUTO_FIXED' | 'PERSISTENT' | 'NOTIFIED' | 'RESOLVED';

export interface ErrorReport {
  errorType: ErrorType;
  errorCategory: ErrorCategory;
  errorMessage: string;
  errorStack?: string;
  errorCode?: string;
  module?: string;
  functionName?: string;
  route?: string;
  userId?: string;
  userEmail?: string;
  autoCorrectionAttempted: boolean;
  autoCorrectionAction?: string;
  autoCorrectionSuccess?: boolean;
  metadata?: Record<string, any>;
}

export interface ErrorLog extends ErrorReport {
  id: string;
  created_at: string;
  status: ErrorStatus;
  telegram_notified: boolean;
  telegram_sent_at?: string;
}

export interface AutoCorrectionResult {
  attempted: boolean;
  action: string;
  success: boolean;
}
