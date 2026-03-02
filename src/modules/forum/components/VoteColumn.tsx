import React from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useVote } from '../hooks/useForumVotes';
import { toast } from 'sonner';

interface VoteColumnProps {
  targetType: 'THREAD' | 'POST';
  targetId: string;
  score: number;
  userVote?: number; // 1, -1, or undefined
  compact?: boolean;
}

export function VoteColumn({ targetType, targetId, score, userVote, compact }: VoteColumnProps) {
  const vote = useVote();

  const handleVote = (value: 1 | -1) => {
    vote.mutate({ targetType, targetId, value }, {
      onError: () => toast.error('Erro ao votar.'),
    });
  };

  return (
    <div className={cn(
      'flex items-center gap-0.5',
      compact ? 'flex-row' : 'flex-col',
    )}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVote(1); }}
        className={cn(
          'p-0.5 rounded hover:bg-muted transition-colors',
          userVote === 1 ? 'text-orange-500' : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="Upvote"
      >
        <ChevronUp className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
      <span className={cn(
        'font-bold text-center min-w-[1.5rem]',
        compact ? 'text-xs' : 'text-sm',
        score > 0 ? 'text-orange-500' : score < 0 ? 'text-blue-500' : 'text-muted-foreground',
      )}>
        {score}
      </span>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleVote(-1); }}
        className={cn(
          'p-0.5 rounded hover:bg-muted transition-colors',
          userVote === -1 ? 'text-blue-500' : 'text-muted-foreground hover:text-foreground',
        )}
        aria-label="Downvote"
      >
        <ChevronDown className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
      </button>
    </div>
  );
}
