import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import SubscriptionPlans from '@/components/SubscriptionPlans';
import SubscriptionStatus from '@/components/SubscriptionStatus';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { Truck, Users, BarChart3, HeadphonesIcon, X, Mail, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Subscription: React.FC = () => {
  const { subscriptionTier } = useSubscription();
  const navigate = useNavigate();

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
    <div className="container mx-auto px-4 py-8 space-y-8 relative">
      {/* Close Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(-1)}
        className="absolute top-0 right-4 z-10"
      >
        <X className="h-5 w-5" />
      </Button>
      
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
                <div key={benefit.title} className="flex items-start gap-3">
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
          <p className="text-muted-foreground mb-6">
            Nossa equipe está pronta para ajudar você a escolher o melhor plano
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              variant="outline"
              onClick={() => window.open('mailto:agrirouteconnect@gmail.com')}
              className="flex items-center gap-2 min-w-[200px]"
            >
              <Mail className="h-4 w-4" />
              Email
            </Button>
            <Button
              variant="outline"
              onClick={() => window.open('https://wa.me/5515669942656', '_blank')}
              className="flex items-center gap-2 min-w-[200px]"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-4">
            agrirouteconnect@gmail.com • 015 66 9 9942-6656
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Subscription;