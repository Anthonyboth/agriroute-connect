import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Flag, MapPin, Phone, DollarSign, Lock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForumThread, useForumPosts, useCreatePost, useMarkThreadViewed, useCreateReport } from '../hooks/useForumThread';
import { useAuth } from '@/hooks/useAuth';
import { ForumLayout } from '../components/ForumLayout';
import { THREAD_TYPE_LABELS, THREAD_TYPE_COLORS, REPORT_REASONS } from '../types';
import { formatDistanceToNow, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

const MARKETPLACE_TYPES = ['VENDA', 'COMPRA', 'SERVICO', 'FRETE', 'PARCERIA'];

export default function ForumThreadPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [page, setPage] = useState(1);
  const [replyBody, setReplyBody] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<{ type: 'THREAD' | 'POST'; id: string } | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportDetails, setReportDetails] = useState('');

  const threadQuery = useForumThread(id);
  const postsQuery = useForumPosts(id, page);
  const createPost = useCreatePost();
  const markViewed = useMarkThreadViewed();
  const createReport = useCreateReport();

  const thread = threadQuery.data;
  const totalPages = Math.ceil((postsQuery.data?.total || 0) / 20);

  // Mark as viewed
  useEffect(() => {
    if (id && profile) {
      markViewed.mutate(id);
    }
  }, [id, profile]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyBody.trim() || !id) return;
    try {
      await createPost.mutateAsync({ threadId: id, body: replyBody.trim() });
      setReplyBody('');
      toast.success('Resposta publicada!');
    } catch {
      toast.error('Erro ao publicar resposta.');
    }
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
      toast.success('Denúncia enviada. Obrigado!');
    } catch {
      toast.error('Erro ao enviar denúncia.');
    }
  };

  const isMarketplace = thread && MARKETPLACE_TYPES.includes(thread.thread_type);

  return (
    <ForumLayout
      title={thread?.title || 'Tópico'}
      breadcrumbs={[
        { label: 'Fórum', href: '/forum' },
        ...(thread ? [{ label: (thread as any).board_name, href: `/forum/subforum/${(thread as any).board_slug}` }] : []),
        { label: thread?.title || '...' },
      ]}
    >
      {threadQuery.isLoading && <p className="text-center py-8 text-muted-foreground">Carregando...</p>}

      {thread && (
        <>
          {/* Thread header */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={THREAD_TYPE_COLORS[thread.thread_type] || ''}>
                  {THREAD_TYPE_LABELS[thread.thread_type] || thread.thread_type}
                </Badge>
                {thread.is_pinned && <Badge variant="secondary">📌 Fixado</Badge>}
                {thread.is_locked && <Badge variant="destructive"><Lock className="h-3 w-3 mr-1" /> Trancado</Badge>}
                <Badge variant="outline">{thread.status}</Badge>
              </div>
              <h1 className="text-xl font-bold mt-2">{thread.title}</h1>
              <p className="text-sm text-muted-foreground">
                por <strong>{thread.author_name}</strong> · {format(new Date(thread.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            </CardHeader>

            {/* Marketplace info block */}
            {isMarketplace && (
              <CardContent className="pt-0">
                <div className="bg-muted/50 rounded-lg p-3 flex flex-wrap gap-4 text-sm">
                  {thread.price != null && (
                    <span className="flex items-center gap-1 font-semibold text-emerald-700">
                      <DollarSign className="h-4 w-4" />
                      {thread.currency} {thread.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {thread.location_text && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-4 w-4" /> {thread.location_text}
                    </span>
                  )}
                  {thread.contact_preference && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-4 w-4" /> {thread.contact_preference}
                    </span>
                  )}
                </div>
              </CardContent>
            )}

            <CardContent className="pt-0">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => {
                  setReportTarget({ type: 'THREAD', id: thread.id });
                  setReportOpen(true);
                }}
              >
                <Flag className="h-4 w-4 mr-1" /> Denunciar
              </Button>
            </CardContent>
          </Card>

          {/* Posts */}
          <div className="space-y-3">
            {postsQuery.data?.posts.map(post => (
              <Card key={post.id} className={post.is_deleted ? 'opacity-50' : ''}>
                <CardContent className="py-3 px-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-semibold text-sm">{post.author_name}</span>
                      {post.author_role && (
                        <Badge variant="outline" className="ml-2 text-xs">{post.author_role}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-2">
                        {format(new Date(post.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {!post.is_deleted && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground h-7"
                        onClick={() => {
                          setReportTarget({ type: 'POST', id: post.id });
                          setReportOpen(true);
                        }}
                      >
                        <Flag className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {post.is_deleted ? (
                    <p className="italic text-muted-foreground text-sm">[Mensagem removida{post.deleted_reason ? `: ${post.deleted_reason}` : ''}]</p>
                  ) : (
                    <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap">{post.body}</div>
                  )}
                </CardContent>
              </Card>
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

          {/* Reply form */}
          {thread.is_locked ? (
            <Card className="mt-4">
              <CardContent className="py-4 text-center text-muted-foreground">
                <Lock className="h-5 w-5 inline mr-2" />
                Este tópico está trancado. Não é possível responder.
              </CardContent>
            </Card>
          ) : profile ? (
            <Card className="mt-4">
              <CardContent className="py-4">
                <form onSubmit={handleReply} className="space-y-3">
                  <Textarea
                    placeholder="Escreva sua resposta..."
                    value={replyBody}
                    onChange={e => setReplyBody(e.target.value)}
                    rows={4}
                  />
                  <Button type="submit" disabled={!replyBody.trim() || createPost.isPending}>
                    {createPost.isPending ? 'Enviando...' : 'Responder'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="mt-4">
              <CardContent className="py-4 text-center text-muted-foreground">
                <Link to="/auth" className="text-primary underline">Faça login</Link> para responder.
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Denunciar Conteúdo</DialogTitle>
          </DialogHeader>
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
