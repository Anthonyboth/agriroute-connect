import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Trash2, Copy } from 'lucide-react';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';
import { isChunkLoadError, hardResetPWA, getDiagnosticInfo } from '@/utils/pwaRecovery';

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
  isChunkError?: boolean;
  isClearing?: boolean;
  diagnosticCopied?: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    const isChunk = isChunkLoadError(error);
    return { hasError: true, error, isChunkError: isChunk };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const msg = String(error?.message || '');
    const isDOMTransient = msg.includes('removeChild') || msg.includes('insertBefore') || msg.includes('Cannot read properties of null');

    if (isDOMTransient) {
      console.warn('Transient DOM error (will be reported):', error);
      
      // ✅ Reportar erro DOM ao sistema de monitoramento
      ErrorMonitoringService.getInstance().captureError(error, {
        componentStack: errorInfo.componentStack,
        source: 'frontend',
        module: 'ErrorBoundary',
        errorType: 'DOM_TRANSIENT',
        userFacing: false
      });
      
      // Allow React to recover, then reset boundary
      setTimeout(() => {
        this.setState({ hasError: false, error: undefined });
      }, 100);
      return;
    }

    console.error('ErrorBoundary caught error:', error, errorInfo);
    console.error('🚨 ErrorBoundary detalhes:', {
      message: error.message,
      name: error.name,
      stack: error.stack?.slice(0, 500),
      componentStack: errorInfo.componentStack?.slice(0, 500),
      timestamp: new Date().toISOString(),
      location: window.location.pathname
    });
    
    // Detectar painel baseado na URL
    const currentPath = window.location.pathname;
    let panel = 'Desconhecido';
    if (currentPath.includes('/company')) panel = 'Transportadora';
    else if (currentPath.includes('/driver')) panel = 'Motorista';
    else if (currentPath.includes('/producer')) panel = 'Produtor';
    else if (currentPath.includes('/provider')) panel = 'Prestador';
    else if (currentPath.includes('/dashboard')) panel = 'Dashboard';
    
    // Enviar para monitoring com userFacing=true
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
  }

  private handleRetry = async () => {
    if (this.state.retrying) return;

    this.setState({ retrying: true });
    
    try {
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

  private handleClearCache = async () => {
    this.setState({ isClearing: true });
    try {
      await hardResetPWA('error_boundary_manual');
    } catch (e) {
      // Se falhar, pelo menos recarrega
      window.location.reload();
    }
  };

  private handleCopyDiagnostic = async () => {
    try {
      const info = await getDiagnosticInfo();
      info.error = this.state.error?.message;
      info.errorStack = this.state.error?.stack?.slice(0, 500);
      await navigator.clipboard.writeText(JSON.stringify(info, null, 2));
      this.setState({ diagnosticCopied: true });
      setTimeout(() => this.setState({ diagnosticCopied: false }), 2000);
    } catch (e) {
      console.error('Falha ao copiar diagnóstico:', e);
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // UI especial para erros de chunk/PWA
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="max-w-md w-full">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-full">
                    <RefreshCw className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <CardTitle>Atualização Detectada</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  Uma nova versão do app foi publicada. Vamos limpar o cache para recuperar.
                </p>
                
                <div className="rounded-md bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
                  💡 Isso acontece quando há uma atualização enquanto você usava o app.
                </div>
                
                <div className="flex flex-col gap-2">
                  <Button 
                    onClick={this.handleClearCache}
                    disabled={this.state.isClearing}
                    className="w-full"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {this.state.isClearing ? 'Limpando...' : 'Limpar Cache e Recarregar'}
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={this.handleReset}
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Apenas Recarregar
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={this.handleCopyDiagnostic}
                    className="w-full text-muted-foreground"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    {this.state.diagnosticCopied ? '✓ Copiado!' : 'Copiar Diagnóstico'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      }

      // UI padrão para outros erros
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
              
              <div className="flex flex-col gap-2">
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
                <Button 
                  variant="ghost"
                  onClick={this.handleClearCache}
                  disabled={this.state.isClearing}
                  className="w-full text-muted-foreground"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {this.state.isClearing ? 'Limpando...' : 'Limpar Cache do App'}
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
