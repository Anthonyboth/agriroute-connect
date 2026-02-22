import React from 'react';
import { ServiceProviderDashboard as ServiceDashboard } from '@/components/ServiceProviderDashboard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
const ServiceProviderDashboard = () => {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    // ✅ Logout silencioso - sem toasts
    await signOut();
  };

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  // ✅ NÃO limpar state aqui - o componente ServiceDashboard consome via useLocation
  
  return (
    <div data-dashboard-ready="true" className="min-h-screen bg-gradient-to-br from-background via-background to-primary/10 dark:to-primary/5">
      <Header
        user={{ name: profile?.full_name || 'Prestador de Serviços', role: 'PRESTADOR_SERVICOS' }}
        onMenuClick={handleMenuClick}
        onLogout={handleLogout}
        userProfile={profile}
        notifications={unreadCount}
      />
      
      <div className="provider-theme">
        {/* Dashboard Principal - Mural de Avisos já está incluído inline dentro do componente */}
        <ServiceDashboard />
      </div>
    </div>
  );
};

export default ServiceProviderDashboard;