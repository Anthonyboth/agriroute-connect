import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Truck, Wrench, MessageSquare, FileText, X, Share2, Navigation, Users, CheckCircle2, Clock, Package, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatConversation, ChatParticipant } from '@/hooks/useUnifiedChats';

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

  const handlePhoneCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (conversation.otherParticipant?.phone) {
      const cleanNumber = conversation.otherParticipant.phone.replace(/\D/g, '');
      window.open(`tel:+55${cleanNumber}`, '_self');
    }
  };

  const getStatusBadge = () => {
    if (!conversation.freightStatus) return null;
    
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      'ACCEPTED': { label: 'Aceito', variant: 'secondary', icon: <Clock className="h-3 w-3" /> },
      'LOADING': { label: 'Carregando', variant: 'default', icon: <Package className="h-3 w-3" /> },
      'LOADED': { label: 'Carregado', variant: 'default', icon: <Package className="h-3 w-3" /> },
      'IN_TRANSIT': { label: 'Em Trânsito', variant: 'default', icon: <Truck className="h-3 w-3" /> },
      'DELIVERED': { label: 'Entregue', variant: 'outline', icon: <CheckCircle2 className="h-3 w-3" /> },
      'COMPLETED': { label: 'Concluído', variant: 'outline', icon: <CheckCircle2 className="h-3 w-3" /> },
    };
    
    const config = statusConfig[conversation.freightStatus];
    if (!config) return null;
    
    return (
      <Badge variant={config.variant} className="text-xs gap-1 px-1.5 py-0">
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'PRODUTOR': return 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300';
      case 'MOTORISTA': 
      case 'MOTORISTA_AFILIADO': return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
      case 'TRANSPORTADORA': return 'bg-purple-500/20 text-purple-700 dark:text-purple-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const participants = conversation.participants || [];
  const hasMultipleParticipants = participants.length > 2;

  return (
    <Card
      className={`p-4 hover:bg-accent/50 cursor-pointer transition-all relative group ${
        conversation.isClosed ? 'opacity-60' : ''
      }`}
      onClick={onClick}
    >
      {/* Header: Icon + Title + Unread badge */}
      <div className="flex items-center gap-2 mb-2">
        {getIcon()}
        <h4 className="font-semibold text-sm truncate flex-1 min-w-0">
          {conversation.title}
        </h4>
        {conversation.unreadCount > 0 && (
          <Badge variant="destructive" className="text-xs px-1.5 py-0 shrink-0">
            {conversation.unreadCount}
          </Badge>
        )}
        {onClose && !conversation.isClosed && !conversation.isAutoClosedByRatings && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Status badges row */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {getStatusBadge()}
        
        {conversation.hasGpsTracking && !conversation.isClosed && (
          <Badge variant="outline" className="text-xs gap-1 px-1.5 py-0 bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300">
            <Navigation className="h-3 w-3" />
            GPS
            {conversation.gpsLastUpdate && (
              <span className="text-green-600/70 dark:text-green-400/70">
                • {formatDistanceToNow(new Date(conversation.gpsLastUpdate), { locale: ptBR })}
              </span>
            )}
          </Badge>
        )}
        
        {hasMultipleParticipants && (
          <Badge variant="outline" className="text-xs gap-1 px-1.5 py-0">
            <Users className="h-3 w-3" />
            {participants.length}
          </Badge>
        )}

        {conversation.isClosed && (
          conversation.isAutoClosedByRatings ? (
            <Badge variant="secondary" className="text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Concluído
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Fechada
            </Badge>
          )
        )}
      </div>

      {/* Body: Avatars + Content */}
      <div className="flex items-center gap-3">
        {/* Avatares */}
        <div className="relative shrink-0">
          {participants.length > 0 ? (
            <div className="flex -space-x-2">
              {participants.slice(0, 3).map((p, idx) => (
                <Avatar 
                  key={p.id} 
                  className="h-9 w-9 border-2 border-background"
                  style={{ zIndex: 3 - idx }}
                >
                  <AvatarFallback className={`text-xs ${getRoleBadgeColor(p.role)}`}>
                    {getInitials(p.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {participants.length > 3 && (
                <Avatar className="h-9 w-9 border-2 border-background">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    +{participants.length - 3}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ) : (
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(conversation.otherParticipant.name)}
              </AvatarFallback>
            </Avatar>
          )}
          
          {conversation.hasGpsTracking && !conversation.isClosed && (
            <div 
              className="absolute -bottom-0.5 -right-0.5 bg-green-500 rounded-full p-0.5 animate-pulse"
              title={conversation.gpsLastUpdate 
                ? `Última atualização: ${formatDistanceToNow(new Date(conversation.gpsLastUpdate), { addSuffix: true, locale: ptBR })}`
                : 'GPS ativo'
              }
            >
              <Navigation className="h-2.5 w-2.5 text-white" />
            </div>
          )}
        </div>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">
            {participants.length > 0 
              ? participants.map(p => p.name).join(', ')
              : conversation.otherParticipant.name
            }
          </p>

          <p className="text-sm text-foreground/80 truncate mt-0.5">
            {conversation.lastMessage}
          </p>
        </div>

        {/* Right side: time + phone */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          <p className="text-xs text-muted-foreground whitespace-nowrap">
            {formatDistanceToNow(new Date(conversation.lastMessageTime), {
              addSuffix: true,
              locale: ptBR,
            })}
          </p>
          {conversation.otherParticipant?.phone && !conversation.isClosed && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePhoneCall}
              className="h-6 w-6 p-0 text-green-700 dark:text-green-300 hover:bg-green-500/10"
            >
              <Phone className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
