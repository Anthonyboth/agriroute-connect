/**
 * AuthGate Component
 * 
 * Prevents indefinite loading on auth/revalidation screens
 * Shows timeout with CTAs after hard timeout (~12s)
 * Includes minimum delay to prevent flashing
 * Avoids infinite loops by using proper state management
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ComponentLoader } from '@/components/LazyComponents';

export interface AuthGateProps {
  /**
   * Minimum delay before showing content (prevents flash)
   * Default: 500ms
   */
  minDelay?: number;

  /**
   * Hard timeout before showing error CTAs
   * Default: 12000ms (12 seconds)
   */
  hardTimeout?: number;

  /**
   * Loading state from auth
   */
  loading: boolean;

  /**
   * Whether user is authenticated
   */
  isAuthenticated: boolean;

  /**
   * Whether user profile loaded
   */
  hasProfile: boolean;

  /**
   * Children to render when auth is ready
   */
  children: React.ReactNode;

  /**
   * Custom timeout message
   */
  timeoutMessage?: string;

  /**
   * Custom timeout description
   */
  timeoutDescription?: string;
}

export function AuthGate({
  minDelay = 500,
  hardTimeout = 12000,
  loading,
  isAuthenticated,
  hasProfile,
  children,
  timeoutMessage = 'Revalidação Demorando',
  timeoutDescription = 'A autenticação está demorando mais que o esperado. Tente recarregar ou fazer login novamente.',
}: AuthGateProps) {
  const navigate = useNavigate();
  const [minDelayElapsed, setMinDelayElapsed] = useState(false);
  const [hardTimeoutElapsed, setHardTimeoutElapsed] = useState(false);
  const minDelayTimerRef = useRef<NodeJS.Timeout>();
  const hardTimeoutTimerRef = useRef<NodeJS.Timeout>();

  // Minimum delay timer
  useEffect(() => {
    minDelayTimerRef.current = setTimeout(() => {
      setMinDelayElapsed(true);
    }, minDelay);

    return () => {
      if (minDelayTimerRef.current) {
        clearTimeout(minDelayTimerRef.current);
      }
    };
  }, [minDelay]);

  // Hard timeout timer - only active when loading
  useEffect(() => {
    if (loading && !hardTimeoutElapsed) {
      hardTimeoutTimerRef.current = setTimeout(() => {
        setHardTimeoutElapsed(true);
      }, hardTimeout);

      return () => {
        if (hardTimeoutTimerRef.current) {
          clearTimeout(hardTimeoutTimerRef.current);
        }
      };
    } else if (!loading) {
      // Reset hard timeout when loading completes
      setHardTimeoutElapsed(false);
      if (hardTimeoutTimerRef.current) {
        clearTimeout(hardTimeoutTimerRef.current);
      }
    }
  }, [loading, hardTimeout, hardTimeoutElapsed]);

  // Show loading until minimum delay passes
  if (!minDelayElapsed) {
    return <ComponentLoader />;
  }

  // Hard timeout elapsed - show error with CTAs
  if (hardTimeoutElapsed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="text-center space-y-6 max-w-md">
          <AlertCircle className="h-16 w-16 mx-auto text-warning" />
          <div className="space-y-2">
            <h2 className="text-2xl font-bold">{timeoutMessage}</h2>
            <p className="text-muted-foreground">
              {timeoutDescription}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              onClick={() => window.location.reload()} 
              variant="default"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Recarregar Página
            </Button>
            <Button 
              onClick={() => navigate('/auth')} 
              variant="outline"
              className="gap-2"
            >
              <LogIn className="h-4 w-4" />
              Ir para Login
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Se o problema persistir, limpe o cache do navegador ou entre em contato com o suporte.
          </p>
        </div>
      </div>
    );
  }

  // Still loading and within timeout - show loader
  if (loading) {
    return <ComponentLoader />;
  }

  // Not authenticated - should redirect (but don't show error here)
  if (!isAuthenticated) {
    return <ComponentLoader />;
  }

  // Authenticated but no profile - might be creating profile
  if (!hasProfile) {
    return <ComponentLoader />;
  }

  // All good - render children
  return <>{children}</>;
}
