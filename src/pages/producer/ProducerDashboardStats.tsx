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
  // ✅ P0: Validação de integridade de contadores
  const expectedTotal = statistics.openFreights + statistics.openServices;
  if (statistics.openTotal !== expectedTotal) {
    console.error('[CRITICAL] STATS_CARD_MISMATCH', {
      openFreights: statistics.openFreights,
      openServices: statistics.openServices,
      openTotal: statistics.openTotal,
      expectedTotal,
      timestamp: new Date().toISOString(),
    });
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
      {/* ✅ P0: Card "Abertos" mostra openTotal (fretes + serviços) */}
      <StatsCard
        size="sm"
        icon={<Package className="h-5 w-5" />}
        iconColor="text-blue-500"
        label="Abertos"
        value={statistics.openTotal}
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

      {/* ✅ P0: Só mostra serviços se existirem (lógica de negócio) */}
      <StatsCard
        size="sm"
        icon={<Wrench className="h-5 w-5" />}
        iconColor="text-teal-500"
        label="Serviços"
        value={statistics.openServices}
        onClick={() => onTabChange('services-open')}
      />
    </div>
  );
};
