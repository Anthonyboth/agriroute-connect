import React from 'react';
import { Star } from 'lucide-react';
import { useForumKarma } from '../hooks/useForumMarketplace';

interface KarmaBadgeProps {
  userId: string;
  compact?: boolean;
}

export function KarmaBadge({ userId, compact }: KarmaBadgeProps) {
  const { data } = useForumKarma(userId);
  
  if (!data) return null;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Star className="h-3 w-3 text-amber-500" />
        {data.karma}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <Star className="h-3.5 w-3.5 text-amber-500" />
        <span className="font-medium">{data.karma}</span> karma
      </span>
      <span>•</span>
      <span>{data.thread_count} posts</span>
      <span>•</span>
      <span>{data.post_count} comentários</span>
    </div>
  );
}
