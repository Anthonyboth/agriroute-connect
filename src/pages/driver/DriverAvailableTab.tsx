import React, { useCallback, useState, useEffect } from "react";
import { SmartFreightMatcher } from "@/components/SmartFreightMatcher";
import { AdvancedFreightSearch } from "@/components/AdvancedFreightSearch";
import { SafeListWrapper } from "@/components/SafeListWrapper";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DriverAvailableTabProps {
  profileId: string | undefined;
  onFreightAction: (freightId: string, action: "propose" | "accept" | "complete" | "cancel") => void;
  onFetchAvailable: () => void;
  onCountsChange?: (counts: { total: number; highUrgency: number }) => void;
}

export const DriverAvailableTab: React.FC<DriverAvailableTabProps> = ({
  profileId,
  onFreightAction,
  onFetchAvailable,
  onCountsChange,
}) => {
  const [advancedFilters, setAdvancedFilters] = useState<any | null>(null);

  const handleAdvancedSearch = useCallback((filters: any) => {
    // Verifica se há filtros reais ativos
    const hasActiveFilters = 
      filters.origin_city || filters.destination_city || filters.route_corridor ||
      filters.cargo_categories?.length > 0 || filters.vehicle_types?.length > 0 ||
      filters.urgent_only || filters.scheduled_only || filters.live_cargo ||
      filters.refrigerated || filters.hazardous_cargo ||
      (filters.min_price > 0) || (filters.max_price < 50000) ||
      (filters.min_weight > 0) || (filters.max_weight < 100);

    setAdvancedFilters(hasActiveFilters ? filters : null);
    onFetchAvailable();
  }, [onFetchAvailable]);

  const clearAdvancedFilters = useCallback(() => {
    setAdvancedFilters(null);
  }, []);

  // ✅ SESSÃO: limpa filtros ao desmontar (sair da tela/app)
  useEffect(() => {
    return () => {
      setAdvancedFilters(null);
    };
  }, []);

  return (
    <SafeListWrapper>
      <div className="flex flex-col items-center gap-2 mb-4">
        <AdvancedFreightSearch
          onSearch={handleAdvancedSearch}
          userRole="MOTORISTA"
        />
        {advancedFilters && (
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
              Busca ativa
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAdvancedFilters}
              className="h-6 w-6 p-0"
              title="Limpar busca avançada"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      <SmartFreightMatcher
        key={`freight-matcher-${profileId || "loading"}`}
        onFreightAction={onFreightAction}
        onCountsChange={onCountsChange}
        advancedFilters={advancedFilters}
      />
    </SafeListWrapper>
  );
};
