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
      // Enhanced logging for transient DOM errors: include a short marker and the component stack
      // This helps trace the originating component/file via sourcemaps in logs
      try {
        console.warn('[DOM_TRANSIENT] Transient DOM error suppressed by ErrorBoundary', {
          message: msg,
          componentStack: errorInfo.componentStack?.split('\n').slice(0,4).join(' | '),
        });

        // Keep suppression (allow React to recover), but include a short debug marker
        console.debug('[DOM_TRANSIENT] componentStack (short):', errorInfo.componentStack?.split('\n').slice(0,4));
      } catch (e) {
        console.warn('[ErrorBoundary] Failed to format transient DOM stack', e);
      }

      // reset the boundary after a short delay to avoid leaving the UI broken
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined });
      }, 100);
      return;
    }

    console.error('ErrorBoundary caught error:', error, errorInfo);
    
    // Detect panel based on URL
    const currentPath = window.location.pathname;
    let panel = 'Desconhecido';
    if (currentPath.includes('/company')) panel = 'Transportadora';
    else if (currentPath.includes('/driver')) panel = 'Motorista';
    else if (currentPath.includes('/producer')) panel = 'Produtor';
    else if (currentPath.includes('/provider')) panel = 'Prestador';
    else if (currentPath.includes('/dashboard')) panel = 'Dashboard';
    
    // Send to monitoring with userFacing=true
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
      }).catch((e) => {
        console.error('[ErrorBoundary] Failed to report error to monitoring:', e);
      });
    }).catch((e) => {
      console.error('[ErrorBoundary] Failed to import errorMonitoringService:', e);
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
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Ocorreu um erro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                  <div>
                    <p className="font-semibold">Algo deu errado</p>
                    <p className="text-sm text-muted-foreground">
                      O erro foi reportado automaticamente. Se quiser, tente recarregar a página.
                    </p>
                    {this.state.errorLogId && (
                      <p className="text-xs text-muted-foreground mt-2">ID do erro: {this.state.errorLogId}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={this.handleRetry} disabled={this.state.retrying}>🔄 Reenviar</Button>
                  <Button variant="ghost" onClick={this.handleReset}>Recarregar</Button>
                </div>
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