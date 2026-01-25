/**
 * ✅ RELEASE HARDENING: Action Telemetry
 * 
 * Standardized logging for critical actions to prove when production diverges from preview.
 * Sends ACTION_START, ACTION_SUCCESS, ACTION_FAIL events.
 */

import { supabase } from '@/integrations/supabase/client';
import { ENV, PLATFORM, getEnvironmentInfo } from '@/config/env';

type ActionStatus = 'START' | 'SUCCESS' | 'FAIL';

interface ActionLog {
  action: string;
  status: ActionStatus;
  duration?: number;
  error?: string;
  metadata?: Record<string, any>;
}

// Keep track of action start times
const actionTimers = new Map<string, number>();

/**
 * Log action start
 */
export function logActionStart(action: string, metadata?: Record<string, any>): string {
  const actionId = `${action}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  actionTimers.set(actionId, Date.now());

  const log: ActionLog = {
    action,
    status: 'START',
    metadata,
  };

  console.debug(`[ACTION] ${action} START`, { actionId, ...metadata });

  // Only send to backend in production and for critical actions
  if (ENV.IS_PRODUCTION && isCriticalAction(action)) {
    sendToBackend(log, actionId).catch(() => {});
  }

  return actionId;
}

/**
 * Log action success
 */
export function logActionSuccess(
  actionId: string,
  action: string,
  metadata?: Record<string, any>
): void {
  const startTime = actionTimers.get(actionId);
  const duration = startTime ? Date.now() - startTime : undefined;
  actionTimers.delete(actionId);

  const log: ActionLog = {
    action,
    status: 'SUCCESS',
    duration,
    metadata,
  };

  console.debug(`[ACTION] ${action} SUCCESS`, { actionId, duration, ...metadata });

  // Only send to backend in production and for critical actions
  if (ENV.IS_PRODUCTION && isCriticalAction(action)) {
    sendToBackend(log, actionId).catch(() => {});
  }
}

/**
 * Log action failure
 */
export function logActionFail(
  actionId: string,
  action: string,
  error: Error | string,
  metadata?: Record<string, any>
): void {
  const startTime = actionTimers.get(actionId);
  const duration = startTime ? Date.now() - startTime : undefined;
  actionTimers.delete(actionId);

  const errorMessage = error instanceof Error ? error.message : String(error);

  const log: ActionLog = {
    action,
    status: 'FAIL',
    duration,
    error: errorMessage,
    metadata,
  };

  console.error(`[ACTION] ${action} FAIL`, { actionId, duration, error: errorMessage, ...metadata });

  // Always send failures to backend
  sendToBackend(log, actionId).catch(() => {});
}

/**
 * Check if action is critical (worth logging to backend)
 */
function isCriticalAction(action: string): boolean {
  const criticalActions = [
    'LOGIN',
    'SIGNUP',
    'LOGOUT',
    'CREATE_FREIGHT',
    'CREATE_SERVICE',
    'CANCEL_FREIGHT',
    'CANCEL_SERVICE',
    'ACCEPT_PROPOSAL',
    'REJECT_PROPOSAL',
    'CONFIRM_DELIVERY',
    'UPLOAD_CERTIFICATE',
    'PAYMENT',
    'MODAL_OPEN',
    'AUTH_MODAL',
  ];

  return criticalActions.some((ca) => action.toUpperCase().includes(ca));
}

/**
 * Send log to backend
 */
async function sendToBackend(log: ActionLog, actionId: string): Promise<void> {
  try {
    const envInfo = getEnvironmentInfo();

    await supabase.functions.invoke('report-error', {
      body: {
        errorType: log.status === 'FAIL' ? 'ACTION_FAIL' : 'ACTION_LOG',
        errorMessage: log.status === 'FAIL' 
          ? `${log.action} failed: ${log.error}`
          : `${log.action} ${log.status}`,
        context: {
          actionId,
          action: log.action,
          status: log.status,
          duration: log.duration,
          error: log.error,
          metadata: log.metadata,
          ...envInfo,
          url: typeof window !== 'undefined' ? window.location.href : 'N/A',
          timestamp: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    // Silent fail - don't break the app for logging
    console.debug('[Telemetry] Failed to send log:', error);
  }
}

/**
 * Wrap an async function with telemetry
 */
export function withTelemetry<T>(
  action: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const actionId = logActionStart(action, metadata);

  return fn()
    .then((result) => {
      logActionSuccess(actionId, action, metadata);
      return result;
    })
    .catch((error) => {
      logActionFail(actionId, action, error, metadata);
      throw error;
    });
}

/**
 * Hook for using telemetry in React components
 */
export function useTelemetry() {
  return {
    logStart: logActionStart,
    logSuccess: logActionSuccess,
    logFail: logActionFail,
    withTelemetry,
  };
}

export default {
  logActionStart,
  logActionSuccess,
  logActionFail,
  withTelemetry,
  useTelemetry,
};
