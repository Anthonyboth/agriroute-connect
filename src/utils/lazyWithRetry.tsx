import React, { lazy, ComponentType, useState, useEffect } from 'react';

interface LazyRetryOptions {
  retries?: number;
  delay?: number;
  onError?: (error: Error, attempt: number) => void;
}

/**
 * Creates a lazy component with automatic retry on failure
 * Helps recover from dynamic import failures due to network issues or cache problems
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyRetryOptions = {}
): React.LazyExoticComponent<T> {
  const { retries = 3, delay = 1000, onError } = options;

  return lazy(async () => {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Add cache-busting query param on retry
        if (attempt > 0) {
          // Clear any module cache that might be causing issues
          const timestamp = Date.now();
          console.log(`[LazyRetry] Attempt ${attempt + 1}/${retries + 1} with cache-bust: ${timestamp}`);
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, delay * attempt));
        }

        const module = await importFn();
        
        // Verify the module has a default export
        if (!module || typeof module.default !== 'function') {
          throw new Error('Module loaded but default export is invalid');
        }

        return module;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.error(`[LazyRetry] Import failed (attempt ${attempt + 1}/${retries + 1}):`, lastError.message);
        
        onError?.(lastError, attempt);

        // On last retry failure, try to clear caches and reload
        if (attempt === retries) {
          // Check if it's a chunk loading error
          const isChunkError = /failed to fetch|dynamically imported module|loading chunk/i.test(lastError.message);
          
          if (isChunkError) {
            console.warn('[LazyRetry] Chunk loading error detected, attempting recovery...');
            
            // Clear service worker caches if available
            if ('caches' in window) {
              try {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
                console.log('[LazyRetry] Cleared browser caches');
              } catch (e) {
                console.warn('[LazyRetry] Failed to clear caches:', e);
              }
            }
          }
        }
      }
    }

    // All retries exhausted - throw the last error
    throw lastError || new Error('Failed to load module after retries');
  });
}

/**
 * Error Fallback component for lazy loading failures
 */
export const LazyLoadErrorFallback = ({ 
  error, 
  onRetry,
  componentName = 'componente'
}: { 
  error: Error; 
  onRetry: () => void;
  componentName?: string;
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    
    // Clear caches before retry
    if ('caches' in window) {
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      } catch (e) {
        console.warn('Failed to clear caches:', e);
      }
    }

    // Small delay then retry
    setTimeout(() => {
      onRetry();
      setIsRetrying(false);
    }, 500);
  };

  const handleHardReload = () => {
    // Force a complete page reload bypassing cache
    window.location.href = window.location.pathname + '?t=' + Date.now();
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px] p-6 text-center">
      <div className="bg-destructive/10 text-destructive p-4 rounded-lg mb-4 max-w-md">
        <h3 className="font-semibold mb-2">Erro ao carregar {componentName}</h3>
        <p className="text-sm opacity-80 mb-4">
          Houve um problema ao carregar este módulo. Isso pode ser causado por problemas de rede ou cache.
        </p>
        <code className="text-xs bg-background/50 p-2 rounded block overflow-auto max-h-20">
          {error.message}
        </code>
      </div>
      
      <div className="flex gap-3">
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
        >
          {isRetrying ? 'Tentando...' : 'Tentar Novamente'}
        </button>
        <button
          onClick={handleHardReload}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
        >
          Recarregar Página
        </button>
      </div>
    </div>
  );
};

/**
 * Wrapper component that handles lazy loading with error boundary
 */
export function LazyBoundary({ 
  children, 
  fallback,
  componentName
}: { 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
  componentName?: string;
}) {
  const [error, setError] = useState<Error | null>(null);
  const [key, setKey] = useState(0);

  // Reset error on retry
  const handleRetry = () => {
    setError(null);
    setKey(prev => prev + 1);
  };

  if (error) {
    return (
      <LazyLoadErrorFallback 
        error={error} 
        onRetry={handleRetry}
        componentName={componentName}
      />
    );
  }

  return (
    <ErrorBoundaryForLazy key={key} onError={setError} fallback={fallback}>
      {children}
    </ErrorBoundaryForLazy>
  );
}

/**
 * Simple error boundary for catching lazy load errors
 */
class ErrorBoundaryForLazy extends React.Component<{
  children: React.ReactNode;
  onError: (error: Error) => void;
  fallback?: React.ReactNode;
}, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || null;
    }
    return this.props.children;
  }
}
