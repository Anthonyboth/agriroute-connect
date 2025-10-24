import React from 'react';

interface PageDOMErrorBoundaryProps {
  children: React.ReactNode;
}

interface PageDOMErrorBoundaryState {
  hasError: boolean;
  retryCount: number;
}

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
      setTimeout(() => {
        this.setState(prev => ({
          hasError: false,
          retryCount: prev.retryCount + 1
        }));
      }, 50); // Delay mínimo para evitar loop infinito
    }
  }

  render() {
    if (this.state.hasError) {
      // Durante o soft-retry, renderizar vazio (sem fallback visual)
      // para permitir que o React reconcilie o DOM limpo
      return null;
    }

    return this.props.children;
  }
}
