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
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ConfirmEmail from "./pages/ConfirmEmail";
import CompleteProfile from "./pages/CompleteProfile";
import ServiceProviderRegistration from "./pages/ServiceProviderRegistration";
import Services from "./pages/Services";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";
import Status from "./pages/Status";
import TransportCompanyRegistration from "./pages/TransportCompanyRegistration";

import Careers from "./pages/Careers";
import Help from "./pages/Help";
import Subscription from "./pages/Subscription";
import Plans from "./pages/Plans";
import SystemTest from "./pages/SystemTest";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import React, { lazy, Suspense } from 'react';
import { useAuth } from "./hooks/useAuth";
import { useCompanyDriver } from "./hooks/useCompanyDriver";
import { ComponentLoader } from '@/components/LazyComponents';
import { ScrollToTop } from './components/ScrollToTop';
import { PermissionPrompts } from './components/PermissionPrompts';
import { useDeviceRegistration } from './hooks/useDeviceRegistration';
import { startSessionRefresh, stopSessionRefresh } from './utils/sessionRefresh';
import { SilentCityBootstrap } from './components/SilentCityBootstrap';
import { ZipCodeService } from './services/zipCodeService';
const PressPage = lazy(() => import("./pages/Press"));
const ServicePaymentSuccess = lazy(() => import("./pages/ServicePaymentSuccess"));
const ServicePaymentCancel = lazy(() => import("./pages/ServicePaymentCancel"));
const CompanyInviteAccept = lazy(() => import("./pages/CompanyInviteAccept"));
const AffiliateSignup = lazy(() => import("./pages/AffiliateSignup"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const ProducerDashboard = lazy(() => import("./pages/ProducerDashboard"));
const DriverDashboard = lazy(() => import("./pages/DriverDashboard"));
const CompanyDashboard = lazy(() => import("./pages/CompanyDashboard"));
const ServiceProviderDashboard = lazy(() => import("./pages/ServiceProviderDashboard"));
import DriverInviteSignup from "./pages/DriverInviteSignup";
import { AlertCircle } from 'lucide-react';

const queryClient = new QueryClient();

// Inicializar Error Monitoring
if (typeof window !== 'undefined') {
  import('@/services/errorMonitoringService').then(({ ErrorMonitoringService }) => {
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
  });
}

// Componente para setup de monitoramento de erros
import { useErrorMonitoring } from '@/hooks/useErrorMonitoring';

const ErrorMonitoringSetup = () => {
  useErrorMonitoring();
  return null;
};

// Componente para sincronização de CEPs ao reconectar
const ZipCodeSyncOnReconnect = () => {
  React.useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 Reconectado à internet - sincronizando cache de CEPs...');
      ZipCodeService.syncOnReconnect();
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
      }, 8000);
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

const RedirectIfAuthed = () => {
  const { isAuthenticated, profile, loading, profiles } = useAuth();
  const [isCheckingCompany, setIsCheckingCompany] = React.useState(false);
  const [isCompany, setIsCompany] = React.useState(false);
  
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
  
  if (loading || isCheckingCompany) {
    return <ComponentLoader />;
  }
  
  if (!isAuthenticated) return <Auth />;
  
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

const App = () => {
  React.useEffect(() => {
    // Notificar o overlay que a app pintou
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('app:painted'));
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <PageDOMErrorBoundary>
      <ErrorBoundary>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <QueryClientProvider client={queryClient}>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <RatingProviderErrorBoundary>
              <RatingProvider>
                <TooltipProvider>
                  <SubscriptionProvider>
                    <ScrollToTop />
                    <DeviceSetup />
                    <SessionManager />
                    <ErrorMonitoringSetup />
                    <ZipCodeSyncOnReconnect />
                    <SilentCityBootstrap />
                    <main>
                      <Routes>
                        <Route path="/" element={<AuthedLanding />} />
                        <Route path="/landing" element={<Landing />} />
                        <Route path="/auth" element={<RedirectIfAuthed />} />
                        <Route path="/reset-password" element={<ResetPassword />} />
                        <Route path="/confirm-email" element={<ConfirmEmail />} />
                        <Route 
                          path="/complete-profile" 
                          element={
                            <ProtectedRoute requiresAuth>
                              <CompleteProfile />
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
                        <Route path="/services" element={<Services />} />
                        <Route path="/subscription" element={<Subscription />} />
                        <Route path="/plans" element={
                          <ProtectedRoute requiresAuth>
                            <Plans />
                          </ProtectedRoute>
                        } />
                        <Route path="/cadastro-prestador" element={<ServiceProviderRegistration />} />
                        <Route 
                          path="/cadastro-transportadora" 
                          element={
                            <ProtectedRoute requiresAuth>
                              <TransportCompanyRegistration />
                            </ProtectedRoute>
                          } 
                        />
                        <Route path="/sobre" element={<About />} />
                        <Route path="/privacidade" element={<Privacy />} />
                        <Route path="/termos" element={<Terms />} />
                        <Route path="/cookies" element={<Cookies />} />
                        <Route path="/status" element={<Status />} />
                        <Route path="/imprensa" element={<Suspense fallback={<ComponentLoader />}><PressPage /></Suspense>} />
                        <Route path="/carreiras" element={<Careers />} />
                        <Route path="/ajuda" element={<Help />} />
                        <Route path="/system-test" element={<SystemTest />} />
                        <Route path="/payment/success" element={<PaymentSuccess />} />
                        <Route path="/payment/cancel" element={<PaymentCancel />} />
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
                        <Route path="/cadastro-motorista" element={<DriverInviteSignup />} />
                        <Route path="/cadastro-motorista-afiliado" element={
                          <Suspense fallback={<ComponentLoader />}> 
                            {React.createElement(lazy(() => import('./pages/AffiliatedDriverSignup')))}
                          </Suspense>
                        } />
                        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                        <Route path="*" element={<SmartFallback />} />
                      </Routes>
                    </main>
            <GlobalRatingModals />
            <PermissionPrompts />
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
  );
};

export default App;
