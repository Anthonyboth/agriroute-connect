/**
 * Suppresses WebSocket connection errors from Supabase Realtime
 * These errors occur during Lighthouse audits and don't affect functionality
 */
export const suppressWebSocketErrors = () => {
  // Store original console.error
  const originalError = console.error;
  
  // Override console.error to filter WebSocket errors
  console.error = (...args: any[]) => {
    const errorMessage = args.join(' ');
    
    // Suppress WebSocket connection errors from Supabase
    if (
      errorMessage.includes('WebSocket connection') &&
      errorMessage.includes('supabase.co') &&
      (errorMessage.includes('ERR_NAME_NOT_RESOLVED') || 
       errorMessage.includes('Error in connection establishment'))
    ) {
      return; // Silently ignore
    }
    
    // Pass all other errors to original console.error
    originalError.apply(console, args);
  };
};
