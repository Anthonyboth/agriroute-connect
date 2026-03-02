import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Flame, Clock, TrendingUp, FolderPlus, LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForumFeed, type FeedSort, type TopPeriod } from '../hooks/useForumFeed';
import { useUserVotes } from '../hooks/useForumVotes';
import { useForumCategories } from '../hooks/useForumCategories';
import { useAdminSaveCategory, useAdminSaveBoard, useAdminForumCategories } from '../hooks/useAdminForum';
import { ForumLayout } from '../components/ForumLayout';
import { FeedCard } from '../components/FeedCard';
import { toast } from 'sonner';

export default function ForumHome() {
  const navigate = useNavigate();
  const [sort, setSort] = useState<FeedSort>('hot');
  const [topPeriod, setTopPeriod] = useState<TopPeriod>('7d');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [boardFilter, setBoardFilter] = useState('');
  const [page, setPage] = useState(1);

  // Category/Board creation
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [catName, setCatName] = useState('');
  const [catDescription, setCatDescription] = useState('');
  const saveCategory = useAdminSaveCategory();

  const [showNewBoard, setShowNewBoard] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardDescription, setBoardDescription] = useState('');
  const [boardCategoryId, setBoardCategoryId] = useState('');
  const saveBoard = useAdminSaveBoard();

  const { data: categories } = useForumCategories();
  const { data: allCategories } = useAdminForumCategories();

  const feed = useForumFeed({
    boardSlug: boardFilter || undefined,
    sort,
    topPeriod,
    search,
    page,
  });

  const threadIds = feed.data?.threads.map(t => t.id) || [];
  const userVotes = useUserVotes('THREAD', threadIds);
  const totalPages = Math.ceil((feed.data?.total || 0) / 20);

  // All boards for filter dropdown
  const allBoards = categories?.flatMap(c => c.boards) || [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleCreateCategory = async () => {
    if (!catName.trim()) { toast.warning('Informe o nome da categoria.'); return; }
    const slug = catName.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      await saveCategory.mutateAsync({ name: catName.trim(), slug, description: catDescription.trim(), order_index: (categories?.length || 0) + 1, is_active: true });
      toast.success('Categoria criada!');
      setShowNewCategory(false); setCatName(''); setCatDescription('');
    } catch { toast.error('Erro ao criar categoria.'); }
  };

  const handleCreateBoard = async () => {
    if (!boardName.trim() || !boardCategoryId) { toast.warning('Preencha nome e selecione a categoria.'); return; }
    const slug = boardName.trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      await saveBoard.mutateAsync({ category_id: boardCategoryId, name: boardName.trim(), slug, description: boardDescription.trim(), order_index: 1, is_active: true, visibility: 'PUBLIC', allowed_roles: null });
      toast.success('Comunidade criada!');
      setShowNewBoard(false); setBoardName(''); setBoardDescription(''); setBoardCategoryId('');
    } catch { toast.error('Erro ao criar comunidade.'); }
  };

  return (
    <ForumLayout title="Fórum da Comunidade" breadcrumbs={[{ label: 'Fórum' }]}>
      {/* Top bar */}
      <div className="flex flex-col gap-3 mb-4">
        {/* Actions row */}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setShowNewCategory(true)} variant="outline" size="sm">
            <FolderPlus className="h-4 w-4 mr-1" /> Nova Categoria
          </Button>
          <Button onClick={() => setShowNewBoard(true)} variant="outline" size="sm">
            <LayoutGrid className="h-4 w-4 mr-1" /> Nova Comunidade
          </Button>
          <Button onClick={() => navigate('/forum/novo-topico')} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Criar Post
          </Button>
        </div>

        {/* Filter row */}
        <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
          {/* Board filter */}
          <Select value={boardFilter} onValueChange={v => { setBoardFilter(v === '__all__' ? '' : v); setPage(1); }}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Todas comunidades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {allBoards.map(b => (
                <SelectItem key={b.id} value={b.slug}>r/{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort tabs */}
          <Tabs value={sort} onValueChange={v => { setSort(v as FeedSort); setPage(1); }} className="flex-shrink-0">
            <TabsList className="h-9">
              <TabsTrigger value="hot" className="text-xs gap-1 px-3">
                <Flame className="h-3.5 w-3.5" /> Hot
              </TabsTrigger>
              <TabsTrigger value="new" className="text-xs gap-1 px-3">
                <Clock className="h-3.5 w-3.5" /> Novo
              </TabsTrigger>
              <TabsTrigger value="top" className="text-xs gap-1 px-3">
                <TrendingUp className="h-3.5 w-3.5" /> Top
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Top period */}
          {sort === 'top' && (
            <Select value={topPeriod} onValueChange={v => { setTopPeriod(v as TopPeriod); setPage(1); }}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">24 horas</SelectItem>
                <SelectItem value="7d">7 dias</SelectItem>
                <SelectItem value="30d">30 dias</SelectItem>
                <SelectItem value="all">Todos</SelectItem>
              </SelectContent>
            </Select>
          )}

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-1.5 flex-1 max-w-xs">
            <Input
              placeholder="Buscar..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="h-9"
            />
            <Button type="submit" variant="outline" size="icon" className="h-9 w-9">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>

      {/* Feed */}
      {feed.isLoading && <p className="text-center py-8 text-muted-foreground">Carregando feed...</p>}

      {feed.data && feed.data.threads.length === 0 && (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">Nenhum post encontrado.</p>
          <Button onClick={() => navigate('/forum/novo-topico')}>
            <Plus className="h-4 w-4 mr-1" /> Criar primeiro post
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {feed.data?.threads.map(thread => (
          <FeedCard
            key={thread.id}
            thread={thread}
            userVote={userVotes.data?.[thread.id]}
          />
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm self-center text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}

      {/* Create Category Dialog */}
      <Dialog open={showNewCategory} onOpenChange={setShowNewCategory}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={catName} onChange={e => setCatName(e.target.value)} placeholder="Ex: Agricultura" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={catDescription} onChange={e => setCatDescription(e.target.value)} rows={3} maxLength={300} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCategory(false)}>Cancelar</Button>
            <Button onClick={handleCreateCategory} disabled={saveCategory.isPending}>
              {saveCategory.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Board Dialog */}
      <Dialog open={showNewBoard} onOpenChange={setShowNewBoard}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Comunidade</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Categoria *</Label>
              <Select value={boardCategoryId} onValueChange={setBoardCategoryId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(allCategories || categories || []).map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={boardName} onChange={e => setBoardName(e.target.value)} placeholder="Ex: Venda de Grãos" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={boardDescription} onChange={e => setBoardDescription(e.target.value)} rows={3} maxLength={300} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewBoard(false)}>Cancelar</Button>
            <Button onClick={handleCreateBoard} disabled={saveBoard.isPending}>
              {saveBoard.isPending ? 'Criando...' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ForumLayout>
  );
}
