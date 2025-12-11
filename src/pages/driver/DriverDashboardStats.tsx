import React from 'react';
import { StatsCard } from '@/components/ui/stats-card';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, CheckCircle, TrendingUp, Eye, EyeOff, DollarSign } from 'lucide-react';

interface DriverDashboardStatsProps {
  canSeeFreights: boolean;
  availableCount: number;
  activeTrips: number;
  pendingProposals: number;
  showEarnings: boolean;
  toggleEarnings: () => void;
  isCompanyDriver: boolean;
  isAffiliated: boolean;
  onTabChange: (tab: string) => void;
}

export const DriverDashboardStats: React.FC<DriverDashboardStatsProps> = ({
  canSeeFreights,
  availableCount,
  activeTrips,
  pendingProposals,
  showEarnings,
  toggleEarnings,
  isCompanyDriver,
  isAffiliated,
  onTabChange,
}) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {canSeeFreights && (
        <StatsCard
          size="sm"
          icon={<MapPin className="h-5 w-5" />}
          iconColor="text-primary"
          label="Disponíveis"
          value={availableCount}
          onClick={() => onTabChange('available')}
        />
      )}

      <StatsCard
        size="sm"
        icon={<Clock className="h-5 w-5" />}
        iconColor="text-orange-500"
        label="Ativas"
        value={activeTrips}
        onClick={() => onTabChange('ongoing')}
      />

      {canSeeFreights && (
        <StatsCard
          size="sm"
          icon={<CheckCircle className="h-5 w-5" />}
          iconColor="text-green-500"
          label="Propostas"
          value={pendingProposals}
          onClick={() => onTabChange('my-trips')}
        />
      )}

      {!isCompanyDriver && (
        <StatsCard
          size="sm"
          icon={<TrendingUp className="h-5 w-5" />}
          iconColor="text-blue-500"
          label="Saldo"
          value={showEarnings ? 'R$ 0,00' : '****'}
          onClick={() => onTabChange('advances')}
          actionButton={
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleEarnings();
              }}
              className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
            >
              {showEarnings ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            </Button>
          }
        />
      )}
      
      {isAffiliated && (
        <StatsCard 
          size="sm"
          icon={<DollarSign className="h-5 w-5" />}
          iconColor="text-muted-foreground"
          label="Valores"
          value="Gerenciados pela empresa"
        />
      )}
    </div>
  );
};
