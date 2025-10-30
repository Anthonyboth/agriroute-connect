import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Skeleton placeholder for FreightCard during loading
 * Prevents layout shift and provides visual feedback
 */
export const FreightCardSkeleton: React.FC = () => {
  return (
    <Card className="animate-pulse border-2 border-border/60">
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start">
          <div className="space-y-2 flex-1">
            {/* Title skeleton */}
            <div className="h-5 bg-muted rounded w-3/4"></div>
            {/* Subtitle skeleton */}
            <div className="h-4 bg-muted rounded w-full"></div>
          </div>
          {/* Price skeleton */}
          <div className="h-8 w-24 bg-primary/20 rounded ml-4"></div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Metadata grid skeleton */}
        <div className="grid grid-cols-3 gap-3">
          <div className="h-12 bg-muted rounded"></div>
          <div className="h-12 bg-muted rounded"></div>
          <div className="h-12 bg-muted rounded"></div>
        </div>

        {/* Actions skeleton */}
        <div className="flex gap-2 pt-2">
          <div className="h-9 bg-muted rounded flex-1"></div>
          <div className="h-9 bg-muted rounded flex-1"></div>
        </div>
      </CardContent>
    </Card>
  );
};
