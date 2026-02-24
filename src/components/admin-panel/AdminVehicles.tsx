import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Truck, Search, Menu, RefreshCw, ChevronLeft, ChevronRight, Gauge, MapPin } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAdminApi } from '@/hooks/useAdminApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdminVehicles = () => {
  const { callApi } = useAdminApi();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, with_tracker: 0 });

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await callApi<any>('vehicles', {
      params: { q: search, page: String(page) },
    });
    if (data) {
      setVehicles(data.data || []);
      setStats(data.stats || { total: 0, with_tracker: 0 });
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
    setRefreshing(false);
  }, [search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => { setSearch(searchInput); setPage(1); };

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-muted rounded-md"><Menu className="h-5 w-5" /></SidebarTrigger>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Veículos</h1>
            <p className="text-sm text-muted-foreground">Todos os veículos cadastrados na plataforma</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => fetchData(true)} disabled={refreshing} className="gap-2">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
        </Button>
      </header>

      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10"><Truck className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Veículos</p>
                  <p className="text-xl font-bold text-foreground">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><MapPin className="h-4 w-4 text-success" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Com Rastreador</p>
                  <p className="text-xl font-bold text-foreground">{stats.with_tracker}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-4 shadow-sm border-border/60">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar placa, marca, modelo ou RNTRC..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="max-w-md"
            />
            <Button size="icon" variant="outline" onClick={handleSearch}><Search className="h-4 w-4" /></Button>
          </div>
        </Card>

        <Card className="shadow-sm border-border/60">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16"><AppSpinner /></div>
            ) : vehicles.length > 0 ? (
              <>
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Placa</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Marca/Modelo</TableHead>
                      <TableHead>Ano</TableHead>
                      <TableHead>Eixos</TableHead>
                      <TableHead>RNTRC</TableHead>
                      <TableHead>Motorista</TableHead>
                      <TableHead>Rastreador</TableHead>
                      <TableHead>Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v: any) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono font-medium text-sm">{v.license_plate || '—'}</TableCell>
                        <TableCell className="text-sm">{v.vehicle_type || '—'}</TableCell>
                        <TableCell className="text-sm">{[v.brand, v.model].filter(Boolean).join(' ') || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.year || '—'}</TableCell>
                        <TableCell className="text-sm text-center">{v.axle_count || '—'}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{v.antt_rntrc || '—'}</TableCell>
                        <TableCell className="text-sm truncate max-w-[120px]">{v.driver_name || '—'}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${v.has_tracker ? 'bg-success/15 text-success border-success/30' : 'bg-muted text-muted-foreground border-border'}`}>
                            {v.has_tracker ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {v.created_at ? format(new Date(v.created_at), 'dd/MM/yy', { locale: ptBR }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">{total} veículos</p>
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
                <p className="text-muted-foreground">Nenhum veículo encontrado</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminVehicles;
