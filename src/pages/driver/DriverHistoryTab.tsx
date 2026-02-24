import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightHistoryFromDB } from '@/components/history/FreightHistoryFromDB';
import { ServiceHistoryFromDB } from '@/components/history/ServiceHistoryFromDB';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { Truck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useDriverFreightVisibility } from '@/hooks/useDriverFreightVisibility';

export const DriverHistoryTab: React.FC = () => {
  const { profile } = useAuth();

  const { hasRuralFreights: hasRural, hasUrbanFreights: hasUrban } = useDriverFreightVisibility({
    serviceTypes: profile?.service_types,
    defaultToRuralWhenEmpty: false,
  });

  const [activeTab, setActiveTab] = useState<string>(hasRural ? 'freights' : 'services');

  useEffect(() => {
    if (!hasRural && hasUrban && activeTab !== 'services') {
      setActiveTab('services');
    }
    if (!hasUrban && hasRural && activeTab !== 'freights') {
      setActiveTab('freights');
    }
  }, [hasRural, hasUrban, activeTab]);

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

  // Nenhum tipo ativo
  if (!hasRural && !hasUrban) {
    return (
      <SafeListWrapper>
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Nenhum tipo de frete ativo no seu perfil. Ative pelo menos um tipo de serviço para visualizar o histórico.
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
