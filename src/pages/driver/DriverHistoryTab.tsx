import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightHistoryFromDB } from '@/components/history/FreightHistoryFromDB';
import { ServiceHistoryFromDB } from '@/components/history/ServiceHistoryFromDB';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { History, Truck, Wrench } from 'lucide-react';

export const DriverHistoryTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('freights');

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