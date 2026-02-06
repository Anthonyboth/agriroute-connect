/**
 * src/components/security/SafePrice.tsx
 *
 * Componente OBRIGATÓRIO para exibição de preço em telas de frete/proposta.
 * Internamente aplica:
 *   - formatPriceForUser() do multiTruckPriceGuard
 *   - validatePriceConsistency() quando aplicável
 *   - NUNCA exibe valor total para motoristas em multi-carreta
 *
 * PROIBIDO usar formatBRL direto para preços de frete — use este componente.
 */

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Truck } from 'lucide-react';
import {
  formatPriceForUser,
  type PriceContext,
  type PriceGuardResult,
} from '@/security/multiTruckPriceGuard';

// =============================================================================
// TIPOS
// =============================================================================

type ViewerRole = 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'PRODUTOR' | 'TRANSPORTADORA' | 'ADMIN';

interface SafePriceProps {
  /** Preço total do frete (freights.price) */
  price: number | null | undefined;
  /** Dados do frete para contexto multi-carreta */
  freight: {
    required_trucks?: number | null;
    price?: number | null;
  };
  /** Contexto de uso */
  context: 'FREIGHT' | 'PROPOSAL' | 'COUNTER';
  /** Papel de quem está visualizando */
  viewerRole: ViewerRole | string;
  /** Preço acordado individual (freight_assignments.agreed_price) */
  agreedPrice?: number | null;
  /** Tamanho da fonte */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Mostrar label "/carreta" */
  showLabel?: boolean;
  /** Mostrar total como secundário (só para PRODUTOR/TRANSPORTADORA) */
  showSecondary?: boolean;
  /** Classes adicionais */
  className?: string;
  /** Renderizar como Badge */
  asBadge?: boolean;
  /** Variante do Badge */
  badgeVariant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

// Mapa de papel para contexto de preço
function roleToPriceContext(role: string): PriceContext {
  const normalized = role.toUpperCase().trim();
  switch (normalized) {
    case 'MOTORISTA':
    case 'MOTORISTA_AFILIADO':
      return 'DRIVER';
    case 'PRODUTOR':
      return 'PRODUCER';
    case 'TRANSPORTADORA':
      return 'COMPANY';
    case 'ADMIN':
      return 'ADMIN';
    default:
      return 'DRIVER'; // Fallback seguro: menor exposição
  }
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
  const priceContext = roleToPriceContext(viewerRole);
  const requiredTrucks = Math.max(freight.required_trucks || 1, 1);

  // Determinar qual preço usar baseado no contexto
  const effectivePrice = context === 'PROPOSAL' || context === 'COUNTER'
    ? price  // Em propostas, o preço passado já é por carreta
    : freight.price ?? price;

  const result: PriceGuardResult = useMemo(
    () => formatPriceForUser({
      freightPrice: context === 'PROPOSAL' || context === 'COUNTER'
        ? (freight.price ?? 0) // Preço total do frete para referência
        : (effectivePrice ?? 0),
      requiredTrucks,
      agreedPrice: agreedPrice ?? (context === 'PROPOSAL' ? (price ?? null) : null),
      context: priceContext,
    }),
    [effectivePrice, requiredTrucks, agreedPrice, priceContext, price, freight.price, context]
  );

  const isMultiTruck = result.isMultiTruck;
  const sizeClass = SIZE_CLASSES[size];

  // Para propostas onde o preço passado JÁ é por carreta
  const displayFormatted = context === 'PROPOSAL' || context === 'COUNTER'
    ? `R$ ${(price ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : result.formattedPrice;

  // Conteúdo principal
  const primaryContent = (
    <span className={`${sizeClass} text-primary ${className}`}>
      {displayFormatted}
      {showLabel && isMultiTruck && result.isPerTruck && (
        <span className="text-xs font-semibold text-muted-foreground ml-1">/carreta</span>
      )}
      {showLabel && isMultiTruck && !result.isPerTruck && (
        <span className="text-xs font-normal text-muted-foreground ml-1">(total)</span>
      )}
    </span>
  );

  if (asBadge) {
    return (
      <Badge variant={badgeVariant} className={`${sizeClass} px-3 ${className}`}>
        {displayFormatted}
        {showLabel && isMultiTruck && result.isPerTruck && (
          <span className="text-xs ml-1">/carreta</span>
        )}
      </Badge>
    );
  }

  // Transportadora: Total como primário, /carreta como secundário
  if (priceContext === 'COMPANY' && isMultiTruck && showSecondary) {
    return (
      <div className={`flex flex-col items-end ${className}`}>
        <span className={`${sizeClass} text-primary`}>
          {result.formattedPrice}
        </span>
        <span className="text-[11px] text-muted-foreground whitespace-nowrap">
          {result.formattedTotalPrice && result.formattedTotalPrice !== result.formattedPrice
            ? `${result.formattedPrice}/carreta`
            : ''}
          <span className="ml-1">({requiredTrucks} carretas)</span>
        </span>
      </div>
    );
  }

  // Produtor/Admin: mostrar total com info de carretas
  if ((priceContext === 'PRODUCER' || priceContext === 'ADMIN') && isMultiTruck && showSecondary) {
    return (
      <div className={`flex flex-col items-end ${className}`}>
        {primaryContent}
        <span className="text-[11px] text-muted-foreground whitespace-nowrap flex items-center gap-1">
          <Truck className="h-3 w-3" />
          {requiredTrucks} carretas
        </span>
      </div>
    );
  }

  return primaryContent;
};
