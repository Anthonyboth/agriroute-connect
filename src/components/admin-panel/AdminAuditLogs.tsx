import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAdminApi } from '@/hooks/useAdminApi';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { ChevronLeft, ChevronRight, Menu } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACTION_BADGES: Record<string, { label: string; className: string }> = {
  APPROVE: { label: 'Aprovação', className: 'bg-green-100 text-green-800' },
  REJECT: { label: 'Reprovação', className: 'bg-red-100 text-red-800' },
  NEEDS_FIX: { label: 'Correção', className: 'bg-orange-100 text-orange-800' },
  NOTE: { label: 'Observação', className: 'bg-blue-100 text-blue-800' },
};

const AdminAuditLogs = () => {
  const { callApi } = useAdminApi();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('all');

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: result } = await callApi<any>('audit-logs', {
      params: { page: String(page), action: actionFilter },
    });
    if (result) {
      setData(result.data || []);
      setTotal(result.total || 0);
    }
    setLoading(false);
  }, [page, actionFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = Math.ceil(total / 30);

  return (
    <div className="flex-1">
      <header className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <SidebarTrigger className="p-2 hover:bg-gray-100 rounded-md">
          <Menu className="h-5 w-5" />
        </SidebarTrigger>
        <h1 className="text-xl font-semibold text-gray-800">Auditoria</h1>
        <Badge variant="outline">{total} registros</Badge>
      </header>

      <div className="p-6 space-y-4">
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div>
              <label className="text-sm font-medium text-gray-600 mb-1 block">Filtrar por ação</label>
              <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="APPROVE">Aprovações</SelectItem>
                  <SelectItem value="REJECT">Reprovações</SelectItem>
                  <SelectItem value="NEEDS_FIX">Correções</SelectItem>
                  <SelectItem value="NOTE">Observações</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12"><AppSpinner /></div>
            ) : (
              <Table>
                <TableHeader className="bg-gray-50">
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Admin</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Transição</TableHead>
                    <TableHead>Motivo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((log: any) => {
                    const actionInfo = ACTION_BADGES[log.action] || { label: log.action, className: '' };
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {format(new Date(log.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-sm">{log.admin?.full_name || log.admin?.email || '—'}</TableCell>
                        <TableCell>
                          <Badge className={actionInfo.className}>{actionInfo.label}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.profile?.full_name || '—'}
                          {log.profile?.role && (
                            <span className="text-xs text-muted-foreground ml-1">({log.profile.role})</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.previous_status} → {log.new_status}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{log.reason || log.internal_notes || '—'}</TableCell>
                      </TableRow>
                    );
                  })}
                  {data.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhum log de auditoria
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

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

export default AdminAuditLogs;
