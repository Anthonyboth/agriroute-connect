import { useState, useRef, useEffect } from "react";
import { CenteredSpinner, InlineSpinner } from "@/components/ui/AppSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useProposalChat } from "@/hooks/useProposalChat";
import { Send, Image as ImageIcon, Paperclip, Loader2, Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useProposalTypingIndicator } from "@/hooks/useProposalTypingIndicator";
import { TypingIndicator } from "@/components/chat/TypingIndicator";

interface ProposalChatPanelProps {
  proposalId: string;
  currentUserId: string;
  currentUserName: string;
  userRole: 'producer' | 'driver';
}

export const ProposalChatPanel = ({
  proposalId,
  currentUserId,
  currentUserName,
  userRole,
}: ProposalChatPanelProps) => {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    messages,
    isLoading,
    isSending,
    unreadCount,
    sendMessage,
    uploadImage,
    uploadFile,
  } = useProposalChat(proposalId, currentUserId);

  // Sistema de digitação em tempo real
  const { typingUsers, handleTyping } = useProposalTypingIndicator({
    proposalId,
    userId: currentUserId,
    userName: currentUserName,
    userRole,
  });

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (newMessage.trim() && !isSending) {
      await sendMessage(newMessage);
      setNewMessage("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadImage(file);
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  if (isLoading) {
    return <CenteredSpinner className="h-64" />;
  }

  return (
    <div className="flex flex-col h-[500px] border rounded-lg">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold" translate="no">Chat de Negociação</h3>
          {unreadCount > 0 && (
            <Badge variant="destructive">{unreadCount} nova(s)</Badge>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Indicador de digitação */}
          {typingUsers.length > 0 && (
            <TypingIndicator
              userName={
                typingUsers[0].userRole === 'driver'
                  ? 'Motorista está digitando...'
                  : 'Produtor está digitando...'
              }
              userAvatar={undefined}
            />
          )}

          {messages.map((message) => {
            const isSender = message.sender_id === currentUserId;
            const senderName = isSender
              ? currentUserName
              : message.sender?.full_name || "Usuário";

            return (
              <div
                key={message.id}
                className={`flex gap-3 ${isSender ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={message.sender?.avatar_url || undefined} />
                  <AvatarFallback>
                    {senderName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className={`flex-1 ${isSender ? "text-right" : ""}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium" translate="no">
                      {senderName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(message.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  <div
                    className={`inline-block rounded-lg px-4 py-2 ${
                      isSender
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {message.message_type === "text" && (
                      <p className="text-sm whitespace-pre-wrap" translate="no">
                        {message.content}
                      </p>
                    )}

                    {message.message_type === "image" && message.image_url && (
                      <img
                        src={message.image_url}
                        alt="Imagem enviada"
                        className="max-w-xs rounded"
                      />
                    )}

                    {message.message_type === "file" && message.file_url && (
                      <a
                        href={message.file_url}
                        download={message.file_name}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <Download className="h-4 w-4" />
                        <div className="text-left">
                          <p className="text-sm font-medium" translate="no">
                            {message.file_name}
                          </p>
                          <p className="text-xs opacity-70">
                            {formatFileSize(message.file_size)}
                          </p>
                        </div>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-muted/50">
        <div className="flex gap-2">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageSelect}
            disabled={isSending}
          />
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileSelect}
            disabled={isSending}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => imageInputRef.current?.click()}
            disabled={isSending}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
          >
            <Paperclip className="h-4 w-4" />
          </Button>

          <Input
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => {
              setNewMessage(e.target.value);
              handleTyping();
            }}
            onKeyPress={handleKeyPress}
            disabled={isSending}
            className="flex-1"
            translate="no"
          />

          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
