import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, CreditCard, Calendar, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface SubscriptionStatus {
  tier: string;
  status: string;
  expires_at?: string;
  subscription_end?: string;
}

export const SubscriptionExpiryNotification: React.FC = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [showExpiryModal, setShowExpiryModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (user && profile) {
      checkSubscriptionStatus();
    }
  }, [user, profile]);

  const checkSubscriptionStatus = async () => {
    try {
      const { data: subscriber } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (subscriber) {
        setSubscriptionStatus({
          tier: subscriber.subscription_tier || 'FREE',
          status: subscriber.subscribed ? 'active' : 'inactive',
          expires_at: subscriber.subscription_end_date,
          subscription_end: subscriber.subscription_end_date
        });

        // Check if subscription is expired or expiring soon
        if (subscriber.subscription_end_date && subscriber.subscription_tier !== 'FREE') {
          const expiryDate = new Date(subscriber.subscription_end_date);
          const now = new Date();
          const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          // Show notification if expired or expiring in 3 days
          if (daysUntilExpiry <= 3 && !dismissed) {
            setShowExpiryModal(true);
          }
        }
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
    }
  };

  const handleRenewSubscription = () => {
    navigate('/subscription');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getDaysUntilExpiry = () => {
    if (!subscriptionStatus?.subscription_end) return 0;
    const expiryDate = new Date(subscriptionStatus.subscription_end);
    const now = new Date();
    return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const isExpired = getDaysUntilExpiry() <= 0;
  const isExpiringSoon = getDaysUntilExpiry() <= 3 && getDaysUntilExpiry() > 0;

  // In-app banner notification
  const renderBanner = () => {
    if (!subscriptionStatus || subscriptionStatus.tier === 'FREE' || dismissed) return null;
    if (!isExpired && !isExpiringSoon) return null;

    return (
      <div className="fixed top-16 left-0 right-0 z-40 px-4">
        <Alert className={`${isExpired ? 'border-red-500 bg-red-50' : 'border-amber-500 bg-amber-50'} shadow-lg`}>
          <AlertTriangle className={`h-4 w-4 ${isExpired ? 'text-red-600' : 'text-amber-600'}`} />
          <AlertDescription className="flex items-center justify-between">
            <div className={isExpired ? 'text-red-800' : 'text-amber-800'}>
              <strong>
                {isExpired ? '⚠️ Assinatura Vencida!' : '⏰ Assinatura Vencendo!'}
              </strong>
              {isExpired 
                ? ' Renove agora para continuar usando todos os recursos.'
                : ` Sua assinatura vence em ${getDaysUntilExpiry()} dias.`
              }
            </div>
            <div className="flex gap-2 ml-4">
              <Button
                size="sm"
                onClick={handleRenewSubscription}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <CreditCard className="h-3 w-3 mr-1" />
                Renovar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDismissed(true)}
                className="h-8 w-8 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  return (
    <>
      {renderBanner()}
      
      {/* Detailed Modal */}
      <Dialog open={showExpiryModal} onOpenChange={setShowExpiryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              {isExpired ? 'Assinatura Vencida' : 'Assinatura Vencendo'}
            </DialogTitle>
            <DialogDescription className="space-y-4 pt-4">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-amber-500 mx-auto mb-3" />
                <p className="text-foreground font-medium">
                  {isExpired 
                    ? 'Sua assinatura venceu em' 
                    : 'Sua assinatura vence em'
                  }
                </p>
                <p className="text-lg font-bold text-amber-600">
                  {subscriptionStatus?.subscription_end && formatDate(subscriptionStatus.subscription_end)}
                </p>
                {!isExpired && (
                  <p className="text-sm text-muted-foreground mt-1">
                    ({getDaysUntilExpiry()} dias restantes)
                  </p>
                )}
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium text-amber-900 dark:text-amber-100 mb-2">
                  {isExpired ? '🚫 Recursos Suspensos:' : '⚠️ Será Suspenso:'}
                </h4>
                <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                  <li>• Comissão reduzida voltará ao padrão</li>
                  <li>• Perda do suporte prioritário</li>
                  <li>• Limitação de cargas por mês</li>
                  <li>• Acesso limitado a relatórios</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleRenewSubscription}
                  className="gradient-primary flex-1"
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Renovar Assinatura
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowExpiryModal(false);
                    setDismissed(true);
                  }}
                >
                  Depois
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Renove agora e mantenha todos os benefícios ativos
              </p>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
};