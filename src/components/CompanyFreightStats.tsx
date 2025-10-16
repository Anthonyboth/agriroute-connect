import React from 'react';
import { StatsCard } from '@/components/ui/stats-card';
import { Package, Truck, TrendingUp, DollarSign, Users } from 'lucide-react';

interface CompanyFreightStatsProps {
  totalFreights: number;
  activeFreights: number;
  activeDrivers: number;
  totalEarnings: number;
  pendingProposals: number;
}

export const CompanyFreightStats: React.FC<CompanyFreightStatsProps> = ({
  totalFreights,
  activeFreights,
  activeDrivers,
  totalEarnings,
  pendingProposals,
}) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <StatsCard
        label="Fretes Totais"
        value={totalFreights}
        icon={<Package className="h-6 w-6" />}
        iconColor="text-blue-600"
      />
      <StatsCard
        label="Fretes Ativos"
        value={activeFreights}
        icon={<TrendingUp className="h-6 w-6" />}
        iconColor="text-green-600"
      />
      <StatsCard
        label="Motoristas Ativos"
        value={activeDrivers}
        icon={<Users className="h-6 w-6" />}
        iconColor="text-purple-600"
      />
      <StatsCard
        label="Ganhos Totais"
        value={`R$ ${totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
        icon={<DollarSign className="h-6 w-6" />}
        iconColor="text-emerald-600"
      />
      <StatsCard
        label="Propostas Pendentes"
        value={pendingProposals}
        icon={<Truck className="h-6 w-6" />}
        iconColor="text-orange-600"
      />
    </div>
  );
};
