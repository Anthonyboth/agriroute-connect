import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Pin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useForumCategories } from '../hooks/useForumCategories';
import { ForumLayout } from '../components/ForumLayout';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function ForumHome() {
  const { data: categories, isLoading, error } = useForumCategories();

  return (
    <ForumLayout title="Fórum da Comunidade" breadcrumbs={[{ label: 'Fórum' }]}>
      {isLoading && <p className="text-muted-foreground text-center py-8">Carregando fórum...</p>}
      {error && <p className="text-destructive text-center py-8">Erro ao carregar fórum.</p>}

      {categories && categories.length === 0 && (
        <p className="text-muted-foreground text-center py-8">Nenhuma categoria disponível.</p>
      )}

      <div className="space-y-6">
        {categories?.map(category => (
          <Card key={category.id} className="overflow-hidden">
            <CardHeader className="bg-muted/50 py-3 px-4">
              <CardTitle className="text-lg font-bold">{category.name}</CardTitle>
              {category.description && (
                <p className="text-sm text-muted-foreground">{category.description}</p>
              )}
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
                <p className="text-sm text-muted-foreground p-4">Nenhum subfórum.</p>
              )}

              {category.boards.map((board, idx) => (
                <React.Fragment key={board.id}>
                  {idx > 0 && <Separator />}
                  <Link
                    to={`/forum/subforum/${board.slug}`}
                    className="grid grid-cols-1 md:grid-cols-[1fr_80px_80px_200px] gap-2 px-4 py-3 hover:bg-muted/40 transition-colors items-center"
                  >
                    <div className="flex items-start gap-3">
                      <MessageSquare className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-semibold text-foreground">{board.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">{board.description}</p>
                      </div>
                    </div>
                    <span className="text-center text-sm font-medium">{board.thread_count || 0}</span>
                    <span className="text-center text-sm font-medium">{board.post_count || 0}</span>
                    <div className="text-xs text-muted-foreground">
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
                  </Link>
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </ForumLayout>
  );
}
