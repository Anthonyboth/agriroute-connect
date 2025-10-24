import React from 'react';

interface PageDOMErrorBoundaryProps {
  children: React.ReactNode;
}

interface PageDOMErrorBoundaryState {
  hasError: boolean;
  retryCount: number;
}

const MAX_RETRIES = 3;

/**
 * ErrorBoundary de escopo amplo que captura e suprime erros DOM transitórios
 * (removeChild/insertBefore NotFoundError) em páginas com conteúdo dinâmico complexo.
 * 
 * Diferente do SafeListWrapper (focado em listas), este boundary protege
 * árvores de componentes inteiras, permitindo soft-retry sem fallback visual.
 */
export class PageDOMErrorBoundary extends React.Component<
  PageDOMErrorBoundaryProps,
  PageDOMErrorBoundaryState
> {
  constructor(props: PageDOMErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<PageDOMErrorBoundaryState> | null {
    // Capturar APENAS NotFoundError de removeChild/insertBefore
    if (
      error.name === 'NotFoundError' &&
      (error.message.includes('removeChild') || error.message.includes('insertBefore'))
    ) {
      return { hasError: true };
    }
    // Re-throw outros erros para ErrorBoundaries superiores tratarem
    throw error;
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn(
      '[PageDOMErrorBoundary] DOM error capturado e suprimido:',
      error.message,
      '- Tentativa:', this.state.retryCount + 1
    );
  }

  componentDidUpdate(
    prevProps: PageDOMErrorBoundaryProps,
    prevState: PageDOMErrorBoundaryState
  ) {
    // Auto-recuperar com soft-retry (sem fallback) após delay curto
    if (this.state.hasError && !prevState.hasError) {
      if (this.state.retryCount < MAX_RETRIES) {
        setTimeout(() => {
          this.setState(prev => ({
            hasError: false,
            retryCount: prev.retryCount + 1
          }));
        }, 100); // Delay aumentado para 100ms para estabilidade
      }
    }
  }

  render() {
    if (this.state.hasError) {
      // Se excedeu máximo de retries, renderizar um fallback mínimo
      if (this.state.retryCount >= MAX_RETRIES) {
        return <div className="min-h-[100px]" />;
      }
      // Durante o soft-retry, renderizar vazio (sem fallback visual)
      // para permitir que o React reconcilie o DOM limpo
      return null;
    }

    return this.props.children;
  }
}
