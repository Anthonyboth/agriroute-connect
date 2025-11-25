import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, Star, Zap, ArrowLeft, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/hooks/useAuth';
import CategoryBasedSubscriptionPlans from '@/components/CategoryBasedSubscriptionPlans';
import SubscriptionStatus from '@/components/SubscriptionStatus';
import Header from '@/components/Header';

const Plans: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { subscriptionTier, createCheckout, loading, openCustomerPortal } = useSubscription();

  const plans = [
    {
      id: 'FREE',
      name: 'Gratuito',
      price: 'R$ 0',
      period: '/mês',
      description: 'Para experimentar a plataforma',
      features: [
        '3 fretes gratuitos',
        'Acesso básico a motoristas',
        'Comissão de 5%',
        'Suporte por email'
      ],
      icon: <Check className="h-5 w-5" />,
      buttonText: 'Plano Atual',
      disabled: true,
      popular: false,
      current: subscriptionTier === 'FREE'
    },
    {
      id: 'ESSENTIAL',
      name: 'Essencial',
      price: 'R$ 59',
      period: '/mês',
      description: 'Para produtores que transportam regularmente',
      features: [
        'Fretes ilimitados',
        'Comissão reduzida de 2%',
        'Suporte prioritário',
        'Relatórios básicos',
        'Acesso antecipado a novos recursos',
        'Rede premium de motoristas'
      ],
      icon: <Star className="h-5 w-5" />,
      buttonText: subscriptionTier === 'ESSENTIAL' ? 'Gerenciar Plano' : 'Assinar Essencial',
      disabled: false,
      popular: true,
      current: subscriptionTier === 'ESSENTIAL'
    },
    {
      id: 'PROFESSIONAL',
      name: 'Profissional',
      price: 'R$ 99',
      period: '/mês',
      description: 'Para grandes produtores',
      features: [
        'Tudo do Essencial',
        'Sem taxas sobre transações',
        'Suporte Prioritário',
        'Relatórios avançados e analytics',
        'API para integração',
        'Gerenciamento de múltiplas fazendas'
      ],
      icon: <Zap className="h-5 w-5" />,
      buttonText: subscriptionTier === 'PROFESSIONAL' ? 'Gerenciar Plano' : 'Assinar Profissional',
      disabled: false,
      popular: false,
      current: subscriptionTier === 'PROFESSIONAL'
    }
  ];

  const handlePlanAction = async (planId: string) => {
    if (planId === 'ESSENTIAL' || planId === 'PROFESSIONAL') {
      if (subscriptionTier === planId) {
        // Open customer portal for current plan
        await openCustomerPortal();
      } else {
        // Create checkout for new plan
        await createCheckout('prestador', planId.toLowerCase() as 'essential' | 'professional');
      }
    }
  };

  return (
    <>
      <Header 
        user={{ 
          name: profile?.full_name || 'Usuário', 
          role: (profile?.role === 'ADMIN' ? 'PRODUTOR' : profile?.role) as 'PRODUTOR' | 'MOTORISTA' || 'PRODUTOR'
        }} 
        onLogout={signOut} 
      />
      <div className="container mx-auto px-4 py-8 space-y-8 min-h-screen">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Planos</h1>
            <p className="text-muted-foreground">
              Escolha o plano ideal para seu negócio ou gerencie sua assinatura atual
            </p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-4">
          {/* Current Subscription Status */}
          <div className="lg:col-span-1">
            <SubscriptionStatus />
            
            {/* Plan Benefits Summary */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Crown className="h-5 w-5 text-primary" />
                  Benefícios Premium
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Fretes ilimitados</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span>Comissões reduzidas</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                    <span>Suporte prioritário</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span>Relatórios avançados</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plans Grid */}
          <div className="lg:col-span-3">
            <CategoryBasedSubscriptionPlans />
          </div>
        </div>

        {/* Contact Section */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="text-center py-8">
            <h2 className="text-xl font-semibold mb-2">
              Precisa de ajuda para escolher?
            </h2>
            <p className="text-muted-foreground mb-4">
              Nossa equipe está pronta para ajudar você a encontrar o plano perfeito para seu negócio
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="mailto:agrirouteconnect@gmail.com" 
                className="text-primary hover:underline font-medium"
              >
                📧 agrirouteconnect@gmail.com
              </a>
              <a 
                href="https://wa.me/5566992734632" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                📱 WhatsApp: (66) 9 9273-4632
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Plans;