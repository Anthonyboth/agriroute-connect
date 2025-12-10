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
      <div className="flex items-start gap-3">
        {/* Avatares empilhados para múltiplos participantes */}
        <div className="relative shrink-0">
          {participants.length > 0 ? (
            <div className="flex -space-x-2">
              {participants.slice(0, 3).map((p, idx) => (
                <Avatar 
                  key={p.id} 
                  className={`h-10 w-10 border-2 border-background ${idx > 0 ? '-ml-3' : ''}`}
                  style={{ zIndex: 3 - idx }}
                >
                  <AvatarFallback className={getRoleBadgeColor(p.role)}>
                    {getInitials(p.name)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {participants.length > 3 && (
                <Avatar className="h-10 w-10 border-2 border-background -ml-3">
                  <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                    +{participants.length - 3}
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ) : (
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-primary/10 text-primary">
                {getInitials(conversation.otherParticipant.name)}
              </AvatarFallback>
            </Avatar>
          )}
          
          {/* Indicador GPS pulsando com tempo */}
          {conversation.hasGpsTracking && !conversation.isClosed && (
            <div 
              className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 animate-pulse"
              title={conversation.gpsLastUpdate 
                ? `Última atualização: ${formatDistanceToNow(new Date(conversation.gpsLastUpdate), { addSuffix: true, locale: ptBR })}`
                : 'GPS ativo'
              }
            >
              <Navigation className="h-3 w-3 text-white" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
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

          {/* Status do frete, GPS info e contagem de participantes */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {getStatusBadge()}
            
            {/* Indicador GPS detalhado com última atualização */}
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
                {participants.length} participantes
              </Badge>
            )}
            
            {/* Botão de ligação rápida */}
            {conversation.otherParticipant?.phone && !conversation.isClosed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePhoneCall}
                className="h-5 px-1.5 py-0 text-xs gap-1 text-green-700 dark:text-green-300 hover:bg-green-500/10"
              >
                <Phone className="h-3 w-3" />
              </Button>
            )}
          </div>

          {/* Nomes dos participantes */}
          <p className="text-xs text-muted-foreground mb-1 truncate">
            {participants.length > 0 
              ? participants.map(p => p.name).join(', ')
              : conversation.otherParticipant.name
            }
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

        {onClose && !conversation.isClosed && !conversation.isAutoClosedByRatings && (
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
        <div className="mt-2 flex gap-2">
          {conversation.isAutoClosedByRatings ? (
            <Badge variant="secondary" className="text-xs gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Concluído com avaliações
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              Fechada
            </Badge>
          )}
        </div>
      )}
    </Card>
  );
};
