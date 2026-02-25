import React, { useCallback } from "react";
import { SmartFreightMatcher } from "@/components/SmartFreightMatcher";
import { AdvancedFreightSearch } from "@/components/AdvancedFreightSearch";
import { SafeListWrapper } from "@/components/SafeListWrapper";

interface DriverAvailableTabProps {
  profileId: string | undefined;
  onFreightAction: (freightId: string, action: "propose" | "accept" | "complete" | "cancel") => void;
  onFetchAvailable: () => void;
}

export const DriverAvailableTab: React.FC<DriverAvailableTabProps> = ({
  profileId,
  onFreightAction,
  onFetchAvailable,
}) => {
  const handleAdvancedSearch = useCallback(() => {
    onFetchAvailable();
  }, [onFetchAvailable]);

  return (
    <SafeListWrapper>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Fretes Disponíveis com IA</h3>

        <AdvancedFreightSearch
          onSearch={handleAdvancedSearch}
          userRole="MOTORISTA"
        />
      </div>

      <SmartFreightMatcher
        key={`freight-matcher-${profileId || "loading"}`}
        onFreightAction={onFreightAction}
      />
    </SafeListWrapper>
  );
};
