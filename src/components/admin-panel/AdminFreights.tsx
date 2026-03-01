import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Search, Truck, Menu, MapPin, DollarSign, Calendar, RefreshCw, Eye, ChevronLeft, ChevronRight, Hash } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAdminApi } from '@/hooks/useAdminApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  NEW: { label: 'Novo', className: 'bg-muted text-muted-foreground border-border' },
  APPROVED: { label: 'Aprovado', className: 'bg-primary/15 text-primary border-primary/30' },
  OPEN: { label: 'Aberto', className: 'bg-primary/15 text-primary border-primary/30' },
  ACCEPTED: { label: 'Aceito', className: 'bg-accent/15 text-accent border-accent/30' },
  LOADING: { label: 'Carregando', className: 'bg-accent/15 text-accent border-accent/30' },
  LOADED: { label: 'Carregado', className: 'bg-accent/15 text-accent border-accent/30' },
  IN_TRANSIT: { label: 'Em Trânsito', className: 'bg-warning/15 text-warning border-warning/30' },
  DELIVERED: { label: 'Entregue', className: 'bg-success/15 text-success border-success/30' },
  DELIVERED_PENDING_CONFIRMATION: { label: 'Entregue (Pend.)', className: 'bg-success/15 text-success border-success/30' },
  COMPLETED: { label: 'Concluído', className: 'bg-success/15 text-success border-success/30' },
  CANCELLED: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  EXPIRED: { label: 'Expirado', className: 'bg-muted text-muted-foreground border-border' },
};

const AdminFreights = () => {
  const { callApi } = useAdminApi();
  const navigate = useNavigate();
  const [freights, setFreights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, active: 0, transit: 0, delivered: 0 });

  const fetchFreights = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    const { data, error } = await callApi<any>('freights', {
      params: {
        status: statusFilter,
        q: search,
        page: String(page),
        pageSize: '20',
      },
    });

    if (data) {
      setFreights(data.data || []);
      setStats(data.stats || { total: 0, active: 0, transit: 0, delivered: 0 });
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } else {
      setFreights([]);
    }
    setLoading(false);
    setRefreshing(false);
  }, [statusFilter, search, page]);

  useEffect(() => { fetchFreights(); }, [fetchFreights]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-muted rounded-md">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Gestão de Fretes</h1>
            <p className="text-sm text-muted-foreground">Monitore todos os fretes da plataforma</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchFreights(true)} disabled={refreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </header>

      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat icon={<Truck className="h-4 w-4 text-primary" />} label="Total de Fretes" value={stats.total} color="primary" />
          <MiniStat icon={<Calendar className="h-4 w-4 text-accent" />} label="Ativos" value={stats.active} color="accent" />
          <MiniStat icon={<MapPin className="h-4 w-4 text-warning" />} label="Em Trânsito" value={stats.transit} color="warning" />
          <MiniStat icon={<DollarSign className="h-4 w-4 text-success" />} label="Entregues (7d)" value={stats.delivered} color="success" />
        </div>

        {/* Filters */}
        <Card className="p-4 shadow-sm border-border/60">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Buscar</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Origem, destino ou carga..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button size="icon" variant="outline" onClick={handleSearch}>
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="NEW">Novo</SelectItem>
                  <SelectItem value="OPEN">Aberto</SelectItem>
                  <SelectItem value="ACCEPTED">Aceito</SelectItem>
                  <SelectItem value="IN_TRANSIT">Em Trânsito</SelectItem>
                  <SelectItem value="DELIVERED">Entregue</SelectItem>
                  <SelectItem value="COMPLETED">Concluído</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16"><AppSpinner /></div>
            ) : freights.length > 0 ? (
              <>
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-[70px]">Ref</TableHead>
                      <TableHead>Origem → Destino</TableHead>
                      <TableHead>Carga</TableHead>
                      <TableHead>Produtor</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {freights.map((freight: any) => {
                      const statusInfo = STATUS_BADGES[freight.status] || { label: freight.status, className: '' };
                      return (
                        <TableRow
                          key={freight.id}
                          className="hover:bg-muted/30 cursor-pointer"
                          onClick={() => navigate(`/admin-v2/fretes/${freight.id}`)}
                        >
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {freight.reference_number ? `#${freight.reference_number}` : freight.id?.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-success flex-shrink-0" />
                              <span className="truncate max-w-[80px]">{freight.origin_city || '—'}/{freight.origin_state || ''}</span>
                              <span className="text-muted-foreground">→</span>
                              <MapPin className="h-3 w-3 text-destructive flex-shrink-0" />
                              <span className="truncate max-w-[80px]">{freight.destination_city || '—'}/{freight.destination_state || ''}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{freight.cargo_type || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground truncate max-w-[100px]">{freight.producer_name || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground truncate max-w-[100px]">{freight.driver_name || '—'}</TableCell>
                          <TableCell className="text-sm font-medium">
                            {freight.price ? `${freight.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} (admin)` : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge className={`text-xs ${statusInfo.className}`}>{statusInfo.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {freight.created_at ? format(new Date(freight.created_at), "dd/MM/yy", { locale: ptBR }) : '—'}
                          </TableCell>
                          <TableCell>
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">{total} fretes encontrados</p>
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
                <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum frete encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">Ajuste os filtros ou aguarde novos fretes serem criados</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const bgMap: Record<string, string> = { primary: 'bg-primary/10', accent: 'bg-accent/10', warning: 'bg-warning/10', success: 'bg-success/10' };
  return (
    <Card className="shadow-sm border-border/60">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${bgMap[color]}`}>{icon}</div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default AdminFreights;
