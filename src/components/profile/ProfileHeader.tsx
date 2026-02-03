/**
 * ProfileHeader.tsx
 * 
 * Header estilo Facebook com foto de capa, avatar, nome e badges.
 * Mobile-first com suporte a edição de foto.
 */

import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Edit2, X, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProfileHeaderProps {
  fullName: string;
  email?: string;
  role: string;
  status: string;
  photoUrl?: string;
  isEditing: boolean;
  isSaving?: boolean;
  onEditToggle: () => void;
  onSave?: () => void;
  onPhotoChange?: (file: File) => void;
}

const getRoleLabel = (role: string) => {
  const roleMap: Record<string, string> = {
    'MOTORISTA': 'Motorista',
    'MOTORISTA_AFILIADO': 'Motorista Afiliado',
    'PRODUTOR': 'Produtor',
    'PRESTADOR_SERVICOS': 'Prestador de Serviços',
    'TRANSPORTADORA': 'Transportadora',
    'ADMIN': 'Administrador'
  };
  return roleMap[role] || role || 'Usuário';
};

const getStatusInfo = (status: string) => {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'APPROVED': { label: 'Aprovado', variant: 'default' },
    'approved': { label: 'Aprovado', variant: 'default' },
    'PENDING': { label: 'Pendente', variant: 'secondary' },
    'pending': { label: 'Pendente', variant: 'secondary' },
    'REJECTED': { label: 'Rejeitado', variant: 'destructive' },
    'rejected': { label: 'Rejeitado', variant: 'destructive' },
    'ACTIVE': { label: 'Ativo', variant: 'default' },
    'active': { label: 'Ativo', variant: 'default' }
  };
  return statusMap[status] || { label: status || 'Ativo', variant: 'outline' as const };
};

const getInitials = (name: string) => {
  if (!name) return '?';
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
};

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  fullName,
  email,
  role,
  status,
  photoUrl,
  isEditing,
  isSaving,
  onEditToggle,
  onSave,
  onPhotoChange
}) => {
  const statusInfo = getStatusInfo(status);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onPhotoChange) {
      onPhotoChange(file);
    }
  };

  return (
    <div className="relative">
      {/* Cover/Banner - Gradiente estilo Facebook */}
      <div className="h-28 sm:h-36 md:h-44 bg-gradient-to-r from-primary via-primary/80 to-accent rounded-t-lg" />
      
      {/* Conteúdo do Header */}
      <div className="px-4 sm:px-6 pb-4">
        {/* Avatar + Info */}
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-12 sm:-mt-14">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <Avatar className={cn(
              "h-24 w-24 sm:h-28 sm:w-28 md:h-32 md:w-32",
              "border-4 border-background shadow-lg bg-background"
            )}>
              <AvatarImage src={photoUrl} alt={fullName} className="object-cover" />
              <AvatarFallback className="text-xl sm:text-2xl font-bold bg-primary/10 text-primary">
                {getInitials(fullName)}
              </AvatarFallback>
            </Avatar>
            
            {/* Botão de foto - só mostra em modo edição */}
            {isEditing && onPhotoChange && (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "absolute bottom-1 right-1",
                    "h-8 w-8 rounded-full",
                    "bg-primary text-primary-foreground",
                    "flex items-center justify-center",
                    "hover:bg-primary/90 transition-colors",
                    "shadow-md border-2 border-background"
                  )}
                  title="Alterar foto"
                >
                  <Camera className="h-4 w-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </>
            )}
          </div>

          {/* Nome e Info */}
          <div className="flex-1 min-w-0 pt-2 sm:pt-0 sm:pb-2">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground truncate">
              {fullName}
            </h1>
            {email && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {email}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {getRoleLabel(role)}
              </Badge>
              <Badge variant={statusInfo.variant} className="text-xs">
                {statusInfo.label}
              </Badge>
            </div>
          </div>

          {/* Botão Editar/Salvar */}
          <div className="flex gap-2 sm:pb-2">
            {isEditing ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onEditToggle}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Cancelar</span>
                </Button>
                <Button
                  size="sm"
                  onClick={onSave}
                  disabled={isSaving}
                  className="gap-1.5"
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">
                    {isSaving ? 'Salvando...' : 'Salvar'}
                  </span>
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onEditToggle}
                className="gap-1.5"
              >
                <Edit2 className="h-4 w-4" />
                <span>Editar Perfil</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
