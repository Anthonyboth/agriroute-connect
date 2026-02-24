import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { DollarSign, TrendingUp, TrendingDown, Clock, Menu, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAdminApi } from '@/hooks/useAdminApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TYPE_LABELS: Record<string, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  payout: 'Saque',
  refund: 'Reembolso',
  commission: 'Comissão',
  freight_payment: 'Pagamento Frete',
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  completed: { label: 'Concluído', className: 'bg-success/15 text-success border-success/30' },
  pending: { label: 'Pendente', className: 'bg-warning/15 text-warning border-warning/30' },
  failed: { label: 'Falhou', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  processing: { label: 'Processando', className: 'bg-primary/15 text-primary border-primary/30' },
};

const AdminFinancial = () => {
  const { callApi } = useAdminApi();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total_credits: 0, total_debits: 0, pending_payouts: 0 });

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await callApi<any>('financial', {
      params: { type: typeFilter, status: statusFilter, page: String(page) },
    });
    if (data) {
      setTransactions(data.data || []);
      setStats(data.stats || { total_credits: 0, total_debits: 0, pending_payouts: 0 });
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
    setRefreshing(false);
  }, [typeFilter, statusFilter, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatCurrency = (v: number) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-muted rounded-md"><Menu className="h-5 w-5" /></SidebarTrigger>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Financeiro</h1>
            <p className="text-sm text-muted-foreground">Transações e pagamentos da plataforma</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </header>

      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><TrendingUp className="h-4 w-4 text-success" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Créditos</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(stats.total_credits)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><TrendingDown className="h-4 w-4 text-destructive" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Débitos</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(stats.total_debits)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-4 w-4 text-warning" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Saques Pendentes</p>
                  <p className="text-xl font-bold text-foreground">{stats.pending_payouts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-4 shadow-sm border-border/60">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Tipo</label>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="credit">Crédito</SelectItem>
                  <SelectItem value="debit">Débito</SelectItem>
                  <SelectItem value="payout">Saque</SelectItem>
                  <SelectItem value="commission">Comissão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="failed">Falhou</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16"><AppSpinner /></div>
            ) : transactions.length > 0 ? (
              <>
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t: any) => {
                      const statusInfo = STATUS_BADGES[t.status] || { label: t.status, className: '' };
                      const isPositive = t.amount >= 0;
                      return (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm text-muted-foreground">
                            {t.created_at ? format(new Date(t.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                          </TableCell>
                          <TableCell className="text-sm">{TYPE_LABELS[t.transaction_type] || t.transaction_type}</TableCell>
                          <TableCell className="text-sm truncate max-w-[120px]">{t.provider_name || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{t.description || '—'}</TableCell>
                          <TableCell className={`text-sm font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
                            {isPositive ? '+' : '-'}{formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell><Badge className={`text-xs ${statusInfo.className}`}>{statusInfo.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">{total} transações</p>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-16">
                <DollarSign className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma transação encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminFinancial;
