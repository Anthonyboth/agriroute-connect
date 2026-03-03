import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Flag, Share2, Pin, Lock, Bookmark, CheckCircle, Image as ImageIcon, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VoteColumn } from './VoteColumn';
import { KarmaBadge } from './KarmaBadge';
import { THREAD_TYPE_LABELS, THREAD_TYPE_COLORS } from '../types';
import { THREAD_STATUS_LABELS, THREAD_STATUS_COLORS } from '../utils/automod';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FeedThread } from '../hooks/useForumFeed';
import { toast } from 'sonner';

interface FeedCardProps {
  thread: FeedThread;
  userVote?: number;
  onReport?: (threadId: string) => void;
  isSaved?: boolean;
  onToggleSave?: (threadId: string) => void;
}

export function FeedCard({ thread, userVote, onReport, isSaved, onToggleSave }: FeedCardProps) {
  const isClosed = thread.status === 'CLOSED' || thread.status === 'SOLD' || thread.status === 'FILLED';
  const hasImages = (thread as any).has_images;

  return (
    <div className={`flex bg-card border rounded-lg hover:border-primary/30 transition-all hover:shadow-sm ${isClosed ? 'opacity-60' : ''}`}>
      {/* Vote column */}
      <div className="flex items-start justify-center px-2 py-3 bg-muted/30 rounded-l-lg min-w-[44px]">
        <VoteColumn
          targetType="THREAD"
          targetId={thread.id}
          score={thread.score}
          userVote={userVote}
        />
      </div>

      {/* Content */}
      <Link to={`/forum/topico/${thread.id}`} className="flex-1 px-3 py-2.5 min-w-0">
        {/* Meta line */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap mb-1">
          {/* Author avatar placeholder */}
          <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-2.5 h-2.5 text-primary/60" />
          </div>
          <Link 
            to={`/forum/r/${thread.board_slug}`}
            className="font-semibold text-primary hover:underline"
            onClick={e => e.stopPropagation()}
          >
            r/{thread.board_name}
          </Link>
          <span className="text-muted-foreground/50">•</span>
          <span>por <strong className="text-foreground/80">{thread.author_name}</strong></span>
          <KarmaBadge userId={thread.author_user_id} compact />
          <span className="text-muted-foreground/50">•</span>
          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale: ptBR })}</span>
          {thread.is_pinned && <Pin className="h-3 w-3 text-primary fill-primary" />}
          {thread.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground text-base leading-snug mb-1.5 line-clamp-2">
          {thread.title}
        </h3>

        {/* Type badge + status + price */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Badge variant="outline" className={`text-[11px] px-1.5 py-0 h-5 ${THREAD_TYPE_COLORS[thread.thread_type] || ''}`}>
            {THREAD_TYPE_LABELS[thread.thread_type] || thread.thread_type}
          </Badge>
          {isClosed && (
            <Badge className={`text-[11px] px-1.5 py-0 h-5 ${THREAD_STATUS_COLORS[thread.status] || ''}`}>
              <CheckCircle className="h-3 w-3 mr-0.5" />
              {THREAD_STATUS_LABELS[thread.status] || thread.status}
            </Badge>
          )}
          {thread.price != null && (
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
              R$ {thread.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
          {thread.location_text && (
            <span className="text-xs text-muted-foreground">📍 {thread.location_text}</span>
          )}
          {hasImages && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              <ImageIcon className="h-3 w-3" /> Imagem
            </span>
          )}
        </div>

        {/* Body preview */}
        {thread.body_preview && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2 leading-relaxed">
            {thread.body_preview}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 border-t border-border/30">
          <span className="flex items-center gap-1 font-medium">
            <MessageSquare className="h-3.5 w-3.5" />
            {thread.comment_count} {thread.comment_count === 1 ? 'comentário' : 'comentários'}
          </span>
          {onToggleSave && (
            <button
              className={`flex items-center gap-1 hover:text-foreground transition-colors ${isSaved ? 'text-primary font-medium' : ''}`}
              onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleSave(thread.id); }}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isSaved ? 'fill-current' : ''}`} />
              {isSaved ? 'Salvo' : 'Salvar'}
            </button>
          )}
          {onReport && (
            <button
              className="flex items-center gap-1 hover:text-foreground transition-colors"
              onClick={e => { e.preventDefault(); e.stopPropagation(); onReport(thread.id); }}
            >
              <Flag className="h-3.5 w-3.5" />
              Denunciar
            </button>
          )}
          <button
            className="flex items-center gap-1 hover:text-foreground transition-colors ml-auto"
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              navigator.clipboard.writeText(`${window.location.origin}/forum/topico/${thread.id}`);
              toast.success('Link copiado!');
            }}
          >
            <Share2 className="h-3.5 w-3.5" />
            Compartilhar
          </button>
        </div>
      </Link>
    </div>
  );
}
