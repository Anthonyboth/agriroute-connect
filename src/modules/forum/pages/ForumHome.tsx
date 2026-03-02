import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Pin, Plus, FolderPlus, LayoutGrid } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForumCategories } from '../hooks/useForumCategories';
import { useAdminSaveCategory, useAdminSaveBoard, useAdminForumCategories } from '../hooks/useAdminForum';
import { ForumLayout } from '../components/ForumLayout';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function ForumHome() {
  const { data: categories, isLoading, error } = useForumCategories();
  const navigate = useNavigate();

  // Category creation
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const saveCategory = useAdminSaveCategory();

  // Board creation
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [boardCategoryId, setBoardCategoryId] = useState('');
  const saveBoard = useAdminSaveBoard();
  const { data: allCategories } = useAdminForumCategories();

  const handleCreateCategory = async () => {
    if (!catName.trim()) {
      toast.warning('Informe o nome da categoria.');
      return;
    }
    const slug = catName.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      await saveCategory.mutateAsync({
        name: catName.trim(),
        slug,
        description: catDescription.trim(),
        order_index: (categories?.length || 0) + 1,
        is_active: true,
      });
      toast.success('Categoria criada!');
      setShowNewCategory(false);
      setCatName('');
      setCatDescription('');
    } catch {
      toast.error('Erro ao criar categoria.');
    }
  };

  const handleCreateBoard = async () => {
    if (!boardName.trim() || !boardCategoryId) {
      toast.warning('Preencha nome e selecione a categoria.');
      return;
    }
    const slug = boardName.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      await saveBoard.mutateAsync({
        category_id: boardCategoryId,
        name: boardName.trim(),
        slug,
        description: boardDescription.trim(),
        order_index: 1,
        is_active: true,
        visibility: 'PUBLIC',
        allowed_roles: null,
      });
      toast.success('Subfórum criado!');
      setShowNewBoard(false);
      setBoardName('');
      setBoardDescription('');
      setBoardCategoryId('');
    } catch {
      toast.error('Erro ao criar subfórum.');
    }
  };

  return (
    <ForumLayout title="Fórum da Comunidade" breadcrumbs={[{ label: 'Fórum' }]}>
      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button onClick={() => setShowNewCategory(true)} variant="outline" size="sm">
          <FolderPlus className="h-4 w-4 mr-1" /> Nova Categoria
        </Button>
        <Button onClick={() => setShowNewBoard(true)} variant="outline" size="sm">
          <LayoutGrid className="h-4 w-4 mr-1" /> Novo Subfórum
        </Button>
      </div>

      {isLoading && <p className="text-muted-foreground text-center py-8">Carregando fórum...</p>}
      {error && <p className="text-destructive text-center py-8">Erro ao carregar fórum.</p>}

      {categories && categories.length === 0 && (
        <div className="text-center py-12 space-y-4">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Nenhuma categoria disponível.</p>
          <p className="text-sm text-muted-foreground">Crie uma categoria e um subfórum para começar!</p>
        </div>
      )}

      <div className="space-y-6">
        {categories?.map(category => (
          <Card key={category.id} className="overflow-hidden">
            <CardHeader className="bg-muted/50 py-3 px-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold">{category.name}</CardTitle>
                  {category.description && (
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_80px_80px_200px] gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase border-b bg-muted/30">
                <span>Subfórum</span>
                <span className="text-center">Tópicos</span>
                <span className="text-center">Posts</span>
                <span>Último Post</span>
              </div>
              
              {category.boards.length === 0 && (
                <p className="text-sm text-muted-foreground p-4">Nenhum subfórum nesta categoria.</p>
              )}

              {category.boards.map((board, idx) => (
                <React.Fragment key={board.id}>
                  {idx > 0 && <Separator />}
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_80px_80px_200px] gap-2 px-4 py-3 hover:bg-muted/40 transition-colors items-center">
                    <Link
                      to={`/forum/subforum/${board.slug}`}
                      className="flex items-start gap-3 flex-1"
                    >
                      <MessageSquare className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-foreground">{board.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{board.description}</p>
                      </div>
                    </Link>
                    <span className="text-center text-sm font-medium">{board.thread_count || 0}</span>
                    <span className="text-center text-sm font-medium">{board.post_count || 0}</span>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-muted-foreground flex-1">
                        {board.last_thread ? (
                          <>
                            <p className="line-clamp-1 font-medium text-foreground">{board.last_thread.title}</p>
                            <p>
                              por {board.last_thread.author_name} ·{' '}
                              {formatDistanceToNow(new Date(board.last_thread.last_post_at), { addSuffix: true, locale: ptBR })}
                            </p>
                          </>
                        ) : (
                          <span className="italic">Sem posts</span>
                        )}
                      </div>
                      <Link to={`/forum/novo-topico?board=${board.id}`}>
                        <Button size="sm" variant="ghost" className="h-7 px-2">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Category Dialog */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Categoria</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Categoria *</Label>
              <Input
                value={catName}
                onChange={e => setCatName(e.target.value)}
                placeholder="Ex: Agricultura, Transporte, Geral..."
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={catDescription}
                onChange={e => setCatDescription(e.target.value)}
                placeholder="Breve descrição da categoria"
                rows={3}
                maxLength={300}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategory(false)}>Cancelar</Button>
            <Button onClick={handleCreateCategory} disabled={saveCategory.isPending}>
              {saveCategory.isPending ? 'Criando...' : 'Criar Categoria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Board Dialog */}
      <Dialog open={showNewBoard} onOpenChange={setShowNewBoard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Subfórum</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={boardCategoryId} onValueChange={setBoardCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {(allCategories || categories || []).map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome do Subfórum *</Label>
              <Input
                value={boardName}
                onChange={e => setBoardName(e.target.value)}
                placeholder="Ex: Venda de Grãos, Busca de Fretes..."
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={boardDescription}
                onChange={e => setBoardDescription(e.target.value)}
                placeholder="Breve descrição do subfórum"
                rows={3}
                maxLength={300}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBoard(false)}>Cancelar</Button>
            <Button onClick={handleCreateBoard} disabled={saveBoard.isPending}>
              {saveBoard.isPending ? 'Criando...' : 'Criar Subfórum'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ForumLayout>
  );
}
