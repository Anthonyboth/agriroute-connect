import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, CheckCircle2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

/**
 * Global Error Boundary - wraps the entire app
 * Provides user-friendly error display with recovery options
 */
class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log to console for debugging
    console.error('🚨 GlobalErrorBoundary caught error:', error);
    console.error('Component stack:', errorInfo.componentStack);
    
    // Send to error monitoring service (if available)
    this.reportError(error, errorInfo);
  }

  private reportError = async (error: Error, errorInfo: ErrorInfo) => {
    try {
      // Dynamic import to avoid circular dependencies
      const { ErrorMonitoringService } = await import('@/services/errorMonitoringService');
      await ErrorMonitoringService.getInstance().captureError(error, {
        componentStack: errorInfo.componentStack,
        source: 'GlobalErrorBoundary',
        userFacing: true,
        module: 'App',
      });
    } catch (e) {
      console.error('Failed to report error:', e);
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleCopyError = async () => {
    const { error, errorInfo } = this.state;
    const errorDetails = {
      message: error?.message,
      stack: error?.stack?.slice(0, 1000),
      componentStack: errorInfo?.componentStack?.slice(0, 500),
      url: window.location.href,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(errorDetails, null, 2));
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (e) {
      console.error('Failed to copy error:', e);
    }
  };

  private handleClearAndReload = async () => {
    try {
      // Clear caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
      }
      
      // Unregister service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
      
      // Force reload
      window.location.reload();
    } catch (e) {
      // Fallback to simple reload
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const { error, copied } = this.state;
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-lg w-full shadow-lg">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 bg-destructive/10 rounded-full w-fit">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Ops! Algo deu errado</CardTitle>
              <CardDescription>
                Ocorreu um erro inesperado. Nossa equipe foi notificada.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {/* Error message (simplified) */}
              {error && (
                <div className="bg-muted rounded-lg p-3">
                  <p className="text-sm font-mono text-muted-foreground break-words">
                    {error.message?.slice(0, 200)}
                    {error.message && error.message.length > 200 && '...'}
                  </p>
                </div>
              )}
              
              {/* Primary actions */}
              <div className="grid gap-2">
                <Button onClick={this.handleReload} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Recarregar Página
                </Button>
                
                <Button variant="outline" onClick={this.handleGoHome} className="w-full">
                  <Home className="h-4 w-4 mr-2" />
                  Voltar ao Início
                </Button>
              </div>
              
              {/* Secondary actions */}
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={this.handleCopyError}
                  className="flex-1 text-muted-foreground"
                >
                  {copied ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-2 text-green-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar Erro
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={this.handleClearAndReload}
                  className="flex-1 text-muted-foreground"
                >
                  <Bug className="h-4 w-4 mr-2" />
                  Limpar Cache
                </Button>
              </div>
              
              {/* Help text */}
              <p className="text-xs text-center text-muted-foreground pt-2">
                Se o problema persistir, tente limpar o cache ou entre em contato com o suporte.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
