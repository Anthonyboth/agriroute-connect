import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import ConfirmEmail from "./pages/ConfirmEmail";
import CompleteProfile from "./pages/CompleteProfile";
import AdminPanel from "./pages/AdminPanel";
import ProducerDashboard from "./pages/ProducerDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import ServiceProviderDashboard from "./pages/ServiceProviderDashboard";
import ServiceProviderRegistration from "./pages/ServiceProviderRegistration";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";
import Status from "./pages/Status";

import Careers from "./pages/Careers";
import Help from "./pages/Help";
import Subscription from "./pages/Subscription";
import Plans from "./pages/Plans";
import SystemTest from "./pages/SystemTest";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentCancel from "./pages/PaymentCancel";
import React, { lazy, Suspense } from 'react';
import { useAuth } from "./hooks/useAuth";
import { ComponentLoader } from '@/components/LazyComponents';
const PressPage = lazy(() => import("./pages/Press"));

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, requiresAuth = true, requiresApproval = false, adminOnly = false }: { 
  children: React.ReactNode; 
  requiresAuth?: boolean;
  requiresApproval?: boolean;
  adminOnly?: boolean;
}) => {
  const { isAuthenticated, isApproved, isAdmin, loading, profile } = useAuth();

  if (loading) {
    return <ComponentLoader />;
  }

  if (requiresAuth && !isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (requiresApproval && !isApproved) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Conta Pendente</h2>
          <p className="text-muted-foreground">Aguarde aprovação do administrador</p>
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
  const { isAuthenticated, profile, loading } = useAuth();
  
  if (loading) {
    return <ComponentLoader />;
  }
  
  if (!isAuthenticated) return <Auth />;
  
  // Wait for profile to be loaded before redirecting
  if (!profile) {
    return <ComponentLoader />;
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
    case 'PRESTADOR_SERVICOS':
      to = '/dashboard/service-provider';
      break;
    default:
      to = '/';
  }
  
  return <Navigate to={to} replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SubscriptionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter 
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}
        >
          <Routes>
            <Route path="/" element={<Landing />} />
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
                <ProtectedRoute requiresAuth adminOnly>
                  <AdminPanel />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/producer" 
              element={
                <ProtectedRoute requiresAuth requiresApproval>
                  <ProducerDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/driver" 
              element={
                <ProtectedRoute requiresAuth requiresApproval>
                  <DriverDashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/dashboard/service-provider" 
              element={
                <ProtectedRoute requiresAuth requiresApproval>
                  <ServiceProviderDashboard />
                </ProtectedRoute>
              } 
            />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/plans" element={
              <ProtectedRoute requiresAuth>
                <Plans />
              </ProtectedRoute>
            } />
            <Route path="/cadastro-prestador" element={<ServiceProviderRegistration />} />
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
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SubscriptionProvider>
  </QueryClientProvider>
);

export default App;
