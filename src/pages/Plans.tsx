import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, Star, Zap, ArrowLeft, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useAuth } from '@/hooks/useAuth';
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
      id: 'BASIC',
      name: 'Básico',
      price: 'R$ 29',
      period: '/mês',
      description: 'Para produtores que transportam regularmente',
      features: [
        'Fretes ilimitados',
        'Comissão reduzida de 3%',
        'Suporte prioritário',
        'Relatórios básicos',
        'Acesso antecipado a novos recursos',
        'Rede premium de motoristas'
      ],
      icon: <Star className="h-5 w-5" />,
      buttonText: subscriptionTier === 'BASIC' ? 'Gerenciar Plano' : 'Assinar Básico',
      disabled: false,
      popular: true,
      current: subscriptionTier === 'BASIC'
    },
    {
      id: 'PREMIUM',
      name: 'Premium',
      price: 'R$ 59',
      period: '/mês',
      description: 'Para grandes produtores',
      features: [
        'Tudo do Básico',
        'Comissão mínima de 2.5%',
        'Suporte VIP',
        'Relatórios avançados e analytics',
        'API para integração',
        'Gerenciamento de múltiplas fazendas'
      ],
      icon: <Zap className="h-5 w-5" />,
      buttonText: subscriptionTier === 'PREMIUM' ? 'Gerenciar Plano' : 'Assinar Premium',
      disabled: false,
      popular: false,
      current: subscriptionTier === 'PREMIUM'
    },
    {
      id: 'ENTERPRISE',
      name: 'Enterprise',
      price: 'R$ 99',
      period: '/mês',
      description: 'Para cooperativas e grandes empresas',
      features: [
        'Tudo do Premium',
        'Comissão mínima de 2%',
        'Suporte VIP 24/7',
        'Analytics avançados',
        'Integração completa',
        'Consultor dedicado',
        'SLA garantido'
      ],
      icon: <Crown className="h-5 w-5" />,
      buttonText: subscriptionTier === 'ENTERPRISE' ? 'Gerenciar Plano' : 'Assinar Enterprise',
      disabled: false,
      popular: false,
      current: subscriptionTier === 'ENTERPRISE'
    }
  ];

  const handlePlanAction = async (planId: string) => {
    if (planId === 'BASIC' || planId === 'PREMIUM' || planId === 'ENTERPRISE') {
      if (subscriptionTier === planId) {
        // Open customer portal for current plan
        await openCustomerPortal();
      } else {
        // Create checkout for new plan
        await createCheckout(planId as 'BASIC' | 'PREMIUM' | 'ENTERPRISE');
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
            <div className="grid gap-6 md:grid-cols-4">
              {plans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`relative transition-all duration-200 hover:shadow-lg ${
                    plan.popular ? 'border-primary shadow-md' : ''
                  } ${
                    plan.current ? 'ring-2 ring-primary bg-primary/5' : ''
                  }`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                      Mais Popular
                    </Badge>
                  )}
                  
                  {plan.current && (
                    <Badge className="absolute -top-2 right-4 bg-green-600">
                      Atual
                    </Badge>
                  )}
                  
                  <CardHeader className="text-center pb-4">
                    <div className="flex justify-center mb-2 text-primary">
                      {plan.icon}
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground text-sm">{plan.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <Separator />
                    
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button
                      className="w-full"
                      variant={plan.current ? "default" : plan.popular ? "default" : "outline"}
                      disabled={plan.id === 'FREE' || loading}
                      onClick={() => handlePlanAction(plan.id)}
                    >
                      {plan.buttonText}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                href="mailto:anthony_pva@hotmail.com" 
                className="text-primary hover:underline font-medium"
              >
                📧 anthony_pva@hotmail.com
              </a>
              <a 
                href="https://wa.me/5515669942656" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                📱 WhatsApp: (15) 9 9942-6656
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default Plans;