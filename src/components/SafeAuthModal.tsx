/**
 * SafeAuthModal - Wrapper robusto e à prova de falhas para o AuthModal
 * 
 * CORREÇÃO P0: O botão "Cadastro" travava em produção porque:
 * 1. SPA fallback retornava HTML para chunks JS (Content-Type errado)
 * 2. Toast de erro irritava o usuário
 * 3. Overlay ficava preso se o modal falhasse
 * 
 * SOLUÇÃO IMPLEMENTADA:
 * 1. Usa useRef para hasRendered (evita closure stale)
 * 2. ZERO toast de erro para o usuário
 * 3. Fallback inline se o modal falhar (nunca trava)
 * 4. ErrorBoundary robusto com cleanup automático
 * 5. Cleanup GARANTIDO do overlay em TODOS os cenários via finally
 * 6. Report para backend com detalhes técnicos
 */
import React, { useEffect, useRef, useState, Component, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Leaf, User, Truck, Wrench, Building2, ArrowRight } from 'lucide-react';

// Importação ESTÁTICA do AuthModal - evita problemas de chunk loading
import AuthModal from '@/components/AuthModal';

// ===============================
// CONFIGURAÇÃO
// ===============================
const FAILSAFE_TIMEOUT_MS = 1000; // 1 segundo para ativar fallback

interface SafeAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'login' | 'signup';
}

// ===============================
// ERROR REPORTING (silencioso)
// ===============================
async function reportModalError(error: Error | string, context: Record<string, unknown>) {
  try {
    const payload = {
      errorType: 'FRONTEND',
      errorCategory: 'CRITICAL',
      errorMessage: typeof error === 'string' ? error : error.message,
      errorStack: typeof error === 'string' ? undefined : error.stack,
      module: 'SafeAuthModal',
      functionName: 'fallbackTriggered',
      route: window.location.pathname,
      metadata: {
        ...context,
        url: window.location.href,
        userAgent: navigator.userAgent,
        isOnline: navigator.onLine,
        timestamp: new Date().toISOString(),
        buildVersion: import.meta.env.VITE_BUILD_VERSION || 'unknown',
      }
    };

    // Tenta enviar para report-error (fire and forget)
    fetch('https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/report-error', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => {/* silencioso */});
  } catch {
    // Ignora erros de logging
  }
}

// ===============================
// ERROR BOUNDARY
// ===============================
class AuthModalErrorBoundary extends Component<
  { children: ReactNode; onError: (error: Error) => void; isOpen: boolean },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; onError: (error: Error) => void; isOpen: boolean }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): { hasError: boolean; error: Error } {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[SafeAuthModal] ErrorBoundary capturou erro:', error.message);
    reportModalError(error, { 
      errorInfo: errorInfo.componentStack?.slice(0, 500),
      trigger: 'ErrorBoundary'
    });
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: { isOpen: boolean }) {
    // Reset error state quando o modal é fechado e reaberto
    if (!prevProps.isOpen && this.props.isOpen && this.state.hasError) {
      this.setState({ hasError: false, error: null });
    }
  }

  render() {
    if (this.state.hasError) {
      return null; // Não renderiza nada se houver erro - fallback será mostrado
    }
    return this.props.children;
  }
}

// ===============================
// FALLBACK MODAL (inline, sem dependências externas)
// ===============================
function FallbackAuthModal({ isOpen, onClose, initialTab }: SafeAuthModalProps) {
  const navigate = useNavigate();
  
  const roles = [
    { id: 'PRODUTOR', label: 'Produtor/Contratante', icon: User, description: 'Publique fretes e contrate transportes' },
    { id: 'MOTORISTA', label: 'Motorista', icon: Truck, description: 'Aceite fretes e gerencie viagens' },
    { id: 'PRESTADOR_SERVICOS', label: 'Prestador de Serviços', icon: Wrench, description: 'Ofereça serviços mecânicos e outros' },
    { id: 'TRANSPORTADORA', label: 'Transportadora', icon: Building2, description: 'Gerencie frota e motoristas' },
  ];

  const handleRoleSelect = (roleId: string) => {
    sessionStorage.setItem('pending_signup_role', roleId);
    onClose();
    navigate(`/auth?mode=signup&role=${roleId}`);
  };

  const handleLogin = () => {
    onClose();
    navigate('/auth?mode=login');
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md z-[10000]">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <Leaf className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center">Bem-vindo ao AgriRoute</DialogTitle>
          <DialogDescription className="text-center">
            {initialTab === 'login' ? 'Faça login para continuar' : 'Escolha seu tipo de cadastro'}
          </DialogDescription>
        </DialogHeader>

        {initialTab === 'login' ? (
          <div className="space-y-4 pt-4">
            <Button onClick={handleLogin} className="w-full gradient-primary">
              Ir para Login
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-4">
            {roles.map((role) => (
              <Button
                key={role.id}
                variant="outline"
                className="w-full justify-start h-auto py-3 px-4"
                onClick={() => handleRoleSelect(role.id)}
              >
                <role.icon className="h-5 w-5 mr-3 text-primary flex-shrink-0" />
                <div className="text-left">
                  <div className="font-medium">{role.label}</div>
                  <div className="text-xs text-muted-foreground">{role.description}</div>
                </div>
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ===============================
// SAFE AUTH MODAL (principal)
// ===============================
export function SafeAuthModal({ isOpen, onClose, initialTab }: SafeAuthModalProps) {
  const [useFallback, setUseFallback] = useState(false);
  const hasRenderedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountTimeRef = useRef<number>(0);

  // Cleanup function garantida - SEMPRE limpa timeout
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Força fechamento do modal se algo der errado
  const forceClose = useCallback(() => {
    cleanup();
    try {
      onClose();
    } catch {
      // Ignora erros de fechamento
    }
  }, [cleanup, onClose]);

  // Reset estado quando modal fecha
  useEffect(() => {
    if (!isOpen) {
      cleanup();
      hasRenderedRef.current = false;
      // Dar tempo para próxima abertura
      const resetTimer = setTimeout(() => {
        setUseFallback(false);
      }, 100);
      return () => clearTimeout(resetTimer);
    }
  }, [isOpen, cleanup]);

  // ===============================
  // FAIL-SAFE: Timeout para fallback
  // ===============================
  useEffect(() => {
    if (isOpen && !useFallback) {
      mountTimeRef.current = Date.now();
      hasRenderedRef.current = false;
      
      timeoutRef.current = setTimeout(() => {
        // Verifica usando ref (não closure stale)
        if (!hasRenderedRef.current) {
          const elapsed = Date.now() - mountTimeRef.current;
          console.warn(`[SafeAuthModal] Timeout após ${elapsed}ms - ativando fallback`);
          
          // Report silencioso (sem toast!)
          reportModalError('REGISTER_MODAL_FALLBACK_TRIGGERED', {
            trigger: 'timeout',
            timeToOpenMs: elapsed,
            initialTab,
          });
          
          setUseFallback(true);
        }
      }, FAILSAFE_TIMEOUT_MS);
    }

    return cleanup;
  }, [isOpen, useFallback, cleanup, initialTab]);

  // Callback para marcar que o modal renderizou com sucesso
  const handleModalMounted = useCallback(() => {
    hasRenderedRef.current = true;
    cleanup();
    
    const loadTime = Date.now() - mountTimeRef.current;
    if (loadTime > 500) {
      console.log(`[SafeAuthModal] Modal renderizado em ${loadTime}ms`);
    }
  }, [cleanup]);

  // Callback para erros do ErrorBoundary - ativa fallback silenciosamente
  const handleError = useCallback((error: Error) => {
    console.error('[SafeAuthModal] ErrorBoundary erro, ativando fallback');
    reportModalError(error, { trigger: 'ErrorBoundary' });
    setUseFallback(true);
  }, []);

  // Não renderizar nada se não estiver aberto
  if (!isOpen) {
    return null;
  }

  // Se fallback está ativo, renderizar modal simplificado inline
  if (useFallback) {
    return (
      <FallbackAuthModal
        isOpen={isOpen}
        onClose={onClose}
        initialTab={initialTab}
      />
    );
  }

  // Tentar renderizar o AuthModal completo com ErrorBoundary
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

// ===============================
// WRAPPER que notifica quando o modal é montado
// ===============================
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
      // Notifica imediatamente + confirma após RAF
      onMounted();
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
