/**
 * Utility to add timeout to any promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string = 'operation'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const error = new Error(`Timeout: ${operationName} exceeded ${timeoutMs}ms`);
      (error as any).isTimeout = true;
      (error as any).operationName = operationName;
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Single-flight utility: ensures only one instance of an operation is in-flight at a time
 * Subsequent calls while an operation is in-flight will wait for and share the same result
 */
const inFlightOperations = new Map<string, Promise<any>>();

export function singleFlight<T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> {
  // Check if operation is already in-flight
  const existing = inFlightOperations.get(key);
  if (existing) {
    if (import.meta.env.DEV) {
      console.log(`[SingleFlight] Reusing in-flight operation: ${key}`);
    }
    return existing as Promise<T>;
  }

  // Start new operation
  const promise = operation()
    .finally(() => {
      // Clean up once operation completes (success or failure)
      inFlightOperations.delete(key);
    });

  inFlightOperations.set(key, promise);
  return promise;
}
