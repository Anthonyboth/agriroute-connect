import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import CompleteProfile from "./pages/CompleteProfile";
import AdminPanel from "./pages/AdminPanel";
import ProducerDashboard from "./pages/ProducerDashboard";
import DriverDashboard from "./pages/DriverDashboard";
import ServiceProviderRegistration from "./pages/ServiceProviderRegistration";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import About from "./pages/About";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Cookies from "./pages/Cookies";
import Status from "./pages/Status";
import Press from "./pages/Press";
import Subscription from "./pages/Subscription";
import { useAuth } from "./hooks/useAuth";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, requiresAuth = true, requiresApproval = false, adminOnly = false }: { 
  children: React.ReactNode; 
  requiresAuth?: boolean;
  requiresApproval?: boolean;
  adminOnly?: boolean;
}) => {
  const { isAuthenticated, isApproved, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
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

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SubscriptionProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
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
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/cadastro-prestador" element={<ServiceProviderRegistration />} />
            <Route path="/sobre" element={<About />} />
            <Route path="/privacidade" element={<Privacy />} />
            <Route path="/termos" element={<Terms />} />
            <Route path="/cookies" element={<Cookies />} />
            <Route path="/status" element={<Status />} />
            <Route path="/imprensa" element={<Press />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SubscriptionProvider>
  </QueryClientProvider>
);

export default App;
