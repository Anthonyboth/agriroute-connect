import React from 'react';
import { StatsCard } from '@/components/ui/stats-card';
import { Package, Play, Clock, Users, CreditCard, Wrench } from 'lucide-react';
import type { ProducerStatistics } from './types';

interface ProducerDashboardStatsProps {
  statistics: ProducerStatistics;
  onTabChange: (tab: string) => void;
}

export const ProducerDashboardStats: React.FC<ProducerDashboardStatsProps> = ({
  statistics,
  onTabChange,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      <StatsCard
        size="sm"
        icon={<Package className="h-5 w-5" />}
        iconColor="text-blue-500"
        label="Abertos"
        value={statistics.openFreights}
        onClick={() => onTabChange('open')}
      />

      <StatsCard
        size="sm"
        icon={<Play className="h-5 w-5" />}
        iconColor="text-orange-500"
        label="Andamento"
        value={statistics.activeFreights}
        onClick={() => onTabChange('ongoing')}
      />

      <StatsCard
        size="sm"
        icon={<Clock className="h-5 w-5" />}
        iconColor="text-amber-500"
        label="P/ Confirmar"
        value={statistics.pendingConfirmation}
        onClick={() => onTabChange('confirm-delivery')}
      />

      <StatsCard
        size="sm"
        icon={<Users className="h-5 w-5" />}
        iconColor="text-purple-500"
        label="Propostas"
        value={statistics.pendingProposals}
        onClick={() => onTabChange('proposals')}
      />

      <StatsCard
        size="sm"
        icon={<CreditCard className="h-5 w-5" />}
        iconColor="text-green-500"
        label="Pagamentos"
        value={statistics.pendingPayments}
        onClick={() => onTabChange('payments')}
      />

      <StatsCard
        size="sm"
        icon={<Wrench className="h-5 w-5" />}
        iconColor="text-teal-500"
        label="Serviços"
        value={statistics.openServices || 0}
        onClick={() => onTabChange('history')}
      />
    </div>
  );
};
