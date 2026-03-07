import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { DollarSign, TrendingUp, TrendingDown, Clock, Menu, RefreshCw, ChevronLeft, ChevronRight, Wallet, CreditCard, ShieldAlert, BarChart, FileText } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAdminApi } from '@/hooks/useAdminApi';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (v: number) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  completed: { label: 'Concluído', className: 'bg-success/15 text-success border-success/30' },
  pending: { label: 'Pendente', className: 'bg-warning/15 text-warning border-warning/30' },
  failed: { label: 'Falhou', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  processing: { label: 'Processando', className: 'bg-primary/15 text-primary border-primary/30' },
  active: { label: 'Ativo', className: 'bg-success/15 text-success border-success/30' },
  blocked: { label: 'Bloqueado', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  under_review: { label: 'Em Análise', className: 'bg-warning/15 text-warning border-warning/30' },
  open: { label: 'Aberta', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  resolved: { label: 'Resolvida', className: 'bg-success/15 text-success border-success/30' },
  pending_review: { label: 'Pendente', className: 'bg-warning/15 text-warning border-warning/30' },
  approved: { label: 'Aprovado', className: 'bg-success/15 text-success border-success/30' },
  rejected: { label: 'Rejeitado', className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const AdminFinancial = () => {
  const { callApi } = useAdminApi();
  const [activeSubTab, setActiveSubTab] = useState('overview');
  const [wallets, setWallets] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [creditAccounts, setCreditAccounts] = useState<any[]>([]);
  const [riskEvents, setRiskEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_wallets: 0, total_available: 0, total_pending: 0,
    total_reserved: 0, total_blocked: 0, total_credit_limit: 0,
    total_credit_used: 0, pending_payouts: 0, open_disputes: 0,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Use service_role via admin API for cross-user queries
      const [walletsRes, payoutsRes, disputesRes, creditRes, riskRes] = await Promise.all([
        supabase.from('wallets').select('*, profiles:profile_id(full_name, role)').limit(100),
        supabase.from('payout_orders').select('*, wallets:wallet_id(profile_id, profiles:profile_id(full_name))').order('created_at', { ascending: false }).limit(50),
        supabase.from('wallet_disputes').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('credit_accounts').select('*, profiles:profile_id(full_name)').limit(50),
        supabase.from('wallet_risk_events').select('*, profiles:profile_id(full_name)').order('created_at', { ascending: false }).limit(50),
      ]);

      const w = walletsRes.data || [];
      setWallets(w);
      setPayouts(payoutsRes.data || []);
      setDisputes(disputesRes.data || []);
      setCreditAccounts(creditRes.data || []);
      setRiskEvents(riskRes.data || []);

      setStats({
        total_wallets: w.length,
        total_available: w.reduce((s: number, x: any) => s + (x.available_balance || 0), 0),
        total_pending: w.reduce((s: number, x: any) => s + (x.pending_balance || 0), 0),
        total_reserved: w.reduce((s: number, x: any) => s + (x.reserved_balance || 0), 0),
        total_blocked: w.reduce((s: number, x: any) => s + (x.blocked_balance || 0), 0),
        total_credit_limit: (creditRes.data || []).reduce((s: number, x: any) => s + (x.credit_limit || 0), 0),
        total_credit_used: (creditRes.data || []).reduce((s: number, x: any) => s + (x.used_amount || 0), 0),
        pending_payouts: (payoutsRes.data || []).filter((p: any) => p.status === 'pending_review').length,
        open_disputes: (disputesRes.data || []).filter((d: any) => d.status === 'open' || d.status === 'under_review').length,
      });
    } catch (e) {
      console.error('Admin financial fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getBadge = (status: string) => {
    const info = STATUS_BADGES[status] || { label: status, className: '' };
    return <Badge className={`text-xs ${info.className}`}>{info.label}</Badge>;
  };

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-muted rounded-md"><Menu className="h-5 w-5" /></SidebarTrigger>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Financeiro — Carteira AgriRoute</h1>
            <p className="text-sm text-muted-foreground">Gestão completa de carteiras, crédito, saques, disputas e risco</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </header>

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[
            { label: 'Carteiras', value: stats.total_wallets, icon: Wallet, color: 'text-primary' },
            { label: 'Saldo Disponível', value: formatCurrency(stats.total_available), icon: TrendingUp, color: 'text-success' },
            { label: 'Saldo Reservado', value: formatCurrency(stats.total_reserved), icon: Clock, color: 'text-warning' },
            { label: 'Saques Pendentes', value: stats.pending_payouts, icon: TrendingDown, color: 'text-destructive' },
            { label: 'Disputas Abertas', value: stats.open_disputes, icon: ShieldAlert, color: 'text-destructive' },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.label} className="shadow-sm border-border/60">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${card.color}`} />
                    <div>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                      <p className="text-lg font-bold text-foreground">{card.value}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Sub-tabs */}
        <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
          <TabsList className="flex flex-wrap gap-1">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="wallets">Carteiras</TabsTrigger>
            <TabsTrigger value="payouts">Saques</TabsTrigger>
            <TabsTrigger value="credit">Crédito</TabsTrigger>
            <TabsTrigger value="disputes">Disputas</TabsTrigger>
            <TabsTrigger value="risk">Risco</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Total em Crédito</p><p className="text-xl font-bold">{formatCurrency(stats.total_credit_limit)}</p><p className="text-xs text-muted-foreground">Usado: {formatCurrency(stats.total_credit_used)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saldo Pendente</p><p className="text-xl font-bold text-warning">{formatCurrency(stats.total_pending)}</p></CardContent></Card>
              <Card><CardContent className="pt-4"><p className="text-xs text-muted-foreground">Saldo Bloqueado</p><p className="text-xl font-bold text-destructive">{formatCurrency(stats.total_blocked)}</p></CardContent></Card>
            </div>
          </TabsContent>

          {/* WALLETS */}
          <TabsContent value="wallets" className="mt-4">
            <Card className="shadow-sm"><CardContent className="p-0">
              {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : (
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow>
                    <TableHead>Usuário</TableHead><TableHead>Tipo</TableHead><TableHead>Disponível</TableHead>
                    <TableHead>Pendente</TableHead><TableHead>Reservado</TableHead><TableHead>Bloqueado</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {wallets.map((w: any) => (
                      <TableRow key={w.id}>
                        <TableCell className="text-sm">{w.profiles?.full_name || '—'}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{w.wallet_type}</Badge></TableCell>
                        <TableCell className="text-sm font-medium text-success">{formatCurrency(w.available_balance)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(w.pending_balance)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(w.reserved_balance)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(w.blocked_balance)}</TableCell>
                        <TableCell>{getBadge(w.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* PAYOUTS */}
          <TabsContent value="payouts" className="mt-4">
            <Card className="shadow-sm"><CardContent className="p-0">
              {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : payouts.length === 0 ? (
                <div className="text-center py-16"><TrendingDown className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhum saque registrado</p></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow>
                    <TableHead>Data</TableHead><TableHead>Usuário</TableHead><TableHead>Valor</TableHead>
                    <TableHead>Chave Pix</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {payouts.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm text-muted-foreground">{p.created_at ? format(new Date(p.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
                        <TableCell className="text-sm">{p.wallets?.profiles?.full_name || '—'}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(p.amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[120px]">{p.pix_key}</TableCell>
                        <TableCell>{getBadge(p.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* CREDIT */}
          <TabsContent value="credit" className="mt-4">
            <Card className="shadow-sm"><CardContent className="p-0">
              {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : creditAccounts.length === 0 ? (
                <div className="text-center py-16"><CreditCard className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhuma conta de crédito</p></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow>
                    <TableHead>Usuário</TableHead><TableHead>Limite</TableHead><TableHead>Usado</TableHead>
                    <TableHead>Disponível</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {creditAccounts.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-sm">{c.profiles?.full_name || '—'}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(c.credit_limit)}</TableCell>
                        <TableCell className="text-sm text-warning">{formatCurrency(c.used_amount)}</TableCell>
                        <TableCell className="text-sm text-success">{formatCurrency(c.available_limit)}</TableCell>
                        <TableCell>{getBadge(c.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* DISPUTES */}
          <TabsContent value="disputes" className="mt-4">
            <Card className="shadow-sm"><CardContent className="p-0">
              {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : disputes.length === 0 ? (
                <div className="text-center py-16"><ShieldAlert className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhuma disputa</p></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow>
                    <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Valor</TableHead>
                    <TableHead>Motivo</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {disputes.map((d: any) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm text-muted-foreground">{d.created_at ? format(new Date(d.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
                        <TableCell className="text-sm">{d.dispute_type}</TableCell>
                        <TableCell className="text-sm font-medium">{formatCurrency(d.amount)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{d.reason || '—'}</TableCell>
                        <TableCell>{getBadge(d.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          {/* RISK */}
          <TabsContent value="risk" className="mt-4">
            <Card className="shadow-sm"><CardContent className="p-0">
              {loading ? <div className="py-16 flex justify-center"><AppSpinner /></div> : riskEvents.length === 0 ? (
                <div className="text-center py-16"><ShieldAlert className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" /><p className="text-sm text-muted-foreground">Nenhum evento de risco</p></div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50"><TableRow>
                    <TableHead>Data</TableHead><TableHead>Usuário</TableHead><TableHead>Tipo</TableHead>
                    <TableHead>Severidade</TableHead><TableHead>Status</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {riskEvents.map((r: any) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-sm text-muted-foreground">{r.created_at ? format(new Date(r.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}</TableCell>
                        <TableCell className="text-sm">{r.profiles?.full_name || '—'}</TableCell>
                        <TableCell className="text-sm">{r.event_type}</TableCell>
                        <TableCell><Badge className={`text-xs ${r.severity === 'critical' ? 'bg-destructive/15 text-destructive' : r.severity === 'high' ? 'bg-warning/15 text-warning' : 'bg-muted'}`}>{r.severity}</Badge></TableCell>
                        <TableCell>{getBadge(r.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminFinancial;
