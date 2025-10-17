import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { RatingProvider } from "@/contexts/RatingContext";
import { GlobalRatingModals } from "@/components/GlobalRatingModals";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import ErrorBoundary from "@/components/ErrorBoundary";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ConfirmEmail from "./pages/ConfirmEmail";
import CompleteProfile from "./pages/CompleteProfile";
import AdminPanel from "./pages/AdminPanel";
import ProducerDashboard from "./pages/ProducerDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import CompanyDashboard from "./pages/CompanyDashboard";
import ServiceProviderDashboard from "./pages/ServiceProviderDashboard";
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
const PressPage = lazy(() => import("./pages/Press"));
const ServicePaymentSuccess = lazy(() => import("./pages/ServicePaymentSuccess"));
const ServicePaymentCancel = lazy(() => import("./pages/ServicePaymentCancel"));
const CompanyInviteAccept = lazy(() => import("./pages/CompanyInviteAccept"));
const AffiliateSignup = lazy(() => import("./pages/AffiliateSignup"));
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

  if (loading || isLoadingCompany) {
    return <ComponentLoader />;
  }

  if (requiresAuth && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  // Verificar se o usuário tem o role correto (verificar em user_roles E profiles.role por compatibilidade)
  const hasRequiredRole = allowedRoles && profile ? 
    allowedRoles.some(r => profile.roles?.includes(r) || profile.role === r) : 
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
      } catch (error) {
        console.error('Erro ao logar acesso negado:', error);
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

  if (requiresApproval && !isApproved) {
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

  // Simplify role-based redirection - only redirect if explicitly on wrong dashboard
  if (isAuthenticated && profile) {
    const currentPath = window.location.pathname;
    
    // Check if user is a transport company (kept simple - synchronous checks handled elsewhere)
    if (currentPath === '/dashboard/driver' && profile.active_mode === 'TRANSPORTADORA') {
      return <Navigate to="/dashboard/company" replace />;
    }
    
    // Only redirect if user is on a specific dashboard that doesn't match their role
    if (currentPath === '/dashboard/producer' && profile.role !== 'PRODUTOR') {
      return <Navigate to={profile.role === 'MOTORISTA' ? '/dashboard/driver' : profile.role === 'ADMIN' ? '/admin' : '/dashboard/service-provider'} replace />;
    }
    if (currentPath === '/dashboard/driver' && profile.role !== 'MOTORISTA') {
      return <Navigate to={profile.role === 'PRODUTOR' ? '/dashboard/producer' : profile.role === 'ADMIN' ? '/admin' : '/dashboard/service-provider'} replace />;
    }
    if (currentPath === '/admin' && profile.role !== 'ADMIN') {
      return <Navigate to={profile.role === 'PRODUTOR' ? '/dashboard/producer' : '/dashboard/driver'} replace />;
    }
    if (currentPath === '/dashboard/service-provider' && profile.role !== 'PRESTADOR_SERVICOS') {
      return <Navigate to={profile.role === 'PRODUTOR' ? '/dashboard/producer' : profile.role === 'MOTORISTA' ? '/dashboard/driver' : '/admin'} replace />;
    }
  }

  return <>{children}</>;
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
      to = '/dashboard/driver';
      break;
    case 'PRODUTOR':
      to = '/dashboard/producer';
      break;
    case 'PRESTADOR_SERVI\u00C7OS':
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
  useDeviceRegistration();
  return null;
};

const App = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={queryClient}>
        <SubscriptionProvider>
          <RatingProvider>
            <TooltipProvider>
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true
                }}
              >
            <ScrollToTop />
            <DeviceSetup />
            <Routes>
            <Route path="/" element={<Landing />} />
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
                  <AdminPanel />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/producer" 
              element={
                <ProtectedRoute requiresAuth requiresApproval allowedRoles={["PRODUTOR"]}>
                  <ProducerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/driver" 
              element={
                <ProtectedRoute requiresAuth requiresApproval allowedRoles={["MOTORISTA", "MOTORISTA_AFILIADO"]}>
                  <DriverDashboard />
                </ProtectedRoute>
              } 
            />
          <Route 
            path="/dashboard/service-provider" 
            element={
              <ProtectedRoute requiresAuth requiresApproval allowedRoles={["PRESTADOR_SERVI\u00C7OS"]}>
                <ServiceProviderDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/dashboard/company" 
            element={
              <ProtectedRoute requiresAuth requiresApproval allowedRoles={["TRANSPORTADORA"]}>
                <CompanyDashboard />
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
          <GlobalRatingModals />
          <PermissionPrompts />
          <Toaster />
          <Sonner />
        </BrowserRouter>
      </TooltipProvider>
          </RatingProvider>
      </SubscriptionProvider>
    </QueryClientProvider>
    </ThemeProvider>
  </ErrorBoundary>
);

export default App;
