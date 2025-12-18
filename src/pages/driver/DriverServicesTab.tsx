import React from 'react';
import { ServiceTypeManager } from '@/components/ServiceTypeManager';
import { MatchIntelligentDemo } from '@/components/MatchIntelligentDemo';
import { SafeListWrapper } from '@/components/SafeListWrapper';

export const DriverServicesTab: React.FC = () => {
  return (
    <SafeListWrapper>
      {/* ✅ CORREÇÃO CSS: Container centralizado com largura máxima e overflow controlado */}
      <div className="w-full max-w-4xl mx-auto space-y-6 overflow-x-hidden">
        <div className="w-full">
          <h3 className="text-lg font-semibold mb-4">Tipos de Serviços</h3>
          <ServiceTypeManager />
        </div>
        
        <div className="border-t pt-6 w-full">
          <MatchIntelligentDemo />
        </div>
      </div>
    </SafeListWrapper>
  );
};
