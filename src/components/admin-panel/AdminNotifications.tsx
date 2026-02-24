import React, { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Bell, Send, Menu, RefreshCw, ChevronLeft, ChevronRight, Users, AlertCircle } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAdminApi } from '@/hooks/useAdminApi';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

const AdminNotifications = () => {
  const { callApi } = useAdminApi();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ title: '', message: '', target: 'all' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await callApi<any>('notifications', {
      params: { page: String(page) },
    });
    if (data) {
      setNotifications(data.data || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    }
    setLoading(false);
  }, [page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSend = async () => {
    if (!form.title.trim() || !form.message.trim()) {
      toast.error('Preencha título e mensagem');
      return;
    }
    setSending(true);
    const { data, error } = await callApi('notifications', {
      method: 'POST',
      body: {
        action: 'send',
        title: form.title,
        message: form.message,
        target: form.target,
        type: 'admin_message',
      },
    });
    setSending(false);
    if (error) {
      toast.error(`Erro: ${error}`);
    } else {
      toast.success(`Notificação enviada para ${(data as any)?.sent_count || 0} usuários`);
      setShowSendDialog(false);
      setForm({ title: '', message: '', target: 'all' });
      fetchData();
    }
  };

  return (
    <div className="flex-1 bg-muted/30">
      <header className="bg-card border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2 hover:bg-muted rounded-md"><Menu className="h-5 w-5" /></SidebarTrigger>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Notificações</h1>
            <p className="text-sm text-muted-foreground">Enviar e gerenciar notificações do sistema</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setShowSendDialog(true)} className="gap-2">
            <Send className="h-4 w-4" /> Enviar Notificação
          </Button>
        </div>
      </header>

      <div className="p-6 space-y-4 max-w-7xl mx-auto">
        {/* Info Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Central de Notificações</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Envie notificações para todos os usuários aprovados da plataforma. As mensagens aparecerão no sino de notificações de cada usuário.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Notifications */}
        <Card className="shadow-sm border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Notificações Enviadas (Admin)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-16"><AppSpinner /></div>
            ) : notifications.length > 0 ? (
              <>
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead>Lida</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {notifications.map((n: any) => (
                      <TableRow key={n.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {n.created_at ? format(new Date(n.created_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                        </TableCell>
                        <TableCell className="text-sm font-medium truncate max-w-[200px]">{n.title}</TableCell>
                        <TableCell className="text-sm text-muted-foreground truncate max-w-[300px]">{n.message}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs ${n.is_read ? 'bg-success/15 text-success border-success/30' : 'bg-muted text-muted-foreground border-border'}`}>
                            {n.is_read ? 'Sim' : 'Não'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">{total} notificações</p>
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
                <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">Nenhuma notificação admin enviada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Send Notification Dialog */}
      <Dialog open={showSendDialog} onOpenChange={setShowSendDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              Enviar Notificação
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Destinatário</label>
              <Select value={form.target} onValueChange={(v) => setForm(f => ({ ...f, target: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2"><Users className="h-4 w-4" /> Todos os usuários aprovados</div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Título</label>
              <Input
                placeholder="Ex: Manutenção programada"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Mensagem</label>
              <Textarea
                placeholder="Escreva a mensagem da notificação..."
                value={form.message}
                onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                maxLength={2000}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{form.message.length}/2000</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendDialog(false)}>Cancelar</Button>
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? <AppSpinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminNotifications;
