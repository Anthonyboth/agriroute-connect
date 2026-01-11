import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { RatingProvider } from "@/contexts/RatingContext";
import { RatingProviderErrorBoundary } from "@/components/RatingProviderErrorBoundary";
import { GlobalRatingModals } from "@/components/GlobalRatingModals";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthErrorBoundary } from "@/components/AuthErrorBoundary";
import { PageDOMErrorBoundary } from "@/components/PageDOMErrorBoundary";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import React, { lazy, Suspense } from 'react';

// Import Landing directly (not lazy) - it's the LCP element
import Landing from "./pages/Landing";
import { useAuth } from "./hooks/useAuth";
import { useCompanyDriver } from "./hooks/useCompanyDriver";
import { ComponentLoader } from '@/components/LazyComponents';
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

// Lazy load all page components except Landing (needed for initial render)
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ConfirmEmail = lazy(() => import("./pages/ConfirmEmail"));
const CompleteProfile = lazy(() => import("./pages/CompleteProfile"));
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
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const AdminAnnouncementsManager = lazy(() => import("./pages/AdminAnnouncementsManager"));
const AdminMaintenancePanel = lazy(() => import("./pages/AdminMaintenancePanel"));
const ProducerDashboard = lazy(() => import("./pages/ProducerDashboard"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const CompanyDashboard = lazy(() => import("./pages/CompanyDashboard"));
const ServiceProviderDashboard = lazy(() => import("./pages/ServiceProviderDashboard"));
const NfeDashboard = lazy(() => import("./pages/NfeDashboard"));
const InspectionView = lazy(() => import("./pages/InspectionView"));
import { AlertCircle } from 'lucide-react';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

// QueryClient com configurações otimizadas de cache
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos - dados considerados frescos
      gcTime: 10 * 60 * 1000, // 10 minutos - tempo no cache
      refetchOnWindowFocus: false, // Não refetch ao voltar para aba (economiza requests)
      refetchOnMount: false, // Não refetch ao montar se dados no cache
      retry: 1, // Apenas 1 retry em caso de erro (reduz latência)
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
      errorMonitoring.captureError(event.error || new Error(event.message), {
        source: 'window.error',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Capturar rejeições de promessas não tratadas
    window.addEventListener('unhandledrejection', (event) => {
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
}

// Componente para setup de monitoramento de erros
import { useErrorMonitoring } from '@/hooks/useErrorMonitoring';

const ErrorMonitoringSetup = () => {
  useErrorMonitoring();
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
  const { isAuthenticated, isApproved, isAdmin, loading, profile, signOut } = useAuth();
  const { isCompanyDriver, isLoading: isLoadingCompany } = useCompanyDriver();
  const location = useLocation();
  const navigate = useNavigate();
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);

  React.useEffect(() => {
    if (loading || isLoadingCompany) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 15000); // ✅ ETAPA 5: Aumentado de 8s para 15s
      return () => clearTimeout(timer);
    }
  }, [loading, isLoadingCompany]);

  if ((loading || isLoadingCompany) && !loadingTimeout) {
    return <ComponentLoader />;
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

  // Redirect to correct dashboard BEFORE checking allowedRoles (better UX)
  if (isAuthenticated && profile) {
    const currentPath = window.location.pathname;
    
    // Check if user is a transport company
    if (currentPath === '/dashboard/driver' && profile.active_mode === 'TRANSPORTADORA' && profile.role !== 'MOTORISTA_AFILIADO') {
      return <Navigate to="/dashboard/company" replace />;
    }
    
    // Only redirect if user is on a specific dashboard that doesn't match their role
    if (currentPath === '/dashboard/producer' && profile.role !== 'PRODUTOR') {
      return <Navigate to={profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO' ? '/dashboard/driver' : profile.role === 'ADMIN' ? '/admin' : '/dashboard/service-provider'} replace />;
    }
    if (currentPath === '/dashboard/driver' && profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO') {
      return <Navigate to={profile.role === 'PRODUTOR' ? '/dashboard/producer' : profile.role === 'ADMIN' ? '/admin' : '/dashboard/service-provider'} replace />;
    }
    if (currentPath === '/admin' && profile.role !== 'ADMIN') {
      return <Navigate to={profile.role === 'PRODUTOR' ? '/dashboard/producer' : '/dashboard/driver'} replace />;
    }
    if (currentPath === '/dashboard/service-provider' && profile.role !== 'PRESTADOR_SERVICOS') {
      return <Navigate to={profile.role === 'PRODUTOR' ? '/dashboard/producer' : profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO' ? '/dashboard/driver' : '/admin'} replace />;
    }
    if (currentPath === '/dashboard/company' && profile.role !== 'TRANSPORTADORA' && profile.active_mode !== 'TRANSPORTADORA') {
      return <Navigate to={profile.role === 'PRODUTOR' ? '/dashboard/producer' : profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO' ? '/dashboard/driver' : '/dashboard/service-provider'} replace />;
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
  
  // Timeout para loading
  React.useEffect(() => {
    if (loading || isCheckingCompany) {
      const timer = setTimeout(() => {
        setLoadingTimeout(true);
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [loading, isCheckingCompany]);
  
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
  
  // Se demorou muito e não há usuário, mostrar Landing
  if (loadingTimeout && !profile) {
    return <Landing />;
  }
  
  // Aguardar resolução
  if ((loading || isCheckingCompany) && !loadingTimeout) {
    return <ComponentLoader />;
  }
  
  // Se não autenticado, mostrar Landing normal
  if (!isAuthenticated || !profile) {
    return <Landing />;
  }
  
  // ✅ Usuário autenticado: redirecionar para painel apropriado
  // ✅ PROBLEMA 5: Debug log para diagnóstico de redirecionamento
  console.log('[AuthedLanding] Redirecionando usuário:', { 
    role: profile?.role, 
    active_mode: profile?.active_mode,
    isCompany,
    profileId: profile?.id 
  });
  
  // Redirecionar transportadoras
  if (isCompany) {
    return <Navigate to="/dashboard/company" replace />;
  }
  
  // ✅ PROBLEMA 5: Usar active_mode se disponível, senão role
  const effectiveRole = profile?.active_mode || profile?.role;
  
  let to = "/";
  switch (effectiveRole) {
    case 'ADMIN':
      to = '/admin';
      break;
    case 'MOTORISTA':
    case 'MOTORISTA_AFILIADO':
      to = '/dashboard/driver';
      break;
    case 'PRODUTOR':
      to = '/dashboard/producer';
      break;
    case 'PRESTADOR_SERVICOS':
      to = '/dashboard/service-provider';
      break;
    default:
      to = '/';
  }
  
  return <Navigate to={to} replace />;
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
              window.location.href = '/auth';
            }} variant="outline">
              Fazer Login Novamente
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  if (loading || isCheckingCompany) {
    return <ComponentLoader />;
  }
  
  // ✅ FASE 1 FIX: Aguardar profile carregar quando autenticado (corrige flash de cadastro)
  if (isAuthenticated && !profile) {
    return <ComponentLoader />;
  }
  
  if (!isAuthenticated) return <Suspense fallback={<ComponentLoader />}><Auth /></Suspense>;
  
  // Evita redirecionar cedo demais: só vá para /complete-profile
  // quando já soubermos que não há perfis após o carregamento
  if (!profile) {
    if (Array.isArray(profiles) && profiles.length === 0) {
      return <Navigate to="/complete-profile" replace />;
    }
    return <ComponentLoader />; // aguardando resolução do perfil
  }
  
  // Consumir redirect_after_login se existir
  const after = localStorage.getItem('redirect_after_login');
  if (after && after !== window.location.pathname) {
    localStorage.removeItem('redirect_after_login');
    return <Navigate to={after} replace />;
  }
  
  // Redirecionar transportadoras
  if (isCompany) {
    return <Navigate to="/dashboard/company" replace />;
  }
  
  let to = "/";
  switch (profile?.role) {
    case 'ADMIN':
      to = '/admin';
      break;
    case 'MOTORISTA':
    case 'MOTORISTA_AFILIADO':
      to = '/dashboard/driver';
      break;
    case 'PRODUTOR':
      to = '/dashboard/producer';
      break;
    case 'PRESTADOR_SERVICOS':
      to = '/dashboard/service-provider';
      break;
    default:
      to = '/';
  }
  
  return <Navigate to={to} replace />;
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

const App = () => {
  React.useEffect(() => {
    // Notificar o overlay que a app pintou
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('app:painted'));
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <GlobalErrorBoundary>
    <PageDOMErrorBoundary>
      <ErrorBoundary>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <RatingProviderErrorBoundary>
              <RatingProvider>
                <TooltipProvider>
                  <SubscriptionProvider>
                    <ScrollToTop />
                    <DeviceSetup />
                    <SessionManager />
                    <AndroidBackButtonHandler />
                    <NativeSplashHandler />
                    <ErrorMonitoringSetup />
                    <ZipCodeSyncOnReconnect />
                    <FloatingSupportButton />
                    <SilentCityBootstrap />
                    <main>
                      <Routes>
                        <Route path="/" element={<AuthedLanding />} />
                        <Route path="/landing" element={<Landing />} />
                        <Route path="/auth" element={<Suspense fallback={<ComponentLoader />}><Auth /></Suspense>} />
                        <Route path="/reset-password" element={<Suspense fallback={<ComponentLoader />}><ResetPassword /></Suspense>} />
                        <Route path="/confirm-email" element={<Suspense fallback={<ComponentLoader />}><ConfirmEmail /></Suspense>} />
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
                              <Suspense fallback={<ComponentLoader />}>
                                <ProducerDashboard />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        <Route 
                          path="/dashboard/driver" 
                          element={
                            <ProtectedRoute requiresAuth requiresApproval allowedRoles={["MOTORISTA", "MOTORISTA_AFILIADO"]}>
                              <Suspense fallback={<ComponentLoader />}>
                                <DriverDashboard />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        <Route 
                          path="/dashboard/service-provider" 
                          element={
                            <ProtectedRoute requiresAuth requiresApproval allowedRoles={["PRESTADOR_SERVICOS"]}>
                              <Suspense fallback={<ComponentLoader />}>
                                <ServiceProviderDashboard />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
                        <Route 
                          path="/dashboard/company" 
                          element={
                            <ProtectedRoute requiresAuth requiresApproval allowedRoles={["TRANSPORTADORA"]}>
                              <Suspense fallback={<ComponentLoader />}>
                                <CompanyDashboard />
                              </Suspense>
                            </ProtectedRoute>
                          } 
                        />
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
                        <Route path="/cadastro-prestador" element={<Suspense fallback={<ComponentLoader />}><ServiceProviderRegistration /></Suspense>} />
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
            <GlobalRatingModals />
            <PermissionPrompts />
            <PreviewFreshBuildBanner />
            <Toaster />
            <Sonner />
          </SubscriptionProvider>
                </TooltipProvider>
              </RatingProvider>
            </RatingProviderErrorBoundary>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
    </PageDOMErrorBoundary>
    </GlobalErrorBoundary>
  );
};

export default App;
