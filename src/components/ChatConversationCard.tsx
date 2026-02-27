import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Truck, Wrench, MessageSquare, FileText, Share2, Navigation, Users, CheckCircle2, Clock, Package, Phone } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChatConversation, ChatParticipant } from '@/hooks/useUnifiedChats';
import { cn } from '@/lib/utils';

interface ChatConversationCardProps {
  conversation: ChatConversation;
  onClick: () => void;
}

export const ChatConversationCard = ({
  conversation,
  onClick,
}: ChatConversationCardProps) => {
  const getIcon = () => {
    switch (conversation.type) {
      case 'FREIGHT':
        return <Truck className="h-4 w-4 text-muted-foreground" />;
      case 'SERVICE':
        return <Wrench className="h-4 w-4 text-muted-foreground" />;
      case 'DOCUMENT_REQUEST':
        return <FileText className="h-4 w-4 text-muted-foreground" />;
      case 'FREIGHT_SHARE':
        return <Share2 className="h-4 w-4 text-primary" />;
      default:
        return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
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

    const statusConfig: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
      'ACCEPTED': { label: 'Aceito', className: 'bg-secondary text-secondary-foreground', icon: <Clock className="h-3 w-3" /> },
      'LOADING': { label: 'Carregando', className: 'bg-warning/20 text-warning-foreground', icon: <Package className="h-3 w-3" /> },
      'LOADED': { label: 'Carregado', className: 'bg-success/20 text-success', icon: <Package className="h-3 w-3" /> },
      'IN_TRANSIT': { label: 'Em Trânsito', className: 'bg-primary/20 text-primary', icon: <Truck className="h-3 w-3" /> },
      'DELIVERED': { label: 'Entregue', className: 'bg-muted text-muted-foreground', icon: <CheckCircle2 className="h-3 w-3" /> },
      'COMPLETED': { label: 'Concluído', className: 'bg-muted text-muted-foreground', icon: <CheckCircle2 className="h-3 w-3" /> },
    };

    const config = statusConfig[conversation.freightStatus];
    if (!config) return null;

    return (
      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full', config.className)}>
        {config.icon}
        {config.label}
      </span>
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
      case 'PRODUTOR': return 'bg-primary/15 text-primary';
      case 'MOTORISTA':
      case 'MOTORISTA_AFILIADO': return 'bg-secondary text-secondary-foreground';
      case 'TRANSPORTADORA': return 'bg-accent/15 text-accent-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const participants = conversation.participants || [];
  const hasMultipleParticipants = participants.length > 2;

  return (
    <div
      className={cn(
        'grid grid-cols-[auto_1fr_auto] gap-3 p-4 rounded-xl bg-card border border-border',
        'hover:border-primary/40 hover:shadow-md cursor-pointer transition-all group',
        conversation.isClosed && 'opacity-60'
      )}
      onClick={onClick}
    >
      {/* Col 1: Avatar */}
      <div className="relative shrink-0 self-start pt-0.5">
        {participants.length > 0 ? (
          <div className="flex -space-x-2">
            {participants.slice(0, 3).map((p, idx) => (
              <Avatar
                key={p.id}
                className="h-10 w-10 border-2 border-card"
                style={{ zIndex: 3 - idx }}
              >
                <SignedAvatarImage src={p.avatar} alt={p.name} />
                <AvatarFallback className={cn('text-xs font-medium', getRoleBadgeColor(p.role))}>
                  {getInitials(p.name)}
                </AvatarFallback>
              </Avatar>
            ))}
            {participants.length > 3 && (
              <Avatar className="h-10 w-10 border-2 border-card">
                <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                  +{participants.length - 3}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        ) : (
          <Avatar className="h-10 w-10">
            <SignedAvatarImage src={conversation.otherParticipant.avatar} alt={conversation.otherParticipant.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-medium">
              {getInitials(conversation.otherParticipant.name)}
            </AvatarFallback>
          </Avatar>
        )}

        {/* GPS indicator on avatar */}
        {conversation.hasGpsTracking && !conversation.isClosed && (
          <div
            className="absolute -bottom-0.5 -right-0.5 bg-success rounded-full p-0.5 animate-pulse"
            title={conversation.gpsLastUpdate
              ? `Última atualização: ${formatDistanceToNow(new Date(conversation.gpsLastUpdate), { addSuffix: true, locale: ptBR })}`
              : 'GPS ativo'
            }
          >
            <Navigation className="h-2.5 w-2.5 text-success-foreground" />
          </div>
        )}
      </div>

      {/* Col 2: Content */}
      <div className="min-w-0 space-y-1">
        {/* Title row with icon + unread badge inline */}
        <div className="flex items-center gap-1.5">
          {getIcon()}
          <h3 className="text-foreground font-semibold text-sm leading-tight truncate">
            {conversation.title}
          </h3>
          {conversation.unreadCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground shrink-0">
              {conversation.unreadCount}
            </span>
          )}
        </div>

        {/* Participants */}
        <p className="text-muted-foreground text-xs truncate">
          {participants.length > 0
            ? participants.map(p => p.name).join(', ')
            : conversation.otherParticipant.name
          }
        </p>

        {/* Last message preview */}
        <p className="text-foreground text-sm truncate">
          {conversation.lastMessage}
        </p>

        {/* Status badges row */}
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          {getStatusBadge()}

          {conversation.hasGpsTracking && !conversation.isClosed && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-primary/20 text-primary">
              <Navigation className="h-3 w-3" />
              GPS
              {conversation.gpsLastUpdate && (
                <span className="opacity-70">
                  • {formatDistanceToNow(new Date(conversation.gpsLastUpdate), { locale: ptBR })}
                </span>
              )}
            </span>
          )}

          {hasMultipleParticipants && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-muted text-muted-foreground">
              <Users className="h-3 w-3" />
              {participants.length}
            </span>
          )}

          {conversation.isClosed && (
            conversation.isAutoClosedByRatings ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-muted text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                Concluído
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full bg-muted text-muted-foreground">
                Fechada
              </span>
            )
          )}
        </div>
      </div>

      {/* Col 3: Actions (time, close, phone) */}
      <div className="flex flex-col items-end gap-1.5 shrink-0 self-start">
        <span className="text-muted-foreground text-xs whitespace-nowrap">
          {formatDistanceToNow(new Date(conversation.lastMessageTime), {
            addSuffix: true,
            locale: ptBR,
          })}
        </span>


        {/* Phone call shortcut */}
        {conversation.otherParticipant?.phone && !conversation.isClosed && (
          <button
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
            onClick={handlePhoneCall}
            aria-label="Ligar"
          >
            <Phone className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
