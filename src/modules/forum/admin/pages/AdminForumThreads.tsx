import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pin, Lock, Archive, ArrowRight, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useAdminForumThreads, useAdminThreadAction, useAdminForumBoards } from '../../hooks/useAdminForum';
import { THREAD_TYPE_LABELS } from '../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminForumThreads() {
  const { data: boards } = useAdminForumBoards();
  const [boardFilter, setBoardFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminForumThreads(boardFilter || undefined, page);
  const threadAction = useAdminThreadAction();
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState<{ threadId: string; boardId: string }>({ threadId: '', boardId: '' });

  const doAction = async (threadId: string, action: string, extraData?: any) => {
    try {
      await threadAction.mutateAsync({ threadId, action, data: extraData });
      toast.success(`Ação "${action}" realizada!`);
    } catch { toast.error('Erro'); }
  };

  const handleMove = async () => {
    if (!moveTarget.boardId) return;
    await doAction(moveTarget.threadId, 'move', { board_id: moveTarget.boardId });
    setMoveOpen(false);
  };

  const totalPages = Math.ceil((data?.total || 0) / 30);

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-2xl font-bold">Tópicos do Fórum</h2>
        <Select value={boardFilter} onValueChange={v => { setBoardFilter(v === 'ALL' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos subfóruns" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {boards?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      <div className="space-y-2">
        {data?.threads.map((t: any) => (
          <Card key={t.id}>
            <CardContent className="py-3 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {t.is_pinned && <Badge variant="outline" className="text-xs">📌</Badge>}
                    {t.is_locked && <Badge variant="outline" className="text-xs">🔒</Badge>}
                    <Badge variant="secondary" className="text-xs">{THREAD_TYPE_LABELS[t.thread_type] || t.thread_type}</Badge>
                    <Badge variant={t.status === 'OPEN' ? 'default' : 'secondary'} className="text-xs">{t.status}</Badge>
                  </div>
                  <p className="font-semibold truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    por {t.author_name} · {t.forum_boards?.name} · {format(new Date(t.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" title={t.is_pinned ? 'Desafixar' : 'Fixar'} onClick={() => doAction(t.id, t.is_pinned ? 'unpin' : 'pin')}>
                    <Pin className={`h-4 w-4 ${t.is_pinned ? 'text-primary' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="icon" title={t.is_locked ? 'Destrancar' : 'Trancar'} onClick={() => doAction(t.id, t.is_locked ? 'unlock' : 'lock')}>
                    <Lock className={`h-4 w-4 ${t.is_locked ? 'text-destructive' : ''}`} />
                  </Button>
                  <Button variant="ghost" size="icon" title={t.status === 'ARCHIVED' ? 'Reabrir' : 'Arquivar'} onClick={() => doAction(t.id, t.status === 'ARCHIVED' ? 'reopen' : 'archive')}>
                    {t.status === 'ARCHIVED' ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" title="Mover" onClick={() => { setMoveTarget({ threadId: t.id, boardId: '' }); setMoveOpen(true); }}>
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm self-center">{page}/{totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mover Tópico</DialogTitle></DialogHeader>
          <Select value={moveTarget.boardId} onValueChange={v => setMoveTarget(prev => ({ ...prev, boardId: v }))}>
            <SelectTrigger><SelectValue placeholder="Selecione subfórum destino" /></SelectTrigger>
            <SelectContent>{boards?.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button>
            <Button onClick={handleMove} disabled={!moveTarget.boardId}>Mover</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
