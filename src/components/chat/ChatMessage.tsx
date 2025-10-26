import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, CheckCheck, MoreVertical, Reply, Trash2, Edit, Download, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatMessageProps {
  message: {
    id: string;
    sender_id: string;
    message: string;
    image_url?: string;
    file_url?: string;
    file_name?: string;
    file_type?: string;
    file_size?: number;
    reply_to_message_id?: string;
    created_at: string;
    read_at?: string;
    delivered_at?: string;
    edited_at?: string;
    deleted_at?: string;
    sender_type?: string;
  };
  isSender: boolean;
  senderName: string;
  senderAvatar?: string;
  replyToMessage?: any;
  onReply?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  showAvatar?: boolean;
}

export function ChatMessage({
  message,
  isSender,
  senderName,
  senderAvatar,
  replyToMessage,
  onReply,
  onDelete,
  onEdit,
  showAvatar = true,
}: ChatMessageProps) {
  const [imageError, setImageError] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const isDeleted = !!message.deleted_at;
  const isEdited = !!message.edited_at;

  const getStatusIcon = () => {
    if (!isSender) return null;
    
    if (message.read_at) {
      return <CheckCheck className="w-4 h-4 text-primary" />;
    }
    if (message.delivered_at) {
      return <CheckCheck className="w-4 h-4 text-muted-foreground" />;
    }
    return <Check className="w-4 h-4 text-muted-foreground" />;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const downloadFile = () => {
    if (message.file_url) {
      window.open(message.file_url, '_blank');
    }
  };

  if (isDeleted) {
    return (
      <div className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-2`}>
        <div className={`max-w-[70%] px-4 py-2 rounded-lg ${
          isSender ? 'bg-muted' : 'bg-muted'
        }`}>
          <p className="text-sm text-muted-foreground italic">
            Mensagem removida
          </p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`flex ${isSender ? 'justify-end' : 'justify-start'} mb-3 group`}
      onMouseEnter={() => setShowMenu(true)}
      onMouseLeave={() => setShowMenu(false)}
    >
      {!isSender && showAvatar && (
        <Avatar className="w-8 h-8 mr-2 mt-1">
          <AvatarImage src={senderAvatar} />
          <AvatarFallback className="text-xs">
            {getInitials(senderName)}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`max-w-[70%] ${isSender ? 'items-end' : 'items-start'} flex flex-col`}>
        {!isSender && showAvatar && (
          <span className="text-xs text-muted-foreground mb-1 px-1">
            {senderName}
          </span>
        )}
        
        <div className="relative">
          <div
            className={`rounded-lg px-4 py-2 ${
              isSender
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-foreground'
            }`}
          >
            {/* Reply Preview */}
            {replyToMessage && (
              <div className="mb-2 p-2 border-l-2 border-primary/50 bg-background/10 rounded">
                <p className="text-xs opacity-75 mb-1">{replyToMessage.senderName}</p>
                <p className="text-xs opacity-90 line-clamp-2">
                  {replyToMessage.message}
                </p>
              </div>
            )}

            {/* Image */}
            {message.image_url && !imageError && (
              <div className="mb-2">
                <img
                  src={message.image_url}
                  alt="Imagem enviada"
                  className="rounded max-w-full max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(message.image_url, '_blank')}
                  onError={() => setImageError(true)}
                />
              </div>
            )}

            {/* File */}
            {message.file_url && (
              <div className="mb-2 p-3 bg-background/10 rounded flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{message.file_name}</p>
                  <p className="text-xs opacity-75">
                    {message.file_type} • {message.file_size ? `${(message.file_size / 1024).toFixed(0)}KB` : ''}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-2 shrink-0"
                  onClick={downloadFile}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            )}

            {/* Text Message */}
            {message.message && (
              <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
            )}

            {/* Time and Status */}
            <div className="flex items-center justify-end gap-1 mt-1">
              {isEdited && (
                <span className="text-xs opacity-70">editado</span>
              )}
              <span className="text-xs opacity-70">
                {formatDistanceToNow(new Date(message.created_at), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
              {getStatusIcon()}
            </div>
          </div>

          {/* Message Menu */}
          {showMenu && (onReply || onDelete || onEdit) && (
            <div className={`absolute top-0 ${isSender ? '-left-10' : '-right-10'}`}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isSender ? "end" : "start"}>
                  {onReply && (
                    <DropdownMenuItem onClick={onReply}>
                      <Reply className="w-4 h-4 mr-2" />
                      Responder
                    </DropdownMenuItem>
                  )}
                  {isSender && onEdit && !message.file_url && !message.image_url && (
                    <DropdownMenuItem onClick={onEdit}>
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                  )}
                  {isSender && onDelete && (
                    <DropdownMenuItem onClick={onDelete} className="text-destructive">
                      <Trash2 className="w-4 h-4 mr-2" />
                      Deletar
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {isSender && showAvatar && (
        <Avatar className="w-8 h-8 ml-2 mt-1">
          <AvatarImage src={senderAvatar} />
          <AvatarFallback className="text-xs">
            {getInitials(senderName)}
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
