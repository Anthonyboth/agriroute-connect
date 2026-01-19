import React, { useCallback } from "react";
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
  // Evita spam de fetch e garante execução estável
  const handleSearch = useCallback(
    (_filters: any) => {
      // ⚠️ Importante: a busca avançada provavelmente ainda não está integrada ao matcher,
      // então por enquanto apenas forçamos atualização.
      onFetchAvailable();
    },
    [onFetchAvailable],
  );

  // Só renderiza o matcher quando tiver profileId válido (evita edge calls com id vazio)
  if (!profileId) {
    return (
      <SafeListWrapper>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Fretes Disponíveis com IA</h3>
          <AdvancedFreightSearch onSearch={handleSearch} userRole="MOTORISTA" />
        </div>

        <div className="p-6 rounded-lg border border-dashed text-center text-muted-foreground">
          Carregando perfil do motorista...
        </div>
      </SafeListWrapper>
    );
  }

  return (
    <SafeListWrapper>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Fretes Disponíveis com IA</h3>
        <AdvancedFreightSearch onSearch={handleSearch} userRole="MOTORISTA" />
      </div>

      <SmartFreightMatcher
        key={`freight-matcher-${profileId}`}
        driverProfileId={profileId}
        onFreightAction={onFreightAction}
        onCountsChange={onCountsChange}
      />
    </SafeListWrapper>
  );
};
