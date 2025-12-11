import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

export function TableRowSkeleton() {
  return (
    <tr className="border-b">
      <td className="p-4"><Skeleton className="h-4 w-24" /></td>
      <td className="p-4"><Skeleton className="h-4 w-32" /></td>
      <td className="p-4"><Skeleton className="h-4 w-20" /></td>
      <td className="p-4"><Skeleton className="h-4 w-28" /></td>
      <td className="p-4"><Skeleton className="h-8 w-20 rounded" /></td>
    </tr>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-40" />
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-4 text-left"><Skeleton className="h-4 w-16" /></th>
                <th className="p-4 text-left"><Skeleton className="h-4 w-20" /></th>
                <th className="p-4 text-left"><Skeleton className="h-4 w-16" /></th>
                <th className="p-4 text-left"><Skeleton className="h-4 w-24" /></th>
                <th className="p-4 text-left"><Skeleton className="h-4 w-16" /></th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
