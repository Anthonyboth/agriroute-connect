/**
 * SafeAuthModal - Wrapper robusto e à prova de falhas para o AuthModal
 * 
 * CORREÇÃO P0 v2: O botão "Cadastrar-se" travava em produção porque:
 * 1. Dialog/Portal do Radix falhava silenciosamente em produção
 * 2. useEffect notificava mount ANTES do DOM ser pintado
 * 3. Overlay ficava preso sem conteúdo visível
 * 
 * SOLUÇÃO IMPLEMENTADA:
 * 1. Verificação DOM REAL com data-attribute após 2 RAFs
 * 2. InlineFallbackModal que renderiza SEM Portal/Dialog do Radix
 * 3. Timeout agressivo de 800ms para ativar fallback
 * 4. Fallback final com redirecionamento para /auth após 1500ms
 * 5. Report silencioso para monitoramento
 * 6. NUNCA deixa overlay/backdrop travado
 */
import React, { useEffect, useRef, useState, Component, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Leaf, User, Truck, Wrench, Building2, ArrowRight, X } from 'lucide-react';

// Importação ESTÁTICA do AuthModal - evita problemas de chunk loading
import AuthModal from '@/components/AuthModal';

// ===============================
// CONFIGURAÇÃO
// ===============================
const FAILSAFE_TIMEOUT_MS = 800; // 800ms para ativar fallback (mais agressivo)
const ULTIMATE_FALLBACK_MS = 1500; // 1.5s para redirecionar se tudo falhar
const DOM_VERIFICATION_ATTRIBUTE = 'data-auth-modal-content';

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
        environment: window.location.hostname.includes('lovableproject.com') ? 'preview' : 'production',
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
// INLINE FALLBACK MODAL (100% independente - SEM Radix/Portal)
// ===============================
function InlineFallbackModal({ isOpen, onClose, initialTab }: SafeAuthModalProps) {
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Previne scroll do body quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Renderiza DIRETAMENTE no DOM, sem Portal, sem Dialog do Radix
  return (
    <div 
      data-inline-fallback-modal
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ 
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
      }}
      onClick={handleBackdropClick}
    >
      <div 
        className="bg-background rounded-lg p-6 max-w-md w-full shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Leaf className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">AgriRoute</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Title */}
        <div className="text-center mb-4">
          <h2 className="text-lg font-semibold">
            {initialTab === 'login' ? 'Faça login para continuar' : 'Escolha seu tipo de cadastro'}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Plataforma de logística agrícola
          </p>
        </div>

        {/* Content */}
        {initialTab === 'login' ? (
          <div className="space-y-4 pt-2">
            <Button onClick={handleLogin} className="w-full gradient-primary">
              Ir para Login
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {roles.map((role) => (
              <button
                key={role.id}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-left"
                onClick={() => handleRoleSelect(role.id)}
              >
                <role.icon className="h-5 w-5 text-primary flex-shrink-0" />
                <div>
                  <div className="font-medium text-foreground">{role.label}</div>
                  <div className="text-xs text-muted-foreground">{role.description}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===============================
// FALLBACK MODAL (usa Dialog do Radix - segundo nível de fallback)
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
      <DialogContent className="sm:max-w-md z-[10000]" data-fallback-modal>
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
  const navigate = useNavigate();
  const [useFallback, setUseFallback] = useState(false);
  const [useInlineFallback, setUseInlineFallback] = useState(false);
  const hasRenderedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ultimateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountTimeRef = useRef<number>(0);

  // Cleanup function garantida - SEMPRE limpa timeouts
  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (ultimateTimeoutRef.current) {
      clearTimeout(ultimateTimeoutRef.current);
      ultimateTimeoutRef.current = null;
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
        setUseInlineFallback(false);
      }, 100);
      return () => clearTimeout(resetTimer);
    }
  }, [isOpen, cleanup]);

  // ===============================
  // FAIL-SAFE TIMEOUT: Ativa fallback após 800ms
  // ===============================
  useEffect(() => {
    if (isOpen && !useFallback && !useInlineFallback) {
      mountTimeRef.current = Date.now();
      hasRenderedRef.current = false;
      
      // Timeout para fallback (Dialog do Radix)
      timeoutRef.current = setTimeout(() => {
        if (!hasRenderedRef.current) {
          const elapsed = Date.now() - mountTimeRef.current;
          console.warn(`[SafeAuthModal] Timeout ${elapsed}ms - ativando fallback Radix`);
          
          reportModalError('MODAL_RENDER_TIMEOUT', {
            trigger: 'timeout',
            timeToOpenMs: elapsed,
            initialTab,
            fallbackLevel: 'radix',
          });
          
          setUseFallback(true);
        }
      }, FAILSAFE_TIMEOUT_MS);

      // Timeout ULTIMATE: Se após 1.5s nenhum modal visível, redireciona
      ultimateTimeoutRef.current = setTimeout(() => {
        const anyModalVisible = document.querySelector(
          `[${DOM_VERIFICATION_ATTRIBUTE}], [data-fallback-modal], [data-inline-fallback-modal]`
        );
        
        if (!anyModalVisible) {
          const elapsed = Date.now() - mountTimeRef.current;
          console.error(`[SafeAuthModal] FALLBACK FINAL ${elapsed}ms - redirecionando para /auth`);
          
          reportModalError('MODAL_ULTIMATE_FALLBACK', {
            trigger: 'ultimate_timeout',
            timeToOpenMs: elapsed,
            initialTab,
            fallbackLevel: 'redirect',
          });
          
          // Força fechar e redirecionar
          forceClose();
          
          // Tenta inline fallback primeiro
          setUseInlineFallback(true);
          
          // Se ainda não funcionar, força navegação após mais 500ms
          setTimeout(() => {
            const stillNoModal = !document.querySelector('[data-inline-fallback-modal]');
            if (stillNoModal) {
              window.location.href = `/auth?mode=${initialTab || 'signup'}`;
            }
          }, 500);
        }
      }, ULTIMATE_FALLBACK_MS);
    }

    return cleanup;
  }, [isOpen, useFallback, useInlineFallback, cleanup, initialTab, forceClose]);

  // Callback para marcar que o modal renderizou com sucesso (verificação DOM real)
  const handleModalMounted = useCallback(() => {
    // Aguardar 2 frames para garantir que DOM foi pintado
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const dialogContent = document.querySelector(`[${DOM_VERIFICATION_ATTRIBUTE}]`);
        if (dialogContent) {
          hasRenderedRef.current = true;
          cleanup();
          
          const loadTime = Date.now() - mountTimeRef.current;
          if (loadTime > 300) {
            console.log(`[SafeAuthModal] Modal renderizado em ${loadTime}ms (DOM verificado)`);
          }
        }
      });
    });
  }, [cleanup]);

  // Callback para erros do ErrorBoundary - ativa fallback silenciosamente
  const handleError = useCallback((error: Error) => {
    console.error('[SafeAuthModal] ErrorBoundary erro, ativando inline fallback');
    reportModalError(error, { trigger: 'ErrorBoundary', fallbackLevel: 'inline' });
    setUseInlineFallback(true);
  }, []);

  // Não renderizar nada se não estiver aberto
  if (!isOpen) {
    return null;
  }

  // NÍVEL 3: Inline fallback (sem Radix, sem Portal)
  if (useInlineFallback) {
    return (
      <InlineFallbackModal
        isOpen={isOpen}
        onClose={onClose}
        initialTab={initialTab}
      />
    );
  }

  // NÍVEL 2: Fallback com Dialog do Radix
  if (useFallback) {
    return (
      <FallbackAuthModal
        isOpen={isOpen}
        onClose={onClose}
        initialTab={initialTab}
      />
    );
  }

  // NÍVEL 1: Tentar renderizar o AuthModal completo com ErrorBoundary
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
// WRAPPER que notifica quando o modal é montado COM verificação DOM
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
      
      // Verificação DOM real após 2 RAF (garante que foi pintado)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          onMounted();
        });
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
