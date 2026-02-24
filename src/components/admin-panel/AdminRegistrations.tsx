import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminApi } from '@/hooks/useAdminApi';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Search, Eye, ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Pendente', className: 'bg-warning/15 text-warning hover:bg-warning/15' },
  APPROVED: { label: 'Aprovado', className: 'bg-success/15 text-success hover:bg-success/15' },
  REJECTED: { label: 'Reprovado', className: 'bg-destructive/15 text-destructive hover:bg-destructive/15' },
  NEEDS_FIX: { label: 'Correção', className: 'bg-orange-100 text-orange-800 hover:bg-orange-100' },
  BLOCKED: { label: 'Bloqueado', className: 'bg-destructive/20 text-destructive hover:bg-destructive/20' },
};

const ROLE_LABELS: Record<string, string> = {
  MOTORISTA: 'Motorista',
  MOTORISTA_AFILIADO: 'Mot. Afiliado',
  PRODUTOR: 'Produtor',
  PRESTADOR_SERVICOS: 'Prestador',
  TRANSPORTADORA: 'Transportadora',
  ADMIN: 'Admin',
};

interface Registration {
  id: string;
  full_name: string;
  phone: string;
  cpf_cnpj: string;
  role: string;
  status: string;
  created_at: string;
  base_city_name?: string;
  base_state?: string;
}

const AdminRegistrations = () => {
  const { callApi } = useAdminApi();
  const navigate = useNavigate();
  const [data, setData] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: result, error } = await callApi<any>('registrations', {
      params: {
        status: statusFilter,
        role: roleFilter,
        q: search,
        page: String(page),
      },
    });
    if (result) {
      setData(result.data || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 1);
    }
    setLoading(false);
  }, [statusFilter, roleFilter, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-muted rounded-md">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <h1 className="text-xl font-semibold text-foreground">Cadastros</h1>
        <Badge variant="outline" className="ml-2">{total} registros</Badge>
      </header>

      <div className="p-6 space-y-4">
        {/* Filters */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Buscar</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Nome, CPF/CNPJ ou telefone"
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
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Status</label>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="PENDING">Pendente</SelectItem>
                  <SelectItem value="NEEDS_FIX">Correção</SelectItem>
                  <SelectItem value="APPROVED">Aprovado</SelectItem>
                  <SelectItem value="REJECTED">Reprovado</SelectItem>
                  <SelectItem value="BLOCKED">Bloqueado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-1 block">Tipo</label>
              <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="MOTORISTA">Motorista</SelectItem>
                  <SelectItem value="PRODUTOR">Produtor</SelectItem>
                  <SelectItem value="PRESTADOR_SERVICOS">Prestador</SelectItem>
                  <SelectItem value="TRANSPORTADORA">Transportadora</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12"><AppSpinner /></div>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((reg) => {
                    const statusInfo = STATUS_BADGES[reg.status] || { label: reg.status, className: '' };
                    return (
                      <TableRow
                        key={reg.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => navigate(`/admin-v2/cadastros/${reg.id}`)}
                      >
                        <TableCell className="font-medium">{reg.full_name || '—'}</TableCell>
                        <TableCell className="text-sm">{reg.cpf_cnpj || '—'}</TableCell>
                        <TableCell className="text-sm">{reg.phone || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {ROLE_LABELS[reg.role] || reg.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {reg.base_city_name ? `${reg.base_city_name}/${reg.base_state}` : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusInfo.className}>{statusInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(reg.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum cadastro encontrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Anterior
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminRegistrations;
