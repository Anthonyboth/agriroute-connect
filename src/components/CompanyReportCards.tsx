import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatsCard } from '@/components/ui/stats-card';
import { BarChart3, DollarSign, Users, Truck, FileText } from 'lucide-react';

interface CompanyReportCardsProps {
  onNavigate: (tab: string) => void;
}

export const CompanyReportCards: React.FC<CompanyReportCardsProps> = ({ onNavigate }) => {
  const reportCards = [
    {
      id: 'general',
      title: 'Relatórios Gerenciais',
      description: 'Visão completa das operações',
      icon: <BarChart3 className="h-6 w-6" />,
      iconColor: 'text-blue-600',
      targetTab: 'reports',
    },
    {
      id: 'financial',
      title: 'Relatórios Financeiros',
      description: 'Receitas, pagamentos e saldo',
      icon: <DollarSign className="h-6 w-6" />,
      iconColor: 'text-emerald-600',
      targetTab: 'balance',
    },
    {
      id: 'drivers',
      title: 'Performance de Motoristas',
      description: 'Avaliações e produtividade',
      icon: <Users className="h-6 w-6" />,
      iconColor: 'text-purple-600',
      targetTab: 'drivers',
    },
    {
      id: 'fleet',
      title: 'Performance de Frota',
      description: 'Utilização e manutenção',
      icon: <Truck className="h-6 w-6" />,
      iconColor: 'text-orange-600',
      targetTab: 'fleet',
    },
  ];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Acesso Rápido a Relatórios
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {reportCards.map((card) => (
            <StatsCard
              key={card.id}
              icon={card.icon}
              label={card.title}
              value={card.description}
              iconColor={card.iconColor}
              onClick={() => onNavigate(card.targetTab)}
              size="sm"
              className="cursor-pointer hover:border-emerald-400 hover:shadow-lg transition-all"
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
