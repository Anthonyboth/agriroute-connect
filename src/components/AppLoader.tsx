/**
 * AppLoader - Componente de loading unificado do AgriRoute
 * 
 * Resolve o problema de múltiplos spinners em diferentes posições.
 * 
 * Modos:
 * - fullscreen: Overlay bloqueante para boot/auth
 * - inline: Para seções/tabs específicas
 * - minimal: Spinner pequeno sem texto
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AppLoaderVariant = 'fullscreen' | 'inline' | 'minimal';
export type AppLoaderSize = 'sm' | 'md' | 'lg';

interface AppLoaderProps {
  /** Variante do loader */
  variant?: AppLoaderVariant;
  /** Tamanho do spinner */
  size?: AppLoaderSize;
  /** Texto a exibir abaixo do spinner */
  text?: string;
  /** Classe CSS adicional */
  className?: string;
  /** ID para debugging */
  debugId?: string;
}

const sizeClasses: Record<AppLoaderSize, string> = {
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
};

const textSizeClasses: Record<AppLoaderSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export const AppLoader: React.FC<AppLoaderProps> = ({
  variant = 'inline',
  size = 'md',
  text,
  className,
  debugId,
}) => {
  // Log de debug apenas em dev
  React.useEffect(() => {
    if (import.meta.env.DEV && debugId) {
      console.log(`[AppLoader:${debugId}] mounted (variant=${variant})`);
      return () => {
        console.log(`[AppLoader:${debugId}] unmounted`);
      };
    }
  }, [debugId, variant]);

  if (variant === 'fullscreen') {
    return (
      <div 
        className={cn(
          "fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm",
          className
        )}
        role="status"
        aria-label={text || 'Carregando...'}
      >
        <div className="flex flex-col items-center gap-4">
          <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
          {text && (
            <p className={cn("text-muted-foreground animate-pulse", textSizeClasses[size])}>
              {text}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div 
        className={cn("flex items-center justify-center p-2", className)}
        role="status"
        aria-label="Carregando..."
      >
        <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
      </div>
    );
  }

  // variant === 'inline' (default)
  return (
    <div 
      className={cn(
        "flex items-center justify-center min-h-[200px] p-8",
        className
      )}
      role="status"
      aria-label={text || 'Carregando...'}
    >
      <div className="flex flex-col items-center gap-3">
        <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
        {text && (
          <p className={cn("text-muted-foreground", textSizeClasses[size])}>
            {text}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * AuthLoader - Loader específico para fluxo de autenticação
 * Centralizado e com mensagem contextual
 */
export const AuthLoader: React.FC<{ message?: string }> = ({ 
  message = 'Verificando autenticação...' 
}) => (
  <AppLoader 
    variant="fullscreen" 
    size="lg" 
    text={message}
    debugId="auth-loader"
  />
);

/**
 * DashboardLoader - Loader para carregamento inicial do dashboard
 */
export const DashboardLoader: React.FC<{ message?: string }> = ({ 
  message = 'Carregando painel...' 
}) => (
  <AppLoader 
    variant="fullscreen" 
    size="lg" 
    text={message}
    debugId="dashboard-loader"
  />
);

/**
 * SectionLoader - Loader para seções/tabs específicas
 */
export const SectionLoader: React.FC<{ message?: string }> = ({ 
  message 
}) => (
  <AppLoader 
    variant="inline" 
    size="md" 
    text={message}
    debugId="section-loader"
  />
);

/**
 * Hook para medir tempo de loading (apenas dev)
 */
export const useLoadingMetrics = (label: string) => {
  const startTimeRef = React.useRef<number>(Date.now());
  
  React.useEffect(() => {
    startTimeRef.current = Date.now();
    
    return () => {
      if (import.meta.env.DEV) {
        const elapsed = Date.now() - startTimeRef.current;
        console.log(`⏱️ [${label}] Loading time: ${elapsed}ms`);
      }
    };
  }, [label]);
  
  return {
    getElapsed: () => Date.now() - startTimeRef.current,
  };
};

export default AppLoader;
