/**
 * src/hooks/useFreightPriceUI.ts
 *
 * HOOK UNIVERSAL para exibir preço de frete na UI.
 * Aplica a REGRA DE GATING: fora do painel do solicitante,
 * secondaryText é SEMPRE null (só unitário).
 *
 * Uso:
 *   const price = useFreightPriceUI({ freight, viewerProfileId, viewerRole });
 *   return <span>{price.primaryText}</span>;
 *   // price.secondaryText é null para motorista/transportadora
 */

import { useMemo } from 'react';
import {
  precoPreenchidoDoFrete,
  type PrecoPreenchido,
  type PrecoPreenchidoInput,
} from '@/lib/precoPreenchido';
import { resolveUiPriceMode, type UiPriceMode } from '@/lib/precoUI';

export interface FreightPriceUIInput {
  /** Freight data (must include id + pricing fields) */
  freight: (PrecoPreenchidoInput & { id: string; producer_id?: string | null }) | null | undefined;
  /** Current viewer's profile.id */
  viewerProfileId?: string | null;
  /** Current viewer's role (PRODUTOR, MOTORISTA, TRANSPORTADORA, etc.) */
  viewerRole?: string | null;
}

export interface FreightPriceUIResult extends PrecoPreenchido {
  /** The resolved mode for this viewer */
  mode: UiPriceMode;
}

/**
 * Returns freight price display data with viewer-based gating.
 * Non-requesters get secondaryText = null (no totals, no metadata).
 */
export function useFreightPriceUI({
  freight,
  viewerProfileId,
  viewerRole,
}: FreightPriceUIInput): FreightPriceUIResult | null {
  return useMemo(() => {
    if (!freight?.id) return null;

    const mode = resolveUiPriceMode(
      viewerProfileId,
      viewerRole,
      freight.producer_id,
    );

    const preco = precoPreenchidoDoFrete(freight.id, freight, {
      unitOnly: mode === 'UNIT_ONLY',
    });

    return { ...preco, mode };
  }, [
    freight?.id,
    freight?.price,
    freight?.pricing_type,
    freight?.price_per_km,
    freight?.price_per_ton,
    freight?.required_trucks,
    freight?.weight,
    freight?.distance_km,
    freight?.producer_id,
    viewerProfileId,
    viewerRole,
  ]);
}
