import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { FreightCard } from '@/components/FreightCard';
import { Package } from 'lucide-react';
import type { ProducerFreight } from './types';

interface ProducerOpenTabProps {
  freights: ProducerFreight[];
  onFreightAction: (action: string, freight: ProducerFreight) => void;
}

export const ProducerOpenTab: React.FC<ProducerOpenTabProps> = ({
  freights,
  onFreightAction,
}) => {
  const openFreights = freights.filter(f => f.status === 'OPEN');

  if (openFreights.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Package className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-2">Nenhum frete aberto</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Crie um novo frete para começar a receber propostas de motoristas.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid gap-6 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-[1fr]">
        {openFreights.map((freight) => (
          <FreightCard
            key={freight.id}
            freight={freight as any}
            showActions
            showProducerActions
            onAction={(action) => onFreightAction(action, freight)}
          />
        ))}
      </div>
    </div>
  );
};
