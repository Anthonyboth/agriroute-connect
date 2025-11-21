import CategoryBasedSubscriptionPlans from '@/components/CategoryBasedSubscriptionPlans';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useDieselPricing } from '@/hooks/useDieselPricing';

const SubscriptionPlans: React.FC = () => {
  const { subscriptionTier, createCheckout, loading, userCategory, getAvailablePlans } = useSubscription();
  const { userPricing, dieselPrice, isLoading: loadingDiesel } = useDieselPricing();
  
  const availablePlans = getAvailablePlans();

  const plans = [
    {
      id: 'FREE',
      name: 'Plano Grátis',
      price: 'R$ 0',
      period: '/mês',
      description: 'Para experimentar a plataforma',
      features: [
        'Fretes/serviços limitados',
        '5% comissão sobre transações',
        'Suporte básico por email',
        'Acesso a rede básica'
      ],
      icon: <Check className="h-5 w-5" />,
      buttonText: 'Plano Atual',
      disabled: true,
      popular: false
    },
    {
      id: 'ESSENTIAL',
      name: 'Plano Essencial',
      price: loadingDiesel 
        ? 'Calculando...' 
        : `R$ ${userPricing?.monthlyFee?.toFixed(2) || '60,00'}`,
      period: '/mês',
      description: userPricing 
        ? `${userPricing.litersBase}L × R$ ${dieselPrice?.toFixed(2)}/L`
        : 'Baseado no diesel',
      features: [
        'Fretes/serviços ilimitados',
        '2% comissão reduzida',
        `💡 Valor: ${userPricing?.litersBase || 10}L de diesel`,
        'Suporte prioritário',
        'Relatórios básicos',
        'Dashboard avançado'
      ],
      icon: <Star className="h-5 w-5" />,
      buttonText: 'Em Breve',
      disabled: true,
      popular: true,
      badge: '⛽ Diesel'
    },
    {
      id: 'PROFESSIONAL',
      name: 'Plano Profissional',
      price: loadingDiesel 
        ? 'Calculando...' 
        : `R$ ${((userPricing?.monthlyFee || 60) * 2).toFixed(2)}`,
      period: '/mês',
      description: 'Para grandes profissionais',
      features: [
        'Tudo do Essencial',
        'Sem comissões',
        'Suporte 24/7',
        'Relatórios avançados',
        'API para integração',
        'Consultor dedicado'
      ],
      icon: <Zap className="h-5 w-5" />,
      buttonText: 'Em Breve',
      disabled: true,
      popular: false
    }
  ];

  const handleSubscribe = async (planId: string) => {
    if (planId === 'ESSENTIAL' || planId === 'PROFESSIONAL') {
      await createCheckout(userCategory || 'prestador', planId.toLowerCase() as 'essential' | 'professional');
    }
  };

  return (
    <div>
      {loadingDiesel && (
        <div className="text-center text-sm text-muted-foreground mb-4">
          ⛽ Calculando valores do diesel...
        </div>
      )}
      
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
            
            {plan.badge && (
              <Badge variant="secondary" className="absolute -top-2 right-4 bg-amber-500/10 text-amber-900 border-amber-200">
                {plan.badge}
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
              onClick={() => handleSubscribe(plan.id)}
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