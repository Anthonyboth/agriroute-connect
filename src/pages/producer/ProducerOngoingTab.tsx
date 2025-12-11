import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FreightInProgressCard } from '@/components/FreightInProgressCard';
import { Play } from 'lucide-react';
import { isInProgressFreight } from '@/utils/freightDateHelpers';
import type { ProducerFreight } from './types';

interface ProducerOngoingTabProps {
  freights: ProducerFreight[];
  onViewDetails: (freight: ProducerFreight) => void;
  onRequestCancel: (freight: ProducerFreight) => void;
}

export const ProducerOngoingTab: React.FC<ProducerOngoingTabProps> = ({
  freights,
  onViewDetails,
  onRequestCancel,
}) => {
  const ongoingFreights = freights.filter(f => isInProgressFreight(f.pickup_date, f.status));

  if (ongoingFreights.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Play className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Nenhum frete em andamento</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Você não possui fretes em andamento no momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
        {ongoingFreights.map((freight) => (
          <FreightInProgressCard
            key={freight.id}
            freight={freight as any}
            onViewDetails={() => onViewDetails(freight)}
            onRequestCancel={() => onRequestCancel(freight)}
          />
        ))}
      </div>
    </div>
  );
};
