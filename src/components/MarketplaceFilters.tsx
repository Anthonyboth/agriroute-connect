import React, { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Clock, ArrowUpDown } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// =============================================
// Types
// =============================================

export type ExpiryBucket = "ALL" | "NOW_6H" | "TODAY_24H" | "NEXT_72H" | "LATER";
export type SortOption = "EXPIRY_ASC" | "PRICE_DESC" | "RPM_DESC" | "DIST_ASC" | "NEWEST";

export interface MarketplaceFiltersState {
  selectedTypes: string[];
  expiryBucket: ExpiryBucket;
  sort: SortOption;
}

export interface MarketplaceFiltersProps {
  /** Estado atual dos filtros */
  filters: MarketplaceFiltersState;
  /** Callback ao alterar filtros */
  onChange: (filters: MarketplaceFiltersState) => void;
  /** Se deve mostrar filtro de R$/km (só faz sentido para fretes rurais) */
  showRpmSort?: boolean;
  /** Se deve mostrar filtro de distância */
  showDistSort?: boolean;
}

// =============================================
// Constants
// =============================================

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "EXPIRY_ASC", label: "Vencimento mais próximo" },
  { value: "PRICE_DESC", label: "Maior valor" },
  { value: "RPM_DESC", label: "Maior R$/km" },
  { value: "DIST_ASC", label: "Menor distância" },
  { value: "NEWEST", label: "Mais recente" },
];

// =============================================
// Helper: formatar expiração
// =============================================

export function formatExpiresAt(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  try {
    const date = new Date(expiresAt);
    if (isNaN(date.getTime())) return null;
    const now = new Date();
    if (date <= now) return "Expirado";
    return `Expira ${formatDistanceToNow(date, { locale: ptBR, addSuffix: true })}`;
  } catch {
    return null;
  }
}

export function getExpiryUrgencyClass(expiresAt: string | null | undefined): string {
  if (!expiresAt) return "";
  try {
    const date = new Date(expiresAt);
    const now = new Date();
    const hoursLeft = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (hoursLeft <= 0) return "text-destructive font-semibold";
    if (hoursLeft <= 6) return "text-orange-600 font-semibold";
    if (hoursLeft <= 24) return "text-yellow-600";
    return "text-muted-foreground";
  } catch {
    return "";
  }
}

// =============================================
// Component
// =============================================

export const MarketplaceFilters: React.FC<MarketplaceFiltersProps> = ({
  filters,
  onChange,
  showRpmSort = true,
  showDistSort = true,
}) => {
  const sortOptions = useMemo(() => {
    return SORT_OPTIONS.filter((opt) => {
      if (opt.value === "RPM_DESC" && !showRpmSort) return false;
      if (opt.value === "DIST_ASC" && !showDistSort) return false;
      return true;
    });
  }, [showRpmSort, showDistSort]);

  return (
    <div className="flex w-full md:w-auto items-center">
      <div className="w-full">
        <Select
          value={filters.sort}
          onValueChange={(v) => onChange({ ...filters, sort: v as SortOption })}
        >
          <SelectTrigger className="h-8 w-full md:w-[220px] lg:w-[240px] text-xs">
            <ArrowUpDown className="h-3 w-3 mr-1 flex-shrink-0" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sortOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};

// =============================================
// Badge helper for cards
// =============================================

export const ExpiryBadge: React.FC<{ expiresAt: string | null | undefined }> = ({ expiresAt }) => {
  const label = formatExpiresAt(expiresAt);
  const urgencyClass = getExpiryUrgencyClass(expiresAt);
  if (!label) return null;
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${urgencyClass}`}>
      <Clock className="h-3 w-3" />
      {label}
    </span>
  );
};

export const DEFAULT_FILTERS: MarketplaceFiltersState = {
  selectedTypes: [],
  expiryBucket: "ALL",
  sort: "EXPIRY_ASC",
};
