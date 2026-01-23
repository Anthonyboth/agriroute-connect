import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

const SubscriptionPlans: React.FC = () => {
  const { subscriptionTier, loading } = useSubscription();

  const plans = [
    {
      id: 'FREE',
      name: 'Plano Grátis',
      price: 'R$ 0',
      period: '/mês',
      description: 'Para experimentar a plataforma',
      features: [
        'Fretes e serviços ilimitados',
        '10% de comissão sobre transações',
        'Suporte básico por e-mail',
        'Acesso à rede básica'
      ],
      icon: <Check className="h-5 w-5" />,
      buttonText: 'Plano Atual',
      disabled: true,
      popular: false
    },
    {
      id: 'ESSENTIAL',
      name: 'Plano Essencial',
      price: 'R$ 120,00',
      period: '/mês',
      description: 'Ideal para profissionais em crescimento',
      features: [
        'Fretes e serviços ilimitados',
        '5% de comissão sobre transações',
        'Suporte prioritário',
        'Relatórios básicos',
        'Dashboard avançado'
      ],
      icon: <Star className="h-5 w-5" />,
      buttonText: 'Em breve',
      disabled: true,
      popular: true
    },
    {
      id: 'PROFESSIONAL',
      name: 'Plano Profissional',
      price: 'R$ 240,00',
      period: '/mês',
      description: 'Para grandes profissionais',
      features: [
        'Tudo do Plano Essencial',
        'Sem comissão sobre transações',
        'Suporte 24/7',
        'Relatórios avançados',
        'API para integração',
        'Consultor dedicado'
      ],
      icon: <Zap className="h-5 w-5" />,
      buttonText: 'Em breve',
      disabled: true,
      popular: false
    }
  ];

  return (
    <div>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card 
            key={plan.id} 
            className={`relative ${plan.popular ? 'border-primary' : ''} ${
              subscriptionTier === plan.id ? 'bg-primary/5' : ''
            }`}
          >
            {plan.popular && (
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                Mais Popular
              </Badge>
            )}
          
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-2">
              {plan.icon}
            </div>
            <CardTitle className="text-xl">{plan.name}</CardTitle>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-3xl font-bold">{plan.price}</span>
              <span className="text-muted-foreground">{plan.period}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {plan.description}
            </p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <Button
              className="w-full"
              variant={plan.popular ? "default" : "outline"}
              disabled={plan.disabled || loading}
            >
              {plan.buttonText}
            </Button>
          </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SubscriptionPlans;