/**
 * src/components/security/SafePrice.tsx
 *
 * Componente OBRIGATÓRIO para exibição de preço em telas de frete/proposta.
 * Agora usa o contrato canônico getCanonicalFreightPrice para respeitar
 * pricing_type (PER_TON, PER_KM, FIXED) em vez de hardcodar "/carreta".
 */

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Truck } from 'lucide-react';
import { getCanonicalFreightPrice, getCanonicalPriceFromTotal, type FreightPriceDisplay } from '@/lib/freightPriceContract';

// =============================================================================
// TIPOS
// =============================================================================

type ViewerRole = 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'PRODUTOR' | 'TRANSPORTADORA' | 'ADMIN';

interface SafePriceProps {
  /** Preço total do frete (freights.price) */
  price: number | null | undefined;
  /** Dados do frete para contexto */
  freight: {
    required_trucks?: number | null;
    price?: number | null;
    pricing_type?: string | null;
    price_per_km?: number | null;
    price_per_ton?: number | null;
    weight?: number | null;
    distance_km?: number | null;
  };
  /** Contexto de uso */
  context: 'FREIGHT' | 'PROPOSAL' | 'COUNTER';
  /** Papel de quem está visualizando */
  viewerRole: ViewerRole | string;
  /** Preço acordado individual (freight_assignments.agreed_price) */
  agreedPrice?: number | null;
  /** Tamanho da fonte */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Mostrar label de unidade */
  showLabel?: boolean;
  /** Mostrar info secundária */
  showSecondary?: boolean;
  /** Classes adicionais */
  className?: string;
  /** Renderizar como Badge */
  asBadge?: boolean;
  /** Variante do Badge */
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

// Classes de tamanho
const SIZE_CLASSES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg font-bold',
  xl: 'text-xl font-bold',
} as const;

// =============================================================================
// COMPONENTE
// =============================================================================

export const SafePrice: React.FC<SafePriceProps> = ({
  price,
  freight,
  context,
  viewerRole,
  agreedPrice,
  size = 'md',
  showLabel = true,
  showSecondary = true,
  className = '',
  asBadge = false,
  badgeVariant = 'default',
}) => {
  const requiredTrucks = Math.max(freight.required_trucks || 1, 1);
  const isMultiTruck = requiredTrucks > 1;
  const sizeClass = SIZE_CLASSES[size];

  // Use canonical contract for display
  const display: FreightPriceDisplay = useMemo(() => {
    // For proposals/counters, the price passed might be a driver's total - derive from total
    if ((context === 'PROPOSAL' || context === 'COUNTER') && price != null) {
      return getCanonicalPriceFromTotal(price, {
        pricing_type: freight.pricing_type,
        weight: freight.weight,
        distance_km: freight.distance_km,
        required_trucks: freight.required_trucks,
      });
    }

    // For freight display, use the freight's own data
    return getCanonicalFreightPrice({
      pricing_type: freight.pricing_type,
      price_per_ton: freight.price_per_ton,
      price_per_km: freight.price_per_km,
      price: freight.price ?? price ?? 0,
      required_trucks: freight.required_trucks,
      weight: freight.weight,
      distance_km: freight.distance_km,
    });
  }, [price, freight, context]);

  const primaryContent = (
    <span className={`${sizeClass} text-primary ${className}`}>
      {display.primaryLabel}
    </span>
  );

  if (asBadge) {
    return (
      <Badge variant={badgeVariant} className={`${sizeClass} px-3 ${className}`}>
        {display.primaryLabel}
      </Badge>
    );
  }

  // Show secondary info (truck count, weight, distance)
  if (isMultiTruck && showSecondary) {
    return (
      <div className={`flex flex-col items-end ${className}`}>
        {primaryContent}
        <span className="text-[11px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <Truck className="h-3 w-3" />
          {requiredTrucks} carretas
          {display.secondaryLabel && ` · ${display.secondaryLabel}`}
        </span>
      </div>
    );
  }

  return primaryContent;
};
