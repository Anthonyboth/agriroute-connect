/**
 * SafeAuthModal - Wrapper robusto e à prova de falhas para o AuthModal
 * 
 * CORREÇÃO P0 v3: O botão "Cadastrar-se" travava em produção porque:
 * 1. Dialog/Portal do Radix falhava silenciosamente em produção
 * 2. useEffect notificava mount ANTES do DOM ser pintado
 * 3. Overlay ficava preso sem conteúdo visível
 * 4. Timeouts muito agressivos para conexões lentas
 * 
 * SOLUÇÃO IMPLEMENTADA:
 * 1. Verificação DOM REAL com data-attribute após 2 RAFs
 * 2. InlineFallbackModal que renderiza SEM Portal/Dialog do Radix
 * 3. Timeouts mais tolerantes para produção (1.5s, 3s, 5s)
 * 4. Detecção de conexão lenta para fallback imediato
 * 5. Report silencioso para monitoramento
 * 6. NUNCA deixa overlay/backdrop travado
 */
import React, { useEffect, useRef, useState, Component, ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Leaf, User, Truck, Wrench, Building2, ArrowRight } from 'lucide-react';

// Importação ESTÁTICA do AuthModal - evita problemas de chunk loading
import AuthModal from '@/components/AuthModal';

// ===============================
// CONFIGURAÇÃO - Timeouts aumentados para produção (redes lentas)
// ===============================
const FAILSAFE_TIMEOUT_MS = 1500; // 1.5s para ativar fallback Radix (mais tolerante para produção)
const ULTIMATE_FALLBACK_MS = 3000; // 3s para tentar inline fallback
const DOM_VERIFICATION_ATTRIBUTE = 'data-auth-modal-content';

// Detecta se é ambiente de produção
const IS_PRODUCTION = typeof window !== 'undefined' &&
  !window.location.hostname.includes('lovableproject.com') &&
  !window.location.hostname.includes('localhost');

// Detecta conexão lenta via Network Information API (se disponível)
function isSlowConnection(): boolean {
  try {
    const nav = navigator as any;
    if (nav.connection) {
      const effectiveType = nav.connection.effectiveType;
      // 2g ou slow-2g são conexões muito lentas
      return effectiveType === '2g' || effectiveType === 'slow-2g';
    }
  } catch {
    // API não disponível
  }
  return false;
}

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
  // ✅ PRODUÇÃO: usar modo inline (sem Portal) imediatamente para evitar tela preta
  // (o visual/UX é o MESMO do AuthModal, apenas sem Radix Portal)
  const shouldUseInlineFallbackImmediately = IS_PRODUCTION || isSlowConnection();
  
  const [useFallback, setUseFallback] = useState(false);
  const [useInlineFallback, setUseInlineFallback] = useState(shouldUseInlineFallbackImmediately);
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
        // Mantém inline fallback se conexão lenta
        setUseInlineFallback(shouldUseInlineFallbackImmediately);
      }, 100);
      return () => clearTimeout(resetTimer);
    }
  }, [isOpen, cleanup, shouldUseInlineFallbackImmediately]);

  // ===============================
  // FAIL-SAFE TIMEOUT: Ativa fallback após 1.5s
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

      // Timeout ULTIMATE: Se após 3s nenhum modal visível, tenta inline fallback
      ultimateTimeoutRef.current = setTimeout(() => {
        const anyModalVisible = document.querySelector(
          `[${DOM_VERIFICATION_ATTRIBUTE}], [data-fallback-modal], [data-inline-fallback-modal]`
        );
        
        if (!anyModalVisible) {
          const elapsed = Date.now() - mountTimeRef.current;
          console.warn(`[SafeAuthModal] FALLBACK INLINE ${elapsed}ms - ativando inline modal`);
          
          reportModalError('MODAL_ULTIMATE_FALLBACK', {
            trigger: 'ultimate_timeout',
            timeToOpenMs: elapsed,
            initialTab,
            fallbackLevel: 'inline',
          });
          
           // Ativa inline render (sem Portal)
          setUseInlineFallback(true);
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

  // NÍVEL 3: Inline render (sem Portal) — usa o MESMO AuthModal em modo inline
  if (useInlineFallback) {
    return (
      <AuthModal
        isOpen={isOpen}
        onClose={onClose}
        initialTab={initialTab}
        renderMode="inline"
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
