import React from 'react';

interface SafeListWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface SafeListWrapperState {
  hasError: boolean;
}

/**
 * ErrorBoundary específico para capturar erros DOM de removeChild/insertBefore
 * que podem ocorrer durante reconciliação do React em listas dinâmicas.
 */
export class SafeListWrapper extends React.Component<SafeListWrapperProps, SafeListWrapperState> {
  constructor(props: SafeListWrapperProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    // Apenas capturar erros DOM específicos de removeChild/insertBefore
    if (error.name === 'NotFoundError' && 
        (error.message.includes('removeChild') || error.message.includes('insertBefore'))) {
      return { hasError: true };
    }
    // Re-throw outros erros para serem tratados por outros ErrorBoundaries
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[SafeListWrapper] DOM error caught and suppressed:', error.message);
  }

  componentDidUpdate() {
    // Auto-recuperar após 100ms
    if (this.state.hasError) {
      setTimeout(() => {
        this.setState({ hasError: false });
      }, 100);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="text-sm text-muted-foreground p-4 animate-pulse">
          Recarregando lista...
        </div>
      );
    }

    return this.props.children;
  }
}
