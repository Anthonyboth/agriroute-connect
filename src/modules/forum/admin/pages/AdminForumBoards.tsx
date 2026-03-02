import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAdminForumBoards, useAdminSaveBoard, useAdminDeleteBoard, useAdminForumCategories } from '../../hooks/useAdminForum';
import { toast } from 'sonner';

export default function AdminForumBoards() {
  const { data: boards, isLoading } = useAdminForumBoards();
  const { data: categories } = useAdminForumCategories();
  const saveBoard = useAdminSaveBoard();
  const deleteBoard = useAdminDeleteBoard();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const openNew = () => {
    setEditing({ name: '', slug: '', description: '', order_index: (boards?.length || 0) + 1, is_active: true, visibility: 'PUBLIC', allowed_roles: null, category_id: categories?.[0]?.id || '' });
    setEditOpen(true);
  };

  const openEdit = (b: any) => { setEditing({ ...b }); setEditOpen(true); };

  const handleSave = async () => {
    if (!editing?.name || !editing?.slug || !editing?.category_id) return toast.error('Campos obrigatórios');
    const { forum_categories, ...payload } = editing;
    try {
      await saveBoard.mutateAsync(payload);
      setEditOpen(false);
      toast.success('Subfórum salvo!');
    } catch { toast.error('Erro ao salvar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir subfórum?')) return;
    try { await deleteBoard.mutateAsync(id); toast.success('Excluído!'); } catch { toast.error('Erro'); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Subfóruns</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Subfórum</Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      <div className="space-y-2">
        {boards?.map((b: any) => (
          <Card key={b.id}>
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-muted-foreground w-8">#{b.order_index}</span>
                <div>
                  <p className="font-semibold">{b.name}</p>
                  <p className="text-xs text-muted-foreground">{b.forum_categories?.name} · {b.visibility} · {b.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={b.is_active ? 'default' : 'secondary'}>{b.is_active ? 'Ativo' : 'Inativo'}</Badge>
                <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(b.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Novo'} Subfórum</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Categoria</Label>
              <Select value={editing?.category_id || ''} onValueChange={v => setEditing({ ...editing, category_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{categories?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nome</Label><Input value={editing?.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={editing?.slug || ''} onChange={e => setEditing({ ...editing, slug: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={editing?.order_index || 0} onChange={e => setEditing({ ...editing, order_index: parseInt(e.target.value) })} /></div>
            <div><Label>Visibilidade</Label>
              <Select value={editing?.visibility || 'PUBLIC'} onValueChange={v => setEditing({ ...editing, visibility: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">Público</SelectItem>
                  <SelectItem value="VERIFIED_ONLY">Verificados</SelectItem>
                  <SelectItem value="AFFILIATES_ONLY">Afiliados</SelectItem>
                  <SelectItem value="ADMIN_ONLY">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2"><Switch checked={editing?.is_active} onCheckedChange={v => setEditing({ ...editing, is_active: v })} /><Label>Ativo</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveBoard.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
