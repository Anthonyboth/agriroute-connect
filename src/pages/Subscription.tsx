import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import SubscriptionStatus from '@/components/SubscriptionStatus';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Truck, Users, BarChart3, HeadphonesIcon } from 'lucide-react';

const Subscription: React.FC = () => {
  const { subscriptionTier } = useSubscription();

  const benefits = [
    {
      icon: <Truck className="h-6 w-6" />,
      title: 'Cargas Ilimitadas',
      description: 'Publique quantas cargas precisar',
      tier: 'ESSENTIAL'
    },
    {
      icon: <Users className="h-6 w-6" />,
      title: 'Rede Premium de Motoristas',
      description: 'Acesso prioritário aos melhores motoristas',
      tier: 'ESSENTIAL'
    },
    {
      icon: <BarChart3 className="h-6 w-6" />,
      title: 'Relatórios Avançados',
      description: 'Analytics completos dos seus transportes',
      tier: 'PROFESSIONAL'
    },
    {
      icon: <HeadphonesIcon className="h-6 w-6" />,
      title: 'Suporte VIP',
      description: 'Atendimento prioritário 24/7',
      tier: 'PROFESSIONAL'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">Planos de Assinatura</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Escolha o plano ideal para seu negócio e maximize sua eficiência no transporte de cargas
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SubscriptionPlans />
        </div>
        
        <div className="space-y-6">
          <SubscriptionStatus />
          
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Benefícios Premium</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="text-primary mt-1">
                    {benefit.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm">{benefit.title}</h3>
                      <Badge 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {benefit.tier === 'ESSENTIAL' ? 'Essential+' : 'Professional'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="text-center py-8">
          <h2 className="text-xl font-semibold mb-2">
            Precisa de mais informações?
          </h2>
          <p className="text-muted-foreground mb-4">
            Nossa equipe está pronta para ajudar você a escolher o melhor plano
          </p>
          <a 
            href="mailto:anthony_pva@hotmail.com" 
            className="text-primary hover:underline font-medium"
          >
            Fale conosco: anthony_pva@hotmail.com | WhatsApp: 015 66 9 9942-6656
          </a>
        </CardContent>
      </Card>
    </div>
  );
};

export default Subscription;