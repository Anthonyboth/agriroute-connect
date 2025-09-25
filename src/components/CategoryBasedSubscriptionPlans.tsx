import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Star, Zap, Truck, Package, Crown } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';

const CategoryBasedSubscriptionPlans: React.FC = () => {
  const { 
    subscriptionTier, 
    userCategory, 
    createCheckout, 
    loading, 
    getAvailablePlans 
  } = useSubscription();

  const plans = getAvailablePlans();

  const getCategoryIcon = (category: string) => {
    const icons = {
      'prestador': <Package className="h-5 w-5" />,
      'motorista_rural': <Truck className="h-5 w-5" />,
      'motorista_urbano': <Truck className="h-5 w-5" />,
      'guincho_urbano': <Package className="h-5 w-5" />
    };
    return icons[category as keyof typeof icons] || <Package className="h-5 w-5" />;
  };

  const getCategoryName = (category: string) => {
    const names = {
      'prestador': 'Prestador de Serviços',
      'motorista_rural': 'Motorista Rural',
      'motorista_urbano': 'Motorista Urbano',
      'guincho_urbano': 'Guincho Urbano'
    };
    return names[category as keyof typeof names] || 'Categoria';
  };

  const getPlanIcon = (planType: string) => {
    const icons = {
      'free': <Check className="h-5 w-5" />,
      'essential': <Star className="h-5 w-5" />,
      'professional': <Crown className="h-5 w-5" />
    };
    return icons[planType] || <Check className="h-5 w-5" />;
  };

  const getPlanFeatures = (planType: string, category: string) => {
    const serviceType = category === 'prestador' ? 'serviços' : 'fretes';
    const itemType = category === 'prestador' ? 'Serviços' : 'Fretes';
    
    const baseFeatures = {
      'free': [
        `${itemType} limitados`,
        `5% comissão sobre ${serviceType}`,
        'Suporte básico por email',
        'Acesso à rede básica'
      ],
      'essential': [
        `${itemType} ilimitados`,
        `2% comissão sobre ${serviceType}`,
        'Valor mensal fixo',
        'Suporte prioritário',
        'Dashboard avançado',
        'Relatórios básicos'
      ],
      'professional': [
        `${itemType} ilimitados`,
        'Sem comissões sobre transações',
        'Apenas valor mensal',
        'Suporte premium 24/7',
        'Relatórios completos',
        'Dashboard premium',
        'Consultor dedicado'
      ]
    };
    return baseFeatures[planType as keyof typeof baseFeatures] || [];
  };

  const isCurrentPlan = (planType: string) => {
    if (planType === 'free') return subscriptionTier === 'FREE';
    if (planType === 'essential') return subscriptionTier === 'ESSENTIAL';
    if (planType === 'professional') return subscriptionTier === 'PROFESSIONAL';
    return false;
  };

  const handleSubscribe = async (planType: string) => {
    if (planType === 'essential' || planType === 'professional') {
      await createCheckout(userCategory || 'prestador', planType as 'essential' | 'professional');
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          {getCategoryIcon(userCategory || 'prestador')}
          <h2 className="text-2xl font-bold">
            {getCategoryName(userCategory || 'prestador')}
          </h2>
        </div>
        <p className="text-muted-foreground">
          Planos específicos para sua categoria profissional
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan, index) => (
          <Card 
            key={plan.id} 
            className={`relative ${
              index === 1 ? 'border-primary scale-105' : ''
            } ${
              isCurrentPlan(plan.planType) ? 'bg-primary/5 ring-2 ring-primary' : ''
            }`}
          >
            {index === 1 && (
              <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-primary">
                Mais Popular
              </Badge>
            )}
            
            {isCurrentPlan(plan.planType) && (
              <Badge className="absolute -top-2 right-4 bg-green-500">
                Plano Atual
              </Badge>
            )}
            
            <CardHeader className="text-center pb-4">
              <div className="flex justify-center mb-2 text-primary">
                {getPlanIcon(plan.planType)}
              </div>
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-3xl font-bold">
                  R$ {plan.price}
                </span>
                <span className="text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {getPlanFeatures(plan.planType, userCategory || 'prestador').map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button
                className="w-full"
                variant={index === 1 ? "default" : "outline"}
                disabled={plan.planType === 'free' || isCurrentPlan(plan.planType) || loading}
                onClick={() => handleSubscribe(plan.planType)}
              >
                {isCurrentPlan(plan.planType) 
                  ? 'Plano Atual' 
                  : plan.planType === 'free' 
                    ? 'Plano Gratuito' 
                    : `Assinar ${plan.name}`
                }
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Category Switch Note */}
      <div className="text-center text-sm text-muted-foreground">
        <p>
          Os preços são específicos para sua categoria profissional. 
          Motoristas e prestadores pagam mensalidade, com diferentes comissões por categoria.
        </p>
      </div>
    </div>
  );
};

export default CategoryBasedSubscriptionPlans;