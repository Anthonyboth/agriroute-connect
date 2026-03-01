/**
 * src/lib/precoFechado.ts
 *
 * Helper para exibição de preço em contextos de PAGAMENTO.
 * Prioriza o preço FECHADO (acordo da tabela freight_price_agreements) se existir,
 * senão cai no preço preenchido (unitário) do frete.
 *
 * REGRA: total só aparece para o solicitante (REQUESTER_FULL).
 */

import { supabase } from '@/integrations/supabase/client';
import { precoPreenchidoDoFrete } from '@/lib/precoPreenchido';
import { resolveUiPriceMode, type UiPriceMode } from '@/lib/precoUI';

type PricingType = 'PER_VEHICLE' | 'PER_KM' | 'PER_TON';

export interface DealSnapshot {
  agreed_pricing_type?: PricingType | null;
  agreed_unit_rate?: number | null;
  agreed_total?: number | null;
}

export interface PrecoParaPagamentoResult {
  /** Label unitário: "R$ 80,00/ton", "R$ 12,00/km", etc. */
  primary: string;
  /** Total formatado — SOMENTE se o viewer for o solicitante */
  total: string | null;
  /** Whether an agreement was found in the DB */
  hasAgreement?: boolean;
}

// ─── Cache for fetched agreements ───────────────────────────

const agreementCache = new Map<string, DealSnapshot | null>();

export function limparCachePrecoFechado(freightId?: string): void {
  if (freightId) {
    agreementCache.delete(freightId);
  } else {
    agreementCache.clear();
  }
}

// ─── Fetch agreement from DB ────────────────────────────────

export async function fetchAgreement(freightId: string): Promise<DealSnapshot | null> {
  const cached = agreementCache.get(freightId);
  if (cached !== undefined) return cached;

  const { data, error } = await supabase
    .from('freight_price_agreements')
    .select('agreed_unit_rate, agreed_pricing_type, agreed_total')
    .eq('freight_id', freightId)
    .eq('status', 'ACTIVE')
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    agreementCache.set(freightId, null);
    return null;
  }

  const deal: DealSnapshot = {
    agreed_pricing_type: data.agreed_pricing_type as PricingType,
    agreed_unit_rate: Number(data.agreed_unit_rate),
    agreed_total: data.agreed_total ? Number(data.agreed_total) : null,
  };

  agreementCache.set(freightId, deal);
  return deal;
}

// ─── Sync helper (no DB fetch, for inline deal data) ────────

export function precoParaPagamentosUI(args: {
  viewerProfileId: string | null | undefined;
  viewerRole: string | null | undefined;
  freight: {
    id: string;
    producer_id?: string | null;
    price?: number | null;
    pricing_type?: string | null;
    price_per_km?: number | null;
    price_per_ton?: number | null;
    required_trucks?: number | null;
    weight?: number | null;
    distance_km?: number | null;
  };
  deal?: DealSnapshot | null;
}): PrecoParaPagamentoResult {
  const mode = resolveUiPriceMode(
    args.viewerProfileId,
    args.viewerRole,
    args.freight.producer_id,
  );

  // 1) Preço FECHADO tem prioridade (se existir)
  if (args.deal?.agreed_pricing_type && args.deal?.agreed_unit_rate) {
    const unit = formatUnit(args.deal.agreed_pricing_type, args.deal.agreed_unit_rate);
    return {
      primary: unit,
      total: mode === 'REQUESTER_FULL' ? formatBRL(args.deal.agreed_total) : null,
      hasAgreement: true,
    };
  }

  // 2) Senão, cai no preço preenchido (unitário) do frete
  const filled = precoPreenchidoDoFrete(args.freight.id, args.freight, { unitOnly: true });
  return {
    primary: filled.primaryText,
    total: null, // NUNCA mostrar total por padrão
    hasAgreement: false,
  };
}

// ─── Async version: fetches agreement from DB automatically ─

export async function precoFechadoParaUI(args: {
  viewerProfileId: string | null | undefined;
  viewerRole: string | null | undefined;
  freight: {
    id: string;
    producer_id?: string | null;
    price?: number | null;
    pricing_type?: string | null;
    price_per_km?: number | null;
    price_per_ton?: number | null;
    required_trucks?: number | null;
    weight?: number | null;
    distance_km?: number | null;
  };
}): Promise<PrecoParaPagamentoResult> {
  const deal = await fetchAgreement(args.freight.id);
  return precoParaPagamentosUI({ ...args, deal });
}

function formatBRL(value?: number | null): string | null {
  if (!value || value <= 0) return null;
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatUnit(type: PricingType, rate: number): string {
  const brl = `R$ ${rate.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (type === 'PER_VEHICLE') return `${brl}/veíc`;
  if (type === 'PER_KM') return `${brl}/km`;
  return `${brl}/ton`;
}
