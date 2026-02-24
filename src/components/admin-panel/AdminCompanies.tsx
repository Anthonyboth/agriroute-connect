import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Building2, Search, Menu, RefreshCw, ChevronLeft, ChevronRight, CheckCircle, Users } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAdminApi } from '@/hooks/useAdminApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const AdminCompanies = () => {
  const { callApi } = useAdminApi();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({ total: 0, verified: 0 });

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const { data } = await callApi<any>('companies', {
      params: { q: search, page: String(page) },
    });
    if (data) {
      setCompanies(data.data || []);
      setStats(data.stats || { total: 0, verified: 0 });
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
            <h1 className="text-xl font-semibold text-foreground">Transportadoras</h1>
            <p className="text-sm text-muted-foreground">Empresas de transporte cadastradas</p>
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
                <div className="p-2 rounded-lg bg-primary/10"><Building2 className="h-4 w-4 text-primary" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Total de Transportadoras</p>
                  <p className="text-xl font-bold text-foreground">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-border/60">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-4 w-4 text-success" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">Verificadas</p>
                  <p className="text-xl font-bold text-foreground">{stats.verified}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="p-4 shadow-sm border-border/60">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar nome ou CNPJ..."
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
            ) : companies.length > 0 ? (
              <>
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Motoristas</TableHead>
                      <TableHead>Veículos</TableHead>
                      <TableHead>Verificada</TableHead>
                      <TableHead>Cadastro</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {companies.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-sm truncate max-w-[150px]">{c.company_name || '—'}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{c.company_cnpj || '—'}</TableCell>
                        <TableCell className="text-sm">{c.company_type || '—'}</TableCell>
                        <TableCell className="text-sm truncate max-w-[120px]">{c.owner_name || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{[c.city, c.state].filter(Boolean).join('/') || '—'}</TableCell>
                        <TableCell className="text-sm text-center">{c.total_drivers ?? '—'}</TableCell>
                        <TableCell className="text-sm text-center">{c.total_vehicles ?? '—'}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${c.is_verified ? 'bg-success/15 text-success border-success/30' : 'bg-warning/15 text-warning border-warning/30'}`}>
                            {c.is_verified ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.created_at ? format(new Date(c.created_at), 'dd/MM/yy', { locale: ptBR }) : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">{total} transportadoras</p>
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
                <Building2 className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma transportadora encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminCompanies;
