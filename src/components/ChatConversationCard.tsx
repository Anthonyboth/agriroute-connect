import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Truck, Wrench, MessageSquare, FileText, X, Share2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatConversation } from '@/hooks/useUnifiedChats';

interface ChatConversationCardProps {
  conversation: ChatConversation;
  onClick: () => void;
  onClose?: () => void;
}

export const ChatConversationCard = ({
  conversation,
  onClick,
  onClose,
}: ChatConversationCardProps) => {
  const getIcon = () => {
    switch (conversation.type) {
      case 'FREIGHT':
        return <Truck className="h-4 w-4" />;
      case 'SERVICE':
        return <Wrench className="h-4 w-4" />;
      case 'DOCUMENT_REQUEST':
        return <FileText className="h-4 w-4" />;
      case 'FREIGHT_SHARE':
        return <Share2 className="h-4 w-4 text-accent" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Card
      className={`p-4 hover:bg-accent/50 cursor-pointer transition-all relative group ${
        conversation.isClosed ? 'opacity-60' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(conversation.otherParticipant.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {getIcon()}
            <h4 className="font-semibold text-sm truncate flex-1">
              {conversation.title}
            </h4>
            {conversation.unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                {conversation.unreadCount}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground mb-1">
            {conversation.otherParticipant.name}
          </p>

          <p className="text-sm text-foreground/80 truncate mb-2">
            {conversation.lastMessage}
          </p>

          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(conversation.lastMessageTime), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
        </div>

        {onClose && !conversation.isClosed && (
          <Button
            variant="ghost"
            size="icon"
            className="opacity-0 group-hover:opacity-100 transition-opacity absolute top-2 right-2"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {conversation.isClosed && (
        <div className="mt-2">
          <Badge variant="secondary" className="text-xs">
            Fechada
          </Badge>
        </div>
      )}
    </Card>
  );
};
