/**
 * AppLoader - Componente de loading unificado do AgriRoute
 * 
 * REGRA CRÍTICA (PRODUÇÃO):
 * - SPINNER ÚNICO: Apenas um spinner verde centralizado
 * - SEM TEXTO: Nenhuma mensagem de loading
 * - Cor: Verde AgriRoute (text-primary)
 * - Centralizado na tela
 * 
 * Modos:
 * - fullscreen: Overlay bloqueante para boot/auth (SEM TEXTO)
 * - inline: Para seções/tabs específicas (SEM TEXTO)
 * - minimal: Spinner pequeno (SEM TEXTO)
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
  /** @deprecated Não usar - sistema padronizado sem texto */
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

export const AppLoader: React.FC<AppLoaderProps> = ({
  variant = 'inline',
  size = 'md',
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
        aria-label="Carregando"
      >
        <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div 
        className={cn("flex items-center justify-center p-2", className)}
        role="status"
        aria-label="Carregando"
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
      aria-label="Carregando"
    >
      <Loader2 className={cn(sizeClasses[size], "animate-spin text-primary")} />
    </div>
  );
};

/**
 * GlobalLoader - Spinner único global do AgriRoute
 * Verde, centralizado, SEM TEXTO
 */
export const GlobalLoader: React.FC = () => (
  <AppLoader 
    variant="fullscreen" 
    size="lg" 
    debugId="global-loader"
  />
);

/**
 * AuthLoader - Loader para fluxo de autenticação
 * @deprecated Use GlobalLoader - sistema padronizado sem texto
 */
export const AuthLoader: React.FC<{ message?: string }> = () => (
  <GlobalLoader />
);

/**
 * DashboardLoader - Loader para carregamento inicial do dashboard
 * @deprecated Use GlobalLoader - sistema padronizado sem texto
 */
export const DashboardLoader: React.FC<{ message?: string }> = () => (
  <GlobalLoader />
);

/**
 * SectionLoader - Loader para seções/tabs específicas
 * Spinner inline SEM TEXTO
 */
export const SectionLoader: React.FC<{ message?: string }> = () => (
  <AppLoader 
    variant="inline" 
    size="md" 
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
