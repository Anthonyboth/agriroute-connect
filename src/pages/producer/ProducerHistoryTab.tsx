import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightHistoryFromDB } from '@/components/history/FreightHistoryFromDB';
import { ServiceHistoryFromDB } from '@/components/history/ServiceHistoryFromDB';
import { History, Truck, Wrench } from 'lucide-react';

export const ProducerHistoryTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('freights');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="freights" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Fretes
          </TabsTrigger>
          <TabsTrigger value="services" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Serviços
          </TabsTrigger>
        </TabsList>

        <TabsContent value="freights" className="mt-4">
          <FreightHistoryFromDB role="PRODUTOR" />
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <ServiceHistoryFromDB asClient={true} />
        </TabsContent>
      </Tabs>
    </div>
  );
};