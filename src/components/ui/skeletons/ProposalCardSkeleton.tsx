import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function ProposalCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
        
        <div className="space-y-2 mb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-4 w-full" />
        </div>
        
        <div className="flex items-center justify-between pt-2 border-t">
          <Skeleton className="h-5 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-8 w-20 rounded" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProposalListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <ProposalCardSkeleton key={i} />
      ))}
    </div>
  );
}
