import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ServiceProviderDashboard as ServiceDashboard } from '@/components/ServiceProviderDashboard';
import { PendingServiceRatingsPanel } from '@/components/PendingServiceRatingsPanel';
import FreightLimitTracker from '@/components/FreightLimitTracker';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { SystemAnnouncementBanner } from '@/components/SystemAnnouncementBanner';

const ServiceProviderDashboard = () => {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();

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
      <div className="provider-theme">
        <div className="container mx-auto p-4 space-y-4">
          <FreightLimitTracker hideForAffiliatedDriver={true} />
          
          {/* Seção Mural */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span>📢</span> Mural
            </h2>
            <SystemAnnouncementBanner />
          </div>

          <ServiceDashboard />
        </div>
      </div>
    </div>
  );
};

export default ServiceProviderDashboard;