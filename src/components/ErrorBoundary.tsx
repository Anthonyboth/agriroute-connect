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
  notified?: boolean;
  errorLogId?: string;
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
    
    // Enviar para monitoring e receber status
    import('@/services/errorMonitoringService').then(({ ErrorMonitoringService }) => {
      ErrorMonitoringService.getInstance().captureError(error, {
        componentStack: errorInfo.componentStack,
        source: 'ErrorBoundary',
        module: 'ErrorBoundary'
      }).then(result => {
        this.setState({
          notified: result.notified,
          errorLogId: result.errorLogId
        });
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
              <div className="space-y-2">
                <p className="text-muted-foreground">
                  Desculpe, ocorreu um erro inesperado.
                </p>
                
                {this.state.notified !== undefined && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${
                    this.state.notified 
                      ? 'bg-green-50 dark:bg-green-950/30 text-green-800 dark:text-green-200' 
                      : 'bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-200'
                  }`}>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      this.state.notified 
                        ? 'bg-green-600 text-white' 
                        : 'bg-yellow-600 text-white'
                    }`}>
                      {this.state.notified ? '✓ Notificado' : 'ℹ Registrado'}
                    </span>
                    <span>
                      {this.state.notified 
                        ? 'Alerta enviado ao suporte. Estamos trabalhando na correção.'
                        : 'Erro registrado no sistema. Notificação será enviada se recorrer.'}
                    </span>
                  </div>
                )}
                
                {this.state.errorLogId && (
                  <p className="text-xs text-muted-foreground">
                    ID do erro: <code className="bg-muted px-1 py-0.5 rounded">{this.state.errorLogId}</code>
                  </p>
                )}
              </div>
              
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
