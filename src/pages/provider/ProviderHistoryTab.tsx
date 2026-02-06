import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ServiceHistoryFromDB } from '@/components/history/ServiceHistoryFromDB';
import { History, Wrench } from 'lucide-react';

export const ProviderHistoryTab: React.FC = () => {
  return (
    <div className="space-y-4">
      <ServiceHistoryFromDB asClient={false} />
    </div>
  );
};