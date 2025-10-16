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
  retrying?: boolean;
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
    
    // Detectar painel baseado na URL
    const currentPath = window.location.pathname;
    let panel = 'Desconhecido';
    if (currentPath.includes('/company')) panel = 'Transportadora';
    else if (currentPath.includes('/driver')) panel = 'Motorista';
    else if (currentPath.includes('/producer')) panel = 'Produtor';
    else if (currentPath.includes('/provider')) panel = 'Prestador';
    else if (currentPath.includes('/dashboard')) panel = 'Dashboard';
    
    // Enviar para monitoring com userFacing=true
    import('@/services/errorMonitoringService').then(({ ErrorMonitoringService }) => {
      ErrorMonitoringService.getInstance().captureError(error, {
        componentStack: errorInfo.componentStack,
        source: 'frontend',
        module: 'ErrorBoundary',
        panel,
        userFacing: true
      }).then(result => {
        this.setState({
          notified: result.notified,
          errorLogId: result.errorLogId
        });
      });
    });
  }

  private handleRetry = async () => {
    if (this.state.retrying) return;

    this.setState({ retrying: true });
    
    try {
      const { ErrorMonitoringService } = await import('@/services/errorMonitoringService');
      const result = await ErrorMonitoringService.getInstance().captureError(
        this.state.error!,
        {
          source: 'frontend',
          module: 'ErrorBoundary',
          userFacing: true,
          retry: true
        }
      );
      
      this.setState({ 
        notified: result.notified,
        errorLogId: result.errorLogId,
        retrying: false
      });
    } catch (err) {
      console.error('[ErrorBoundary] Falha no reenvio:', err);
      this.setState({ retrying: false });
    }
  };

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
                
                {this.state.notified && this.state.errorLogId && (
                  <div className="rounded-md bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
                    <div className="font-medium">✓ Alerta enviado ao suporte</div>
                    <div className="text-xs mt-1 opacity-75">ID: {this.state.errorLogId}</div>
                  </div>
                )}
                
                {this.state.notified === false && (
                  <div className="space-y-2">
                    <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-3 text-sm text-yellow-800 dark:text-yellow-200">
                      ⚠️ Erro registrado, reenvio pendente
                      {this.state.errorLogId && (
                        <div className="text-xs mt-1 opacity-75">ID: {this.state.errorLogId}</div>
                      )}
                    </div>
                    <button
                      onClick={this.handleRetry}
                      disabled={this.state.retrying}
                      className="px-3 py-1.5 text-sm bg-yellow-100 dark:bg-yellow-900/40 text-yellow-900 dark:text-yellow-100 rounded hover:bg-yellow-200 dark:hover:bg-yellow-900/60 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {this.state.retrying ? 'Enviando...' : '🔄 Enviar novamente'}
                    </button>
                  </div>
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
