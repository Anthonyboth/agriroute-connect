/**
 * ProviderEnterprise.tsx
 *
 * Enterprise PowerBI components for PRESTADOR panel.
 * All state/logic derived with useMemo. No backend changes.
 */
import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DollarSign, BarChart3, Activity, Star, Timer, Search, X,
  Filter, AlertTriangle, TrendingUp, CheckCircle, Layers, PieChart,
  MapPin, Percent, Eye,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { BI } from './reports-enterprise-theme';
import { ReportCharts, formatBRL, type ChartConfig, type Drilldown } from '@/components/reports';
import {
  resolveServiceDim,
  getServiceLabel,
  getServiceChannels,
  getServiceOrder,
  CHANNEL_LABELS,
  CHANNEL_ABBR,
  CHANNEL_COLORS,
  type ServiceChannel,
} from '@/lib/service-dimension';
import { canonicalizeServiceId } from '@/lib/service-types';
import { formatMonthLabelPtBR } from '@/lib/reports-formatters';

// ═══════════════════════════════════════════════════════════════════════════════
// Formatters
// ═══════════════════════════════════════════════════════════════════════════════
const fmtNum = (v: number, dec = 0) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const fmtHours = (h: number) => {
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 24) return `${fmtNum(h, 1)}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${Math.round(h % 24)}h`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════
export type ProviderSlicers = {
  channels: ServiceChannel[];
  services: string[];
  status: string[];
  includeOutros: boolean;
  serviceSearch: string;
};

export const EMPTY_PROVIDER_SLICERS: ProviderSlicers = {
  channels: [],
  services: [],
  status: [],
  includeOutros: false,
  serviceSearch: '',
};

interface ProviderRow {
  __baseServiceId: string;
  __serviceLabel: string;
  __channels: ServiceChannel[];
  __date: Date | null;
  __status: string;
  __valor: number;
  __cidade: string;
  __avaliacao: number | null;
  __duracao: number | null;
  __order: number;
  [key: string]: any;
}

// ═══════════════════════════════════════════════════════════════════════════════
// StatusBadge
// ═══════════════════════════════════════════════════════════════════════════════
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = String(status).toUpperCase();
  const map: Record<string, { label: string; cls: string }> = {
    DELIVERED: { label: 'Concluído', cls: 'bg-[hsl(142,71%,45%)]/12 text-[hsl(142,71%,45%)]' },
    COMPLETED: { label: 'Concluído', cls: 'bg-[hsl(142,71%,45%)]/12 text-[hsl(142,71%,45%)]' },
    CANCELLED: { label: 'Cancelado', cls: 'bg-destructive/10 text-destructive' },
    IN_PROGRESS: { label: 'Em andamento', cls: 'bg-blue-500/10 text-blue-500' },
    ACCEPTED: { label: 'Aceito', cls: 'bg-amber-500/10 text-amber-500' },
    OPEN: { label: 'Aberto', cls: 'bg-muted text-muted-foreground' },
    PENDING: { label: 'Pendente', cls: 'bg-amber-500/10 text-amber-500' },
  };
  const cfg = map[s] ?? { label: status, cls: 'bg-muted text-muted-foreground' };
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide whitespace-nowrap', cfg.cls)}>
      {cfg.label}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ChannelBadge
// ═══════════════════════════════════════════════════════════════════════════════
const ChannelBadge: React.FC<{ channel: ServiceChannel }> = ({ channel }) => (
  <span
    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider"
    style={{
      backgroundColor: `${CHANNEL_COLORS[channel]}15`,
      color: CHANNEL_COLORS[channel],
    }}
  >
    {CHANNEL_ABBR[channel]}
  </span>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ToggleChip
// ═══════════════════════════════════════════════════════════════════════════════
const ToggleChip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; color?: string }> = ({
  active, onClick, children, color,
}) => (
  <button
    onClick={onClick}
    type="button"
    className={cn(
      'px-2.5 py-1 rounded-full text-[11px] font-semibold border transition',
      active
        ? 'border-[rgba(22,163,74,0.3)] text-[#16a34a]'
        : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/50',
    )}
    style={active && color ? { backgroundColor: `${color}15`, borderColor: `${color}40`, color } : active ? { backgroundColor: 'rgba(22,163,74,0.15)' } : undefined}
  >
    {children}
  </button>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SectionTitle
// ═══════════════════════════════════════════════════════════════════════════════
const SectionTitle: React.FC<{ icon: React.ElementType; title: string; subtitle?: string; actions?: React.ReactNode }> = ({
  icon: Icon, title, subtitle, actions,
}) => (
  <div className="flex items-center justify-between gap-2 pt-1">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
      <div>
        <h3 className={BI.sectionTitle}>{title}</h3>
        {subtitle && <p className={BI.sectionSub}>{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-1.5">{actions}</div>}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════════════════════════════════════
interface ProviderEnterpriseProps {
  kpis: Record<string, any>;
  charts: Record<string, any>;
  tables: Record<string, any>;
  isLoading: boolean;
  dateRange: { from: Date; to: Date };
}

export const ProviderEnterprise: React.FC<ProviderEnterpriseProps> = ({
  kpis, charts, tables, isLoading, dateRange,
}) => {
  // ── Slicers state ──────────────────────────────────────────────────────────
  const [slicers, setSlicers] = useState<ProviderSlicers>(EMPTY_PROVIDER_SLICERS);
  const resetSlicers = () => setSlicers(EMPTY_PROVIDER_SLICERS);

  const toggleChannel = (ch: ServiceChannel) =>
    setSlicers(p => ({ ...p, channels: p.channels.includes(ch) ? p.channels.filter(c => c !== ch) : [...p.channels, ch] }));
  const toggleService = (svc: string) =>
    setSlicers(p => ({ ...p, services: p.services.includes(svc) ? p.services.filter(s => s !== svc) : [...p.services, svc] }));
  const toggleStatus = (st: string) =>
    setSlicers(p => ({ ...p, status: p.status.includes(st) ? p.status.filter(s => s !== st) : [...p.status, st] }));

  // ── Drilldown handler ──────────────────────────────────────────────────────
  const applyDrilldown = (d: { kind: string; value: string }) => {
    if (d.kind === 'service') {
      setSlicers(p => ({ ...p, services: [d.value] }));
    } else if (d.kind === 'channel') {
      const ch = d.value as ServiceChannel;
      setSlicers(p => ({ ...p, channels: [ch] }));
    } else if (d.kind === 'status') {
      setSlicers(p => ({ ...p, status: [d.value] }));
    } else if (d.kind === 'city') {
      // city drilldown — not a slicer, but we can use serviceSearch as a proxy
    }
  };

  // ── Normalize extrato ─────────────────────────────────────────────────────
  const providerRows: ProviderRow[] = useMemo(() => {
    const raw = tables?.extrato_servicos || [];
    return raw.map((r: any) => {
      const rawServiceId = r.service_type || r.tipo || r.categoria || '';
      const baseServiceId = canonicalizeServiceId(rawServiceId);
      const serviceLabel = getServiceLabel(baseServiceId);
      const channels = getServiceChannels(baseServiceId);
      const order = getServiceOrder(baseServiceId);
      const dtRaw = r.data || r.created_at || r.completed_at;
      const dt = dtRaw ? new Date(dtRaw) : null;

      return {
        ...r,
        __baseServiceId: baseServiceId,
        __serviceLabel: serviceLabel,
        __channels: channels,
        __date: dt && isValid(dt) ? dt : null,
        __status: String(r.status || '').toUpperCase(),
        __valor: Number(r.receita || r.valor || r.price || 0) || 0,
        __cidade: r.cidade || r.city || '—',
        __avaliacao: r.avaliacao != null ? Number(r.avaliacao) : null,
        __duracao: r.duracao_horas != null ? Number(r.duracao_horas) : r.duration_hours != null ? Number(r.duration_hours) : null,
        __order: order,
      };
    });
  }, [tables]);

  // ── Slicer options ────────────────────────────────────────────────────────
  const slicerOptions = useMemo(() => {
    const serviceMap = new Map<string, { id: string; label: string; count: number; order: number }>();
    const statusSet = new Set<string>();
    const channelSet = new Set<ServiceChannel>();

    for (const r of providerRows) {
      if (r.__baseServiceId) {
        const existing = serviceMap.get(r.__baseServiceId);
        if (existing) {
          existing.count++;
        } else {
          serviceMap.set(r.__baseServiceId, { id: r.__baseServiceId, label: r.__serviceLabel, count: 1, order: r.__order });
        }
      }
      if (r.__status) statusSet.add(r.__status);
      for (const ch of r.__channels) channelSet.add(ch);
    }

    const services = Array.from(serviceMap.values()).sort((a, b) => b.count - a.count);
    return {
      services,
      statuses: Array.from(statusSet).sort(),
      channels: Array.from(channelSet).sort(),
    };
  }, [providerRows]);

  // ── Filtered rows ─────────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let rows = providerRows;
    const s = slicers;

    if (!s.includeOutros) {
      rows = rows.filter(r => r.__baseServiceId !== 'OUTROS');
    }
    if (s.channels.length) {
      rows = rows.filter(r => r.__channels.some(ch => s.channels.includes(ch)));
    }
    if (s.services.length) {
      rows = rows.filter(r => s.services.includes(r.__baseServiceId));
    }
    if (s.status.length) {
      rows = rows.filter(r => s.status.includes(r.__status));
    }
    return rows;
  }, [providerRows, slicers]);

  const activeFiltersCount = useMemo(() => {
    let c = 0;
    if (slicers.channels.length) c++;
    if (slicers.services.length) c++;
    if (slicers.status.length) c++;
    if (slicers.includeOutros) c++;
    return c;
  }, [slicers]);

  // ── Chart data: Revenue by Service (Top 10) ──────────────────────────────
  const revenueByService = useMemo(() => {
    const map = new Map<string, { label: string; revenue: number; count: number; order: number }>();
    for (const r of filteredRows) {
      const k = r.__baseServiceId;
      const cur = map.get(k) || { label: r.__serviceLabel, revenue: 0, count: 0, order: r.__order };
      cur.revenue += r.__valor;
      cur.count++;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue || a[1].order - b[1].order)
      .slice(0, 10)
      .map(([id, v]) => ({ name: v.label, receita: v.revenue, __id: id }));
  }, [filteredRows]);

  // ── Chart data: Services by Service (Top 10) ─────────────────────────────
  const countByService = useMemo(() => {
    const map = new Map<string, { label: string; count: number; order: number }>();
    for (const r of filteredRows) {
      const k = r.__baseServiceId;
      const cur = map.get(k) || { label: r.__serviceLabel, count: 0, order: r.__order };
      cur.count++;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count || a[1].order - b[1].order)
      .slice(0, 10)
      .map(([id, v]) => ({ name: v.label, servicos: v.count, __id: id }));
  }, [filteredRows]);

  // ── Chart data: Revenue by Channel ────────────────────────────────────────
  const revenueByChannel = useMemo(() => {
    const map = new Map<ServiceChannel, number>();
    for (const r of filteredRows) {
      for (const ch of r.__channels) {
        map.set(ch, (map.get(ch) || 0) + r.__valor);
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([ch, val]) => ({ name: CHANNEL_LABELS[ch], value: val, __id: ch }));
  }, [filteredRows]);

  // ── Chart data: Status ────────────────────────────────────────────────────
  const byStatus = useMemo(() => {
    const STATUS_LABELS: Record<string, string> = {
      DELIVERED: 'Concluído', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
      IN_PROGRESS: 'Em Andamento', ACCEPTED: 'Aceito', OPEN: 'Aberto', PENDING: 'Pendente',
    };
    const map = new Map<string, number>();
    for (const r of filteredRows) {
      const label = STATUS_LABELS[r.__status] || r.__status || 'Outros';
      map.set(label, (map.get(label) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [filteredRows]);

  // ── Chart data: Top Cities ────────────────────────────────────────────────
  const topCities = useMemo(() => {
    const map = new Map<string, { count: number; revenue: number }>();
    for (const r of filteredRows) {
      if (r.__cidade === '—') continue;
      const cur = map.get(r.__cidade) || { count: 0, revenue: 0 };
      cur.count++;
      cur.revenue += r.__valor;
      map.set(r.__cidade, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, v]) => ({ name, servicos: v.count }));
  }, [filteredRows]);

  // ── Revenue by Month ──────────────────────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    // prefer charts.receita_por_mes from backend
    if (charts?.receita_por_mes?.length) {
      return charts.receita_por_mes
        .map((m: any) => ({
          month: formatMonthLabelPtBR(m.mes),
          receita: Number(m.receita) || 0,
          servicos: Math.round(Number(m.servicos) || 0),
          _sortKey: m.mes,
        }))
        .sort((a: any, b: any) => String(a._sortKey).localeCompare(String(b._sortKey)));
    }
    // fallback: derive from filteredRows
    const map = new Map<string, { receita: number; count: number }>();
    for (const r of filteredRows) {
      if (!r.__date) continue;
      const k = `${r.__date.getFullYear()}-${String(r.__date.getMonth() + 1).padStart(2, '0')}`;
      const cur = map.get(k) || { receita: 0, count: 0 };
      cur.receita += r.__valor;
      cur.count++;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([k, v]) => ({ month: formatMonthLabelPtBR(k), receita: v.receita, servicos: v.count }));
  }, [charts, filteredRows]);

  // ── ChartConfigs ──────────────────────────────────────────────────────────
  const chartConfigs: ChartConfig[] = useMemo(() => {
    const configs: ChartConfig[] = [];

    if (revenueByMonth.length > 0) {
      configs.push({
        title: 'Receita por mês',
        type: 'area',
        data: revenueByMonth,
        dataKeys: [{ key: 'receita', label: 'Receita', color: '#16a34a' }],
        xAxisKey: 'month',
        valueFormatter: formatBRL,
      });
    }

    if (revenueByService.length > 0) {
      configs.push({
        title: 'Receita por Serviço (Top 10)',
        type: 'horizontal-bar',
        data: revenueByService,
        dataKeys: [{ key: 'receita', label: 'Receita (R$)', color: '#16a34a' }],
        xAxisKey: 'name',
        valueFormatter: formatBRL,
        height: 320,
        drilldownKind: 'cargo' as any,
        onDrilldown: (d: Drilldown) => {
          const match = revenueByService.find(s => s.name === d.value);
          if (match) applyDrilldown({ kind: 'service', value: (match as any).__id });
        },
      });
    }

    if (countByService.length > 0) {
      configs.push({
        title: 'Serviços por Tipo (Top 10)',
        type: 'horizontal-bar',
        data: countByService,
        dataKeys: [{ key: 'servicos', label: 'Serviços', color: 'hsl(221,83%,53%)' }],
        xAxisKey: 'name',
        height: 320,
        yAxisAllowDecimals: false,
        drilldownKind: 'cargo' as any,
        onDrilldown: (d: Drilldown) => {
          const match = countByService.find(s => s.name === d.value);
          if (match) applyDrilldown({ kind: 'service', value: (match as any).__id });
        },
      });
    }

    if (revenueByChannel.length > 0) {
      configs.push({
        title: 'Receita por Canal',
        type: 'pie',
        data: revenueByChannel,
        dataKeys: [{ key: 'value', label: 'Receita (R$)' }],
        valueFormatter: formatBRL,
      });
    }

    if (byStatus.length > 0) {
      configs.push({
        title: 'Status dos Serviços',
        type: 'pie',
        data: byStatus,
        dataKeys: [{ key: 'value', label: 'Quantidade' }],
        yAxisAllowDecimals: false,
      });
    }

    if (topCities.length > 0) {
      configs.push({
        title: 'Top Cidades',
        type: 'horizontal-bar',
        data: topCities,
        dataKeys: [{ key: 'servicos', label: 'Serviços', color: 'hsl(25,95%,53%)' }],
        xAxisKey: 'name',
        height: 320,
        yAxisAllowDecimals: false,
      });
    }

    return configs;
  }, [revenueByMonth, revenueByService, countByService, revenueByChannel, byStatus, topCities]);

  // ── Concentration (Mix) ───────────────────────────────────────────────────
  const concentration = useMemo(() => {
    if (!revenueByService.length) return null;
    const totalRevenue = revenueByService.reduce((a, b) => a + b.receita, 0);
    if (totalRevenue <= 0) return null;

    const top1 = revenueByService[0];
    const top1Share = (top1.receita / totalRevenue) * 100;
    const top3Revenue = revenueByService.slice(0, 3).reduce((a, b) => a + b.receita, 0);
    const top3Share = (top3Revenue / totalRevenue) * 100;

    return {
      top1Name: top1.name,
      top1Id: (top1 as any).__id,
      top1Share,
      top3Share,
      isRisky: top1Share > 60,
    };
  }, [revenueByService]);

  // ── Quality / Efficiency ──────────────────────────────────────────────────
  const qualityMetrics = useMemo(() => {
    const withRating = filteredRows.filter(r => r.__avaliacao != null && r.__avaliacao > 0);
    const withDuration = filteredRows.filter(r => r.__duracao != null && r.__duracao > 0);
    const withValue = filteredRows.filter(r => r.__valor > 0);

    const bottomRating = [...withRating]
      .sort((a, b) => (a.__avaliacao || 0) - (b.__avaliacao || 0))
      .slice(0, 10);

    const topDuration = [...withDuration]
      .sort((a, b) => (b.__duracao || 0) - (a.__duracao || 0))
      .slice(0, 10);

    const bottomTicket = [...withValue]
      .sort((a, b) => a.__valor - b.__valor)
      .slice(0, 10);

    return {
      hasRating: withRating.length >= 3,
      hasDuration: withDuration.length >= 3,
      hasTicket: withValue.length >= 3,
      bottomRating,
      topDuration,
      bottomTicket,
    };
  }, [filteredRows]);

  // ── Filtered service chips (top 12 + search) ─────────────────────────────
  const displayedServices = useMemo(() => {
    const svcList = slicerOptions.services;
    if (!slicers.serviceSearch.trim()) return svcList.slice(0, 12);
    const q = slicers.serviceSearch.toLowerCase();
    return svcList.filter(s => s.label.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [slicerOptions.services, slicers.serviceSearch]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Slicers PowerBI ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionTitle
          icon={Filter}
          title="Filtros analíticos"
          subtitle="Canais, serviços e status"
          actions={
            activeFiltersCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={resetSlicers} className="h-7 text-xs gap-1">
                <X className="h-3 w-3" /> Limpar ({activeFiltersCount})
              </Button>
            ) : undefined
          }
        />

        <Card className={cn(BI.radius, BI.cardSoft, 'p-3 space-y-3')}>
          {/* Channels */}
          <div>
            <p className={cn(BI.label, 'mb-1.5')}>Canal</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(CHANNEL_LABELS) as ServiceChannel[]).map(ch => (
                <ToggleChip
                  key={ch}
                  active={slicers.channels.includes(ch)}
                  onClick={() => toggleChannel(ch)}
                  color={CHANNEL_COLORS[ch]}
                >
                  {CHANNEL_LABELS[ch]}
                </ToggleChip>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <p className={BI.label}>Serviço</p>
              {slicerOptions.services.length > 12 && (
                <div className="relative flex-1 max-w-[200px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={slicers.serviceSearch}
                    onChange={e => setSlicers(p => ({ ...p, serviceSearch: e.target.value }))}
                    placeholder="Buscar..."
                    className="h-6 pl-7 text-[11px]"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {displayedServices.map(svc => (
                <ToggleChip key={svc.id} active={slicers.services.includes(svc.id)} onClick={() => toggleService(svc.id)}>
                  {svc.label} ({svc.count})
                </ToggleChip>
              ))}
            </div>
          </div>

          {/* Status */}
          {slicerOptions.statuses.length > 0 && (
            <div>
              <p className={cn(BI.label, 'mb-1.5')}>Status</p>
              <div className="flex flex-wrap gap-1.5">
                {slicerOptions.statuses.map(st => {
                  const labels: Record<string, string> = {
                    DELIVERED: 'Concluído', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
                    IN_PROGRESS: 'Em Andamento', ACCEPTED: 'Aceito', OPEN: 'Aberto', PENDING: 'Pendente',
                  };
                  return (
                    <ToggleChip key={st} active={slicers.status.includes(st)} onClick={() => toggleStatus(st)}>
                      {labels[st] || st}
                    </ToggleChip>
                  );
                })}
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="flex items-center gap-3 pt-1">
            <ToggleChip active={slicers.includeOutros} onClick={() => setSlicers(p => ({ ...p, includeOutros: !p.includeOutros }))}>
              Incluir "Outros"
            </ToggleChip>
          </div>
        </Card>
      </div>

      {/* ── Concentration (Mix) Card ─────────────────────────────────────── */}
      {concentration && (
        <div className="space-y-2">
          <SectionTitle icon={PieChart} title="Concentração (Mix)" subtitle="Dependência por tipo de serviço" />
          <Card className={cn(BI.radius, BI.cardSoft, 'p-4')}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <button
                onClick={() => applyDrilldown({ kind: 'service', value: concentration.top1Id })}
                className={cn(BI.radius, BI.cardHover, 'p-3 text-left border', concentration.isRisky ? BI.badBg : BI.cardSoft)}
              >
                <p className={BI.label}>Top 1 serviço</p>
                <p className={cn('text-lg font-extrabold tabular-nums', concentration.isRisky ? BI.bad : 'text-foreground')}>
                  {concentration.top1Share.toFixed(1)}%
                </p>
                <p className={cn(BI.sub, 'mt-0.5 truncate')}>{concentration.top1Name}</p>
                {concentration.isRisky && (
                  <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-3 w-3" /> RISCO
                  </span>
                )}
              </button>
              <div className={cn(BI.radius, BI.cardSoft, 'p-3')}>
                <p className={BI.label}>Top 3 share</p>
                <p className="text-lg font-extrabold tabular-nums text-foreground">{concentration.top3Share.toFixed(1)}%</p>
                <p className={cn(BI.sub, 'mt-0.5')}>
                  {concentration.top3Share >= 80 ? 'Alta concentração' : 'Diversificado'}
                </p>
              </div>
              <div className={cn(BI.radius, BI.cardSoft, 'p-3')}>
                <p className={BI.label}>Serviços ativos</p>
                <p className="text-lg font-extrabold tabular-nums text-foreground">{revenueByService.length}</p>
                <p className={cn(BI.sub, 'mt-0.5')}>com receita no período</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Charts ───────────────────────────────────────────────────────── */}
      {chartConfigs.length > 0 && (
        <div className="space-y-3">
          <SectionTitle icon={BarChart3} title="Análise gráfica" subtitle="Clique nas barras para filtrar" />
          <ReportCharts charts={chartConfigs} isLoading={false} columns={2} />
        </div>
      )}

      {/* ── Quality / Efficiency ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionTitle icon={Star} title="Qualidade e eficiência" subtitle="Rankings por avaliação, duração e ticket" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Bottom 10 by Rating */}
          <Card className={cn(BI.radius, BI.card, 'overflow-hidden')}>
            <CardHeader className="py-2 px-3 border-b border-border/40">
              <CardTitle className="text-xs font-bold">Bottom 10 — Avaliação</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {qualityMetrics.hasRating ? (
                <div className="divide-y divide-border/30">
                  {qualityMetrics.bottomRating.map((r, i) => (
                    <div key={i} className={cn('flex items-center justify-between px-3 py-1.5 text-xs', i % 2 === 0 && BI.tableRowEven)}>
                      <span className="truncate max-w-[60%]">{r.__serviceLabel}</span>
                      <span className={cn('font-bold tabular-nums', (r.__avaliacao || 0) < 3 ? BI.bad : BI.warn)}>
                        {(r.__avaliacao || 0).toFixed(1)} ★
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
                  <Star className="h-4 w-4 opacity-20 mr-2" /> Dados insuficientes
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top 10 by Duration */}
          <Card className={cn(BI.radius, BI.card, 'overflow-hidden')}>
            <CardHeader className="py-2 px-3 border-b border-border/40">
              <CardTitle className="text-xs font-bold">Top 10 — Maior duração</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {qualityMetrics.hasDuration ? (
                <div className="divide-y divide-border/30">
                  {qualityMetrics.topDuration.map((r, i) => (
                    <div key={i} className={cn('flex items-center justify-between px-3 py-1.5 text-xs', i % 2 === 0 && BI.tableRowEven)}>
                      <span className="truncate max-w-[60%]">{r.__serviceLabel}</span>
                      <span className="font-bold tabular-nums text-muted-foreground">{fmtHours(r.__duracao || 0)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
                  <Timer className="h-4 w-4 opacity-20 mr-2" /> Dados insuficientes
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bottom 10 by Ticket */}
          <Card className={cn(BI.radius, BI.card, 'overflow-hidden')}>
            <CardHeader className="py-2 px-3 border-b border-border/40">
              <CardTitle className="text-xs font-bold">Bottom 10 — Menor ticket</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {qualityMetrics.hasTicket ? (
                <div className="divide-y divide-border/30">
                  {qualityMetrics.bottomTicket.map((r, i) => (
                    <div key={i} className={cn('flex items-center justify-between px-3 py-1.5 text-xs', i % 2 === 0 && BI.tableRowEven)}>
                      <span className="truncate max-w-[60%]">{r.__serviceLabel}</span>
                      <span className={cn('font-bold tabular-nums', BI.bad)}>{formatBRL(r.__valor)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-24 text-muted-foreground text-xs">
                  <DollarSign className="h-4 w-4 opacity-20 mr-2" /> Dados insuficientes
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Extrato Enterprise ───────────────────────────────────────────── */}
      <div className="space-y-3">
        <SectionTitle icon={DollarSign} title="Extrato de serviços" subtitle={`${filteredRows.length} registros`} />
        {filteredRows.length > 0 ? (
          <Card className={cn(BI.radius, BI.card, 'overflow-hidden')}>
            <VirtualizedProviderTable rows={filteredRows} />
          </Card>
        ) : (
          <Card className={cn(BI.radius, 'p-6 flex flex-col items-center gap-2')}>
            <Eye className="h-8 w-8 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">
              {activeFiltersCount > 0 ? 'Nenhum registro para os filtros selecionados' : 'Sem dados no período'}
            </p>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetSlicers} className="text-xs">Limpar filtros</Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// VirtualizedProviderTable
// ═══════════════════════════════════════════════════════════════════════════════
const VirtualizedProviderTable: React.FC<{ rows: ProviderRow[] }> = ({ rows }) => {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 38,
    overscan: 15,
  });

  useEffect(() => {
    parentRef.current?.scrollTo({ top: 0 });
  }, [rows]);

  return (
    <>
      {/* Sticky header */}
      <div className={cn(BI.tableHeader, 'flex items-center')}>
        <div className={cn(BI.tableHeaderCell, 'flex-none w-[140px] text-left')}>Serviço</div>
        <div className={cn(BI.tableHeaderCell, 'flex-none w-[50px] text-center')}>Canal</div>
        <div className={cn(BI.tableHeaderCell, 'flex-none w-[70px] text-left')}>Data</div>
        <div className={cn(BI.tableHeaderCell, 'flex-1 min-w-0 text-left hidden sm:block')}>Cidade</div>
        <div className={cn(BI.tableHeaderCell, 'flex-none w-[85px] text-right')}>Valor</div>
        <div className={cn(BI.tableHeaderCell, 'flex-none w-[75px] text-center')}>Status</div>
        <div className={cn(BI.tableHeaderCell, 'flex-none w-[50px] text-center hidden md:block')}>★</div>
        <div className={cn(BI.tableHeaderCell, 'flex-none w-[55px] text-right hidden md:block')}>Duração</div>
      </div>

      <div ref={parentRef} className="max-h-[600px] overflow-auto">
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const row = rows[virtualRow.index];
            const isEven = virtualRow.index % 2 === 0;
            return (
              <div
                key={virtualRow.index}
                className="absolute left-0 w-full"
                style={{ top: 0, transform: `translateY(${virtualRow.start}px)`, height: `${virtualRow.size}px` }}
              >
                <div className={cn(
                  'flex items-center h-full text-xs',
                  BI.tableRow, BI.tableRowHover,
                  isEven && BI.tableRowEven,
                )}>
                  <div className="flex-none w-[140px] px-3 truncate font-medium">{row.__serviceLabel}</div>
                  <div className="flex-none w-[50px] px-1 text-center">
                    {row.__channels[0] && <ChannelBadge channel={row.__channels[0]} />}
                  </div>
                  <div className="flex-none w-[70px] px-3 text-muted-foreground whitespace-nowrap tabular-nums">
                    {row.__date ? format(row.__date, 'dd/MM/yy', { locale: ptBR }) : '—'}
                  </div>
                  <div className="flex-1 min-w-0 px-3 truncate text-muted-foreground hidden sm:block">{row.__cidade}</div>
                  <div className={cn('flex-none w-[85px] px-3 text-right font-semibold whitespace-nowrap tabular-nums', BI.good)}>
                    {row.__valor > 0 ? formatBRL(row.__valor) : '—'}
                  </div>
                  <div className="flex-none w-[75px] px-2 text-center">
                    <StatusBadge status={row.__status} />
                  </div>
                  <div className="flex-none w-[50px] px-2 text-center text-muted-foreground tabular-nums hidden md:block">
                    {row.__avaliacao != null ? `${row.__avaliacao.toFixed(1)}` : '—'}
                  </div>
                  <div className="flex-none w-[55px] px-2 text-right text-muted-foreground tabular-nums hidden md:block">
                    {row.__duracao != null ? fmtHours(row.__duracao) : '—'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
