import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServiceHistory } from '@/components/ServiceHistory';
import { CompletedOperationsHistory } from '@/components/history/CompletedOperationsHistory';
import { OperationReportPanel } from '@/components/history/OperationReportPanel';
import { History, CheckCircle, BarChart3 } from 'lucide-react';

export const ProviderHistoryTab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('all');

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Todos
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Concluídos
          </TabsTrigger>
          <TabsTrigger value="metrics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <ServiceHistory />
        </TabsContent>

        <TabsContent value="completed" className="mt-4">
          <CompletedOperationsHistory entityType="SERVICE" />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <OperationReportPanel entityType="SERVICE" />
        </TabsContent>
      </Tabs>
    </div>
  );
};
