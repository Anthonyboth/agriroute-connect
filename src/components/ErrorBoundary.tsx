import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = String(error?.message || '');
    const isDOMTransient = msg.includes('removeChild') || msg.includes('insertBefore') || msg.includes('Cannot read properties of null');

    if (isDOMTransient) {
      console.warn('Transient DOM error suppressed by ErrorBoundary:', error);
      // Allow React to recover, then reset boundary
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined });
      }, 100);
      return;
    }

    console.error('ErrorBoundary caught error:', error, errorInfo);
    
    // Enviar para monitoring
    import('@/services/errorMonitoringService').then(({ ErrorMonitoringService }) => {
      ErrorMonitoringService.getInstance().captureError(error, {
        componentStack: errorInfo.componentStack,
        source: 'ErrorBoundary',
        module: 'ErrorBoundary'
      });
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-destructive/10 rounded-full">
                  <AlertTriangle className="h-6 w-6 text-destructive" />
                </div>
                <CardTitle>Algo deu errado</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Desculpe, ocorreu um erro inesperado. Nossa equipe foi notificada e está trabalhando na correção.
              </p>
              
              {this.state.error && (
                <details className="text-sm bg-muted p-3 rounded-lg">
                  <summary className="cursor-pointer font-medium mb-2">
                    Detalhes técnicos
                  </summary>
                  <code className="text-xs block whitespace-pre-wrap break-words">
                    {this.state.error.message}
                  </code>
                </details>
              )}
              
              <div className="flex gap-2">
                <Button 
                  onClick={this.handleReset}
                  className="flex-1"
                >
                  Tentar Novamente
                </Button>
                <Button 
                  variant="outline"
                  onClick={() => window.location.href = '/'}
                  className="flex-1"
                >
                  Ir para Início
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
