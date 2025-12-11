import { Skeleton } from '@/components/ui/skeleton';

export function ChatMessageSkeleton({ isOwn = false }: { isOwn?: boolean }) {
  return (
    <div className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
      <div className={`max-w-[70%] space-y-1 ${isOwn ? 'items-end' : 'items-start'}`}>
        <Skeleton className={`h-12 w-48 rounded-lg ${isOwn ? 'rounded-br-sm' : 'rounded-bl-sm'}`} />
        <Skeleton className="h-3 w-16" />
      </div>
      {isOwn && <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />}
    </div>
  );
}

export function ChatListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <ChatMessageSkeleton key={i} isOwn={i % 2 === 0} />
      ))}
    </div>
  );
}
