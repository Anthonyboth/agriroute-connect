import CategoryBasedSubscriptionPlans from '@/components/CategoryBasedSubscriptionPlans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

const SubscriptionPlans: React.FC = () => {
  const { subscriptionTier, createCheckout, loading } = useSubscription();

  const plans = [
    {
      id: 'FREE',
      name: 'Gratuito',
      price: 'R$ 0',
      period: '/mês',
      description: 'Para começar a usar a plataforma',
      features: [
        'Até 3 cargas por mês',
        'Comissão de 5%',
        'Suporte básico por email',
        'Acesso a motoristas verificados'
      ],
      icon: <Check className="h-5 w-5" />,
      buttonText: 'Plano Atual',
      disabled: true,
      popular: false
    },
    {
      id: 'ESSENTIAL',
      name: 'Essencial',
      price: 'R$ 59',
      period: '/mês',
      description: 'Para produtores que transportam regularmente',
      features: [
        'Cargas ilimitadas',
        'Comissão reduzida de 2%',
        'Suporte prioritário',
        'Relatórios básicos',
        'Acesso antecipado a novos recursos'
      ],
      icon: <Star className="h-5 w-5" />,
      buttonText: subscriptionTier === 'ESSENTIAL' ? 'Plano Atual' : 'Assinar Essencial',
      disabled: subscriptionTier === 'ESSENTIAL',
      popular: true
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
        'Suporte VIP',
        'Relatórios avançados',
        'API para integração',
        'Gerenciamento de múltiplas fazendas'
      ],
      icon: <Zap className="h-5 w-5" />,
      buttonText: subscriptionTier === 'PROFESSIONAL' ? 'Plano Atual' : 'Assinar Profissional',
      disabled: subscriptionTier === 'PROFESSIONAL',
      popular: false
    }
  ];

  const handleSubscribe = async (planId: string) => {
    if (planId === 'ESSENTIAL' || planId === 'PROFESSIONAL') {
      await createCheckout('prestador', planId.toLowerCase() as 'essential' | 'professional');
    }
  };

  return (
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
              {plan.features.map((feature, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            
            <Button
              className="w-full"
              variant={plan.popular ? "default" : "outline"}
              disabled={plan.disabled || loading}
              onClick={() => handleSubscribe(plan.id)}
            >
              {plan.buttonText}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default SubscriptionPlans;