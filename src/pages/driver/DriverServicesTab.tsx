import React from 'react';
import { ServiceTypeManager } from '@/components/ServiceTypeManager';
import { MatchIntelligentDemo } from '@/components/MatchIntelligentDemo';
import { SafeListWrapper } from '@/components/SafeListWrapper';

export const DriverServicesTab: React.FC = () => {
  return (
    <SafeListWrapper>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold mb-4">Tipos de Serviços</h3>
          <ServiceTypeManager />
        </div>
        
        <div className="border-t pt-6">
          <MatchIntelligentDemo />
        </div>
      </div>
    </SafeListWrapper>
  );
};
