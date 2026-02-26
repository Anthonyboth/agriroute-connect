/**
 * useReportsDataGuarantee.ts
 *
 * Fallback mechanism: when the official RPC returns empty data but the user
 * has records in freight_history / freight_assignment_history / service_request_history,
 * this hook queries those tables directly and builds KPIs, charts, and tables locally.
 *
 * Tables used per panel:
 *   MOTORISTA       → freight_assignment_history (driver_id)
 *   PRODUTOR        → freight_history (producer_id)
 *   TRANSPORTADORA  → freight_assignment_history (company_id)
 *   PRESTADOR       → service_request_history (provider_id)
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, isValid } from 'date-fns';
import { devLog } from '@/lib/devLogger';
import type { PanelType } from './useReportsDashboard';

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReportsGuaranteed {
  kpis: Record<string, any>;
  charts: Record<string, any[]>;
  tables: Record<string, any[]>;
  usedFallback: boolean;
  fallbackReason?: string;
  refreshFallback: () => Promise<void>;
}

interface UseReportsDataGuaranteeArgs {
  panel: PanelType;
  profileId?: string;
  companyId?: string;
  dateRange: { from: Date; to: Date };
  official: {
    kpis: Record<string, any>;
    charts: Record<string, any[]>;
    tables: Record<string, any[]>;
    isLoading: boolean;
    isError: boolean;
  };
}

// ── Suspicious-empty detector ────────────────────────────────────────────────

function isSuspiciousEmpty(d: {
  kpis: any; charts: any; tables: any; isLoading: boolean;
}): boolean {
  if (d.isLoading) return false;

  const receita = Number(d.kpis?.receita_total || 0);
  const count = Number(
    d.kpis?.viagens_concluidas || d.kpis?.fretes_concluidos ||
    d.kpis?.servicos_concluidos || d.kpis?.total_fretes || 0,
  );

  const chartsEmpty =
    !d.charts || Object.values(d.charts).every(
      (v: any) => !v || (Array.isArray(v) && v.length === 0),
    );

  const tablesEmpty =
    !d.tables || Object.values(d.tables).every(
      (v: any) => !v || (Array.isArray(v) && v.length === 0),
    );

  return receita === 0 && count === 0 && chartsEmpty && tablesEmpty;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const titleCase = (s: string) =>
  s ? s.split(/[\s/]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '';

const fmtRoute = (o: string | null, os: string | null, d: string | null, ds: string | null) => {
  const origin = o ? `${titleCase(o)}/${(os || '').toUpperCase()}` : '';
  const dest = d ? `${titleCase(d)}/${(ds || '').toUpperCase()}` : '';
  return origin && dest ? `${origin} → ${dest}` : origin || dest || 'Sem rota';
};

const safeDate = (raw: any): Date | null => {
  if (!raw) return null;
  const d = new Date(raw);
  return isValid(d) ? d : null;
};

const monthKey = (d: Date) => format(d, 'yyyy-MM');

// ── Per-panel queries ────────────────────────────────────────────────────────

async function fetchDriverFallback(profileId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('freight_assignment_history')
    .select('*')
    .eq('driver_id', profileId)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

async function fetchProducerFallback(profileId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('freight_history')
    .select('*')
    .eq('producer_id', profileId)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

async function fetchCarrierFallback(companyId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('freight_assignment_history')
    .select('*')
    .eq('company_id', companyId)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

async function fetchProviderFallback(profileId: string, from: string, to: string) {
  const { data, error } = await supabase
    .from('service_request_history')
    .select('*')
    .eq('provider_id', profileId)
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  return data || [];
}

// ── Aggregators ──────────────────────────────────────────────────────────────

function aggregateFreightRows(rows: any[], priceField = 'agreed_price') {
  const isDone = (s: string) => ['DELIVERED', 'COMPLETED'].includes(String(s || '').toUpperCase());

  let completed = 0, cancelled = 0, revenue = 0, totalKm = 0;
  const monthMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const routeMap = new Map<string, { viagens: number; receita: number; km: number }>();

  for (const r of rows) {
    const status = String(r.status_final || '').toUpperCase();
    statusMap.set(status, (statusMap.get(status) || 0) + 1);

    const dt = safeDate(r.completed_at || r.created_at);
    const price = Number(r[priceField] || r.price_total || 0);
    const km = Number(r.distance_km || 0);

    if (isDone(status)) {
      completed++;
      revenue += price;
      totalKm += km;
      if (dt) {
        const mk = monthKey(dt);
        monthMap.set(mk, (monthMap.get(mk) || 0) + price);
      }
      const route = fmtRoute(r.origin_city, r.origin_state, r.destination_city, r.destination_state);
      const prev = routeMap.get(route) || { viagens: 0, receita: 0, km: 0 };
      routeMap.set(route, { viagens: prev.viagens + 1, receita: prev.receita + price, km: prev.km + km });
    } else if (status === 'CANCELLED') {
      cancelled++;
    }
  }

  const total = rows.length;
  const avgPrice = completed > 0 ? revenue / completed : 0;
  const avgKm = completed > 0 ? totalKm / completed : 0;
  const rpm = totalKm > 0 ? revenue / totalKm : 0;

  const kpis: Record<string, any> = {
    receita_total: revenue,
    viagens_concluidas: completed,
    fretes_concluidos: completed,
    total_fretes: total,
    fretes_cancelados: cancelled,
    ticket_medio: avgPrice,
    km_total: totalKm,
    km_medio: avgKm,
    rpm_medio: rpm,
    taxa_conclusao: total > 0 ? (completed / total) * 100 : 0,
  };

  const receita_por_mes = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, receita]) => ({ mes, receita }));

  const por_status = Array.from(statusMap.entries()).map(([name, value]) => ({ name, value }));

  const top_rotas = Array.from(routeMap.entries())
    .sort(([, a], [, b]) => b.receita - a.receita)
    .slice(0, 10)
    .map(([rota, v]) => ({ rota, ...v, km_medio: v.viagens > 0 ? v.km / v.viagens : 0 }));

  const extrato = rows.map(r => {
    const dt = safeDate(r.completed_at || r.created_at);
    return {
      __date: dt ? format(dt, 'dd/MM/yyyy') : '',
      __dateISO: dt?.toISOString() || '',
      __route: fmtRoute(r.origin_city, r.origin_state, r.destination_city, r.destination_state),
      __cargo: r.cargo_type || 'N/A',
      __status: String(r.status_final || '').toUpperCase(),
      __km: Number(r.distance_km || 0),
      __receita: Number(r[priceField] || r.price_total || 0),
      __weight: Number(r.weight_per_truck || r.weight || 0),
    };
  });

  return {
    kpis,
    charts: {
      receita_por_mes,
      por_status,
      top_rotas,
      viagens_por_mes: receita_por_mes.map(m => ({ mes: m.mes, viagens: 0 })), // placeholder
    },
    tables: { extrato_fretes: extrato },
  };
}

function aggregateServiceRows(rows: any[]) {
  const isDone = (s: string) => ['COMPLETED', 'DONE'].includes(String(s || '').toUpperCase());

  let completed = 0, cancelled = 0, revenue = 0;
  const monthMap = new Map<string, number>();
  const typeMap = new Map<string, { count: number; revenue: number }>();
  const cityMap = new Map<string, number>();

  for (const r of rows) {
    const status = String(r.status_final || '').toUpperCase();
    const price = Number(r.final_price || r.estimated_price || 0);
    const dt = safeDate(r.completed_at || r.created_at);
    const sType = r.service_type || 'OUTROS';

    if (isDone(status)) {
      completed++;
      revenue += price;
      if (dt) monthMap.set(monthKey(dt), (monthMap.get(monthKey(dt)) || 0) + price);
      const prev = typeMap.get(sType) || { count: 0, revenue: 0 };
      typeMap.set(sType, { count: prev.count + 1, revenue: prev.revenue + price });
      if (r.city) cityMap.set(r.city, (cityMap.get(r.city) || 0) + 1);
    } else if (status === 'CANCELLED') {
      cancelled++;
    }
  }

  const total = rows.length;

  const kpis: Record<string, any> = {
    receita_total: revenue,
    servicos_concluidos: completed,
    total_servicos: total,
    servicos_cancelados: cancelled,
    ticket_medio: completed > 0 ? revenue / completed : 0,
    taxa_conclusao: total > 0 ? (completed / total) * 100 : 0,
  };

  const receita_por_mes = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, receita]) => ({ mes, receita }));

  const por_tipo = Array.from(typeMap.entries())
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .map(([name, v]) => ({ name, value: v.count, receita: v.revenue }));

  const top_cidades = Array.from(cityMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([city, count]) => ({ city: titleCase(city), count }));

  const extrato = rows.map(r => {
    const dt = safeDate(r.completed_at || r.created_at);
    return {
      __date: dt ? format(dt, 'dd/MM/yyyy') : '',
      __dateISO: dt?.toISOString() || '',
      __serviceType: r.service_type || 'N/A',
      __status: String(r.status_final || '').toUpperCase(),
      __city: r.city ? `${titleCase(r.city)}/${(r.state || '').toUpperCase()}` : 'N/A',
      __value: Number(r.final_price || r.estimated_price || 0),
    };
  });

  return {
    kpis,
    charts: { receita_por_mes, por_tipo, top_cidades },
    tables: { extrato_servicos: extrato },
  };
}

// ── Merge strategy ───────────────────────────────────────────────────────────

function mergeData(
  official: { kpis: any; charts: any; tables: any },
  fallback: { kpis: any; charts: any; tables: any },
): { kpis: any; charts: any; tables: any } {
  // KPIs: prefer official if non-zero, else fallback
  const kpis = { ...fallback.kpis };
  for (const [k, v] of Object.entries(official.kpis || {})) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) kpis[k] = v;
  }

  // Charts: prefer official arrays if non-empty, else fallback
  const charts = { ...fallback.charts };
  for (const [k, v] of Object.entries(official.charts || {})) {
    if (Array.isArray(v) && v.length > 0) charts[k] = v;
  }

  // Tables: same
  const tables = { ...fallback.tables };
  for (const [k, v] of Object.entries(official.tables || {})) {
    if (Array.isArray(v) && v.length > 0) tables[k] = v;
  }

  return { kpis, charts, tables };
}

// ── Main hook ────────────────────────────────────────────────────────────────

export function useReportsDataGuarantee({
  panel, profileId, companyId, dateRange, official,
}: UseReportsDataGuaranteeArgs): ReportsGuaranteed {
  const fromISO = dateRange.from.toISOString();
  const toISO = dateRange.to.toISOString();

  const suspiciousEmpty = !official.isLoading && (official.isError || isSuspiciousEmpty(official));

  // Determine the lookup id — for TRANSPORTADORA use companyId, else profileId
  const lookupId = panel === 'TRANSPORTADORA' ? (companyId || profileId) : profileId;

  const fallbackQuery = useQuery({
    queryKey: ['reports-fallback', panel, lookupId, fromISO, toISO],
    queryFn: async () => {
      if (!lookupId) return null;
      const t0 = performance.now();

      let rows: any[];
      switch (panel) {
        case 'MOTORISTA':
          rows = await fetchDriverFallback(lookupId, fromISO, toISO);
          break;
        case 'PRODUTOR':
          rows = await fetchProducerFallback(lookupId, fromISO, toISO);
          break;
        case 'TRANSPORTADORA':
          rows = await fetchCarrierFallback(lookupId, fromISO, toISO);
          break;
        case 'PRESTADOR':
          rows = await fetchProviderFallback(lookupId, fromISO, toISO);
          break;
        default:
          rows = [];
      }

      const elapsed = Math.round(performance.now() - t0);
      devLog(`[ReportsGuarantee] ${panel} fallback: ${rows.length} rows in ${elapsed}ms`);

      if (rows.length === 0) return null;

      if (panel === 'PRESTADOR') {
        return aggregateServiceRows(rows);
      }
      return aggregateFreightRows(rows, panel === 'MOTORISTA' ? 'agreed_price' : 'price_total');
    },
    enabled: !!lookupId && suspiciousEmpty,
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    retry: 1,
  });

  const result = useMemo<ReportsGuaranteed>(() => {
    // No profileId → pass through official
    if (!lookupId) {
      return {
        kpis: official.kpis,
        charts: official.charts,
        tables: official.tables,
        usedFallback: false,
        refreshFallback: async () => {},
      };
    }

    // Official has data → use it directly
    if (!suspiciousEmpty || !fallbackQuery.data) {
      return {
        kpis: official.kpis,
        charts: official.charts,
        tables: official.tables,
        usedFallback: false,
        refreshFallback: async () => { await fallbackQuery.refetch(); },
      };
    }

    // Merge fallback into official
    const reason = official.isError ? 'official_error' : 'official_empty';
    devLog(`[ReportsGuarantee] Using fallback for ${panel}: ${reason}`);

    const merged = mergeData(official, fallbackQuery.data);

    return {
      ...merged,
      usedFallback: true,
      fallbackReason: reason,
      refreshFallback: async () => { await fallbackQuery.refetch(); },
    };
  }, [
    lookupId, suspiciousEmpty, official.kpis, official.charts, official.tables,
    official.isError, fallbackQuery.data, panel,
  ]);

  return result;
}
