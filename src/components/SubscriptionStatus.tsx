import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, CreditCard, RefreshCw } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SubscriptionStatus: React.FC = () => {
  const { 
    subscriptionTier, 
    subscribed, 
    subscriptionEnd, 
    loading,
    checkSubscription,
    openCustomerPortal 
  } = useSubscription();

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'ENTERPRISE':
        return 'bg-yellow-500';
      case 'PREMIUM':
        return 'bg-purple-500';
      case 'BASIC':
        return 'bg-blue-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getTierLabel = (tier: string) => {
    switch (tier) {
      case 'ENTERPRISE':
        return 'Enterprise';
      case 'PREMIUM':
        return 'Premium';
      case 'BASIC':
        return 'Básico';
      default:
        return 'Gratuito';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Status da Assinatura</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={checkSubscription}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Plano Atual:</span>
          <Badge className={getTierColor(subscriptionTier)}>
            {getTierLabel(subscriptionTier)}
          </Badge>
        </div>

        {subscribed && subscriptionEnd && (
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              Renovação em:{' '}
              {format(new Date(subscriptionEnd), 'dd/MM/yyyy', { locale: ptBR })}
            </span>
          </div>
        )}

        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {subscriptionTier === 'FREE' && 'Você está no plano gratuito com recursos limitados.'}
            {subscriptionTier === 'BASIC' && 'Você tem acesso a recursos básicos e suporte prioritário.'}
            {subscriptionTier === 'PREMIUM' && 'Você tem acesso a recursos avançados e analytics.'}
            {subscriptionTier === 'ENTERPRISE' && 'Você tem acesso completo a todos os recursos premium.'}
          </div>

          {subscribed && (
            <Button
              variant="outline"
              size="sm"
              onClick={openCustomerPortal}
              className="w-full"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Gerenciar Assinatura
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SubscriptionStatus;