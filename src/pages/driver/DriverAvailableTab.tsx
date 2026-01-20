import React from "react";
import { SmartFreightMatcher } from "@/components/SmartFreightMatcher";
import { AdvancedFreightSearch } from "@/components/AdvancedFreightSearch";
import { SafeListWrapper } from "@/components/SafeListWrapper";

interface DriverAvailableTabProps {
  profileId: string | undefined;
  onFreightAction: (freightId: string, action: "propose" | "accept" | "complete" | "cancel") => void;
  onCountsChange: (counts: { total: number }) => void;
  onFetchAvailable: () => void;
}

export const DriverAvailableTab: React.FC<DriverAvailableTabProps> = ({
  profileId,
  onFreightAction,
  onCountsChange,
  onFetchAvailable,
}) => {
  return (
    <SafeListWrapper>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Fretes Disponíveis com IA</h3>

        <AdvancedFreightSearch
          onSearch={(filters) => {
            console.log("Advanced search filters:", filters);
            onFetchAvailable();
          }}
          userRole="MOTORISTA"
        />
      </div>

      <SmartFreightMatcher
        key={`freight-matcher-${profileId || "loading"}`}
        onFreightAction={onFreightAction}
        onCountsChange={(counts) => {
          // SmartFreightMatcher manda { total, highUrgency }
          // Aqui o DriverAvailableTab só quer { total }
          onCountsChange({ total: counts.total });
        }}
      />
    </SafeListWrapper>
  );
};
