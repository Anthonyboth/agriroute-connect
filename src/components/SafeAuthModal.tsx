/**
 * SafeAuthModal - Wrapper com fail-safe para o AuthModal
 * 
 * PROBLEMA: O AuthModal usa lazy loading e se o chunk falhar em produção,
 * o overlay do Suspense fica travado sem modal visível.
 * 
 * SOLUÇÃO: Este wrapper implementa:
 * 1. Timeout de 3 segundos - se o modal não carregar, fecha o overlay
 * 2. ErrorBoundary - captura erros de chunk/importação
 * 3. Log de erros para debugging
 */
import React, { useEffect, useRef, useState, Component, ReactNode } from 'react';
import { toast } from '@/hooks/use-toast';

// Importação ESTÁTICA do AuthModal - evita problemas de chunk loading
import AuthModal from '@/components/AuthModal';

interface SafeAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'signup';
}

// Error Boundary para capturar erros de renderização
class AuthModalErrorBoundary extends Component<
  { children: ReactNode; onError: () => void; isOpen: boolean },
  { hasError: boolean }
> {
  constructor(props: { children: ReactNode; onError: () => void; isOpen: boolean }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SafeAuthModal] Erro ao renderizar modal:', error, errorInfo);
    this.props.onError();
  }

  componentDidUpdate(prevProps: { isOpen: boolean }) {
    // Reset error state quando o modal é fechado e reaberto
    if (!prevProps.isOpen && this.props.isOpen && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return null; // Não renderiza nada se houver erro
    }

    return this.props.children;
  }
}

export function SafeAuthModal({ isOpen, onClose, initialTab }: SafeAuthModalProps) {
  const [hasRendered, setHasRendered] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountTimeRef = useRef<number>(0);

  // Fail-safe: se o modal for aberto mas não renderizar em 3 segundos, fechar
  useEffect(() => {
    if (isOpen) {
      mountTimeRef.current = Date.now();
      setHasRendered(false);
      
      timeoutRef.current = setTimeout(() => {
        if (!hasRendered) {
          console.error('[SafeAuthModal] Timeout: modal não renderizou em 3s, fechando overlay');
          toast({
            title: 'Erro ao abrir cadastro',
            description: 'Tente novamente ou atualize a página.',
            variant: 'destructive',
          });
          onClose();
        }
      }, 3000);
    } else {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isOpen, hasRendered, onClose]);

  // Callback para marcar que o modal renderizou com sucesso
  const handleModalMounted = () => {
    setHasRendered(true);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    const loadTime = Date.now() - mountTimeRef.current;
    console.log(`[SafeAuthModal] Modal renderizado em ${loadTime}ms`);
  };

  // Callback para erros do ErrorBoundary
  const handleError = () => {
    toast({
      title: 'Erro ao abrir cadastro',
      description: 'Ocorreu um erro. Por favor, tente novamente.',
      variant: 'destructive',
    });
    onClose();
  };

  // Não renderizar nada se não estiver aberto
  if (!isOpen) {
    return null;
  }

  return (
    <AuthModalErrorBoundary onError={handleError} isOpen={isOpen}>
      <AuthModalWithCallback
        isOpen={isOpen}
        onClose={onClose}
        initialTab={initialTab}
        onMounted={handleModalMounted}
      />
    </AuthModalErrorBoundary>
  );
}

// Wrapper que notifica quando o modal é montado
function AuthModalWithCallback({
  isOpen,
  onClose,
  initialTab,
  onMounted,
}: SafeAuthModalProps & { onMounted: () => void }) {
  const hasNotified = useRef(false);

  useEffect(() => {
    if (isOpen && !hasNotified.current) {
      hasNotified.current = true;
      // Pequeno delay para garantir que o DOM foi atualizado
      requestAnimationFrame(() => {
        onMounted();
      });
    }

    if (!isOpen) {
      hasNotified.current = false;
    }
  }, [isOpen, onMounted]);

  return (
    <AuthModal
      isOpen={isOpen}
      onClose={onClose}
      initialTab={initialTab}
    />
  );
}

export default SafeAuthModal;
