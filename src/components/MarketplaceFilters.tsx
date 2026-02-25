import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Package,
  Truck,
  Wrench,
  Bike,
  PawPrint,
  Clock,
  ArrowUpDown,
} from "lucide-react";
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
  /** Tipos de serviço disponíveis no perfil do usuário */
  availableTypes: string[];
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

const TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  CARGA: { label: "Carga", icon: <Package className="h-3 w-3" />, color: "bg-primary/10 text-primary border-primary/20" },
  GUINCHO: { label: "Guincho", icon: <Wrench className="h-3 w-3" />, color: "bg-orange-100 text-orange-800 border-orange-200" },
  MUDANCA: { label: "Mudança", icon: <Truck className="h-3 w-3" />, color: "bg-blue-100 text-blue-800 border-blue-200" },
  FRETE_MOTO: { label: "Moto", icon: <Bike className="h-3 w-3" />, color: "bg-teal-100 text-teal-800 border-teal-200" },
  ENTREGA_PACOTES: { label: "Pacotes", icon: <Package className="h-3 w-3" />, color: "bg-amber-100 text-amber-800 border-amber-200" },
  TRANSPORTE_PET: { label: "Pet", icon: <PawPrint className="h-3 w-3" />, color: "bg-purple-100 text-purple-800 border-purple-200" },
};

const EXPIRY_OPTIONS: { value: ExpiryBucket; label: string; icon: string }[] = [
  { value: "ALL", label: "Todos", icon: "📋" },
  { value: "NOW_6H", label: "Vencendo agora", icon: "🔥" },
  { value: "TODAY_24H", label: "Hoje", icon: "⏰" },
  { value: "NEXT_72H", label: "Próximos dias", icon: "📅" },
  { value: "LATER", label: "Sem pressa", icon: "🕐" },
];

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
  availableTypes,
  filters,
  onChange,
  showRpmSort = true,
  showDistSort = true,
}) => {
  const toggleType = (type: string) => {
    const current = filters.selectedTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    onChange({ ...filters, selectedTypes: next });
  };

  const sortOptions = useMemo(() => {
    return SORT_OPTIONS.filter((opt) => {
      if (opt.value === "RPM_DESC" && !showRpmSort) return false;
      if (opt.value === "DIST_ASC" && !showDistSort) return false;
      return true;
    });
  }, [showRpmSort, showDistSort]);

  return (
    <div className="space-y-3">
      {/* Chips de tipo */}
      {availableTypes.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {availableTypes.map((type) => {
            const info = TYPE_LABELS[type] || { label: type, icon: <Package className="h-3 w-3" />, color: "bg-secondary text-secondary-foreground" };
            const isSelected = filters.selectedTypes.length === 0 || filters.selectedTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer
                  ${isSelected ? info.color : "bg-muted/40 text-muted-foreground border-muted opacity-60"}`}
              >
                {info.icon}
                {info.label}
              </button>
            );
          })}
          {filters.selectedTypes.length > 0 && (
            <button
              onClick={() => onChange({ ...filters, selectedTypes: [] })}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-muted/40 transition-all cursor-pointer"
            >
              ✕ Limpar
            </button>
          )}
        </div>
      )}

      {/* Prazo + Ordenação */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Chips de prazo */}
        <div className="flex flex-wrap gap-1.5">
          {EXPIRY_OPTIONS.map((opt) => {
            const isActive = filters.expiryBucket === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => onChange({ ...filters, expiryBucket: opt.value })}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer
                  ${isActive
                    ? "bg-primary/10 text-primary border-primary/30"
                    : "bg-muted/30 text-muted-foreground border-muted hover:bg-muted/50"
                  }`}
              >
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        {/* Ordenação */}
        <div className="ml-auto">
          <Select
            value={filters.sort}
            onValueChange={(v) => onChange({ ...filters, sort: v as SortOption })}
          >
            <SelectTrigger className="h-8 w-[200px] text-xs">
              <ArrowUpDown className="h-3 w-3 mr-1" />
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
