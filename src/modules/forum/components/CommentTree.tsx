import React, { useState } from 'react';
import { MessageSquare, Reply, Flag, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { VoteColumn } from './VoteColumn';
import { renderSafeMarkdown } from '../utils/sanitize';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { ThreadedPost } from '../hooks/useThreadedPosts';

interface CommentTreeProps {
  posts: ThreadedPost[];
  threadId: string;
  userVotes: Record<string, number>;
  onReply: (postId: string, body: string) => Promise<void>;
  onReport: (postId: string) => void;
  maxDepth?: number;
  isLocked?: boolean;
}

export function CommentTree({ posts, threadId, userVotes, onReply, onReport, maxDepth = 6, isLocked }: CommentTreeProps) {
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
}: {
  post: ThreadedPost;
  threadId: string;
  userVotes: Record<string, number>;
  onReply: (postId: string, body: string) => Promise<void>;
  onReport: (postId: string) => void;
  maxDepth: number;
  isLocked?: boolean;
}) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await onReply(post.id, replyText.trim());
      setReplyText('');
      setShowReply(false);
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

  return (
    <div className={post.depth > 0 ? `ml-3 sm:ml-5 border-l-2 ${depthColors[Math.min(post.depth - 1, 6)]} pl-3` : ''}>
      <div className="py-2">
        {/* Header */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
          <button onClick={() => setCollapsed(!collapsed)} className="hover:text-foreground">
            {collapsed ? '[+]' : '[-]'}
          </button>
          <span className="font-semibold text-foreground">{post.author_name}</span>
          {post.author_role && (
            <Badge variant="outline" className="text-[10px] h-4 px-1">{post.author_role}</Badge>
          )}
          <span>•</span>
          <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR })}</span>
        </div>

        {!collapsed && (
          <>
            {/* Body */}
            {post.is_deleted ? (
              <p className="italic text-muted-foreground text-sm py-1">
                [comentário removido{post.deleted_reason ? `: ${post.deleted_reason}` : ''}]
              </p>
            ) : (
              <div
                className="prose prose-sm max-w-none text-foreground mb-1"
                dangerouslySetInnerHTML={{ __html: renderSafeMarkdown(post.body) }}
              />
            )}

            {/* Actions */}
            {!post.is_deleted && (
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <VoteColumn
                  targetType="POST"
                  targetId={post.id}
                  score={post.score}
                  userVote={userVotes[post.id]}
                  compact
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

            {/* Reply form */}
            {showReply && (
              <div className="mt-2 space-y-2">
                <Textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Escreva sua resposta..."
                  rows={3}
                  className="text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSubmitReply} disabled={!replyText.trim() || submitting}>
                    {submitting ? 'Enviando...' : 'Responder'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowReply(false)}>
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
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
