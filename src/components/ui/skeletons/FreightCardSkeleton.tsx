import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function FreightCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        
        <div className="space-y-3">
          {/* Route */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-40" />
          </div>
          
          {/* Details */}
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
          
          {/* Price */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-9 w-28 rounded-full" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function FreightListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <FreightCardSkeleton key={i} />
      ))}
    </div>
  );
}
