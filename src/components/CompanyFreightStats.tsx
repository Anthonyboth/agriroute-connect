import React from 'react';
import { StatsCard } from '@/components/ui/stats-card';
import { Package, Truck, TrendingUp, DollarSign, Users, Eye, EyeOff } from 'lucide-react';
import { useEarningsVisibility } from '@/hooks/useEarningsVisibility';
import { Button } from '@/components/ui/button';

interface CompanyFreightStatsProps {
  totalFreights: number;
  activeFreights: number;
  activeDrivers: number;
  totalEarnings: number;
  pendingProposals: number;
  onNavigateToTab?: (tab: string) => void;
}

export const CompanyFreightStats: React.FC<CompanyFreightStatsProps> = ({
  totalFreights,
  activeFreights,
  activeDrivers,
  totalEarnings,
  pendingProposals,
  onNavigateToTab,
}) => {
  const { visible, toggle } = useEarningsVisibility(false);
  
  const formattedEarnings = visible 
    ? `R$ ${totalEarnings.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
    : 'R$ •••••';

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <StatsCard
        label="Fretes Totais"
        value={totalFreights}
        icon={<Package className="h-6 w-6" />}
        iconColor="text-blue-600"
        onClick={() => onNavigateToTab?.('freights')}
      />
      <StatsCard
        label="Fretes Ativos"
        value={activeFreights}
        icon={<TrendingUp className="h-6 w-6" />}
        iconColor="text-green-600"
        onClick={() => onNavigateToTab?.('freights')}
      />
      <StatsCard
        label="Motoristas Ativos"
        value={activeDrivers}
        icon={<Users className="h-6 w-6" />}
        iconColor="text-purple-600"
        onClick={() => onNavigateToTab?.('drivers')}
      />
      <StatsCard
        label="Ganhos Totais"
        value={formattedEarnings}
        icon={<DollarSign className="h-6 w-6" />}
        iconColor="text-emerald-600"
        onClick={() => onNavigateToTab?.('balance')}
        actionButton={
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
            className="h-8 w-8 p-0"
          >
            {visible ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        }
      />
      <StatsCard
        label="Propostas Pendentes"
        value={pendingProposals}
        icon={<Truck className="h-6 w-6" />}
        iconColor="text-orange-600"
        onClick={() => onNavigateToTab?.('freights')}
      />
    </div>
  );
};
