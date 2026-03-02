import React from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, Flag, Share2, Pin, Lock, Bookmark, CheckCircle } from 'lucide-react';
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

  return (
    <div className={`flex bg-card border rounded-lg hover:border-primary/30 transition-colors ${isClosed ? 'opacity-70' : ''}`}>
      {/* Vote column */}
      <div className="flex items-start justify-center px-2 py-3 bg-muted/30 rounded-l-lg">
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
          <Link 
            to={`/forum/r/${thread.board_slug}`}
            className="font-semibold text-primary hover:underline"
            onClick={e => e.stopPropagation()}
          >
            r/{thread.board_name}
          </Link>
          <span>•</span>
          <span>por {thread.author_name}</span>
          <KarmaBadge userId={thread.author_user_id} compact />
          <span>•</span>
          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true, locale: ptBR })}</span>
          {thread.is_pinned && <Pin className="h-3 w-3 text-primary" />}
          {thread.is_locked && <Lock className="h-3 w-3 text-muted-foreground" />}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-foreground text-base leading-snug mb-1">
          {thread.title}
        </h3>

        {/* Type badge + status + price */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <Badge variant="outline" className={`text-xs ${THREAD_TYPE_COLORS[thread.thread_type] || ''}`}>
            {THREAD_TYPE_LABELS[thread.thread_type] || thread.thread_type}
          </Badge>
          {isClosed && (
            <Badge className={`text-xs ${THREAD_STATUS_COLORS[thread.status] || ''}`}>
              <CheckCircle className="h-3 w-3 mr-1" />
              {THREAD_STATUS_LABELS[thread.status] || thread.status}
            </Badge>
          )}
          {thread.price != null && (
            <span className="text-xs font-semibold text-emerald-600">
              R$ {thread.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
          {thread.location_text && (
            <span className="text-xs text-muted-foreground">{thread.location_text}</span>
          )}
        </div>

        {/* Body preview */}
        {thread.body_preview && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {thread.body_preview}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            {thread.comment_count} comentários
          </span>
          {onToggleSave && (
            <button
              className={`flex items-center gap-1 hover:text-foreground transition-colors ${isSaved ? 'text-primary' : ''}`}
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
            className="flex items-center gap-1 hover:text-foreground transition-colors"
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
