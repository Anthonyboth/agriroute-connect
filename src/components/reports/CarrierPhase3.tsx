/**
 * CarrierPhase3.tsx — Enterprise features for Transportadora Control Tower
 * Saved Views, Benchmarking, Smart Alerts, Insights, Advanced Scorecard, Quadrant, Governance
 * ⚠️ No backend/hook/schema changes — all derived locally.
 */
import React, { useMemo, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Save, BookOpen, Trash2, Edit2, Lightbulb, Target, Shield,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  AlertTriangle, Zap, Users, DollarSign, MapPin, Truck,
  Building2, Layers, Briefcase, ChevronDown, X, Eye,
  BarChart3, Route, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BI } from './reports-enterprise-theme';
import { formatBRL, type ChartConfig, type Drilldown } from '@/components/reports';
import { ReportCharts } from '@/components/reports';
import {
  type CarrierSavedView,
  DEFAULT_VIEW_SUGGESTIONS,
  useCarrierSavedViews,
} from '@/hooks/useCarrierSavedViews';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════
type CarrierSlicers = {
  status: string[];
  driverQuery: string;
  routeQuery: string;
  minKm?: number;
  maxKm?: number;
  minRevenue?: number;
  maxRevenue?: number;
};

type ScorecardRow = {
  driver: string;
  trips: number;
  revenue: number;
  km: number;
  rs_km: number;
  cancel: number;
};

type ScorecardSortKey = 'revenue' | 'rs_km' | 'trips' | 'cancel_rate';

interface CarrierPhase3Props {
  carrierRows: any[];
  filteredCarrierRows: any[];
  carrierSlicers: CarrierSlicers;
  setCarrierSlicers: React.Dispatch<React.SetStateAction<CarrierSlicers>>;
  carrierScorecard: ScorecardRow[];
  kpis: any;
  dateRange: { from: Date; to: Date };
  setDateRange: (r: { from: Date; to: Date }) => void;
  isLoading: boolean;
  carrierScorecardSort: ScorecardSortKey;
  setCarrierScorecardSort: React.Dispatch<React.SetStateAction<ScorecardSortKey>>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════════
const fmtNum = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

function pctDelta(cur: number, prev: number): number | null {
  if (prev <= 0) return null;
  return ((cur - prev) / prev) * 100;
}

function previousRange(from: Date, to: Date) {
  const diff = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - diff);
  return { from: prevFrom, to: prevTo };
}

function rowsInRange(rows: any[], range: { from: Date; to: Date }) {
  return rows.filter(r => r.__date && r.__date >= range.from && r.__date <= range.to);
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. SAVED VIEWS BAR
// ═══════════════════════════════════════════════════════════════════════════════
export const CarrierSavedViewsBar: React.FC<{
  carrierSlicers: CarrierSlicers;
  setCarrierSlicers: React.Dispatch<React.SetStateAction<CarrierSlicers>>;
  dateRange: { from: Date; to: Date };
  setDateRange: (r: { from: Date; to: Date }) => void;
  carrierScorecardSort: ScorecardSortKey;
  setCarrierScorecardSort: React.Dispatch<React.SetStateAction<ScorecardSortKey>>;
}> = ({ carrierSlicers, setCarrierSlicers, dateRange, setDateRange, carrierScorecardSort, setCarrierScorecardSort }) => {
  const { views, saveView, deleteView, renameView } = useCarrierSavedViews();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const applyView = useCallback((view: CarrierSavedView | Omit<CarrierSavedView, 'id' | 'createdAt'>) => {
    setCarrierSlicers(view.slicers as CarrierSlicers);
    setDateRange({
      from: new Date(view.dateRange.from),
      to: new Date(view.dateRange.to),
    });
    if (view.sort) {
      setCarrierScorecardSort(view.sort.key);
    }
    setShowDropdown(false);
  }, [setCarrierSlicers, setDateRange, setCarrierScorecardSort]);

  const handleSave = () => {
    if (!saveName.trim()) return;
    saveView({
      name: saveName.trim(),
      dateRange: { from: dateRange.from.toISOString(), to: dateRange.to.toISOString() },
      slicers: carrierSlicers,
      sort: { key: carrierScorecardSort, dir: 'desc' },
    });
    setSaveName('');
    setShowSaveModal(false);
  };

  const allViews = [...DEFAULT_VIEW_SUGGESTIONS.map((v, i) => ({ ...v, id: `default-${i}`, createdAt: '', _isDefault: true })), ...views.map(v => ({ ...v, _isDefault: false }))];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Views dropdown */}
      <div className="relative">
        <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => setShowDropdown(!showDropdown)}>
          <BookOpen className="h-3 w-3" /> Visões <ChevronDown className="h-3 w-3" />
        </Button>
        {showDropdown && (
          <div className="absolute top-8 left-0 z-50 w-56 bg-popover border border-border rounded-xl shadow-lg p-1.5 space-y-0.5">
            <p className={cn(BI.label, 'px-2 py-1')}>Visões salvas</p>
            {allViews.map((v) => (
              <button key={v.id} type="button" onClick={() => applyView(v)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/40 transition flex items-center justify-between gap-2">
                <span className="truncate font-medium">{v.name}</span>
                {v._isDefault && <span className="text-[9px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-full">sugestão</span>}
              </button>
            ))}
            {allViews.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2">Nenhuma visão salva</p>}
            <div className="border-t border-border/40 pt-1 mt-1">
              <button type="button" onClick={() => { setShowManageModal(true); setShowDropdown(false); }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-muted/40 transition text-muted-foreground">
                Gerenciar visões…
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Save button */}
      <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5" onClick={() => setShowSaveModal(true)}>
        <Save className="h-3 w-3" /> Salvar visão
      </Button>

      {/* Save modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowSaveModal(false)}>
          <div className="bg-card border rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-sm">Salvar visão atual</h3>
            <Input placeholder="Nome da visão (ex: Análise semanal)" value={saveName} onChange={e => setSaveName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()} className="text-sm" autoFocus />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setShowSaveModal(false)}>Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={!saveName.trim()}>Salvar</Button>
            </div>
          </div>
        </div>
      )}

      {/* Manage modal */}
      {showManageModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowManageModal(false)}>
          <div className="bg-card border rounded-2xl p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm">Gerenciar visões</h3>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowManageModal(false)}><X className="h-4 w-4" /></Button>
            </div>
            {views.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma visão personalizada salva.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {views.map(v => (
                  <div key={v.id} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-muted/10 border border-border/40">
                    {editId === v.id ? (
                      <Input className="h-7 text-xs flex-1" value={editName} onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { renameView(v.id, editName); setEditId(null); } }}
                        autoFocus />
                    ) : (
                      <span className="text-xs font-medium truncate">{v.name}</span>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {editId === v.id ? (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { renameView(v.id, editName); setEditId(null); }}>
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setEditId(v.id); setEditName(v.name); }}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteView(v.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 6. GOVERNANCE PLACEHOLDERS
// ═══════════════════════════════════════════════════════════════════════════════
export const CarrierGovernanceBar: React.FC = () => (
  <TooltipProvider>
    <div className="flex items-center gap-2">
      {[
        { icon: Building2, label: 'Unidade' },
        { icon: Truck, label: 'Frota' },
        { icon: Briefcase, label: 'Centro de custo' },
      ].map(({ icon: Icon, label }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 opacity-50 cursor-not-allowed" disabled>
              <Icon className="h-3 w-3" /> {label}
            </Button>
          </TooltipTrigger>
          <TooltipContent><p className="text-xs">Em breve — escopo por {label.toLowerCase()}</p></TooltipContent>
        </Tooltip>
      ))}
    </div>
  </TooltipProvider>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 2. BENCHMARK DELTAS
// ═══════════════════════════════════════════════════════════════════════════════
interface BenchmarkResult {
  current: { revenue: number; trips: number; rs_km: number; revPerDriver: number };
  previous: { revenue: number; trips: number; rs_km: number; revPerDriver: number };
  deltas: { revenue: number | null; trips: number | null; rs_km: number | null; revPerDriver: number | null };
  hasPrev: boolean;
}

export function useCarrierBenchmark(carrierRows: any[], dateRange: { from: Date; to: Date }): BenchmarkResult {
  return useMemo(() => {
    const prevRange = previousRange(dateRange.from, dateRange.to);
    const currentRows = rowsInRange(carrierRows, dateRange);
    const prevRows = rowsInRange(carrierRows, prevRange);

    const agg = (rows: any[]) => {
      let revenue = 0, km = 0, trips = 0;
      const drivers = new Set<string>();
      for (const r of rows) {
        revenue += r.__revenue || 0;
        km += r.__km || 0;
        trips += 1;
        if (r.__driver) drivers.add(r.__driver);
      }
      const driverCount = drivers.size || 1;
      return {
        revenue, trips,
        rs_km: km > 0 ? revenue / km : 0,
        revPerDriver: revenue / driverCount,
      };
    };

    const current = agg(currentRows);
    const previous = agg(prevRows);
    const hasPrev = prevRows.length > 0;

    return {
      current, previous, hasPrev,
      deltas: {
        revenue: pctDelta(current.revenue, previous.revenue),
        trips: pctDelta(current.trips, previous.trips),
        rs_km: pctDelta(current.rs_km, previous.rs_km),
        revPerDriver: pctDelta(current.revPerDriver, previous.revPerDriver),
      },
    };
  }, [carrierRows, dateRange]);
}

const DeltaBadge: React.FC<{ delta: number | null; lowBase?: boolean }> = ({ delta, lowBase }) => {
  if (delta === null) return <span className="text-[9px] text-muted-foreground ml-1">—</span>;
  if (lowBase) return <span className="text-[9px] text-muted-foreground ml-1">base baixa</span>;
  const isPositive = delta > 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn('inline-flex items-center gap-0.5 text-[10px] font-bold ml-1.5',
      isPositive ? BI.good : delta < -5 ? BI.bad : 'text-muted-foreground')}>
      <Icon className="h-3 w-3" />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SMART ALERTS (Enterprise)
// ═══════════════════════════════════════════════════════════════════════════════
type AlertCard = {
  icon: string;
  label: string;
  value: string;
  hint?: string;
  tone: 'good' | 'neutral' | 'bad';
  onClick?: () => void;
};

export const CarrierSmartAlerts: React.FC<{
  kpis: any;
  carrierScorecard: ScorecardRow[];
  benchmark: BenchmarkResult;
  filteredCarrierRows: any[];
  setCarrierSlicers: React.Dispatch<React.SetStateAction<CarrierSlicers>>;
}> = ({ kpis, carrierScorecard, benchmark, filteredCarrierRows, setCarrierSlicers }) => {
  const alerts = useMemo(() => {
    const items: AlertCard[] = [];
    const totalFretes = Number(kpis.total_fretes) || 0;
    const cancelados = Number(kpis.cancelados || 0);
    const taxaCancel = Number(kpis.taxa_cancelamento) || (totalFretes > 0 ? (cancelados / totalFretes) * 100 : 0);
    const fretesAbertos = Number(kpis.fretes_abertos) || 0;
    const emTransito = Number(kpis.em_transito || kpis.in_transit) || 0;
    const sla = Number(kpis.sla_medio_horas) || 0;
    const utilizacao = Number(kpis.utilizacao_frota) || 0;

    // 1) Cancelamento alto
    items.push({
      icon: '🔴', label: 'Cancelamento',
      value: `${taxaCancel.toFixed(1)}%`,
      tone: taxaCancel >= 10 ? 'bad' : taxaCancel > 0 ? 'neutral' : 'good',
      hint: taxaCancel >= 10 ? 'Taxa acima de 10%' : undefined,
      onClick: taxaCancel > 0 ? () => setCarrierSlicers(s => ({ ...s, status: ['CANCELLED'] })) : undefined,
    });

    // 2) Receita caindo (benchmark)
    if (benchmark.hasPrev && benchmark.deltas.revenue !== null && benchmark.deltas.revenue <= -10) {
      items.push({
        icon: '📉', label: 'Receita caindo',
        value: `${benchmark.deltas.revenue.toFixed(1)}%`,
        tone: 'bad',
        hint: `Período anterior: ${formatBRL(benchmark.previous.revenue)}`,
      });
    }

    // 3) R$/km anômalo (p90/p10)
    const rsKmVals = filteredCarrierRows
      .filter(r => r.__km > 0 && r.__revenue > 0)
      .map(r => r.__revenue / r.__km)
      .sort((a, b) => a - b);
    if (rsKmVals.length >= 10) {
      const p10 = quantile(rsKmVals, 0.1);
      const p90 = quantile(rsKmVals, 0.9);
      if (p90 > p10 * 3) {
        items.push({
          icon: '📊', label: 'R$/km disperso',
          value: `P10: ${fmtNum(p10, 2)} · P90: ${fmtNum(p90, 2)}`,
          tone: 'bad',
          hint: 'Alta variação na eficiência',
        });
      }
    }

    // 4) Motorista risco (piores por cancel)
    const worstDrivers = [...carrierScorecard].filter(d => d.cancel > 0).sort((a, b) => {
      const aRate = a.trips > 0 ? a.cancel / a.trips : 0;
      const bRate = b.trips > 0 ? b.cancel / b.trips : 0;
      return bRate - aRate;
    }).slice(0, 3);
    if (worstDrivers.length > 0) {
      const worst = worstDrivers[0];
      items.push({
        icon: '🟡', label: 'Motorista risco',
        value: worst.driver,
        hint: `${worst.cancel} cancelamento(s) em ${worst.trips} viagens`,
        tone: 'bad',
        onClick: () => setCarrierSlicers(s => ({ ...s, driverQuery: worst.driver })),
      });
    }

    // 5) Excesso em aberto
    if (fretesAbertos > 0) {
      items.push({
        icon: '🟠', label: 'Em aberto',
        value: fmtNum(fretesAbertos),
        tone: fretesAbertos >= 5 ? 'bad' : 'neutral',
        onClick: () => setCarrierSlicers(s => ({ ...s, status: ['OPEN'] })),
      });
    }

    // 6) Em trânsito
    if (emTransito > 0) {
      items.push({
        icon: '🚛', label: 'Em trânsito',
        value: fmtNum(emTransito),
        tone: 'neutral',
        onClick: () => setCarrierSlicers(s => ({ ...s, status: ['IN_TRANSIT'] })),
      });
    }

    // 7) Baixa utilização
    if (utilizacao > 0 && utilizacao < 50) {
      items.push({
        icon: '⚠️', label: 'Baixa utilização',
        value: `${utilizacao.toFixed(0)}%`,
        hint: 'Frota abaixo de 50%',
        tone: 'bad',
      });
    }

    // 8) SLA ruim
    if (sla > 48) {
      items.push({
        icon: '🟡', label: 'SLA alto',
        value: `${sla > 24 ? `${Math.floor(sla / 24)}d ${Math.round(sla % 24)}h` : `${fmtNum(sla, 1)}h`}`,
        hint: 'Acima de 48h',
        tone: 'bad',
      });
    }

    // 9) Melhor performance
    const best = [...carrierScorecard].filter(d => d.rs_km > 0).sort((a, b) => b.rs_km - a.rs_km)[0];
    if (best) {
      items.push({
        icon: '🟢', label: 'Melhor R$/km',
        value: `R$ ${fmtNum(best.rs_km, 2)}`,
        hint: best.driver,
        tone: 'good',
        onClick: () => setCarrierSlicers(s => ({ ...s, driverQuery: best.driver })),
      });
    }

    // 10) Sem atividade
    if (totalFretes === 0) {
      items.push({ icon: '🟡', label: 'Sem atividade', value: 'Nenhum frete', hint: 'Amplie o período', tone: 'neutral' });
    }

    return items.slice(0, 8);
  }, [kpis, carrierScorecard, benchmark, filteredCarrierRows, setCarrierSlicers]);

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4', BI.gridGap)}>
      {alerts.map((a, i) => (
        <div key={i} className={cn(
          BI.radius, BI.cardSoft, BI.cardHover, 'p-3',
          a.tone === 'bad' && BI.badBg,
          a.tone === 'good' && BI.goodBg,
          a.onClick && 'cursor-pointer',
        )} onClick={a.onClick}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-sm leading-none">{a.icon}</span>
            <p className={BI.label}>{a.label}</p>
          </div>
          <p className={cn('text-base font-extrabold tabular-nums', a.tone === 'bad' && BI.bad, a.tone === 'good' && BI.good)}>
            {a.value}
          </p>
          {a.hint && <p className={cn(BI.sub, 'mt-0.5')}>{a.hint}</p>}
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 4. INSIGHTS (PowerBI-like)
// ═══════════════════════════════════════════════════════════════════════════════
type InsightCard = { title: string; value: string; context: string; tone: 'good' | 'bad' | 'neutral'; onClick?: () => void };

export const CarrierInsightsPanel: React.FC<{
  filteredCarrierRows: any[];
  carrierScorecard: ScorecardRow[];
  benchmark: BenchmarkResult;
  setCarrierSlicers: React.Dispatch<React.SetStateAction<CarrierSlicers>>;
}> = ({ filteredCarrierRows, carrierScorecard, benchmark, setCarrierSlicers }) => {
  const insights = useMemo(() => {
    const items: InsightCard[] = [];
    const rows = filteredCarrierRows;
    if (!rows.length) return items;

    // 1) Most profitable route (R$/km)
    const routeMap = new Map<string, { rev: number; km: number }>();
    for (const r of rows) {
      if (r.__km > 0 && r.__revenue > 0) {
        const cur = routeMap.get(r.__rota) || { rev: 0, km: 0 };
        cur.rev += r.__revenue; cur.km += r.__km;
        routeMap.set(r.__rota, cur);
      }
    }
    const routeEff = Array.from(routeMap.entries())
      .map(([name, v]) => ({ name, rs_km: v.km > 0 ? v.rev / v.km : 0, rev: v.rev }))
      .filter(r => r.rs_km > 0);
    if (routeEff.length) {
      const best = routeEff.sort((a, b) => b.rs_km - a.rs_km)[0];
      items.push({
        title: 'Rota mais lucrativa (R$/km)',
        value: `R$ ${fmtNum(best.rs_km, 2)}/km`,
        context: best.name,
        tone: 'good',
        onClick: () => setCarrierSlicers(s => ({ ...s, routeQuery: best.name })),
      });
    }

    // 2) Most efficient driver
    const drvEff = [...carrierScorecard].filter(d => d.rs_km > 0).sort((a, b) => b.rs_km - a.rs_km);
    if (drvEff.length) {
      items.push({
        title: 'Motorista mais eficiente',
        value: `R$ ${fmtNum(drvEff[0].rs_km, 2)}/km`,
        context: drvEff[0].driver,
        tone: 'good',
        onClick: () => setCarrierSlicers(s => ({ ...s, driverQuery: drvEff[0].driver })),
      });
    }

    // 3) Highest total revenue route
    if (routeEff.length) {
      const bestRev = [...routeEff].sort((a, b) => b.rev - a.rev)[0];
      items.push({
        title: 'Maior receita total',
        value: formatBRL(bestRev.rev),
        context: `Rota: ${bestRev.name}`,
        tone: 'good',
        onClick: () => setCarrierSlicers(s => ({ ...s, routeQuery: bestRev.name })),
      });
    }

    // 4) Worst outlier
    if (routeEff.length >= 2) {
      const worst = [...routeEff].sort((a, b) => a.rs_km - b.rs_km)[0];
      items.push({
        title: 'Pior outlier R$/km',
        value: `R$ ${fmtNum(worst.rs_km, 2)}/km`,
        context: `Rota: ${worst.name}`,
        tone: 'bad',
        onClick: () => setCarrierSlicers(s => ({ ...s, routeQuery: worst.name })),
      });
    }

    // 5) Dominant status
    const statusMap = new Map<string, number>();
    for (const r of rows) { statusMap.set(r.__status, (statusMap.get(r.__status) || 0) + 1); }
    const dominant = Array.from(statusMap.entries()).sort((a, b) => b[1] - a[1])[0];
    if (dominant && rows.length > 0) {
      const pct = ((dominant[1] / rows.length) * 100).toFixed(0);
      items.push({
        title: 'Status dominante',
        value: `${dominant[0]} (${pct}%)`,
        context: `${dominant[1]} de ${rows.length} fretes`,
        tone: 'neutral',
        onClick: () => setCarrierSlicers(s => ({ ...s, status: [dominant[0]] })),
      });
    }

    // 6) Average daily revenue
    const dates = new Set<string>();
    for (const r of rows) { if (r.__date) dates.add(r.__date.toISOString().slice(0, 10)); }
    const totalRev = rows.reduce((s, r) => s + (r.__revenue || 0), 0);
    const days = dates.size || 1;
    items.push({
      title: 'Receita diária média',
      value: formatBRL(totalRev / days),
      context: `${days} dia(s) com movimentação`,
      tone: 'neutral',
    });

    // 7) Trend vs previous
    if (benchmark.hasPrev && benchmark.deltas.revenue !== null) {
      const d = benchmark.deltas.revenue;
      items.push({
        title: d >= 0 ? 'Tendência: receita subiu' : 'Tendência: receita caiu',
        value: `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`,
        context: `Anterior: ${formatBRL(benchmark.previous.revenue)}`,
        tone: d >= 0 ? 'good' : 'bad',
      });
    }

    // 8) Concentration - top 3 drivers
    if (carrierScorecard.length >= 3) {
      const sorted = [...carrierScorecard].sort((a, b) => b.revenue - a.revenue);
      const top3Rev = sorted.slice(0, 3).reduce((s, d) => s + d.revenue, 0);
      const allRev = sorted.reduce((s, d) => s + d.revenue, 0);
      if (allRev > 0) {
        const pct = ((top3Rev / allRev) * 100).toFixed(0);
        items.push({
          title: 'Concentração de receita',
          value: `${pct}%`,
          context: 'Top 3 motoristas',
          tone: Number(pct) > 70 ? 'bad' : 'neutral',
        });
      }
    }

    // 9) Average ticket
    if (rows.length > 0) {
      const avg = totalRev / rows.length;
      items.push({
        title: 'Ticket médio',
        value: formatBRL(avg),
        context: `${rows.length} fretes no período`,
        tone: 'neutral',
      });
    }

    // 10) Top km route
    const routeByKm = Array.from(routeMap.entries()).sort((a, b) => b[1].km - a[1].km);
    if (routeByKm.length) {
      items.push({
        title: 'Rota com mais km',
        value: `${fmtNum(routeByKm[0][1].km)} km`,
        context: routeByKm[0][0],
        tone: 'neutral',
        onClick: () => setCarrierSlicers(s => ({ ...s, routeQuery: routeByKm[0][0] })),
      });
    }

    return items.slice(0, 10);
  }, [filteredCarrierRows, carrierScorecard, benchmark, setCarrierSlicers]);

  if (!insights.length) return null;

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5', BI.gridGap)}>
      {insights.map((ins, i) => (
        <div key={i} className={cn(
          BI.radius, BI.cardSoft, BI.cardHover, 'p-3',
          ins.tone === 'good' && BI.goodBg,
          ins.tone === 'bad' && BI.badBg,
          ins.onClick && 'cursor-pointer',
        )} onClick={ins.onClick}>
          <p className={cn(BI.label, 'line-clamp-1')}>{ins.title}</p>
          <p className={cn('text-sm font-extrabold tabular-nums mt-1', ins.tone === 'good' && BI.good, ins.tone === 'bad' && BI.bad)}>
            {ins.value}
          </p>
          <p className={cn(BI.sub, 'mt-0.5 line-clamp-1')}>{ins.context}</p>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// 5. SCORECARD ADVANCED + QUADRANT
// ═══════════════════════════════════════════════════════════════════════════════
const SCORECARD_TABS: { key: ScorecardSortKey; label: string }[] = [
  { key: 'revenue', label: 'Receita' },
  { key: 'rs_km', label: 'Eficiência (R$/km)' },
  { key: 'trips', label: 'Volume' },
  { key: 'cancel_rate', label: 'Risco' },
];

export const CarrierScorecardAdvanced: React.FC<{
  scorecard: ScorecardRow[];
  sortKey: ScorecardSortKey;
  setSortKey: React.Dispatch<React.SetStateAction<ScorecardSortKey>>;
  setCarrierSlicers: React.Dispatch<React.SetStateAction<CarrierSlicers>>;
  filteredCarrierRows: any[];
}> = ({ scorecard, sortKey, setSortKey, setCarrierSlicers, filteredCarrierRows }) => {
  const sorted = useMemo(() => {
    const copy = [...scorecard];
    switch (sortKey) {
      case 'revenue': return copy.sort((a, b) => b.revenue - a.revenue);
      case 'rs_km': return copy.sort((a, b) => b.rs_km - a.rs_km);
      case 'trips': return copy.sort((a, b) => b.trips - a.trips);
      case 'cancel_rate': {
        return copy.sort((a, b) => {
          const aRate = a.trips > 0 ? a.cancel / a.trips : 0;
          const bRate = b.trips > 0 ? b.cancel / b.trips : 0;
          return bRate - aRate;
        });
      }
      default: return copy;
    }
  }, [scorecard, sortKey]);

  // Quadrant data
  const quadrantData = useMemo(() => {
    const hasLate = filteredCarrierRows.some(r => r.__isLate !== undefined);
    if (!hasLate) return null;

    const driverMap = new Map<string, { driver: string; revenue: number; km: number; late: number; total: number }>();
    for (const r of filteredCarrierRows) {
      const d = r.__driver || '—';
      const cur = driverMap.get(d) || { driver: d, revenue: 0, km: 0, late: 0, total: 0 };
      cur.revenue += r.__revenue || 0;
      cur.km += r.__km || 0;
      if (r.__isLate) cur.late++;
      cur.total++;
      driverMap.set(d, cur);
    }

    return Array.from(driverMap.values())
      .filter(d => d.km > 0 && d.total >= 2)
      .map(d => ({
        name: d.driver,
        rs_km: d.revenue / d.km,
        on_time: ((d.total - d.late) / d.total) * 100,
      }))
      .sort((a, b) => b.rs_km - a.rs_km)
      .slice(0, 20);
  }, [filteredCarrierRows]);

  const highlightCol = (key: ScorecardSortKey) =>
    key === sortKey ? 'font-bold' : '';

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <Card className={cn(BI.radius, BI.card, 'overflow-hidden')}>
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border/40 bg-muted/10 overflow-x-auto">
          {SCORECARD_TABS.map(tab => (
            <Button key={tab.key} variant={sortKey === tab.key ? 'secondary' : 'ghost'} size="sm"
              className="h-6 text-[10px] shrink-0" onClick={() => setSortKey(tab.key)}>
              {tab.label}
            </Button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className={BI.tableHeader}>
              <tr>
                <th className={cn(BI.tableHeaderCell, 'text-left w-8')}>#</th>
                <th className={cn(BI.tableHeaderCell, 'text-left')}>Motorista</th>
                <th className={cn(BI.tableHeaderCell, 'text-right', highlightCol('trips'))}>Viagens</th>
                <th className={cn(BI.tableHeaderCell, 'text-right', highlightCol('revenue'))}>Receita</th>
                <th className={cn(BI.tableHeaderCell, 'text-right hidden sm:table-cell')}>Km</th>
                <th className={cn(BI.tableHeaderCell, 'text-right hidden sm:table-cell', highlightCol('rs_km'))}>R$/km</th>
                <th className={cn(BI.tableHeaderCell, 'text-right hidden sm:table-cell', highlightCol('cancel_rate'))}>Cancel.</th>
                <th className={cn(BI.tableHeaderCell, 'text-center')}>Badge</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const isTop = i === 0 && r.revenue > 0;
                const cancelRate = r.trips > 0 ? (r.cancel / r.trips) * 100 : 0;
                const isRisk = r.cancel >= 3 || cancelRate > 20;
                return (
                  <tr key={i} className={cn(BI.tableRow, BI.tableRowHover, i % 2 === 0 && BI.tableRowEven, 'cursor-pointer')}
                    onClick={() => setCarrierSlicers(s => ({ ...s, driverQuery: r.driver }))}>
                    <td className={cn(BI.tableCell, 'text-muted-foreground tabular-nums w-8')}>{i + 1}</td>
                    <td className={cn(BI.tableCell, 'font-medium')}>{r.driver || '—'}</td>
                    <td className={cn(BI.tableCellNum, highlightCol('trips'))}>{fmtNum(r.trips)}</td>
                    <td className={cn(BI.tableCellNum, 'font-semibold', BI.good, highlightCol('revenue'))}>{formatBRL(r.revenue)}</td>
                    <td className={cn(BI.tableCellNum, 'hidden sm:table-cell')}>{fmtNum(r.km)}</td>
                    <td className={cn(BI.tableCellNum, 'hidden sm:table-cell', highlightCol('rs_km'))}>{r.rs_km > 0 ? fmtNum(r.rs_km, 2) : '—'}</td>
                    <td className={cn(BI.tableCellNum, 'hidden sm:table-cell', highlightCol('cancel_rate'))}>{sortKey === 'cancel_rate' ? `${cancelRate.toFixed(0)}%` : fmtNum(r.cancel)}</td>
                    <td className={cn(BI.tableCell, 'text-center')}>
                      {isTop && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-[hsl(142,71%,45%)]/12 text-[hsl(142,71%,45%)]">Top</span>}
                      {isRisk && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-destructive/10 text-destructive">Risco</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Quadrant chart */}
      {quadrantData && quadrantData.length >= 3 ? (
        <Card className={cn(BI.radius, BI.card, 'p-4')}>
          <p className={cn(BI.sectionTitle, 'mb-1')}>Quadrante: Eficiência x Pontualidade</p>
          <p className={cn(BI.sub, 'mb-3')}>Motoristas por R$/km e % no prazo</p>
          <ResponsiveContainer width="100%" height={300}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="rs_km" name="R$/km" type="number"
                tick={{ fontSize: 10 }} label={{ value: 'R$/km', position: 'insideBottom', offset: -5, style: { fontSize: 10 } }} />
              <YAxis dataKey="on_time" name="No prazo (%)" type="number" domain={[0, 100]}
                tick={{ fontSize: 10 }} label={{ value: '% no prazo', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
              <RechartsTooltip
                content={({ payload }) => {
                  if (!payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg p-2 text-xs shadow-lg">
                      <p className="font-bold">{d.name}</p>
                      <p>R$/km: {fmtNum(d.rs_km, 2)}</p>
                      <p>No prazo: {fmtNum(d.on_time, 0)}%</p>
                    </div>
                  );
                }}
              />
              <Scatter data={quadrantData} fill="hsl(142,71%,45%)" fillOpacity={0.7} />
              <ReferenceLine y={80} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.4} />
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      ) : (
        <Card className={cn(BI.radius, BI.cardSoft, 'p-5 flex flex-col items-center gap-2')}>
          <Target className="h-8 w-8 text-muted-foreground/20" />
          <p className="text-xs font-medium text-muted-foreground">Quadrante Eficiência x Pontualidade</p>
          <p className={cn(BI.sub, 'text-center max-w-xs')}>
            Disponível quando tracking de prazo estiver ativo (campo __isLate com dados reais)
          </p>
        </Card>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// HERO WITH BENCHMARK DELTAS
// ═══════════════════════════════════════════════════════════════════════════════
export const CarrierHeroBenchmark: React.FC<{
  kpis: any;
  benchmark: BenchmarkResult;
  isLoading: boolean;
}> = ({ kpis, benchmark, isLoading }) => {
  const totalFretes = Number(kpis.total_fretes) || 0;
  const fretesConcluidos = Number(kpis.fretes_concluidos) || 0;
  const totalMotoristas = Number(kpis.total_motoristas) || 0;
  const utilizacao = Number(kpis.utilizacao_frota) || 0;
  const receitaMotorista = Number(kpis.receita_por_motorista) || 0;
  const ticketMedio = Number(kpis.ticket_medio) || 0;
  const rsPorKm = Number(kpis.rs_por_km) || 0;
  const sla = Number(kpis.sla_medio_horas) || 0;

  const lowBase = benchmark.previous.revenue < 100;

  const items = [
    { label: 'Concluídos', value: fmtNum(fretesConcluidos), icon: CheckCircle, highlight: true, delta: benchmark.deltas.trips },
    { label: 'Total fretes', value: fmtNum(totalFretes), icon: BarChart3, delta: null as number | null },
    { label: 'Motoristas', value: fmtNum(totalMotoristas), icon: Users, highlight: true, delta: null as number | null },
    { label: 'Utilização frota', value: `${utilizacao.toFixed(0)}%`, icon: Zap, delta: null as number | null },
    { label: 'Receita/motorista', value: receitaMotorista > 0 ? formatBRL(receitaMotorista) : '—', icon: DollarSign, delta: benchmark.deltas.revPerDriver },
    { label: 'Ticket médio', value: ticketMedio > 0 ? formatBRL(ticketMedio) : '—', icon: TrendingUp, delta: null as number | null },
    { label: 'R$/km médio', value: rsPorKm > 0 ? `R$ ${fmtNum(rsPorKm, 2)}` : '—', icon: MapPin, delta: benchmark.deltas.rs_km },
    { label: 'SLA médio', value: sla > 0 ? `${sla > 24 ? `${Math.floor(sla / 24)}d` : `${fmtNum(sla, 1)}h`}` : '—', icon: Shield, delta: null as number | null },
  ];

  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4', BI.gridGap)}>
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <div key={i} className={cn(BI.radius, BI.cardGlass, 'px-3 py-2', item.highlight && 'ring-1 ring-[hsl(142,71%,45%)]/20')}>
            <div className="flex items-center justify-between mb-0.5">
              <p className={BI.label}>{item.label}</p>
              <Icon className={cn('h-3 w-3 flex-shrink-0', item.highlight ? BI.good : 'text-muted-foreground/50')} />
            </div>
            <div className="flex items-baseline gap-1">
              <p className={cn('text-sm font-bold tabular-nums', item.highlight && BI.good)}>{item.value}</p>
              {benchmark.hasPrev && item.delta !== null && <DeltaBadge delta={item.delta} lowBase={lowBase} />}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORT for convenience
// ═══════════════════════════════════════════════════════════════════════════════
export { useCarrierSavedViews } from '@/hooks/useCarrierSavedViews';
export type { CarrierSavedView, ScorecardSortKey };
