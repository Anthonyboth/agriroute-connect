import React from 'react';
import { ServiceProviderDashboard as ServiceDashboard } from '@/components/ServiceProviderDashboard';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ServiceProviderDashboard = () => {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Erro ao fazer logout');
    } else {
      toast.success('Logout realizado com sucesso');
    }
  };

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={{ name: profile?.full_name || 'Prestador de Serviços', role: 'MOTORISTA' }}
        onMenuClick={handleMenuClick}
        onLogout={handleLogout}
        userProfile={profile}
        notifications={unreadCount}
      />
      <div className="container mx-auto py-6 px-4">
        <ServiceDashboard />
      </div>
    </div>
  );
};

export default ServiceProviderDashboard;