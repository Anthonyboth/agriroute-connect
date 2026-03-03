import React, { useState } from 'react';
import { Reply, Flag, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { VoteColumn } from './VoteColumn';
import { ForumImageGallery } from './ForumImageGallery';
import { ForumFileUpload } from './ForumFileUpload';
import { renderSafeMarkdown } from '../utils/sanitize';
import { uploadForumAttachments } from '../hooks/useForumAttachments';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import type { ThreadedPost } from '../hooks/useThreadedPosts';
import type { ForumAttachmentWithUrl } from '../hooks/useForumAttachments';

interface CommentTreeProps {
  posts: ThreadedPost[];
  threadId: string;
  userVotes: Record<string, number>;
  onReply: (postId: string, body: string) => Promise<void>;
  onReport: (postId: string) => void;
  maxDepth?: number;
  isLocked?: boolean;
  attachments?: ForumAttachmentWithUrl[];
  onAttachmentsRefresh?: () => void;
}

export function CommentTree({ posts, threadId, userVotes, onReply, onReport, maxDepth = 6, isLocked, attachments, onAttachmentsRefresh }: CommentTreeProps) {
  return (
    <div className="space-y-0">
      {posts.map(post => (
        <CommentNode
          key={post.id}
          post={post}
          threadId={threadId}
          userVotes={userVotes}
          onReply={onReply}
          onReport={onReport}
          maxDepth={maxDepth}
          isLocked={isLocked}
          attachments={attachments}
          onAttachmentsRefresh={onAttachmentsRefresh}
        />
      ))}
    </div>
  );
}

function CommentNode({
  post,
  threadId,
  userVotes,
  onReply,
  onReport,
  maxDepth,
  isLocked,
  attachments,
  onAttachmentsRefresh,
}: {
  post: ThreadedPost;
  threadId: string;
  userVotes: Record<string, number>;
  onReply: (postId: string, body: string) => Promise<void>;
  onReport: (postId: string) => void;
  maxDepth: number;
  isLocked?: boolean;
  attachments?: ForumAttachmentWithUrl[];
  onAttachmentsRefresh?: () => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyFiles, setReplyFiles] = useState<File[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { profile } = useAuth();

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(post.id, replyText.trim());
      // Upload reply attachments if any
      if (replyFiles.length > 0 && profile?.id) {
        await uploadForumAttachments(replyFiles, threadId, null, profile.id);
        onAttachmentsRefresh?.();
      }
      setReplyText('');
      setReplyFiles([]);
      setShowReply(false);
      toast.success('Resposta publicada!');
    } catch {
      toast.error('Erro ao responder.');
    } finally {
      setSubmitting(false);
    }
  };

  const depthColors = [
    'border-l-primary/40',
    'border-l-blue-400/40',
    'border-l-emerald-400/40',
    'border-l-amber-400/40',
    'border-l-purple-400/40',
    'border-l-rose-400/40',
    'border-l-muted-foreground/20',
  ];

  const postAttachments = attachments?.filter(a => a.post_id === post.id) || [];

  return (
    <div className={post.depth > 0 ? `ml-3 sm:ml-5 border-l-2 ${depthColors[Math.min(post.depth - 1, 6)]} pl-3` : ''}>
      <div className="py-2 group/comment">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <button onClick={() => setCollapsed(!collapsed)} className="hover:text-foreground transition-colors flex-shrink-0">
            {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
          </button>
          {/* Mini avatar */}
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-3 h-3 text-primary/60" />
          </div>
          {post.is_deleted ? (
            <span className="italic">[removido]</span>
          ) : (
            <>
              <span className="font-semibold text-foreground">{post.author_name}</span>
              {post.author_role && (
                <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal">{post.author_role}</Badge>
              )}
            </>
          )}
          <span className="text-muted-foreground/50">•</span>
          <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}</span>
          {collapsed && post.children.length > 0 && (
            <span className="text-muted-foreground/60">({post.children.length} {post.children.length === 1 ? 'resposta' : 'respostas'})</span>
          )}
        </div>

        {!collapsed && (
          <>
            {/* Body */}
            {post.is_deleted ? (
              <div className="bg-muted/50 rounded p-2 my-1">
                <p className="italic text-muted-foreground text-sm">
                  [Comentário removido{post.deleted_reason ? ` — ${post.deleted_reason}` : ''}]
                </p>
              </div>
            ) : (
              <>
                <div
                  className="prose prose-sm max-w-none text-foreground mb-1 [&_a]:text-primary [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(post.body) }}
                />
                {/* Post-level attachments */}
                {postAttachments.length > 0 && (
                  <ForumImageGallery
                    attachments={postAttachments}
                    compact
                  />
                )}
              </>
            )}

            {/* Actions — only for non-deleted */}
            {!post.is_deleted && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <VoteColumn
                  targetType="POST"
                  targetId={post.id}
                  score={post.score}
                  userVote={userVotes[post.id]}
                  compact
                  disabled={post.is_deleted}
                />
                {!isLocked && post.depth < maxDepth && (
                  <button
                    className="flex items-center gap-1 hover:text-foreground transition-colors"
                    onClick={() => setShowReply(!showReply)}
                  >
                    <Reply className="h-3.5 w-3.5" />
                    Responder
                  </button>
                )}
                <button
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => onReport(post.id)}
                >
                  <Flag className="h-3.5 w-3.5" />
                  Denunciar
                </button>
              </div>
            )}

            {/* Reply form with file upload */}
            {showReply && (
              <div className="mt-2 space-y-2 bg-muted/20 rounded-lg p-3 border">
                <Textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Escreva sua resposta..."
                  rows={3}
                  className="text-sm bg-background"
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button size="sm" onClick={handleSubmitReply} disabled={!replyText.trim() || submitting}>
                    {submitting ? 'Enviando...' : 'Responder'}
                  </Button>
                  <ForumFileUpload files={replyFiles} onFilesChange={setReplyFiles} maxFiles={3} compact />
                  <Button size="sm" variant="ghost" onClick={() => { setShowReply(false); setReplyFiles([]); }}>
                    Cancelar
                  </Button>
                </div>
              </div>
            )}

            {/* Children */}
            {post.children.length > 0 && (
              <CommentTree
                posts={post.children}
                threadId={post.thread_id}
                userVotes={userVotes}
                onReply={onReply}
                onReport={onReport}
                maxDepth={maxDepth}
                isLocked={isLocked}
                attachments={attachments}
                onAttachmentsRefresh={onAttachmentsRefresh}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
