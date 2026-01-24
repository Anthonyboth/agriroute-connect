import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export class AuthErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Auth Error:', error, errorInfo);
  }

  handleRetry = () => {
    // ✅ Preserve current URL params (mode, role) on retry
    window.location.reload();
  };

  handleGoToAuth = () => {
    // ✅ Preserve mode from current URL if available
    const currentUrl = new URL(window.location.href);
    const mode = currentUrl.searchParams.get('mode') || 'login';
    const role = currentUrl.searchParams.get('role');
    
    let authUrl = `/auth?mode=${mode}`;
    if (role && mode === 'signup') {
      authUrl += `&role=${role}`;
    }
    
    window.location.href = authUrl;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-6">
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-2xl font-bold">Erro ao carregar autenticação</h2>
            <p className="text-muted-foreground">
              {this.state.error?.message || 'Ocorreu um erro inesperado'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button onClick={this.handleRetry}>
                Tentar Novamente
              </Button>
              <Button variant="outline" onClick={this.handleGoToAuth}>
                Ir para Login
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
