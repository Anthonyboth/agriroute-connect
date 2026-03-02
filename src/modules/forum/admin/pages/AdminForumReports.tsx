import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAdminForumReports, useAdminReportAction } from '../../hooks/useAdminForum';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-destructive/10 text-destructive',
  IN_REVIEW: 'bg-amber-100 text-amber-800',
  RESOLVED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-muted text-muted-foreground',
};

export default function AdminForumReports() {
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const { data: reports, isLoading } = useAdminForumReports(statusFilter);
  const reportAction = useAdminReportAction();
  const [actionOpen, setActionOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [quickAction, setQuickAction] = useState('');

  const openAction = (report: any) => {
    setSelected(report);
    setNewStatus(report.status);
    setNotes(report.admin_notes || '');
    setQuickAction('');
    setActionOpen(true);
  };

  const handleAction = async () => {
    if (!selected) return;
    try {
      let qa: any = undefined;
      if (quickAction === 'lock' && selected.thread_id) qa = { type: 'lock_thread', targetId: selected.thread_id };
      if (quickAction === 'delete' && selected.post_id) qa = { type: 'delete_post', targetId: selected.post_id };
      if (quickAction === 'ban' && selected.target_user_id) qa = { type: 'ban_user', targetId: selected.target_user_id };

      await reportAction.mutateAsync({ reportId: selected.id, status: newStatus, admin_notes: notes, quickAction: qa });
      setActionOpen(false);
      toast.success('Denúncia atualizada!');
    } catch { toast.error('Erro'); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Denúncias do Fórum</h2>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todas</SelectItem>
            <SelectItem value="OPEN">Abertas</SelectItem>
            <SelectItem value="IN_REVIEW">Em Análise</SelectItem>
            <SelectItem value="RESOLVED">Resolvidas</SelectItem>
            <SelectItem value="REJECTED">Rejeitadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}
      {reports?.length === 0 && !isLoading && <p className="text-muted-foreground">Nenhuma denúncia.</p>}

      <div className="space-y-2">
        {reports?.map((r: any) => (
          <Card key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => openAction(r)}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={STATUS_COLORS[r.status] || ''}>{r.status}</Badge>
                    <Badge variant="outline">{r.target_type}</Badge>
                    <Badge variant="secondary">{r.reason}</Badge>
                  </div>
                  <p className="text-sm line-clamp-2">{r.details || 'Sem detalhes'}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    por {r.reporter_name} · {format(new Date(r.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={actionOpen} onOpenChange={setActionOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Gerenciar Denúncia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-sm"><strong>Tipo:</strong> {selected?.target_type} · <strong>Motivo:</strong> {selected?.reason}</p>
              <p className="text-sm text-muted-foreground mt-1">{selected?.details}</p>
              {selected?.thread_id && <p className="text-xs text-muted-foreground">Thread: {selected.thread_id}</p>}
              {selected?.post_id && <p className="text-xs text-muted-foreground">Post: {selected.post_id}</p>}
            </div>
            <div><Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Aberta</SelectItem>
                  <SelectItem value="IN_REVIEW">Em Análise</SelectItem>
                  <SelectItem value="RESOLVED">Resolvida</SelectItem>
                  <SelectItem value="REJECTED">Rejeitada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Notas do Admin</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} /></div>
            <div><Label>Ação Rápida (opcional)</Label>
              <Select value={quickAction} onValueChange={setQuickAction}>
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {selected?.thread_id && <SelectItem value="lock">Trancar Tópico</SelectItem>}
                  {selected?.post_id && <SelectItem value="delete">Ocultar Post</SelectItem>}
                  {selected?.target_user_id && <SelectItem value="ban">Banir Usuário</SelectItem>}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionOpen(false)}>Cancelar</Button>
            <Button onClick={handleAction} disabled={reportAction.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
