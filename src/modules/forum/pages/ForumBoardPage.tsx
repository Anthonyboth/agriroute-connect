import React, { useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, Flame, Clock, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForumFeed, type FeedSort, type TopPeriod } from '../hooks/useForumFeed';
import { useUserVotes } from '../hooks/useForumVotes';
import { useForumSaves, useToggleSave } from '../hooks/useForumMarketplace';
import { ForumLayout } from '../components/ForumLayout';
import { FeedCard } from '../components/FeedCard';
import { BoardRules } from '../components/BoardRules';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function ForumBoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [sort, setSort] = useState<FeedSort>('hot');
  const [topPeriod, setTopPeriod] = useState<TopPeriod>('7d');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  // Board info
  const boardQuery = useQuery({
    queryKey: ['forum-board-info', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forum_boards')
        .select('*, forum_categories!inner(name)')
        .eq('slug', slug!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const boardData = boardQuery.data as any;

  const feed = useForumFeed({
    boardSlug: slug,
    sort,
    topPeriod,
    search,
    page,
  });

  const threadIds = feed.data?.threads.map(t => t.id) || [];
  const userVotes = useUserVotes('THREAD', threadIds);
  const totalPages = Math.ceil((feed.data?.total || 0) / 20);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleReport = (threadId: string) => {
    toast.info('Use a página do post para denunciar.');
    navigate(`/forum/topico/${threadId}`);
  };

  return (
    <ForumLayout
      title={boardData?.name ? `r/${boardData.name}` : 'Comunidade'}
      breadcrumbs={[
        { label: 'Fórum', href: '/forum' },
        { label: boardData?.name || '...' },
      ]}
    >
      {/* Board header */}
      {boardData && (
        <div className="bg-card border rounded-lg p-4 mb-4">
          <h2 className="text-xl font-bold">r/{boardData.name}</h2>
          {boardData.description && (
            <p className="text-sm text-muted-foreground mt-1">{boardData.description}</p>
          )}
          <div className="mt-3">
            <Button size="sm" onClick={() => navigate(`/forum/novo-topico?board=${boardData.id}`)}>
              <Plus className="h-4 w-4 mr-1" /> Criar Post
            </Button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center mb-4">
        <Tabs value={sort} onValueChange={v => { setSort(v as FeedSort); setPage(1); }}>
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

        {sort === 'top' && (
          <Select value={topPeriod} onValueChange={v => { setTopPeriod(v as TopPeriod); setPage(1); }}>
            <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 horas</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        )}

        <form onSubmit={handleSearch} className="flex gap-1.5 flex-1 max-w-xs">
          <Input placeholder="Buscar..." value={searchInput} onChange={e => setSearchInput(e.target.value)} className="h-9" />
          <Button type="submit" variant="outline" size="icon" className="h-9 w-9">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      {/* Feed */}
      {feed.isLoading && <p className="text-center py-8 text-muted-foreground">Carregando...</p>}

      {feed.data && feed.data.threads.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhum post nesta comunidade ainda.</p>
          {boardData && (
            <Button className="mt-3" onClick={() => navigate(`/forum/novo-topico?board=${boardData.id}`)}>
              <Plus className="h-4 w-4 mr-1" /> Criar primeiro post
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2">
        {feed.data?.threads.map(thread => (
          <FeedCard key={thread.id} thread={thread} userVote={userVotes.data?.[thread.id]} onReport={handleReport} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
          <span className="text-sm self-center text-muted-foreground">Página {page} de {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Próxima</Button>
        </div>
      )}
    </ForumLayout>
  );
}
