// TooltipProvider deferred to avoid pulling ui-vendor chunk on landing page
import React, { lazy, Suspense } from 'react';
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { getDefaultRouteForProfile, isRouteAllowedForProfile } from '@/security/panelAccessGuard';
import { RequirePanel } from '@/components/security/RequirePanel';
import { Capacitor } from '@capacitor/core';
import { useDoubleTapResetZoom } from '@/hooks/useDoubleTapResetZoom';
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { RatingProvider } from "@/contexts/RatingContext";
import { RatingProviderErrorBoundary } from "@/components/RatingProviderErrorBoundary";
// GlobalRatingModals deferred - uses Radix Dialog which pulls ui-vendor chunk (50KB)
// Only needed after authentication, not on landing page
const GlobalRatingModals = lazy(() => import("@/components/GlobalRatingModals").then(m => ({ default: m.GlobalRatingModals })));
// Toaster deferred to avoid pulling ui-vendor (Radix Toast) on landing page
const LazyToaster = lazy(() => import("@/components/ui/toaster").then(m => ({ default: m.Toaster })));
const LazyMatchDebugPanel = lazy(() => import("@/components/MatchDebugPanel").then(m => ({ default: m.MatchDebugPanel })));
// Sonner deferred to avoid loading sonner package on landing page
const LazySonner = lazy(() => import("@/components/ui/sonner").then(m => ({ default: m.Toaster })));
import { ThemeProvider } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthErrorBoundary } from "@/components/AuthErrorBoundary";
import { PageDOMErrorBoundary } from "@/components/PageDOMErrorBoundary";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";

// Import Landing directly (not lazy) - it's the LCP element
import Landing from "./pages/Landing";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useCompanyDriver } from "./hooks/useCompanyDriver";
import { ComponentLoader } from '@/components/LazyComponents';
import { AppLoader, AuthLoader, DashboardLoader, GlobalLoader } from '@/components/AppLoader';
import { AppBootProvider, useAppBoot, useShouldShowTimeoutFallback } from '@/contexts/AppBootContext';
import { BootstrapGuardWrapper, BootTimeoutGuard } from '@/components/BootstrapGuardWrapper';
import { BootOrchestrator } from '@/components/BootOrchestrator';
import { ScrollToTop } from './components/ScrollToTop';
import { PermissionPrompts } from './components/PermissionPrompts';
import { useDeviceRegistration } from './hooks/useDeviceRegistration';
import { startSessionRefresh, stopSessionRefresh } from './utils/sessionRefresh';
import { SilentCityBootstrap } from './components/SilentCityBootstrap';
import { ZipCodeService } from './services/zipCodeService';
import { GlobalAnnouncementBar } from './components/GlobalAnnouncementBar';
import { FloatingSupportButton } from './components/FloatingSupportButton';
import { useSplashScreen } from './hooks/useSplashScreen';
import { PreviewFreshBuildBanner } from './components/PreviewFreshBuildBanner';
import { SwipeNavigationHandler } from './components/SwipeNavigationHandler';
import { LoopPreventionBoundary } from '@/components/LoopPreventionBoundary';
import { TutorialProvider } from '@/tutorial';

// ✅ RELEASE HARDENING: Import centralized env config and health check
import { ENV, PLATFORM, validateEnvironment } from '@/config/env';
import { initializeHealthCheck } from '@/lib/runtime-health-check';

// ✅ PERFORMANCE: Prefetch estratégico de rotas críticas
// Só executa em conexões rápidas (não mobile data saver)
if (typeof window !== 'undefined' && 'connection' in navigator) {
  const conn = (navigator as any).connection;
  if (!conn?.saveData && conn?.effectiveType !== '2g' && conn?.effectiveType !== 'slow-2g') {
    const prefetchRoutes = ['/dashboard/driver', '/dashboard/producer', '/dashboard/company'];
    
    // Defer prefetch to idle time
    const doPrefetch = () => {
      prefetchRoutes.forEach(route => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        link.as = 'document';
        document.head.appendChild(link);
      });
    };
    
    if ('requestIdleCallback' in window) {
      requestIdleCallback(doPrefetch, { timeout: 3000 });
    } else {
      setTimeout(doPrefetch, 2000);
    }
  }
}

// Import lazyWithRetry for robust module loading
import { lazyWithRetry } from '@/utils/lazyWithRetry';

// Lazy load all page components except Landing (needed for initial render)
// ✅ Using lazyWithRetry for critical auth pages to handle network/cache failures after deploys
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const ConfirmEmail = lazyWithRetry(() => import("./pages/ConfirmEmail"));
const CompleteProfile = lazyWithRetry(() => import("./pages/CompleteProfile"));
const ServiceProviderRegistration = lazy(() => import("./pages/ServiceProviderRegistration"));
const Services = lazy(() => import("./pages/Services"));
const NotFound = lazy(() => import("./pages/NotFound"));
const About = lazy(() => import("./pages/About"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Cookies = lazy(() => import("./pages/Cookies"));
const Status = lazy(() => import("./pages/Status"));
const TransportCompanyRegistration = lazy(() => import("./pages/TransportCompanyRegistration"));
const Careers = lazy(() => import("./pages/Careers"));
const Help = lazy(() => import("./pages/Help"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Plans = lazy(() => import("./pages/Plans"));
const SystemTest = lazy(() => import("./pages/SystemTest"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancel = lazy(() => import("./pages/PaymentCancel"));
const DriverInviteSignup = lazy(() => import("./pages/DriverInviteSignup"));
const PressPage = lazy(() => import("./pages/Press"));
const ServicePaymentSuccess = lazy(() => import("./pages/ServicePaymentSuccess"));
const ServicePaymentCancel = lazy(() => import("./pages/ServicePaymentCancel"));
const CompanyInviteAccept = lazy(() => import("./pages/CompanyInviteAccept"));
const AffiliateSignup = lazy(() => import("./pages/AffiliateSignup"));
const AdminPanel = lazyWithRetry(() => import("./pages/AdminPanel"), { retries: 3 });
const AdminPanelV2 = lazyWithRetry(() => import("./pages/AdminPanelV2"), { retries: 3 });
const AdminAnnouncementsManager = lazy(() => import("./pages/AdminAnnouncementsManager"));
const AdminMaintenancePanel = lazy(() => import("./pages/AdminMaintenancePanel"));

// ✅ CRITICAL DASHBOARDS: Use lazyWithRetry with 3 retries for robustness
const ProducerDashboard = lazyWithRetry(() => import("./pages/ProducerDashboard"), { 
  retries: 3, 
  delay: 1000,
  onError: (error, attempt) => {
    console.error(`[ProducerDashboard] Load failed (attempt ${attempt + 1}):`, error.message);
  }
});
const DriverDashboard = lazyWithRetry(() => import("./pages/DriverDashboard"), { 
  retries: 3, 
  delay: 1000,
  onError: (error, attempt) => {
    console.error(`[DriverDashboard] Load failed (attempt ${attempt + 1}):`, error.message);
  }
});
const CompanyDashboard = lazyWithRetry(() => import("./pages/CompanyDashboard"), { 
  retries: 3, 
  delay: 1000,
  onError: (error, attempt) => {
    console.error(`[CompanyDashboard] Load failed (attempt ${attempt + 1}):`, error.message);
  }
});
const ServiceProviderDashboard = lazyWithRetry(() => import("./pages/ServiceProviderDashboard"), { 
  retries: 3, 
  delay: 1000,
  onError: (error, attempt) => {
    console.error(`[ServiceProviderDashboard] Load failed (attempt ${attempt + 1}):`, error.message);
  }
});
const NfeDashboard = lazyWithRetry(() => import("./pages/NfeDashboard"), { retries: 3 });
const InspectionView = lazy(() => import("./pages/InspectionView"));
import { AlertCircle } from 'lucide-react';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

// ✅ PERFORMANCE: QueryClient com configurações otimizadas
// - staleTime: 10 minutos (dados considerados frescos por mais tempo)
// - gcTime: 15 minutos (manter cache por mais tempo)
// - refetchOnWindowFocus: false em native (Android WebView dispara focus events excessivos)
// - refetchInterval: false (NUNCA fazer polling automático)
// - refetchOnMount: false (não refetch se dados no cache)
const isNativePlatform = Capacitor.isNativePlatform();

// ✅ CRITICAL FIX: Desabilitar focusManager em plataformas nativas
// Android WebView dispara eventos de focus/blur constantemente (teclado, troca de app, etc.)
// causando refetch em cascata → remontagem → flickering de telas
if (isNativePlatform) {
  focusManager.setEventListener(() => {
    // No-op: ignora todos os eventos de focus em native
    return () => {};
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000, // 10 minutos - dados considerados frescos
      gcTime: 15 * 60 * 1000, // 15 minutos - tempo no cache
      refetchOnWindowFocus: !isNativePlatform, // ✅ Desabilitado em Android/iOS
      refetchOnMount: false, // Não refetch ao montar se dados no cache
      refetchOnReconnect: true, // Atualizar ao reconectar
      retry: 1, // Apenas 1 retry em caso de erro
      refetchInterval: false, // ❌ NUNCA fazer polling automático
    },
  },
});

// Defer Error Monitoring initialization to after first render
if (typeof window !== 'undefined') {
  // Use requestIdleCallback to defer non-critical initialization
  const initErrorMonitoring = () => {
    const errorMonitoring = ErrorMonitoringService.getInstance();

    // Capturar erros não tratados
    window.addEventListener('error', (event) => {
      const message = event.message || '';

      // ✅ Não reportar conflitos esperados (regra de negócio) como "blank screen"
      const isExpectedFiscalIssuerConflict =
        message.includes('Edge function returned 409') &&
        (message.includes('fiscal-issuer-register') ||
          message.includes('Este CPF/CNPJ já está cadastrado'));

      // ✅ Não reportar erro esperado de saldo insuficiente (regra de negócio)
      // Ex.: "Edge function returned 402 ... INSUFFICIENT_BALANCE"
      const isExpectedNfeInsufficientBalance =
        message.includes('Edge function returned 402') &&
        (message.includes('INSUFFICIENT_BALANCE') || message.includes('Saldo insuficiente'));

      if (isExpectedFiscalIssuerConflict || isExpectedNfeInsufficientBalance) {
        return;
      }

      errorMonitoring.captureError(event.error || new Error(message), {
        source: 'window.error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Capturar rejeições de promessas não tratadas
    window.addEventListener('unhandledrejection', (event) => {
      const message = event.reason?.message || String(event.reason);
      const errorName = event.reason?.name || '';

      // ✅ Ignorar AbortError - comportamento esperado quando componentes desmontam
      // MapLibre GL cancela fetches de tiles internamente ao unmount
      if (
        errorName === 'AbortError' ||
        message.includes('signal is aborted without reason') ||
        message.includes('The operation was aborted') ||
        /aborted/i.test(message)
      ) {
        event.preventDefault?.();
        return;
      }

      // ✅ Não reportar conflitos esperados (regra de negócio)
      const isExpectedFiscalIssuerConflict =
        message.includes('Edge function returned 409') &&
        (message.includes('fiscal-issuer-register') ||
          message.includes('Este CPF/CNPJ já está cadastrado'));

      // ✅ Não reportar erro esperado de saldo insuficiente (regra de negócio)
      const isExpectedNfeInsufficientBalance =
        message.includes('Edge function returned 402') &&
        (message.includes('INSUFFICIENT_BALANCE') || message.includes('Saldo insuficiente'));

      if (isExpectedFiscalIssuerConflict || isExpectedNfeInsufficientBalance) {
        event.preventDefault?.();
        return;
      }

      errorMonitoring.captureError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        { source: 'unhandledrejection' }
      );
    });
  };

  if ('requestIdleCallback' in window) {
    requestIdleCallback(initErrorMonitoring);
  } else {
    setTimeout(initErrorMonitoring, 1);
  }

  // ✅ RELEASE HARDENING: Initialize health check on app load
  initializeHealthCheck();
}

// Componente para setup de monitoramento de erros
import { useErrorMonitoring } from '@/hooks/useErrorMonitoring';
import { useSecurityAntiError } from '@/hooks/useSecurityAntiError';

const ErrorMonitoringSetup = () => {
  useErrorMonitoring();
  return null;
};

const SecurityAntiErrorSetup = () => {
  useSecurityAntiError();
  return null;
};

// Defer ZipCode service initialization to after first render
const ZipCodeSyncOnReconnect = () => {
  React.useEffect(() => {
    const handleOnline = () => {
      // Defer sync to idle time
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => {
          console.log('🌐 Reconectado à internet - sincronizando cache de CEPs...');
          ZipCodeService.syncOnReconnect();
        });
      } else {
        setTimeout(() => {
          console.log('🌐 Reconectado à internet - sincronizando cache de CEPs...');
          ZipCodeService.syncOnReconnect();
        }, 100);
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
  
  return null;
};

const ProtectedRoute = ({ children, requiresAuth = true, requiresApproval = false, adminOnly = false, allowedRoles }: {
  children: React.ReactNode; 
  requiresAuth?: boolean;
  requiresApproval?: boolean;
  adminOnly?: boolean;
  allowedRoles?: ('PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'TRANSPORTADORA' | 'PRESTADOR_SERVICOS' | 'ADMIN')[];
}) => {
  const { isAuthenticated, isApproved, isAdmin, loading, profile, signOut, refreshProfile } = useAuth();
  const { isCompanyDriver, isLoading: isLoadingCompany } = useCompanyDriver();
  const location = useLocation();
  const navigate = useNavigate();
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const loadingStartRef = React.useRef<number>(Date.now());
  const approvalRecheckRef = React.useRef(false);

  React.useEffect(() => {
    if (loading || isLoadingCompany) {
      loadingStartRef.current = Date.now();
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 8000); // 8s timeout - reduzido para evitar tela travada
      return () => clearTimeout(timer);
    } else {
      // Log tempo de loading em dev
      if (import.meta.env.DEV) {
        const elapsed = Date.now() - loadingStartRef.current;
        if (elapsed > 100) {
          console.log(`⏱️ [ProtectedRoute] Loading: ${elapsed}ms`);
        }
      }
    }
  }, [loading, isLoadingCompany]);

  // ✅ Se a rota exige aprovação e o usuário está autenticado mas o profile ainda não carregou,
  // revalidar uma vez no banco antes de mostrar "Conta Pendente".
  React.useEffect(() => {
    if (!requiresApproval) return;
    if (!isAuthenticated) return;
    if (loading || isLoadingCompany) return;
    if (profile) return;
    if (approvalRecheckRef.current) return;

    approvalRecheckRef.current = true;
    refreshProfile?.();
  }, [requiresApproval, isAuthenticated, loading, isLoadingCompany, profile, refreshProfile]);

  // ✅ UNIFICADO: Usar AuthLoader para estado de carregamento
  if ((loading || isLoadingCompany) && !loadingTimeout) {
    return <AuthLoader message="Verificando autenticação..." />;
  }
  
  if (loadingTimeout) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-warning" />
          <h2 className="text-2xl font-bold">Tempo esgotado</h2>
          <p className="text-muted-foreground">
            A autenticação está demorando. Tente novamente.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate('/auth')}>
              Ir para Login
            </Button>
            <Button onClick={() => window.location.href = '/'} variant="outline">
              Voltar à Página Inicial
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (requiresAuth && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (requiresApproval && isAuthenticated && !profile) {
    return <AuthLoader message="Revalidando status de aprovação..." />;
  }

  // ✅ ROLE GATE — Camada 1: Redirecionar para o painel correto antes de checar allowedRoles
  // Usa panelAccessGuard como fonte única de verdade (sem active_mode como critério de painel)
  if (isAuthenticated && profile) {
    const currentPath = window.location.pathname;

    // Só age em rotas de painel
    if (currentPath.startsWith('/dashboard') || currentPath.startsWith('/admin')) {
      if (!isRouteAllowedForProfile(currentPath, profile)) {
        const correctRoute = getDefaultRouteForProfile(profile);
        if (import.meta.env.DEV) {
          console.warn(`[ProtectedRoute] 🚫 Rota ${currentPath} bloqueada para role ${profile.role} → ${correctRoute}`);
        }
        return <Navigate to={correctRoute} replace />;
      }
    }
  }

  // Verificar se o usuário tem o role correto (verificar em user_roles E profiles.role por compatibilidade + active_mode)
  const hasRequiredRole = allowedRoles && profile ? 
    allowedRoles.some(r => 
      profile.roles?.includes(r) || 
      profile.role === r || 
      (r === 'TRANSPORTADORA' && profile.active_mode === 'TRANSPORTADORA')
    ) : 
    true;

  if (allowedRoles && profile && !hasRequiredRole) {
    // Log de acesso negado
    const logAccessDenied = async () => {
      try {
        await supabase.functions.invoke('log-access-denied', {
          body: {
            route: location.pathname,
            requiredRoles: allowedRoles,
            userRoles: profile.roles || [profile.role]
          }
        });
      } catch (error: any) {
        // Silenciar erro - não impacta UX
        console.debug('[App] Log de acesso negado falhou (não crítico):', error?.message);
      }
    };
    logAccessDenied();

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="space-y-4">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
            <h2 className="text-2xl font-bold">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Esta área é exclusiva para perfis autorizados.
            </p>
            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <p><strong>Roles necessários:</strong> {allowedRoles.join(', ')}</p>
              <p><strong>Seus roles:</strong> {profile.roles?.join(', ') || profile.role}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Se você acredita ter acesso, entre em contato com o suporte.
            </p>
          </div>
          <Button onClick={() => window.location.href = '/'}>
            Voltar à Página Inicial
          </Button>
        </div>
      </div>
    );
  }

  // ✅ CRÍTICO: Priorizar profile.status === 'APPROVED' para evitar bloqueios
  // especialmente quando WebSocket falha (Firefox) e companyDriver data ainda carregando
  const effectivelyApproved = (profile?.status === 'APPROVED') || isApproved || 
    ((profile?.role === 'MOTORISTA_AFILIADO' || profile?.role === 'MOTORISTA') && isCompanyDriver);

  if (import.meta.env.DEV) {
    console.log('[Auth] role:', profile?.role, 'status:', profile?.status, 'approved:', effectivelyApproved);
  }

  if (requiresApproval && !effectivelyApproved) {
    const handleGoHome = () => {
      // Fazer logout e ir para página inicial
      signOut();
    };

    // Determinar tipo de aprovação
    const isAffiliatedDriver = profile?.role === 'MOTORISTA_AFILIADO' || 
      (profile?.role === 'MOTORISTA' && isCompanyDriver);
    
    const approvalMessage = isAffiliatedDriver 
      ? 'Aguarde a aprovação da transportadora'
      : 'Aguarde aprovação do administrador';
    
    const approvalDescription = isAffiliatedDriver
      ? 'Sua transportadora precisa aprovar seu cadastro antes de você começar a usar o app.'
      : 'Seu cadastro está sendo analisado pela equipe AgriRoute.';

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Conta Pendente</h2>
            <p className="text-muted-foreground font-semibold">{approvalMessage}</p>
            <p className="text-sm text-muted-foreground">{approvalDescription}</p>
          </div>
          <div className="space-y-3">
            <Button 
              onClick={handleGoHome}
              variant="outline"
              className="w-full"
            >
              Voltar à Página Inicial
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

// ✅ Componente para autoredirecionar da home "/" para o painel correto
const AuthedLanding = () => {
  const { isAuthenticated, profile, loading } = useAuth();
  const [isCheckingCompany, setIsCheckingCompany] = React.useState(false);
  const [isCompany, setIsCompany] = React.useState(false);
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  const bootTimeRef = React.useRef<number>(Date.now());
  
  // ✅ Detectar sessão em cache para evitar flash da Landing para usuários logados
  const hasCachedSession = React.useMemo(() => {
    try {
      return !!localStorage.getItem('sb-shnvtxejjecbnztdbbbl-auth-token');
    } catch { return false; }
  }, []);
  
  // Timeout para loading (8s)
  React.useEffect(() => {
    if (loading || isCheckingCompany) {
      bootTimeRef.current = Date.now();
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [loading, isCheckingCompany]);
  
  // Verificar se é transportadora
  React.useEffect(() => {
    const checkCompany = async () => {
      if (!profile) return;

      // ✅ Transportadora: não precisa consultar tabela, sempre é painel da empresa
      if (profile.role === 'TRANSPORTADORA' || profile.active_mode === 'TRANSPORTADORA') {
        setIsCompany(true);
        return;
      }

      // Motorista pode operar como transportadora (modo ativo)
      if (profile.role === 'MOTORISTA') {
        setIsCheckingCompany(true);
        try {
          const { data } = await supabase
            .from('transport_companies')
            .select('id')
            .eq('profile_id', profile.id)
            .maybeSingle();

          const isCompanyUser = !!data || profile.active_mode === 'TRANSPORTADORA';
          setIsCompany(isCompanyUser);
        } finally {
          setIsCheckingCompany(false);

          // Log tempo em dev
          if (import.meta.env.DEV) {
            console.log(`⏱️ [AuthedLanding] Company check: ${Date.now() - bootTimeRef.current}ms`);
          }
        }
        return;
      }

      // Outros perfis
      setIsCompany(false);
    };
    
    if (profile) {
      checkCompany();
    }
  }, [profile]);
  
  // Se ainda carregando e não tem perfil:
  // - Se há sessão em cache → spinner (usuário provavelmente logado, evita flash da Landing)
  // - Se não há sessão → Landing direto
  if ((loading || isCheckingCompany) && !profile) {
    if (hasCachedSession) {
      return <GlobalLoader />;
    }
    return <Landing />;
  }
  
  // Se autenticado mas ainda verificando empresa, mostrar loader
  if (isCheckingCompany && profile) {
    return <AuthLoader message="Carregando..." />;
  }
  
  // Se não autenticado, mostrar Landing normal
  if (!isAuthenticated || !profile) {
    return <Landing />;
  }
  
  // ✅ ROLE GATE — Usar panelAccessGuard como fonte única (remove dependência de active_mode)
  console.log('[AuthedLanding] Redirecionando usuário:', {
    role: profile?.role,
    active_mode: profile?.active_mode,
    profileId: profile?.id,
  });

  const targetRoute = getDefaultRouteForProfile(profile);
  return <Navigate to={targetRoute} replace />;
};

const RedirectIfAuthed = () => {
  const { isAuthenticated, profile, loading, profiles } = useAuth();
  const [isCheckingCompany, setIsCheckingCompany] = React.useState(false);
  const [isCompany, setIsCompany] = React.useState(false);
  const [profileTimeout, setProfileTimeout] = React.useState(false); // ✅ ETAPA 2: Novo estado para timeout
  
  // ✅ ETAPA 2: Timeout para quando isAuthenticated mas profile não carrega
  React.useEffect(() => {
    if (isAuthenticated && !profile && !loading) {
      const timer = setTimeout(() => {
        console.log('⏰ [RedirectIfAuthed] Profile timeout após 10s');
        setProfileTimeout(true);
      }, 10000); // 10 segundos
      return () => clearTimeout(timer);
    } else {
      setProfileTimeout(false);
    }
  }, [isAuthenticated, profile, loading]);
  
  // Verificar se é transportadora
  React.useEffect(() => {
    const checkCompany = async () => {
      if (profile?.role === 'MOTORISTA') {
        setIsCheckingCompany(true);
        const { data } = await supabase
          .from('transport_companies')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();
        
        const isCompanyUser = !!data || profile.active_mode === 'TRANSPORTADORA';
        setIsCompany(isCompanyUser);
        setIsCheckingCompany(false);
      }
    };
    
    if (profile) {
      checkCompany();
    }
  }, [profile]);
  
  // ✅ ETAPA 2: Se timeout atingido, mostrar opção de limpar e tentar novamente
  if (profileTimeout && isAuthenticated && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-md">
          <AlertCircle className="h-12 w-12 mx-auto text-warning" />
          <h2 className="text-2xl font-bold">Erro ao carregar perfil</h2>
          <p className="text-muted-foreground">
            Não foi possível carregar seu perfil. Isso pode ser um problema temporário.
          </p>
          <div className="flex gap-3 justify-center">
            <Button onClick={() => {
              console.log('🔄 [RedirectIfAuthed] Limpando cooldown e recarregando...');
              sessionStorage.removeItem('profile_fetch_cooldown_until');
              window.location.reload();
            }}>
              Tentar Novamente
            </Button>
            <Button onClick={async () => {
              console.log('🚪 [RedirectIfAuthed] Fazendo logout...');
              await supabase.auth.signOut({ scope: 'local' });
              window.location.href = '/';
            }} variant="outline">
              Fazer Login Novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  // ✅ UNIFICADO: Usar AuthLoader em vez de ComponentLoader
  if (loading || isCheckingCompany) {
    return <AuthLoader message="Verificando perfil..." />;
  }
  
  // ✅ FASE 1 FIX: Aguardar profile carregar quando autenticado (corrige flash de cadastro)
  if (isAuthenticated && !profile) {
    return <AuthLoader message="Carregando perfil..." />;
  }
  
  if (!isAuthenticated) return <Suspense fallback={<AuthLoader message="Carregando..." />}><Auth /></Suspense>;
  
  // Evita redirecionar cedo demais: só vá para /complete-profile
  // quando já soubermos que não há perfis após o carregamento
  if (!profile) {
    if (Array.isArray(profiles) && profiles.length === 0) {
      return <Navigate to="/complete-profile" replace />;
    }
    return <AuthLoader message="Finalizando..." />; // aguardando resolução do perfil
  }
  
  // ✅ LACUNA 5 CORRIGIDA: Validar redirect_after_login contra os painéis permitidos do perfil
  // Evita redirecionar para um painel de outra sessão/role anterior
  const after = localStorage.getItem('redirect_after_login');
  if (after && after !== window.location.pathname) {
    localStorage.removeItem('redirect_after_login');
    if (isRouteAllowedForProfile(after, profile)) {
      return <Navigate to={after} replace />;
    }
    // Se a rota salva não é permitida para este role, ignora e usa o painel padrão
    if (import.meta.env.DEV) {
      console.warn(`[RedirectIfAuthed] redirect_after_login ignorado (rota não permitida para role ${profile.role}): ${after}`);
    }
  }

  // ✅ ROLE GATE: Usar panelAccessGuard como fonte única de verdade
  const targetRoute = getDefaultRouteForProfile(profile);
  return <Navigate to={targetRoute} replace />;
};

const SmartFallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const inviteToken = params.get('inviteToken');
  
  if (location.pathname.includes('/cadastro-motorista') || inviteToken) {
    navigate(`/cadastro-motorista${location.search}`, { replace: true });
    return null;
  }
  
  return <Navigate to="/" replace />;
};

// Component to handle device registration
const DeviceSetup = () => {
  const mountedRef = React.useRef(true);
  
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  useDeviceRegistration();
  return null;
};

// Component to handle session refresh
const SessionManager = () => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const timeoutRef = React.useRef<NodeJS.Timeout>();
  const mountedRef = React.useRef(true);
  
  React.useEffect(() => {
    mountedRef.current = true;
    
    // ✅ Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // ✅ Não iniciar refresh na rota /auth
    if (location.pathname === '/auth') {
      stopSessionRefresh();
      return;
    }
    
    // ✅ DEBOUNCE: aguardar 300ms antes de iniciar/parar
    timeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      
      if (isAuthenticated) {
        startSessionRefresh();
      } else {
        stopSessionRefresh();
      }
    }, 300);
    
    return () => {
      mountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      stopSessionRefresh();
    };
  }, [isAuthenticated, location.pathname]);
  
  return null;
};

// Component to handle Android/browser back button navigation
const AndroidBackButtonHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      // Handle back button for modals or special cases
      const currentPath = window.location.pathname;
      
      // Se estiver em auth, ir para landing
      if (currentPath === '/auth') {
        event.preventDefault();
        navigate('/', { replace: true });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [navigate, location.pathname]);

  return null;
};

// Component to handle native splash screen on Capacitor
const NativeSplashHandler = () => {
  useSplashScreen();
  return null;
};

// ✅ PERFORMANCE: Deferred TooltipProvider - avoids loading ui-vendor chunk on landing page
// Renders children immediately, then wraps with TooltipProvider once loaded (~50ms)
const DeferredTooltipProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [Provider, setProvider] = React.useState<React.ComponentType<{ children: React.ReactNode }> | null>(null);
  
  React.useEffect(() => {
    import("@/components/ui/tooltip").then(m => {
      setProvider(() => m.TooltipProvider);
    });
  }, []);
  
  if (!Provider) return <>{children}</>;
  return <Provider>{children}</Provider>;
};

const App = () => {
  // Double-tap para resetar zoom
  useDoubleTapResetZoom();

  React.useEffect(() => {
    // Notificar o overlay que a app pintou
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('app:painted'));
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <LoopPreventionBoundary>
      <GlobalErrorBoundary>
      <PageDOMErrorBoundary>
        <ErrorBoundary>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <QueryClientProvider client={queryClient}>
            <AuthProvider>
            <AppBootProvider>
            <BootstrapGuardWrapper>
            <BootTimeoutGuard>
            <BrowserRouter>
              <BootOrchestrator />
              <RatingProviderErrorBoundary>
                <RatingProvider>
                  <DeferredTooltipProvider>
                    <SubscriptionProvider>
                    <TutorialProvider>
                      <ScrollToTop />
                      <DeviceSetup />
                      <SessionManager />
                      <AndroidBackButtonHandler />
                      <NativeSplashHandler />
                      <ErrorMonitoringSetup />
                      <SecurityAntiErrorSetup />
                      <ZipCodeSyncOnReconnect />
                      <FloatingSupportButton />
                      <SilentCityBootstrap />
                      <SwipeNavigationHandler />
                      <main>
                        <Routes>
                        <Route path="/" element={<AuthedLanding />} />
                        <Route path="/landing" element={<Landing />} />
                        <Route path="/auth" element={<Suspense fallback={<AuthLoader message="Carregando..." />}><Auth /></Suspense>} />
                        <Route path="/reset-password" element={<Suspense fallback={<AppLoader variant="inline" />}><ResetPassword /></Suspense>} />
                        <Route path="/confirm-email" element={<Suspense fallback={<AppLoader variant="inline" />}><ConfirmEmail /></Suspense>} />
                        <Route 
                          path="/complete-profile" 
                          element={
                            <ProtectedRoute requiresAuth>
                              <Suspense fallback={<ComponentLoader />}>
                                <CompleteProfile />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        {/* Admin Panel V2 — allowlist-based, nested routes */}
                        <Route 
                          path="/admin-v2/*" 
                          element={
                            <ProtectedRoute requiresAuth>
                              <Suspense fallback={<ComponentLoader />}>
                                <AdminPanelV2 />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        {/* Legacy Admin Panel */}
                        <Route 
                          path="/admin" 
                          element={
                            <ProtectedRoute requiresAuth adminOnly allowedRoles={["ADMIN"]}>
                              <Suspense fallback={<ComponentLoader />}>
                                <AdminPanel />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        <Route 
                          path="/admin/avisos" 
                          element={
                            <ProtectedRoute requiresAuth adminOnly allowedRoles={["ADMIN"]}>
                              <Suspense fallback={<ComponentLoader />}>
                                <AdminAnnouncementsManager />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        <Route 
                          path="/admin/manutencao" 
                          element={
                            <ProtectedRoute requiresAuth adminOnly allowedRoles={["ADMIN"]}>
                              <Suspense fallback={<ComponentLoader />}>
                                <AdminMaintenancePanel />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        <Route 
                          path="/dashboard/producer"
                          element={
                            <ProtectedRoute requiresAuth requiresApproval allowedRoles={["PRODUTOR"]}>
                              <RequirePanel panel="PRODUCER">
                                <Suspense fallback={<DashboardLoader message="Carregando painel do produtor..." />}>
                                  <ProducerDashboard />
                                </Suspense>
                              </RequirePanel>
                            </ProtectedRoute>
                          } 
                        />
                        {/* Alias legado (evita tela branca por links antigos) */}
                        <Route path="/driver/dashboard" element={<Navigate to="/dashboard/driver" replace />} />
                        <Route 
                          path="/dashboard/driver" 
                          element={
                            <ProtectedRoute requiresAuth requiresApproval allowedRoles={["MOTORISTA", "MOTORISTA_AFILIADO"]}>
                              <RequirePanel panel="DRIVER">
                                <Suspense fallback={<DashboardLoader message="Carregando painel do motorista..." />}>
                                  <DriverDashboard />
                                </Suspense>
                              </RequirePanel>
                            </ProtectedRoute>
                          } 
                        />
                        <Route 
                          path="/dashboard/service-provider" 
                          element={
                            <ProtectedRoute requiresAuth requiresApproval allowedRoles={["PRESTADOR_SERVICOS"]}>
                              <RequirePanel panel="SERVICE_PROVIDER">
                                <Suspense fallback={<DashboardLoader message="Carregando painel de serviços..." />}>
                                  <ServiceProviderDashboard />
                                </Suspense>
                              </RequirePanel>
                            </ProtectedRoute>
                          } 
                        />
                        <Route 
                          path="/dashboard/company" 
                          element={
                            <ProtectedRoute requiresAuth requiresApproval allowedRoles={["TRANSPORTADORA"]}>
                              <RequirePanel panel="CARRIER">
                                <Suspense fallback={<DashboardLoader message="Carregando painel da transportadora..." />}>
                                  <CompanyDashboard />
                                </Suspense>
                              </RequirePanel>
                            </ProtectedRoute>
                          } 
                        />
                        {/* Alias legado (rota antiga usada em alguns fluxos) */}
                        <Route path="/dashboard/transport" element={<Navigate to="/dashboard/company" replace />} />
                        <Route 
                          path="/nfe-dashboard" 
                          element={
                            <ProtectedRoute requiresAuth requiresApproval allowedRoles={["PRODUTOR", "MOTORISTA", "MOTORISTA_AFILIADO", "TRANSPORTADORA"]}>
                              <Suspense fallback={<ComponentLoader />}>
                                <NfeDashboard />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        <Route path="/services" element={<Suspense fallback={<ComponentLoader />}><Services /></Suspense>} />
                        <Route path="/subscription" element={<Suspense fallback={<ComponentLoader />}><Subscription /></Suspense>} />
                        <Route path="/plans" element={
                          <ProtectedRoute requiresAuth>
                            <Suspense fallback={<ComponentLoader />}>
                              <Plans />
                            </Suspense>
                          </ProtectedRoute>
                        } />
                        <Route path="/cadastro-prestador" element={<Navigate to="/complete-profile" replace />} />
                        <Route 
                          path="/cadastro-transportadora" 
                          element={
                            <ProtectedRoute requiresAuth>
                              <Suspense fallback={<ComponentLoader />}>
                                <TransportCompanyRegistration />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        <Route path="/sobre" element={<Suspense fallback={<ComponentLoader />}><About /></Suspense>} />
                        <Route path="/privacidade" element={<Suspense fallback={<ComponentLoader />}><Privacy /></Suspense>} />
                        <Route path="/termos" element={<Suspense fallback={<ComponentLoader />}><Terms /></Suspense>} />
                        <Route path="/cookies" element={<Suspense fallback={<ComponentLoader />}><Cookies /></Suspense>} />
                        <Route path="/status" element={<Suspense fallback={<ComponentLoader />}><Status /></Suspense>} />
                        <Route path="/imprensa" element={<Suspense fallback={<ComponentLoader />}><PressPage /></Suspense>} />
                        <Route path="/carreiras" element={<Suspense fallback={<ComponentLoader />}><Careers /></Suspense>} />
                        <Route path="/ajuda" element={<Suspense fallback={<ComponentLoader />}><Help /></Suspense>} />
                        <Route path="/system-test" element={<Suspense fallback={<ComponentLoader />}><SystemTest /></Suspense>} />
                        <Route path="/payment/success" element={<Suspense fallback={<ComponentLoader />}><PaymentSuccess /></Suspense>} />
                        <Route path="/payment/cancel" element={<Suspense fallback={<ComponentLoader />}><PaymentCancel /></Suspense>} />
                        <Route path="/service-payment/success" element={
                          <Suspense fallback={<ComponentLoader />}> 
                            <ServicePaymentSuccess />
                          </Suspense>
                        } />
                        <Route path="/service-payment/cancel" element={
                          <Suspense fallback={<ComponentLoader />}> 
                            <ServicePaymentCancel />
                          </Suspense>
                        } />
                        <Route path="/company-invite/:inviteCode" element={
                          <Suspense fallback={<ComponentLoader />}> 
                            <CompanyInviteAccept />
                          </Suspense>
                        } />
                        <Route path="/cadastro-afiliado/:companyId" element={
                          <Suspense fallback={<ComponentLoader />}> 
                            <AffiliateSignup />
                          </Suspense>
                        } />
                        <Route path="/cadastro-motorista" element={<Suspense fallback={<ComponentLoader />}><DriverInviteSignup /></Suspense>} />
                        <Route path="/cadastro-motorista-afiliado" element={
                          <Suspense fallback={<ComponentLoader />}> 
                            {React.createElement(lazy(() => import('./pages/AffiliatedDriverSignup')))}
                          </Suspense>
                        } />
                        {/* Página pública de fiscalização via QR Code */}
                        <Route path="/fiscalizacao" element={
                          <Suspense fallback={<ComponentLoader />}> 
                            <InspectionView />
                          </Suspense>
                        } />
                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        <Route path="*" element={<SmartFallback />} />
                      </Routes>
                    </main>
            <Suspense fallback={null}><GlobalRatingModals /></Suspense>
            <PermissionPrompts />
            <PreviewFreshBuildBanner />
            <Suspense fallback={null}><LazyToaster /></Suspense>
            <Suspense fallback={null}><LazySonner /></Suspense>
            <Suspense fallback={null}><LazyMatchDebugPanel /></Suspense>
          </TutorialProvider>
          </SubscriptionProvider>
                </DeferredTooltipProvider>
              </RatingProvider>
            </RatingProviderErrorBoundary>
          </BrowserRouter>
          </BootTimeoutGuard>
          </BootstrapGuardWrapper>
          </AppBootProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
        </ErrorBoundary>
        </PageDOMErrorBoundary>
        </GlobalErrorBoundary>
    </LoopPreventionBoundary>
  );
};

export default App;
