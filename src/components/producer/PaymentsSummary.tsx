import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Clock, CheckCircle, DollarSign, AlertCircle } from 'lucide-react';
import type { PaymentCardData } from './PaymentCard';

interface PaymentsSummaryProps {
  payments: PaymentCardData[];
}

export const PaymentsSummary: React.FC<PaymentsSummaryProps> = ({ payments }) => {
  // ✅ Normalizar status: 'confirmed' do banco = 'completed' na UI
  const normalizeStatus = (status: string) => 
    status === 'confirmed' ? 'completed' : status;

  const proposed = payments.filter(p => normalizeStatus(p.status) === 'proposed');
  const pending = payments.filter(p => normalizeStatus(p.status) === 'paid_by_producer');
  const completed = payments.filter(p => normalizeStatus(p.status) === 'completed');

  const totalPending = proposed.reduce((sum, p) => sum + p.amount, 0);
  const totalWaiting = pending.reduce((sum, p) => sum + p.amount, 0);
  const totalCompleted = completed.reduce((sum, p) => sum + p.amount, 0);

  const stats = [
    {
      label: 'Pendentes',
      count: proposed.length,
      value: totalPending,
      icon: AlertCircle,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      label: 'Aguardando',
      count: pending.length,
      value: totalWaiting,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      label: 'Concluídos',
      count: completed.length,
      value: totalCompleted,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      label: 'Total Pago',
      count: null,
      value: totalCompleted,
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className={`${stat.bgColor} border-none`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`h-4 w-4 ${stat.color}`} />
                <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              </div>
              <div className="space-y-1">
                {stat.count !== null && (
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                )}
                <p className="text-sm font-semibold">
                  R$ {stat.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
