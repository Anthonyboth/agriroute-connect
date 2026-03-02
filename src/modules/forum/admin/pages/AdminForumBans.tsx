import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAdminForumBans, useAdminBanUser, useAdminUnbanUser } from '../../hooks/useAdminForum';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminForumBans() {
  const { data: bans, isLoading } = useAdminForumBans();
  const banUser = useAdminBanUser();
  const unbanUser = useAdminUnbanUser();
  const [newOpen, setNewOpen] = useState(false);
  const [userId, setUserId] = useState('');
  const [reason, setReason] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const handleBan = async () => {
    if (!userId.trim() || !reason.trim()) return toast.error('ID e motivo obrigatórios');
    try {
      await banUser.mutateAsync({ userId: userId.trim(), reason: reason.trim(), expiresAt: expiresAt || undefined });
      setNewOpen(false);
      setUserId('');
      setReason('');
      setExpiresAt('');
      toast.success('Usuário banido!');
    } catch { toast.error('Erro'); }
  };

  const handleUnban = async (banId: string) => {
    if (!confirm('Remover ban?')) return;
    try {
      await unbanUser.mutateAsync(banId);
      toast.success('Ban removido!');
    } catch { toast.error('Erro'); }
  };

  const isExpired = (expiresAt: string | null) => expiresAt && new Date(expiresAt) < new Date();

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Banimentos do Fórum</h2>
        <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4 mr-1" /> Banir Usuário</Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      <div className="space-y-2">
        {bans?.map((b: any) => (
          <Card key={b.id} className={isExpired(b.expires_at) ? 'opacity-50' : ''}>
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{b.user_name} <span className="text-xs text-muted-foreground font-mono">({b.user_id.slice(0, 8)}...)</span></p>
                <p className="text-sm text-muted-foreground">{b.reason}</p>
                <p className="text-xs text-muted-foreground">
                  por {b.admin_name} · {format(new Date(b.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  {b.expires_at && ` · Expira: ${format(new Date(b.expires_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isExpired(b.expires_at) ? 'secondary' : b.expires_at ? 'outline' : 'destructive'}>
                  {isExpired(b.expires_at) ? 'Expirado' : b.expires_at ? 'Temporário' : 'Permanente'}
                </Badge>
                <Button variant="ghost" size="icon" title="Remover ban" onClick={() => handleUnban(b.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Banir Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>ID do Usuário (UUID)</Label><Input value={userId} onChange={e => setUserId(e.target.value)} placeholder="UUID do perfil" /></div>
            <div><Label>Motivo</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} /></div>
            <div><Label>Expira em (opcional, vazio = permanente)</Label><Input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleBan} disabled={banUser.isPending}>Banir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
