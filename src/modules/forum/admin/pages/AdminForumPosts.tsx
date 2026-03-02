import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Trash2, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAdminForumPosts, useAdminPostAction } from '../../hooks/useAdminForum';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminForumPosts() {
  const [threadId, setThreadId] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const { data: posts, isLoading } = useAdminForumPosts(threadId || undefined);
  const postAction = useAdminPostAction();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string>('');
  const [deleteReason, setDeleteReason] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setThreadId(searchInput.trim());
  };

  const handleDelete = async () => {
    try {
      await postAction.mutateAsync({ postId: deleteTarget, action: 'delete', reason: deleteReason });
      setDeleteOpen(false);
      setDeleteReason('');
      toast.success('Post ocultado!');
    } catch { toast.error('Erro'); }
  };

  const handleRestore = async (postId: string) => {
    try {
      await postAction.mutateAsync({ postId, action: 'restore' });
      toast.success('Post restaurado!');
    } catch { toast.error('Erro'); }
  };

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Posts do Fórum</h2>
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input placeholder="ID do tópico (UUID)" value={searchInput} onChange={e => setSearchInput(e.target.value)} className="max-w-md" />
        <Button type="submit">Buscar</Button>
      </form>

      {isLoading && threadId && <p className="text-muted-foreground">Carregando...</p>}
      {!threadId && <p className="text-muted-foreground">Insira o ID de um tópico para ver seus posts.</p>}

      <div className="space-y-2">
        {posts?.map((p: any) => (
          <Card key={p.id} className={p.is_deleted ? 'opacity-60' : ''}>
            <CardContent className="py-3 px-4 flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{p.author_name}</span>
                  <span className="text-xs text-muted-foreground">{format(new Date(p.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                  {p.is_deleted && <Badge variant="destructive" className="text-xs">Deletado</Badge>}
                </div>
                <p className="text-sm whitespace-pre-wrap line-clamp-3">{p.is_deleted ? `[Removido: ${p.deleted_reason || ''}]` : p.body}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {p.is_deleted ? (
                  <Button variant="ghost" size="icon" title="Restaurar" onClick={() => handleRestore(p.id)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="icon" title="Ocultar" onClick={() => { setDeleteTarget(p.id); setDeleteOpen(true); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ocultar Post</DialogTitle></DialogHeader>
          <div><Label>Motivo</Label><Input value={deleteReason} onChange={e => setDeleteReason(e.target.value)} placeholder="Motivo da remoção" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={postAction.isPending}>Ocultar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
