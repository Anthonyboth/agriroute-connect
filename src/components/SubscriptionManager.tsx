import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Gift, Crown, CheckCircle, Clock } from 'lucide-react';

interface SubscriptionManagerProps {
  onSubscriptionChange?: () => void;
}

export const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  onSubscriptionChange
}) => {
  const { profile } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [freightCount, setFreightCount] = useState(0);
  const [driverCount, setDriverCount] = useState(0);

  useEffect(() => {
    if (profile) {
      fetchSubscriptionData();
      fetchFreightCount();
      fetchDriverCount();
    }
  }, [profile]);

  const fetchSubscriptionData = async () => {
    try {
      const { data, error } = await supabase
        .from('subscribers')
        .select('*')
        .eq('user_id', profile?.user_id)
        .single();

      if (!error && data) {
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFreightCount = async () => {
    if (profile?.role === 'MOTORISTA') {
      const { data, error } = await supabase
        .from('freights')
        .select('id', { count: 'exact' })
        .eq('driver_id', profile.id)
        .eq('status', 'DELIVERED');

      if (!error) {
        setFreightCount(data?.length || 0);
      }
    }
  };

  const fetchDriverCount = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id', { count: 'exact' })
      .eq('role', 'MOTORISTA')
      .eq('status', 'APPROVED');

    if (!error && data) {
      setDriverCount(data.length);
    }
  };

  const activateFreeTrial = async () => {
    if (!profile || driverCount >= 1000) {
      toast.error('Promoção não mais disponível');
      return;
    }

    setLoading(true);
    try {
      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 30); // 30 days trial

      const { error } = await supabase
        .from('subscribers')
        .upsert({
          user_id: profile?.user_id,
          user_email: profile?.user_id + '@temp.com',
          subscribed: true,
          subscription_tier: 'TRIAL',
          subscription_end_date: trialEndDate.toISOString(),
        });

      if (error) throw error;

      // Send notification
      await supabase.rpc('send_notification', {
        p_user_id: profile.user_id,
        p_title: 'Período trial ativado!',
        p_message: 'Você ganhou 3 fretes gratuitos e 30 dias de acesso premium!',
        p_type: 'success'
      });

      toast.success('Período trial ativado com sucesso!');
      await fetchSubscriptionData();
      onSubscriptionChange?.();
    } catch (error: any) {
      toast.error('Erro ao ativar período trial: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const isEligibleForTrial = () => {
    return (
      profile?.role === 'MOTORISTA' &&
      driverCount < 1000 &&
      (!subscription || subscription.subscription_tier === 'FREE')
    );
  };

  const getRemainingTrialDays = () => {
    if (!subscription || subscription.subscription_tier !== 'TRIAL') return 0;
    
    const endDate = new Date(subscription.subscription_end_date);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  const getFreightUsage = () => {
    if (subscription?.subscription_tier === 'TRIAL') {
      return Math.min(freightCount, 3);
    }
    return freightCount;
  };

  const getMaxFreights = () => {
    if (subscription?.subscription_tier === 'TRIAL') return 3;
    if (subscription?.subscription_tier === 'PROFESSIONAL') return -1; // Unlimited
    if (subscription?.subscription_tier === 'ESSENTIAL') return 50;
    return 5; // Free
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-2 bg-muted rounded"></div>
            <div className="h-8 bg-muted rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const trialDays = getRemainingTrialDays();
  const usedFreights = getFreightUsage();
  const maxFreights = getMaxFreights();
  const progressPercent = maxFreights > 0 ? (usedFreights / maxFreights) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Promotion Banner for First 1000 Drivers */}
      {isEligibleForTrial() && (
        <Card className="border-2 border-primary bg-gradient-to-r from-primary/10 to-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Gift className="h-5 w-5" />
              Oferta Especial - Primeiros 1000 Motoristas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>3 fretes gratuitos</span>
              </div>
              <div className="flex items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-600" />
                <span>30 dias de acesso premium</span>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Motoristas cadastrados:</span>
                <span className="font-medium">{driverCount}/1000</span>
              </div>
              <Progress value={(driverCount / 1000) * 100} className="h-2" />
            </div>

            <Button 
              onClick={activateFreeTrial}
              disabled={loading || driverCount >= 1000}
              className="w-full"
            >
              {driverCount >= 1000 ? 'Promoção Encerrada' : 'Ativar Oferta Especial'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Subscription Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Status da Assinatura</span>
            <Badge variant={
              subscription?.subscription_tier === 'TRIAL' ? 'default' :
              subscription?.subscription_tier === 'PROFESSIONAL' ? 'default' :
              subscription?.subscription_tier === 'ESSENTIAL' ? 'secondary' : 'outline'
            }>
              {subscription?.subscription_tier === 'TRIAL' ? 'Trial' :
               subscription?.subscription_tier === 'PROFESSIONAL' ? 'Profissional' :
               subscription?.subscription_tier === 'ESSENTIAL' ? 'Essencial' : 'Gratuito'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Trial Information */}
          {subscription?.subscription_tier === 'TRIAL' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 text-blue-800">
                <Clock className="h-4 w-4" />
                <span className="font-medium">
                  Período trial ativo - {trialDays} dias restantes
                </span>
              </div>
            </div>
          )}

          {/* Freight Usage */}
          {profile?.role === 'MOTORISTA' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Fretes realizados:</span>
                <span className="font-medium">
                  {usedFreights}{maxFreights > 0 ? `/${maxFreights}` : ''}
                  {subscription?.subscription_tier === 'TRIAL' && ' (Gratuitos)'}
                </span>
              </div>
              
              {maxFreights > 0 && (
                <Progress value={progressPercent} className="h-2" />
              )}

              {subscription?.subscription_tier === 'TRIAL' && usedFreights >= 3 && (
                <p className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                  Você usou todos os fretes gratuitos. Considere upgradar seu plano.
                </p>
              )}
            </div>
          )}

          {/* Upgrade Options */}
          {(!subscription || subscription.subscription_tier === 'FREE' || subscription.subscription_tier === 'TRIAL') && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">
                Quer mais funcionalidades? Confira nossos planos:
              </p>
              <Button variant="outline" className="w-full">
                Ver Planos Premium
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SubscriptionManager;