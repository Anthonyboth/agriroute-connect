import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { AppSpinner } from '@/components/ui/AppSpinner';
import {
  DollarSign, TrendingUp, TrendingDown, Clock, Menu, RefreshCw,
  Wallet, CreditCard, ShieldAlert, BarChart3, FileText, Search,
  AlertTriangle, CheckCircle2, XCircle, Eye, Lock, Unlock,
  ArrowDownCircle, ArrowUpCircle, Activity, Scale, Shield,
  Ban, Flag, ChevronRight, CircleDollarSign, Percent,
  CalendarClock, History, Zap, Users
} from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  completed: { label: 'Concluído', variant: 'default' },
  pending: { label: 'Pendente', variant: 'secondary' },
  failed: { label: 'Falhou', variant: 'destructive' },
  processing: { label: 'Processando', variant: 'secondary' },
  active: { label: 'Ativo', variant: 'default' },
  blocked: { label: 'Bloqueado', variant: 'destructive' },
  suspended: { label: 'Suspenso', variant: 'destructive' },
  under_review: { label: 'Em Análise', variant: 'secondary' },
  open: { label: 'Aberta', variant: 'destructive' },
  resolved: { label: 'Resolvida', variant: 'default' },
  rejected: { label: 'Rejeitado', variant: 'destructive' },
  pending_review: { label: 'Pendente', variant: 'secondary' },
  pending_approval: { label: 'Aguardando', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  disbursed: { label: 'Liberada', variant: 'default' },
  settled: { label: 'Quitada', variant: 'outline' },
  new: { label: 'Novo', variant: 'secondary' },
  reviewed: { label: 'Revisado', variant: 'outline' },
};

const getBadge = (status: string) => {
  const info = STATUS_MAP[status] || { label: status, variant: 'outline' as const };
  return <Badge variant={info.variant} className="text-[10px] font-medium">{info.label}</Badge>;
};

const MetricCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; accent?: string; sub?: string }> = ({ label, value, icon, accent, sub }) => (
  <Card className="shadow-sm border-border/50">
    <CardContent className="pt-4 pb-3">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className={`text-xl font-bold tracking-tight ${accent || 'text-foreground'}`}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
        <div className="rounded-lg bg-muted/60 p-2">{icon}</div>
      </div>
    </CardContent>
  </Card>
);

const EmptyTable: React.FC<{ icon: React.ReactNode; text: string }> = ({ icon, text }) => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="rounded-full bg-muted/60 p-4 mb-3">{icon}</div>
    <p className="text-sm text-muted-foreground">{text}</p>
  </div>
);

const AdminFinancial = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [wallets, setWallets] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<any[]>([]);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [reconciliation, setReconciliation] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [stats, setStats] = useState({
    total_wallets: 0, total_available: 0, total_pending: 0,
    total_reserved: 0, total_blocked: 0, total_custodied: 0,
    total_credit_limit: 0, total_credit_used: 0,
    total_advanced: 0, total_deposits: 0, total_withdrawals: 0,
    pending_payouts: 0, open_disputes: 0, dispute_value: 0,
    pending_advances: 0, risk_events_open: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [walletsRes, payoutsRes, disputesRes, creditRes, riskRes, advancesRes, auditRes, reconRes] = await Promise.all([
        supabase.from('wallets').select('*, profiles:profile_id(full_name, role)').limit(200),
        supabase.from('payout_orders').select('*, wallets:wallet_id(profile_id, profiles:profile_id(full_name))').order('created_at', { ascending: false }).limit(100),
        supabase.from('wallet_disputes').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('credit_accounts').select('*, profiles:profile_id(full_name)').limit(100),
        supabase.from('wallet_risk_events').select('*, profiles:profile_id(full_name)').order('created_at', { ascending: false }).limit(100),
        supabase.from('receivable_advances').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('admin_financial_audit_logs').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('reconciliation_runs').select('*').order('created_at', { ascending: false }).limit(50),
      ]);

      const w = walletsRes.data || [];
      const d = disputesRes.data || [];
      const p = payoutsRes.data || [];
      const c = creditRes.data || [];
      const adv = advancesRes.data || [];
      const risk = riskRes.data || [];

      setWallets(w);
      setPayouts(p);
      setDisputes(d);
      setCreditAccounts(c);
      setRiskEvents(risk);
      setAdvances(adv);
      setAuditLogs(auditRes.data || []);
      setReconciliation(reconRes.data || []);

      const totalAvail = w.reduce((s: number, x: any) => s + (x.available_balance || 0), 0);
      const totalPend = w.reduce((s: number, x: any) => s + (x.pending_balance || 0), 0);
      const totalRes = w.reduce((s: number, x: any) => s + (x.reserved_balance || 0), 0);
      const totalBlk = w.reduce((s: number, x: any) => s + (x.blocked_balance || 0), 0);

      setStats({
        total_wallets: w.length,
        total_available: totalAvail,
        total_pending: totalPend,
        total_reserved: totalRes,
        total_blocked: totalBlk,
        total_custodied: totalAvail + totalPend + totalRes + totalBlk,
        total_credit_limit: c.reduce((s: number, x: any) => s + (x.credit_limit || 0), 0),
        total_credit_used: c.reduce((s: number, x: any) => s + (x.used_amount || 0), 0),
        total_advanced: adv.filter((a: any) => a.status === 'disbursed').reduce((s: number, x: any) => s + (x.net_amount || 0), 0),
        total_deposits: 0,
        total_withdrawals: p.filter((x: any) => x.status === 'completed').reduce((s: number, x: any) => s + (x.amount || 0), 0),
        pending_payouts: p.filter((x: any) => x.status === 'pending_review' || x.status === 'pending').length,
        open_disputes: d.filter((x: any) => x.status === 'open' || x.status === 'under_review').length,
        dispute_value: d.filter((x: any) => x.status === 'open' || x.status === 'under_review').reduce((s: number, x: any) => s + (x.amount || 0), 0),
        pending_advances: adv.filter((a: any) => a.status === 'pending').length,
        risk_events_open: risk.filter((r: any) => r.status === 'new' || r.status === 'under_review').length,
      });
    } catch (e) {
      console.error('Admin financial fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = (action: string) => {
    toast.info(`${action} — funcionalidade em desenvolvimento`);
  };

  const filteredWallets = wallets.filter(w =>
    !searchTerm || (w.profiles?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const creditUsagePercent = stats.total_credit_limit > 0
    ? Math.round((stats.total_credit_used / stats.total_credit_limit) * 100) : 0;

  return (
    <div className="flex-1 bg-muted/30">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-muted rounded-md">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Central Financeira</h1>
            <p className="text-sm text-muted-foreground">Controle operacional de carteiras, crédito, saques, disputas e risco</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </header>

      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* ─── DASHBOARD CONSOLIDADO ─── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Total Custodiado" value={formatCurrency(stats.total_custodied)} icon={<DollarSign className="h-5 w-5 text-primary" />} accent="text-primary" />
          <MetricCard label="Disponível" value={formatCurrency(stats.total_available)} icon={<TrendingUp className="h-5 w-5 text-emerald-500" />} accent="text-emerald-600 dark:text-emerald-400" />
          <MetricCard label="Reservado" value={formatCurrency(stats.total_reserved)} icon={<Lock className="h-5 w-5 text-amber-500" />} accent="text-amber-600 dark:text-amber-400" />
          <MetricCard label="Bloqueado" value={formatCurrency(stats.total_blocked)} icon={<Ban className="h-5 w-5 text-destructive" />} accent="text-destructive" />
          <MetricCard label="Pendente" value={formatCurrency(stats.total_pending)} icon={<Clock className="h-5 w-5 text-muted-foreground" />} />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <MetricCard label="Crédito Total" value={formatCurrency(stats.total_credit_limit)} icon={<CreditCard className="h-5 w-5 text-primary" />} sub={`${creditUsagePercent}% utilizado`} />
          <MetricCard label="Antecipado" value={formatCurrency(stats.total_advanced)} icon={<Zap className="h-5 w-5 text-emerald-500" />} sub={`${stats.pending_advances} pendentes`} />
          <MetricCard label="Saques Pendentes" value={String(stats.pending_payouts)} icon={<TrendingDown className="h-5 w-5 text-amber-500" />} accent="text-amber-600 dark:text-amber-400" />
          <MetricCard label="Disputas Abertas" value={String(stats.open_disputes)} icon={<ShieldAlert className="h-5 w-5 text-destructive" />} accent="text-destructive" sub={formatCurrency(stats.dispute_value)} />
          <MetricCard label="Alertas de Risco" value={String(stats.risk_events_open)} icon={<AlertTriangle className="h-5 w-5 text-destructive" />} accent={stats.risk_events_open > 0 ? 'text-destructive' : undefined} />
        </div>

        {/* ─── TABS DE GESTÃO ─── */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="overview" className="text-xs gap-1"><BarChart3 className="h-3.5 w-3.5" /> Visão Geral</TabsTrigger>
            <TabsTrigger value="wallets" className="text-xs gap-1"><Wallet className="h-3.5 w-3.5" /> Carteiras</TabsTrigger>
            <TabsTrigger value="credit" className="text-xs gap-1"><CreditCard className="h-3.5 w-3.5" /> Crédito</TabsTrigger>
            <TabsTrigger value="advances" className="text-xs gap-1"><Zap className="h-3.5 w-3.5" /> Antecipações</TabsTrigger>
            <TabsTrigger value="payouts" className="text-xs gap-1"><TrendingDown className="h-3.5 w-3.5" /> Saques</TabsTrigger>
            <TabsTrigger value="disputes" className="text-xs gap-1"><ShieldAlert className="h-3.5 w-3.5" /> Disputas</TabsTrigger>
            <TabsTrigger value="reconciliation" className="text-xs gap-1"><Scale className="h-3.5 w-3.5" /> Reconciliação</TabsTrigger>
            <TabsTrigger value="risk" className="text-xs gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Risco</TabsTrigger>
            <TabsTrigger value="audit" className="text-xs gap-1"><FileText className="h-3.5 w-3.5" /> Auditoria</TabsTrigger>
          </TabsList>

          {/* ── VISÃO GERAL ── */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary" /> Crédito Consolidado</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Limite Total</span>
                    <span className="font-bold">{formatCurrency(stats.total_credit_limit)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Utilizado</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{formatCurrency(stats.total_credit_used)}</span>
                  </div>
                  <Progress value={creditUsagePercent} className="h-2" />
                  <p className="text-[11px] text-muted-foreground text-right">{creditUsagePercent}% utilizado</p>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Zap className="h-4 w-4 text-emerald-500" /> Antecipações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Antecipado</span>
                    <span className="font-bold">{formatCurrency(stats.total_advanced)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Pendentes</span>
                    <span className="font-bold text-amber-600 dark:text-amber-400">{stats.pending_advances}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total operações</span>
                    <span className="font-medium">{advances.length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-destructive" /> Disputas & Risco</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Disputas Abertas</span>
                    <span className="font-bold text-destructive">{stats.open_disputes}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Valor Travado</span>
                    <span className="font-bold">{formatCurrency(stats.dispute_value)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Alertas de Risco</span>
                    <span className={`font-bold ${stats.risk_events_open > 0 ? 'text-destructive' : ''}`}>{stats.risk_events_open}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick actions */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setActiveTab('payouts')}>
                    <TrendingDown className="h-3.5 w-3.5" /> Revisar Saques ({stats.pending_payouts})
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setActiveTab('disputes')}>
                    <ShieldAlert className="h-3.5 w-3.5" /> Ver Disputas ({stats.open_disputes})
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setActiveTab('risk')}>
                    <AlertTriangle className="h-3.5 w-3.5" /> Alertas de Risco ({stats.risk_events_open})
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setActiveTab('credit')}>
                    <CreditCard className="h-3.5 w-3.5" /> Gestão de Crédito
                  </Button>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => setActiveTab('reconciliation')}>
                    <Scale className="h-3.5 w-3.5" /> Reconciliação
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CARTEIRAS ── */}
          <TabsContent value="wallets" className="mt-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm" />
              </div>
              <Badge variant="outline" className="text-xs">{filteredWallets.length} carteiras</Badge>
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Usuário</TableHead>
                        <TableHead className="text-xs">Perfil</TableHead>
                        <TableHead className="text-xs">Disponível</TableHead>
                        <TableHead className="text-xs">Reservado</TableHead>
                        <TableHead className="text-xs">Pendente</TableHead>
                        <TableHead className="text-xs">Bloqueado</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWallets.length === 0 ? (
                        <TableRow><TableCell colSpan={8} className="text-center py-8 text-sm text-muted-foreground">Nenhuma carteira encontrada</TableCell></TableRow>
                      ) : filteredWallets.map((w: any) => (
                        <TableRow key={w.id}>
                          <TableCell className="text-sm font-medium">{w.profiles?.full_name || '—'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-[10px]">{w.wallet_type || w.profiles?.role || '—'}</Badge></TableCell>
                          <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(w.available_balance)}</TableCell>
                          <TableCell className="text-sm">{formatCurrency(w.reserved_balance)}</TableCell>
                          <TableCell className="text-sm">{formatCurrency(w.pending_balance)}</TableCell>
                          <TableCell className="text-sm">{formatCurrency(w.blocked_balance)}</TableCell>
                          <TableCell>{getBadge(w.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction('Ver carteira')}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction('Bloquear/Desbloquear carteira')}>
                                {w.status === 'blocked' ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction('Ver extrato')}>
                                <FileText className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── CRÉDITO ── */}
          <TabsContent value="credit" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Contas de Crédito" value={String(creditAccounts.length)} icon={<CreditCard className="h-4 w-4 text-primary" />} />
              <MetricCard label="Aguardando Aprovação" value={String(creditAccounts.filter((c: any) => c.status === 'pending_approval').length)} icon={<Clock className="h-4 w-4 text-amber-500" />} />
              <MetricCard label="Limite Total" value={formatCurrency(stats.total_credit_limit)} icon={<DollarSign className="h-4 w-4 text-primary" />} />
              <MetricCard label="Utilização" value={`${creditUsagePercent}%`} icon={<Percent className="h-4 w-4 text-amber-500" />} />
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : creditAccounts.length === 0 ? (
                  <EmptyTable icon={<CreditCard className="h-8 w-8 text-muted-foreground/40" />} text="Nenhuma conta de crédito" />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Usuário</TableHead>
                        <TableHead className="text-xs">Limite</TableHead>
                        <TableHead className="text-xs">Usado</TableHead>
                        <TableHead className="text-xs">Disponível</TableHead>
                        <TableHead className="text-xs">Utilização</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {creditAccounts.map((c: any) => {
                        const usage = c.credit_limit > 0 ? Math.round((c.used_amount / c.credit_limit) * 100) : 0;
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="text-sm font-medium">{c.profiles?.full_name || '—'}</TableCell>
                            <TableCell className="text-sm font-semibold">{formatCurrency(c.credit_limit)}</TableCell>
                            <TableCell className="text-sm text-amber-600 dark:text-amber-400">{formatCurrency(c.used_amount)}</TableCell>
                            <TableCell className="text-sm text-emerald-600 dark:text-emerald-400">{formatCurrency(c.available_limit)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={usage} className="h-1.5 w-16" />
                                <span className="text-[11px] text-muted-foreground">{usage}%</span>
                              </div>
                            </TableCell>
                            <TableCell>{getBadge(c.status)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {c.status === 'pending_approval' && (
                                  <>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-emerald-600" onClick={() => handleAction('Aprovar crédito')}>
                                      <CheckCircle2 className="h-3 w-3" /> Aprovar
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-destructive" onClick={() => handleAction('Negar crédito')}>
                                      <XCircle className="h-3 w-3" /> Negar
                                    </Button>
                                  </>
                                )}
                                {c.status === 'active' && (
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1" onClick={() => handleAction('Bloquear crédito')}>
                                    <Lock className="h-3 w-3" /> Bloquear
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction('Ver histórico crédito')}>
                                  <History className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── ANTECIPAÇÕES ── */}
          <TabsContent value="advances" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Total Antecipado" value={formatCurrency(stats.total_advanced)} icon={<Zap className="h-4 w-4 text-emerald-500" />} />
              <MetricCard label="Pendentes" value={String(stats.pending_advances)} icon={<Clock className="h-4 w-4 text-amber-500" />} />
              <MetricCard label="Ativas" value={String(advances.filter((a: any) => a.status === 'disbursed').length)} icon={<Activity className="h-4 w-4 text-primary" />} />
              <MetricCard label="Quitadas" value={String(advances.filter((a: any) => a.status === 'settled').length)} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : advances.length === 0 ? (
                  <EmptyTable icon={<Zap className="h-8 w-8 text-muted-foreground/40" />} text="Nenhuma antecipação registrada" />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Solicitado</TableHead>
                        <TableHead className="text-xs">Taxa</TableHead>
                        <TableHead className="text-xs">Líquido</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advances.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs text-muted-foreground">{a.created_at ? format(new Date(a.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
                          <TableCell className="text-sm font-medium">{formatCurrency(a.total_requested)}</TableCell>
                          <TableCell className="text-sm text-amber-600 dark:text-amber-400">{formatCurrency(a.fee_amount)}</TableCell>
                          <TableCell className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(a.net_amount)}</TableCell>
                          <TableCell>{getBadge(a.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {a.status === 'pending' && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-emerald-600" onClick={() => handleAction('Aprovar antecipação')}>
                                    <CheckCircle2 className="h-3 w-3" /> Aprovar
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-destructive" onClick={() => handleAction('Negar antecipação')}>
                                    <XCircle className="h-3 w-3" /> Negar
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction('Ver recebíveis')}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── SAQUES PIX ── */}
          <TabsContent value="payouts" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Pendentes" value={String(stats.pending_payouts)} icon={<Clock className="h-4 w-4 text-amber-500" />} accent="text-amber-600 dark:text-amber-400" />
              <MetricCard label="Concluídos" value={String(payouts.filter((p: any) => p.status === 'completed').length)} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
              <MetricCard label="Bloqueados" value={String(payouts.filter((p: any) => p.status === 'blocked').length)} icon={<Ban className="h-4 w-4 text-destructive" />} />
              <MetricCard label="Total Sacado" value={formatCurrency(stats.total_withdrawals)} icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} />
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : payouts.length === 0 ? (
                  <EmptyTable icon={<TrendingDown className="h-8 w-8 text-muted-foreground/40" />} text="Nenhum saque registrado" />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Usuário</TableHead>
                        <TableHead className="text-xs">Valor</TableHead>
                        <TableHead className="text-xs">Chave Pix</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payouts.map((p: any) => (
                        <TableRow key={p.id}>
                          <TableCell className="text-xs text-muted-foreground">{p.created_at ? format(new Date(p.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
                          <TableCell className="text-sm font-medium">{p.wallets?.profiles?.full_name || '—'}</TableCell>
                          <TableCell className="text-sm font-semibold">{formatCurrency(p.amount)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{p.pix_key || '—'}</TableCell>
                          <TableCell>{getBadge(p.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {(p.status === 'pending_review' || p.status === 'pending') && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-emerald-600" onClick={() => handleAction('Aprovar saque')}>
                                    <CheckCircle2 className="h-3 w-3" /> Aprovar
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-destructive" onClick={() => handleAction('Bloquear saque')}>
                                    <Ban className="h-3 w-3" /> Bloquear
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction('Ver detalhes saque')}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── DISPUTAS ── */}
          <TabsContent value="disputes" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Abertas" value={String(disputes.filter((d: any) => d.status === 'open').length)} icon={<ShieldAlert className="h-4 w-4 text-destructive" />} accent="text-destructive" />
              <MetricCard label="Em Análise" value={String(disputes.filter((d: any) => d.status === 'under_review').length)} icon={<Search className="h-4 w-4 text-amber-500" />} />
              <MetricCard label="Resolvidas" value={String(disputes.filter((d: any) => d.status === 'resolved').length)} icon={<CheckCircle2 className="h-4 w-4 text-emerald-500" />} />
              <MetricCard label="Valor Travado" value={formatCurrency(stats.dispute_value)} icon={<Lock className="h-4 w-4 text-destructive" />} accent="text-destructive" />
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : disputes.length === 0 ? (
                  <EmptyTable icon={<ShieldAlert className="h-8 w-8 text-muted-foreground/40" />} text="Nenhuma disputa registrada" />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Valor</TableHead>
                        <TableHead className="text-xs">Motivo</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {disputes.map((d: any) => (
                        <TableRow key={d.id}>
                          <TableCell className="text-xs text-muted-foreground">{d.created_at ? format(new Date(d.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
                          <TableCell className="text-sm">{d.dispute_type}</TableCell>
                          <TableCell className="text-sm font-semibold">{formatCurrency(d.amount)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]">{d.reason || '—'}</TableCell>
                          <TableCell>{getBadge(d.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {(d.status === 'open' || d.status === 'under_review') && (
                                <>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-emerald-600" onClick={() => handleAction('Resolver disputa')}>
                                    <CheckCircle2 className="h-3 w-3" /> Resolver
                                  </Button>
                                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1" onClick={() => handleAction('Bloquear valor')}>
                                    <Lock className="h-3 w-3" /> Bloquear
                                  </Button>
                                </>
                              )}
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction('Ver evidências')}>
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RECONCILIAÇÃO ── */}
          <TabsContent value="reconciliation" className="mt-4 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-sm flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> Rodadas de Reconciliação</CardTitle>
                    <CardDescription className="text-xs">Verificação de consistência entre ledger, saldos e transações</CardDescription>
                  </div>
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={() => handleAction('Reprocessar reconciliação')}>
                    <RefreshCw className="h-3.5 w-3.5" /> Reprocessar
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loading ? <div className="py-8 flex justify-center"><AppSpinner /></div> : reconciliation.length === 0 ? (
                  <EmptyTable icon={<Scale className="h-8 w-8 text-muted-foreground/40" />} text="Nenhuma rodada de reconciliação executada" />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Registros</TableHead>
                        <TableHead className="text-xs">Divergências</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reconciliation.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs text-muted-foreground">{r.created_at ? format(new Date(r.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
                          <TableCell className="text-sm">{r.run_type || 'full'}</TableCell>
                          <TableCell className="text-sm">{r.records_checked || 0}</TableCell>
                          <TableCell className={`text-sm font-medium ${(r.discrepancies_found || 0) > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>{r.discrepancies_found || 0}</TableCell>
                          <TableCell>{getBadge(r.status || 'completed')}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction('Ver divergências')}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── RISCO ── */}
          <TabsContent value="risk" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <MetricCard label="Novos" value={String(riskEvents.filter((r: any) => r.status === 'new').length)} icon={<Flag className="h-4 w-4 text-destructive" />} accent="text-destructive" />
              <MetricCard label="Em Revisão" value={String(riskEvents.filter((r: any) => r.status === 'under_review').length)} icon={<Search className="h-4 w-4 text-amber-500" />} />
              <MetricCard label="Críticos" value={String(riskEvents.filter((r: any) => r.severity === 'critical').length)} icon={<AlertTriangle className="h-4 w-4 text-destructive" />} accent="text-destructive" />
              <MetricCard label="Total Eventos" value={String(riskEvents.length)} icon={<Activity className="h-4 w-4 text-muted-foreground" />} />
            </div>

            <Card className="shadow-sm overflow-hidden">
              <CardContent className="p-0">
                {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : riskEvents.length === 0 ? (
                  <EmptyTable icon={<Shield className="h-8 w-8 text-muted-foreground/40" />} text="Nenhum evento de risco" />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Usuário</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                        <TableHead className="text-xs">Severidade</TableHead>
                        <TableHead className="text-xs">Detalhes</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {riskEvents.map((r: any) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs text-muted-foreground">{r.created_at ? format(new Date(r.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
                          <TableCell className="text-sm font-medium">{r.profiles?.full_name || '—'}</TableCell>
                          <TableCell className="text-sm">{r.event_type}</TableCell>
                          <TableCell>
                            <Badge variant={r.severity === 'critical' ? 'destructive' : r.severity === 'high' ? 'secondary' : 'outline'} className="text-[10px]">
                              {r.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">{r.description || '—'}</TableCell>
                          <TableCell>{getBadge(r.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1" onClick={() => handleAction('Marcar revisão')}>
                                <Flag className="h-3 w-3" /> Revisar
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px] gap-1 text-destructive" onClick={() => handleAction('Bloquear usuário')}>
                                <Ban className="h-3 w-3" /> Bloquear
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── AUDITORIA ── */}
          <TabsContent value="audit" className="mt-4 space-y-4">
            <Card className="shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-muted-foreground" /> Logs de Auditoria Financeira</CardTitle>
                <CardDescription className="text-xs">Registro completo de ações administrativas com efeito financeiro</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : auditLogs.length === 0 ? (
                  <EmptyTable icon={<FileText className="h-8 w-8 text-muted-foreground/40" />} text="Nenhum log de auditoria" />
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Ação</TableHead>
                        <TableHead className="text-xs">Tipo Alvo</TableHead>
                        <TableHead className="text-xs">ID Alvo</TableHead>
                        <TableHead className="text-xs">Admin</TableHead>
                        <TableHead className="text-xs">Detalhes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((l: any) => (
                        <TableRow key={l.id}>
                          <TableCell className="text-xs text-muted-foreground">{l.created_at ? format(new Date(l.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
                          <TableCell className="text-sm font-medium">{l.action}</TableCell>
                          <TableCell className="text-xs">{l.target_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[100px]">{l.target_id || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono truncate max-w-[100px]">{l.admin_id?.slice(0, 8) || '—'}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleAction('Ver detalhes do log')}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminFinancial;
