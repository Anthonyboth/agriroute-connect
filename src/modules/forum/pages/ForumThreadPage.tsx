import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Flag, MapPin, Phone, DollarSign, Lock, Share2 } from 'lucide-react';
import { renderSafeMarkdown, checkClientRateLimit } from '../utils/sanitize';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForumThread, useMarkThreadViewed, useCreateReport } from '../hooks/useForumThread';
import { useThreadedPosts, useCreateReply, type CommentSort } from '../hooks/useThreadedPosts';
import { useUserVotes, useVote } from '../hooks/useForumVotes';
import { useAuth } from '@/hooks/useAuth';
import { ForumLayout } from '../components/ForumLayout';
import { VoteColumn } from '../components/VoteColumn';
import { CommentTree } from '../components/CommentTree';
import { THREAD_TYPE_LABELS, THREAD_TYPE_COLORS, REPORT_REASONS } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const MARKETPLACE_TYPES = ['VENDA', 'COMPRA', 'SERVICO', 'FRETE', 'PARCERIA'];

export default function ForumThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [commentSort, setCommentSort] = useState<CommentSort>('best');
  const [newComment, setNewComment] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'THREAD' | 'POST'; id: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  const threadQuery = useForumThread(id);
  const postsQuery = useThreadedPosts(id, commentSort);
  const createReply = useCreateReply();
  const markViewed = useMarkThreadViewed();
  const createReport = useCreateReport();

  const thread = threadQuery.data;
  const isMarketplace = thread && MARKETPLACE_TYPES.includes(thread.thread_type);

  // Get vote scores for the thread
  const threadVotes = useUserVotes('THREAD', id ? [id] : []);
  
  // Get all post ids for vote lookup
  const allPostIds: string[] = [];
  const collectIds = (posts: any[]) => {
    posts.forEach(p => { allPostIds.push(p.id); collectIds(p.children || []); });
  };
  if (postsQuery.data) collectIds(postsQuery.data);
  const postVotes = useUserVotes('POST', allPostIds);

  // Calculate thread score from votes
  const [threadScore, setThreadScore] = useState(0);
  useEffect(() => {
    if (!id) return;
    // Simple fetch for thread score
    import('@/integrations/supabase/client').then(({ supabase }) => {
      supabase.from('forum_votes' as any)
        .select('value')
        .eq('target_type', 'THREAD')
        .eq('thread_id', id)
        .then(({ data }) => {
          if (data) setThreadScore((data as any[]).reduce((sum, v) => sum + v.value, 0));
        });
    });
  }, [id, threadVotes.data]);

  // Mark as viewed
  useEffect(() => {
    if (id && profile) markViewed.mutate(id);
  }, [id, profile]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !id) return;
    if (!checkClientRateLimit('post', 10)) {
      toast.error('Aguarde um momento antes de enviar outra resposta.');
      return;
    }
    try {
      await createReply.mutateAsync({ threadId: id, body: newComment.trim() });
      setNewComment('');
      toast.success('Comentário publicado!');
    } catch {
      toast.error('Erro ao publicar comentário.');
    }
  };

  const handleReply = async (postId: string, body: string) => {
    if (!id) return;
    if (!checkClientRateLimit('post', 10)) {
      toast.error('Aguarde um momento.');
      return;
    }
    await createReply.mutateAsync({ threadId: id, body, replyToPostId: postId });
    toast.success('Resposta publicada!');
  };

  const handleReport = async () => {
    if (!reportTarget || !reportReason) return;
    try {
      await createReport.mutateAsync({
        target_type: reportTarget.type,
        thread_id: reportTarget.type === 'THREAD' ? reportTarget.id : undefined,
        post_id: reportTarget.type === 'POST' ? reportTarget.id : undefined,
        reason: reportReason,
        details: reportDetails,
      });
      setReportOpen(false);
      setReportTarget(null);
      setReportReason('');
      setReportDetails('');
      toast.success('Denúncia enviada!');
    } catch {
      toast.error('Erro ao enviar denúncia.');
    }
  };

  return (
    <ForumLayout
      title={thread?.title || 'Tópico'}
      breadcrumbs={[
        { label: 'Fórum', href: '/forum' },
        ...(thread ? [{ label: `r/${(thread as any).board_name}`, href: `/forum/r/${(thread as any).board_slug}` }] : []),
        { label: thread?.title || '...' },
      ]}
    >
      {threadQuery.isLoading && <p className="text-center py-8 text-muted-foreground">Carregando...</p>}

      {thread && (
        <>
          {/* Thread card with votes */}
          <div className="flex bg-card border rounded-lg mb-4">
            {/* Vote column */}
            <div className="flex items-start justify-center px-3 py-4 bg-muted/30 rounded-l-lg">
              <VoteColumn
                targetType="THREAD"
                targetId={thread.id}
                score={threadScore}
                userVote={threadVotes.data?.[thread.id]}
              />
            </div>

            {/* Content */}
            <div className="flex-1 p-4">
              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                <Link to={`/forum/r/${(thread as any).board_slug}`} className="font-semibold text-primary hover:underline">
                  r/{(thread as any).board_name}
                </Link>
                <span>•</span>
                <span>por <strong>{thread.author_name}</strong></span>
                <span>•</span>
                <span>{format(new Date(thread.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
              </div>

              {/* Badges */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="outline" className={THREAD_TYPE_COLORS[thread.thread_type] || ''}>
                  {THREAD_TYPE_LABELS[thread.thread_type] || thread.thread_type}
                </Badge>
                {thread.is_pinned && <Badge variant="secondary">📌 Fixado</Badge>}
                {thread.is_locked && <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" /> Trancado</Badge>}
              </div>

              {/* Title */}
              <h1 className="text-xl font-bold mb-3">{thread.title}</h1>

              {/* Marketplace info */}
              {isMarketplace && (
                <div className="bg-muted/50 rounded-lg p-3 flex flex-wrap gap-4 text-sm mb-3">
                  {thread.price != null && (
                    <span className="flex items-center gap-1 font-semibold text-emerald-600">
                      <DollarSign className="h-4 w-4" />
                      R$ {thread.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {thread.location_text && (
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {thread.location_text}</span>
                  )}
                  {thread.contact_preference && (
                    <span className="flex items-center gap-1"><Phone className="h-4 w-4" /> {thread.contact_preference}</span>
                  )}
                </div>
              )}

              {/* First post body (rendered from posts) */}
              {postsQuery.data && postsQuery.data.length > 0 && !postsQuery.data[0].reply_to_post_id && (
                <div
                  className="prose prose-sm max-w-none text-foreground mb-3"
                  dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(postsQuery.data[0].body) }}
                />
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => { setReportTarget({ type: 'THREAD', id: thread.id }); setReportOpen(true); }}
                >
                  <Flag className="h-3.5 w-3.5" /> Denunciar
                </button>
                <button
                  className="flex items-center gap-1 hover:text-foreground"
                  onClick={() => navigator.clipboard.writeText(window.location.href)}
                >
                  <Share2 className="h-3.5 w-3.5" /> Compartilhar
                </button>
              </div>
            </div>
          </div>

          {/* Comments section */}
          <div className="bg-card border rounded-lg p-4">
            {/* New comment */}
            {thread.is_locked ? (
              <div className="text-center text-muted-foreground py-3 mb-4">
                <Lock className="h-5 w-5 inline mr-2" />
                Este tópico está trancado.
              </div>
            ) : profile ? (
              <div className="mb-4 space-y-2">
                <Textarea
                  placeholder="Adicionar um comentário..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  rows={3}
                />
                <Button onClick={handleAddComment} disabled={!newComment.trim() || createReply.isPending} size="sm">
                  {createReply.isPending ? 'Enviando...' : 'Comentar'}
                </Button>
              </div>
            ) : (
              <div className="text-center py-3 mb-4 text-muted-foreground">
                <Link to="/auth" className="text-primary underline">Faça login</Link> para comentar.
              </div>
            )}

            {/* Sort */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-muted-foreground font-medium">Ordenar por:</span>
              <Tabs value={commentSort} onValueChange={v => setCommentSort(v as CommentSort)}>
                <TabsList className="h-7">
                  <TabsTrigger value="best" className="text-xs px-2 h-6">Melhor</TabsTrigger>
                  <TabsTrigger value="new" className="text-xs px-2 h-6">Novo</TabsTrigger>
                  <TabsTrigger value="old" className="text-xs px-2 h-6">Antigo</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Comment tree */}
            {postsQuery.isLoading && <p className="text-muted-foreground text-sm">Carregando comentários...</p>}
            {postsQuery.data && (
              <CommentTree
                posts={postsQuery.data.filter(p => p.reply_to_post_id === null).slice(1)} // skip first post (body)
                threadId={thread.id}
                userVotes={postVotes.data || {}}
                onReply={handleReply}
                onReport={(postId) => { setReportTarget({ type: 'POST', id: postId }); setReportOpen(true); }}
                isLocked={thread.is_locked}
              />
            )}
            {postsQuery.data && postsQuery.data.filter(p => p.reply_to_post_id === null).length <= 1 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum comentário ainda. Seja o primeiro!</p>
            )}
          </div>
        </>
      )}

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Denunciar Conteúdo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Select value={reportReason} onValueChange={setReportReason}>
              <SelectTrigger><SelectValue placeholder="Motivo da denúncia" /></SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Textarea
              placeholder="Detalhes (opcional)"
              value={reportDetails}
              onChange={e => setReportDetails(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancelar</Button>
            <Button onClick={handleReport} disabled={!reportReason || createReport.isPending}>
              {createReport.isPending ? 'Enviando...' : 'Enviar Denúncia'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ForumLayout>
  );
}
