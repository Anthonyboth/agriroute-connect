import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Copy, Trash2, Share2, Users } from 'lucide-react';

interface TemplateCardActionsProps {
  templateId: string;
  isOwner: boolean;
  isShared: boolean;
  onRename: (templateId: string) => void;
  onDuplicate: (templateId: string) => void;
  onDelete: (templateId: string) => void;
  onShare: (templateId: string) => void;
  disabled?: boolean;
}

export const TemplateCardActions: React.FC<TemplateCardActionsProps> = ({
  templateId,
  isOwner,
  isShared,
  onRename,
  onDuplicate,
  onDelete,
  onShare,
  disabled,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled}>
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isOwner && (
          <>
            <DropdownMenuItem onClick={() => onRename(templateId)}>
              <Pencil className="mr-2 h-4 w-4" />
              Renomear
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onShare(templateId)}>
              {isShared ? (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Gerenciar Compartilhamento
                </>
              ) : (
                <>
                  <Share2 className="mr-2 h-4 w-4" />
                  Compartilhar com Empresa
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={() => onDuplicate(templateId)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicar
        </DropdownMenuItem>
        {isOwner && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDelete(templateId)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
