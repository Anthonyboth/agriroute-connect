import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Plus, Pin, Lock, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useForumBoard } from '../hooks/useForumBoard';
import { useAuth } from '@/hooks/useAuth';
import { ForumLayout } from '../components/ForumLayout';
import { THREAD_TYPE_LABELS, THREAD_TYPE_COLORS } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ForumBoardPage() {
  const { slug } = useParams<{ slug: string }>();
  const { profile } = useAuth();
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'most_replies'>('recent');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const { board, threads } = useForumBoard({
    slug: slug || '',
    page,
    typeFilter,
    search,
    sortBy,
    unreadOnly,
    userId: profile?.id,
  });

  const boardData = board.data as any;
  const categoryName = boardData?.forum_categories?.name;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const totalPages = Math.ceil((threads.data?.total || 0) / 20);

  return (
    <ForumLayout
      title={boardData?.name || 'Subfórum'}
      breadcrumbs={[
        { label: 'Fórum', href: '/forum' },
        ...(categoryName ? [{ label: categoryName }] : []),
        { label: boardData?.name || '...' },
      ]}
    >
      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2 flex-1">
          <Input
            placeholder="Buscar tópico..."
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" variant="outline" size="icon">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Todos</SelectItem>
            {Object.entries(THREAD_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={v => { setSortBy(v as any); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais Recente</SelectItem>
            <SelectItem value="most_replies">Mais Respondidos</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={unreadOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setUnreadOnly(!unreadOnly); setPage(1); }}
        >
          Não Lidos
        </Button>
        {boardData && (
          <Link to={`/forum/novo-topico?board=${boardData.id}`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" /> Novo Tópico
            </Button>
          </Link>
        )}
      </div>

      {/* Threads list */}
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="hidden md:grid grid-cols-[1fr_80px_120px] gap-2 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase border-b bg-muted/30">
            <span>Tópico</span>
            <span className="text-center">Respostas</span>
            <span>Último Post</span>
          </div>

          {threads.isLoading && <p className="text-center py-8 text-muted-foreground">Carregando...</p>}
          {threads.data?.threads.length === 0 && !threads.isLoading && (
            <p className="text-center py-8 text-muted-foreground">Nenhum tópico encontrado.</p>
          )}

          {threads.data?.threads.map((thread, idx) => (
            <React.Fragment key={thread.id}>
              {idx > 0 && <Separator />}
              <Link
                to={`/forum/topico/${thread.id}`}
                className={`grid grid-cols-1 md:grid-cols-[1fr_80px_120px] gap-2 px-4 py-3 hover:bg-muted/40 transition-colors items-center ${thread.is_unread ? 'bg-primary/5 border-l-2 border-l-primary' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {thread.is_pinned && <Pin className="h-3 w-3 text-primary" />}
                      {thread.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
                      <Badge variant="outline" className={`text-xs ${THREAD_TYPE_COLORS[thread.thread_type] || ''}`}>
                        {THREAD_TYPE_LABELS[thread.thread_type] || thread.thread_type}
                      </Badge>
                      <span className="font-semibold text-foreground">{thread.title}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">por {thread.author_name}</span>
                  </div>
                </div>
                <span className="text-center text-sm">{thread.post_count || 0}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(thread.last_post_at), { addSuffix: true, locale: ptBR })}
                </span>
              </Link>
            </React.Fragment>
          ))}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            Anterior
          </Button>
          <span className="text-sm self-center text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
            Próxima
          </Button>
        </div>
      )}
    </ForumLayout>
  );
}
