import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Crown, Sparkles, Zap, BarChart3, Download, Clock } from 'lucide-react';
import { usePremiumFeatures } from '@/hooks/usePremiumFeatures';

interface UpgradeScreenProps {
  onClose?: () => void;
  feature?: 'exports' | 'history' | 'comparison' | 'insights';
}

const PLANS = [
  {
    id: 'free',
    name: 'Plano Grátis',
    price: 'R$ 0',
    period: '/mês',
    description: 'Para experimentar a plataforma',
    features: [
      { name: 'Fretes e serviços ilimitados', included: true },
      { name: '10% de comissão sobre transações', included: true },
      { name: 'Suporte básico por e-mail', included: true },
      { name: 'Acesso à rede básica', included: true },
      { name: 'Relatórios avançados', included: false },
      { name: 'Suporte prioritário', included: false },
    ],
    highlighted: false,
  },
  {
    id: 'essential',
    name: 'Plano Essencial',
    price: 'R$ 120,00',
    period: '/mês',
    description: 'Ideal para profissionais em crescimento',
    features: [
      { name: 'Fretes e serviços ilimitados', included: true },
      { name: '5% de comissão sobre transações', included: true },
      { name: 'Suporte prioritário', included: true },
      { name: 'Relatórios básicos', included: true },
      { name: 'Dashboard avançado', included: true },
      { name: 'API para integração', included: false },
    ],
    highlighted: true,
  },
  {
    id: 'professional',
    name: 'Plano Profissional',
    price: 'R$ 240,00',
    period: '/mês',
    description: 'Para grandes profissionais',
    features: [
      { name: 'Tudo do Plano Essencial', included: true },
      { name: 'Sem comissão sobre transações', included: true },
      { name: 'Suporte 24/7', included: true },
      { name: 'Relatórios avançados', included: true },
      { name: 'API para integração', included: true },
      { name: 'Consultor dedicado', included: true },
    ],
    highlighted: false,
  },
];

const FEATURE_MESSAGES: Record<string, { icon: React.ReactNode; title: string; description: string }> = {
  exports: {
    icon: <Download className="h-8 w-8" />,
    title: 'Limite de Exportações Atingido',
    description: 'Você atingiu o limite de exportações diárias. Faça upgrade para exportar sem limites.',
  },
  history: {
    icon: <Clock className="h-8 w-8" />,
    title: 'Histórico Limitado',
    description: 'O plano gratuito mostra apenas os últimos 30 dias. Faça upgrade para ver todo o histórico.',
  },
  comparison: {
    icon: <BarChart3 className="h-8 w-8" />,
    title: 'Comparação de Períodos',
    description: 'Compare o desempenho entre diferentes períodos. Disponível em planos pagos.',
  },
  insights: {
    icon: <Sparkles className="h-8 w-8" />,
    title: 'Insights Automáticos',
    description: 'Receba análises automáticas e sugestões de melhoria. Disponível em planos pagos.',
  },
};

export const UpgradeScreen: React.FC<UpgradeScreenProps> = ({ onClose, feature }) => {
  const { planType, exportsRemaining } = usePremiumFeatures();
  
  const featureMessage = feature ? FEATURE_MESSAGES[feature] : null;

  return (
    <div className="space-y-6">
      {/* Feature-specific message */}
      {featureMessage && (
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="text-amber-600 dark:text-amber-400">
                {featureMessage.icon}
              </div>
              <div>
                <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                  {featureMessage.title}
                </h3>
                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                  {featureMessage.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 text-white mb-4">
          <Crown className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold">Escolha seu plano</h2>
        <p className="text-muted-foreground mt-2">
          Desbloqueie todo o potencial da plataforma
        </p>
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map((plan) => (
          <Card 
            key={plan.id}
            className={`relative overflow-hidden transition-all ${
              plan.highlighted 
                ? 'border-primary shadow-lg scale-105 z-10' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            {plan.highlighted && (
              <div className="absolute top-0 right-0 bg-primary text-primary-foreground text-xs font-medium px-3 py-1 rounded-bl-lg">
                Mais Popular
              </div>
            )}
            
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2">
                {plan.id === 'essential' && <Zap className="h-5 w-5 text-primary" />}
                {plan.name}
              </CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-2">
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <ul className="space-y-2">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm">
                    {feature.included ? (
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={feature.included ? '' : 'text-muted-foreground'}>
                      {feature.name}
                    </span>
                  </li>
                ))}
              </ul>
              
              <Button 
                className={`w-full ${
                  plan.highlighted 
                    ? 'bg-primary hover:bg-primary/90' 
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
                variant={plan.highlighted ? 'default' : 'secondary'}
                disabled={true}
              >
                {plan.id === planType ? 'Plano Atual' : plan.id === 'free' ? 'Plano Gratuito' : 'Em breve'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current plan info */}
      {planType === 'free' && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Plano atual: Grátis</p>
                <p className="text-xs text-muted-foreground">
                  {exportsRemaining} exportação(ões) restante(s) hoje
                </p>
              </div>
              <Badge variant="outline">Grátis</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Close button */}
      {onClose && (
        <div className="text-center">
          <Button variant="ghost" onClick={onClose}>
            Continuar com plano gratuito
          </Button>
        </div>
      )}

      {/* Informational note */}
      <div className="text-center text-sm text-muted-foreground">
        <p>Os planos acima são informativos. A cobrança ainda não está ativa.</p>
      </div>
    </div>
  );
};