import React, { useState, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightHistoryFromDB } from '@/components/history/FreightHistoryFromDB';
import { ServiceHistoryFromDB } from '@/components/history/ServiceHistoryFromDB';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { Truck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

const URBAN_TYPES = [
  'GUINCHO', 'FRETE_MOTO', 'FRETE_URBANO', 'MUDANCA', 'MUDANCA_RESIDENCIAL',
  'MUDANCA_COMERCIAL', 'TRANSPORTE_PET', 'ENTREGA_PACOTES',
];

export const DriverHistoryTab: React.FC = () => {
  const { profile } = useAuth();

  const { hasRural, hasUrban } = useMemo(() => {
    const types: string[] = profile?.service_types || [];
    const rural = types.length === 0 || types.includes('CARGA');
    const urban = types.some(t => URBAN_TYPES.includes(t));
    return { hasRural: rural, hasUrban: urban };
  }, [profile?.service_types]);

  const showBoth = hasRural && hasUrban;
  const [activeTab, setActiveTab] = useState<string>(hasRural ? 'freights' : 'services');

  // Single tab: rural only
  if (hasRural && !hasUrban) {
    return (
      <SafeListWrapper>
        <div className="space-y-4">
          <FreightHistoryFromDB role="MOTORISTA" />
        </div>
      </SafeListWrapper>
    );
  }

  // Single tab: urban only
  if (hasUrban && !hasRural) {
    return (
      <SafeListWrapper>
        <div className="space-y-4">
          <ServiceHistoryFromDB asClient={false} includeTransportTypes={true} />
        </div>
      </SafeListWrapper>
    );
  }

  // Both tabs
  return (
    <SafeListWrapper>
      <div className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="freights" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Fretes Rurais
            </TabsTrigger>
            <TabsTrigger value="services" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              Fretes Urbanos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="freights" className="mt-4">
            <FreightHistoryFromDB role="MOTORISTA" />
          </TabsContent>

          <TabsContent value="services" className="mt-4">
            <ServiceHistoryFromDB asClient={false} includeTransportTypes={true} />
          </TabsContent>
        </Tabs>
      </div>
    </SafeListWrapper>
  );
};
