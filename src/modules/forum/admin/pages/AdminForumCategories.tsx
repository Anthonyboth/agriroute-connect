import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useAdminForumCategories, useAdminSaveCategory, useAdminDeleteCategory } from '../../hooks/useAdminForum';
import { toast } from 'sonner';

export default function AdminForumCategories() {
  const { data: categories, isLoading } = useAdminForumCategories();
  const saveCategory = useAdminSaveCategory();
  const deleteCategory = useAdminDeleteCategory();
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const openNew = () => {
    setEditing({ name: '', slug: '', description: '', order_index: (categories?.length || 0) + 1, is_active: true });
    setEditOpen(true);
  };

  const openEdit = (cat: any) => {
    setEditing({ ...cat });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editing?.name || !editing?.slug) return toast.error('Nome e slug obrigatórios');
    try {
      await saveCategory.mutateAsync(editing);
      setEditOpen(false);
      toast.success('Categoria salva!');
    } catch { toast.error('Erro ao salvar'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir categoria?')) return;
    try {
      await deleteCategory.mutateAsync(id);
      toast.success('Excluída!');
    } catch { toast.error('Erro ao excluir'); }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Categorias do Fórum</h2>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Categoria</Button>
      </div>

      {isLoading && <p className="text-muted-foreground">Carregando...</p>}

      <div className="space-y-2">
        {categories?.map(cat => (
          <Card key={cat.id}>
            <CardContent className="py-3 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-muted-foreground w-8">#{cat.order_index}</span>
                <div>
                  <p className="font-semibold">{cat.name}</p>
                  <p className="text-sm text-muted-foreground">{cat.slug} · {cat.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={cat.is_active ? 'default' : 'secondary'}>{cat.is_active ? 'Ativa' : 'Inativa'}</Badge>
                <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(cat.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Editar' : 'Nova'} Categoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={editing?.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} /></div>
            <div><Label>Slug</Label><Input value={editing?.slug || ''} onChange={e => setEditing({ ...editing, slug: e.target.value })} /></div>
            <div><Label>Descrição</Label><Input value={editing?.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={editing?.order_index || 0} onChange={e => setEditing({ ...editing, order_index: parseInt(e.target.value) })} /></div>
            <div className="flex items-center gap-2"><Switch checked={editing?.is_active} onCheckedChange={v => setEditing({ ...editing, is_active: v })} /><Label>Ativa</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveCategory.isPending}>{saveCategory.isPending ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
