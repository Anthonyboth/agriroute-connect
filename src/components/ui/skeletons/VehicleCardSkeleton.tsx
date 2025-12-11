import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

export function VehicleCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Vehicle image */}
          <Skeleton className="h-20 w-20 rounded-lg flex-shrink-0" />
          
          <div className="flex-1 space-y-2">
            {/* Vehicle name and plate */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-24 rounded-full" />
            </div>
            
            {/* Details */}
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-16" />
            </div>
            
            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-8 w-20 rounded" />
              <Skeleton className="h-8 w-20 rounded" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function VehicleListSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <VehicleCardSkeleton key={i} />
      ))}
    </div>
  );
}
