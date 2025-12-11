import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ServiceProviderDashboard as ServiceDashboard } from '@/components/ServiceProviderDashboard';
import { PendingServiceRatingsPanel } from '@/components/PendingServiceRatingsPanel';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { SystemAnnouncementsBoard } from '@/components/SystemAnnouncementsBoard';
import { Button } from '@/components/ui/button';
import { AppBreadcrumb } from '@/components/navigation/AppBreadcrumb';

const ServiceProviderDashboard = () => {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMuralOpen, setIsMuralOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  useEffect(() => {
    const dismissedAt = localStorage.getItem('mural_dismissed_at');
    const now = new Date();
    let timeoutId: number | undefined;

    if (dismissedAt) {
      const dismissed = new Date(dismissedAt);
      const nextShow = new Date(dismissed);
      nextShow.setDate(nextShow.getDate() + 1);
      nextShow.setHours(7, 0, 0, 0);

      if (now < nextShow) {
        setIsMuralOpen(false);
        // Programa reabertura automática às 07:00
        timeoutId = window.setTimeout(() => {
          localStorage.removeItem('mural_dismissed_at');
          setManualOpen(false);
          setIsMuralOpen(true);
        }, nextShow.getTime() - now.getTime());
      } else {
        // Já passou das 07:00: limpa flag e abre
        localStorage.removeItem('mural_dismissed_at');
        setManualOpen(false);
        setIsMuralOpen(true);
      }
    } else {
      // Sem flag de dismiss: aberto por padrão
      setManualOpen(false);
      setIsMuralOpen(true);
    }

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut();
      toast.success('Logout realizado com sucesso');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      toast.error('Erro ao fazer logout');
    }
  };

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  // Tratar navegação de notificações (ServiceProviderDashboard não implementa modal de serviço ainda)
  useEffect(() => {
    const state = location.state as any;
    if (state) {
      // Apenas limpar state por enquanto - funcionalidade pode ser expandida futuramente
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, navigate, location.pathname]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 dark:to-primary/5">
      <Header
        user={{ name: profile?.full_name || 'Prestador de Serviços', role: 'PRESTADOR_SERVICOS' }}
        onMenuClick={handleMenuClick}
        onLogout={handleLogout}
        userProfile={profile}
        notifications={unreadCount}
      />
      
      {/* Breadcrumb Navigation */}
      <div className="container mx-auto px-4 py-2">
        <AppBreadcrumb />
      </div>
      
      <div className="provider-theme">
        <div className="container mx-auto p-4 space-y-4">
        {/* Botão Mural de Avisos */}
        <div className="mb-6">
        <Button
          variant="outline"
          onClick={() => {
            const newState = !isMuralOpen;
            setIsMuralOpen(newState);
            setManualOpen(newState);
          }}
          className="mb-3 flex items-center gap-2"
        >
          <span>📢</span> Mural de Avisos
        </Button>
        <SystemAnnouncementsBoard
          isOpen={isMuralOpen}
          onClose={() => {
            setIsMuralOpen(false);
            setManualOpen(false);
          }}
          ignoreDismissals={manualOpen}
        />
        </div>

          <ServiceDashboard />
        </div>
      </div>
    </div>
  );
};

export default ServiceProviderDashboard;