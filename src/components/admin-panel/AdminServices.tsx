import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Wrench, Search, Menu, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, XCircle, Clock } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAdminApi } from '@/hooks/useAdminApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-warning/15 text-warning border-warning/30' },
  accepted: { label: 'Aceito', className: 'bg-primary/15 text-primary border-primary/30' },
  in_progress: { label: 'Em Andamento', className: 'bg-accent/15 text-accent border-accent/30' },
  completed: { label: 'Concluído', className: 'bg-success/15 text-success border-success/30' },
  cancelled: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const AdminServices = () => {
  const { callApi } = useAdminApi();
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ open: 0, completed: 0, cancelled: 0 });

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await callApi<any>('services', {
      params: { status: statusFilter, q: search, page: String(page) },
    });
    if (data) {
      setServices(data.data || []);
      setStats(data.stats || { open: 0, completed: 0, cancelled: 0 });
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
    setRefreshing(false);
  }, [statusFilter, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  const formatCurrency = (v: number | null) => v ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—';

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-muted rounded-md"><Menu className="h-5 w-5" /></SidebarTrigger>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Serviços</h1>
            <p className="text-sm text-muted-foreground">Solicitações de serviço da plataforma</p>
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
                <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-4 w-4 text-warning" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Abertos</p>
                  <p className="text-xl font-bold text-foreground">{stats.open}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-4 w-4 text-success" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                  <p className="text-xl font-bold text-foreground">{stats.completed}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10"><XCircle className="h-4 w-4 text-destructive" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Cancelados</p>
                  <p className="text-xl font-bold text-foreground">{stats.cancelled}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-4 shadow-sm border-border/60">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Buscar</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Tipo de serviço ou endereço..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button size="icon" variant="outline" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="accepted">Aceito</SelectItem>
                  <SelectItem value="completed">Concluído</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16"><AppSpinner /></div>
            ) : services.length > 0 ? (
              <>
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Prestador</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Valor Est.</TableHead>
                      <TableHead>Valor Final</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {services.map((s: any) => {
                      const statusInfo = STATUS_BADGES[s.status] || { label: s.status, className: '' };
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-sm font-medium">{s.service_type || '—'}</TableCell>
                          <TableCell className="text-sm truncate max-w-[120px]">{s.client_name || '—'}</TableCell>
                          <TableCell className="text-sm truncate max-w-[120px]">{s.provider_name || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">{s.location_address || '—'}</TableCell>
                          <TableCell className="text-sm">{formatCurrency(s.estimated_price)}</TableCell>
                          <TableCell className="text-sm font-medium">{formatCurrency(s.final_price)}</TableCell>
                          <TableCell><Badge className={`text-xs ${statusInfo.className}`}>{statusInfo.label}</Badge></TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {s.created_at ? format(new Date(s.created_at), 'dd/MM/yy', { locale: ptBR }) : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">{total} serviços</p>
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
                <Wrench className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum serviço encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminServices;
