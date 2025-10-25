import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

export class RatingProviderErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('[RatingProviderErrorBoundary] Erro capturado, rodando em modo silencioso:', error.message);
  }

  render() {
    if (this.state.hasError) {
      // Modo silencioso: renderiza children sem RatingProvider
      return this.props.children;
    }

    return this.props.children;
  }
}
