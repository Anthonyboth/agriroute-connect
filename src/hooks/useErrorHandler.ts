import { useCallback } from 'react';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

export function useErrorHandler() {
  const handleError = useCallback((error: Error, context?: any) => {
    ErrorMonitoringService.getInstance().captureError(error, context);
  }, []);

  return handleError;
}
