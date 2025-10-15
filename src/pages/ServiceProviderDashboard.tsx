import React from 'react';
import { ServiceProviderDashboard as ServiceDashboard } from '@/components/ServiceProviderDashboard';
import { ServiceAutoRatingModal } from '@/components/ServiceAutoRatingModal';
import { PendingServiceRatingsPanel } from '@/components/PendingServiceRatingsPanel';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useServiceAutoRating } from '@/hooks/useServiceAutoRating';
import { useServiceRating } from '@/hooks/useServiceRating';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ServiceProviderDashboard = () => {
  const { profile, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const { 
    serviceRequestId, 
    shouldShow, 
    ratedUserId, 
    ratedUserName, 
    raterRole, 
    serviceType,
    closeAutoRating 
  } = useServiceAutoRating();

  const { submitRating } = useServiceRating({
    serviceRequestId: serviceRequestId || '',
    ratedUserId: ratedUserId || '',
    raterRole: raterRole || 'CLIENT',
  });

  const handleRatingSubmit = async (rating: number, comment?: string) => {
    const result = await submitRating(rating, comment);
    if (result.success) {
      closeAutoRating();
    }
  };

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
          <PendingServiceRatingsPanel />
          <ServiceDashboard />
        </div>
      </div>

      {shouldShow && raterRole && (
        <ServiceAutoRatingModal
          isOpen={shouldShow}
          onClose={closeAutoRating}
          onSubmit={handleRatingSubmit}
          ratedUserName={ratedUserName}
          raterRole={raterRole}
          serviceType={serviceType}
        />
      )}
    </div>
  );
};

export default ServiceProviderDashboard;