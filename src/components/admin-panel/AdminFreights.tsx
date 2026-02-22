import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { supabase } from '@/integrations/supabase/client';
import { Search, Truck, Menu, MapPin, DollarSign, Calendar, RefreshCw, AlertTriangle, Eye } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAdminApi } from '@/hooks/useAdminApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendente', className: 'bg-warning/15 text-warning border-warning/30' },
  ACCEPTED: { label: 'Aceito', className: 'bg-primary/15 text-primary border-primary/30' },
  IN_TRANSIT: { label: 'Em Trânsito', className: 'bg-accent/15 text-accent border-accent/30' },
  DELIVERED: { label: 'Entregue', className: 'bg-success/15 text-success border-success/30' },
  CONFIRMED: { label: 'Confirmado', className: 'bg-success/15 text-success border-success/30' },
  CANCELLED: { label: 'Cancelado', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  EXPIRED: { label: 'Expirado', className: 'bg-muted text-muted-foreground border-border' },
};

const AdminFreights = () => {
  const { callApi } = useAdminApi();
  const [freights, setFreights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [stats, setStats] = useState({ total: 0, active: 0, transit: 0, delivered: 0 });

  const fetchFreights = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const { data, error } = await callApi<any>('freights', {
        params: {
          status: statusFilter,
          q: search,
        },
      });

      if (data?.data) {
        setFreights(data.data);
        setStats(data.stats || { total: 0, active: 0, transit: 0, delivered: 0 });
      } else {
        setFreights([]);
      }
    } catch (err) {
      console.error('Error fetching freights:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { fetchFreights(); }, [fetchFreights]);

  const handleSearch = () => {
    setSearch(searchInput);
  };

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
                  placeholder="Origem, destino ou ID..."
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="ACCEPTED">Aceito</SelectItem>
                  <SelectItem value="IN_TRANSIT">Em Trânsito</SelectItem>
                  <SelectItem value="DELIVERED">Entregue</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmado</SelectItem>
                  <SelectItem value="CANCELLED">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Info Banner */}
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-foreground">Módulo de Fretes em construção</p>
            <p className="text-xs text-muted-foreground mt-1">
              A integração completa com a API de fretes está sendo desenvolvida. Em breve você poderá visualizar detalhes completos,
              histórico de tracking, documentos fiscais e indicadores de risco de cada frete.
            </p>
          </div>
        </div>

        {/* Table */}
        <Card className="shadow-sm border-border/60">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16"><AppSpinner /></div>
            ) : freights.length > 0 ? (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Origem → Destino</TableHead>
                    <TableHead>Tipo Carga</TableHead>
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
                      <TableRow key={freight.id} className="hover:bg-muted/30">
                        <TableCell className="text-xs font-mono text-muted-foreground">{freight.id?.slice(0, 8)}...</TableCell>
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-success" />
                            <span>{freight.origin_city || '—'}</span>
                            <span className="text-muted-foreground">→</span>
                            <MapPin className="h-3 w-3 text-destructive" />
                            <span>{freight.destination_city || '—'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{freight.cargo_type || '—'}</TableCell>
                        <TableCell className="text-sm font-medium">
                          {freight.price ? `R$ ${Number(freight.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
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
            ) : (
              <div className="text-center py-16">
                <Truck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhum frete encontrado</p>
                <p className="text-xs text-muted-foreground mt-1">O endpoint de listagem de fretes será implementado em breve</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

function MiniStat({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const bgMap: Record<string, string> = {
    primary: 'bg-primary/10',
    accent: 'bg-accent/10',
    warning: 'bg-warning/10',
    success: 'bg-success/10',
  };
  return (
    <Card className="shadow-sm border-border/60">
      <CardContent className="pt-4 pb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${bgMap[color]}`}>
            {icon}
          </div>
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
