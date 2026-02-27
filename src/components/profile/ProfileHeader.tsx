/**
 * ProfileHeader.tsx
 * 
 * Header premium com avatar, camera button sempre visível,
 * chips de role/status, localização e membro desde.
 * 
 * Usa useSignedImageUrl para resolver paths privados em tempo real.
 */

import React, { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Camera, Edit2, X, Check, Loader2, MapPin, Calendar, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ProfileHeaderProps {
  fullName: string;
  role: string;
  status: string;
  photoUrl?: string;
  isEditing: boolean;
  isSaving?: boolean;
  isPhotoUploading?: boolean;
  onEditToggle: () => void;
  onSave?: () => void;
  onPhotoChange?: (file: File) => void;
  onRemovePhoto?: () => void;
  location?: string;
  memberSince?: string;
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
    'APPROVED': { label: '✓ Aprovado', variant: 'default' },
    'approved': { label: '✓ Aprovado', variant: 'default' },
    'PENDING': { label: 'Pendente', variant: 'secondary' },
    'pending': { label: 'Pendente', variant: 'secondary' },
    'REJECTED': { label: 'Rejeitado', variant: 'destructive' },
    'rejected': { label: 'Rejeitado', variant: 'destructive' },
    'ACTIVE': { label: '✓ Ativo', variant: 'default' },
    'active': { label: '✓ Ativo', variant: 'default' }
  };
  return statusMap[status] || { label: status || 'Ativo', variant: 'outline' as const };
};

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  fullName,
  role,
  status,
  photoUrl,
  isEditing,
  isSaving,
  isPhotoUploading,
  onEditToggle,
  onSave,
  onPhotoChange,
  onRemovePhoto,
  location,
  memberSince
}) => {
  const statusInfo = getStatusInfo(status);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputId = React.useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // ✅ Resolve relative path → signed URL in real time
  const { url: resolvedPhotoUrl } = useSignedImageUrl(photoUrl);

  const displayUrl = previewUrl || resolvedPhotoUrl || undefined;

  const memberDateStr = memberSince
    ? format(new Date(memberSince), "MMM/yyyy", { locale: ptBR })
    : null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Show preview immediately
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    setPendingFile(file);
    
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  const handleConfirmPhoto = async () => {
    if (pendingFile && onPhotoChange) {
      await onPhotoChange(pendingFile);
      setPendingFile(null);
      setPreviewUrl(null);
    }
  };

  const handleCancelPhoto = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPendingFile(null);
  };

  // Context line: "📍 City/UF • Membro desde fev/2026"
  const contextParts: string[] = [];
  if (location) contextParts.push(`📍 ${location}`);
  if (memberDateStr) contextParts.push(`Membro desde ${memberDateStr}`);
  const contextLine = contextParts.join(' • ');

  return (
    <div className="relative">
      {/* Subtle gradient banner — extra compacto */}
      <div className="h-8 sm:h-10 bg-gradient-to-br from-card via-card to-primary/15 rounded-t-lg border-b border-border/50" />
      
      <div className="px-4 sm:px-6 pb-2">
        <div className="flex flex-col items-center -mt-8 sm:-mt-9">
          {/* Avatar with camera button */}
          <div className="relative group">
            <Avatar className={cn(
              "h-16 w-16 sm:h-20 sm:w-20",
              "border-4 border-background shadow-lg bg-background",
              "transition-transform duration-200"
            )}>
              {isPhotoUploading ? (
                <div className="flex items-center justify-center h-full w-full bg-muted">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <AvatarImage src={displayUrl} alt={fullName} className="object-cover" />
                  <AvatarFallback className="text-xl sm:text-2xl font-bold bg-primary/10 text-primary">
                    {getInitials(fullName)}
                  </AvatarFallback>
                </>
              )}
            </Avatar>
            
            {/* Camera label — opens file selector via native htmlFor, z-50 to avoid overlay blocks */}
            {onPhotoChange && !pendingFile && (
              <>
                {/* Hidden file input — OUTSIDE any overlay/modal layer */}
                <input
                  id="avatar-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />

                {/* Camera trigger — native <label> for maximum cross-browser compatibility */}
                <label
                  htmlFor="avatar-file-input"
                  className={cn(
                    "absolute bottom-0 right-0 z-50",
                    "h-8 w-8 rounded-full cursor-pointer",
                    "bg-primary text-primary-foreground",
                    "flex items-center justify-center",
                    "hover:bg-primary/90 transition-all",
                    "shadow-md border-2 border-background",
                    "active:scale-95",
                    isPhotoUploading && "pointer-events-none opacity-50"
                  )}
                  title="Alterar foto"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <Camera className="h-3.5 w-3.5" />
                </label>

                {photoUrl && onRemovePhoto && (
                  <button
                    type="button"
                    onClick={onRemovePhoto}
                    className={cn(
                      "absolute bottom-0 -left-2 z-50",
                      "h-7 w-7 rounded-full",
                      "bg-destructive text-destructive-foreground",
                      "flex items-center justify-center",
                      "hover:opacity-90 transition-all",
                      "shadow-md border-2 border-background",
                      "active:scale-95"
                    )}
                    title="Remover foto"
                    disabled={isPhotoUploading}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            )}
          </div>

          {/* Photo preview confirm/cancel */}
          {pendingFile && (
            <div className="flex gap-2 mt-2">
              <Button size="sm" variant="outline" onClick={handleCancelPhoto} disabled={isPhotoUploading}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancelar
              </Button>
              <Button size="sm" onClick={handleConfirmPhoto} disabled={isPhotoUploading}>
                {isPhotoUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1" />
                )}
                Salvar
              </Button>
            </div>
          )}

          {/* Name */}
          <h1 className="mt-1.5 text-lg font-bold leading-6 text-foreground text-center truncate max-w-full px-2">
            {fullName}
          </h1>

          {/* Chips */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap justify-center">
            <Badge variant="secondary" className="text-xs">
              {getRoleLabel(role)}
            </Badge>
            <Badge variant={statusInfo.variant} className="text-xs">
              {statusInfo.label}
            </Badge>
          </div>

          {/* Context line — 13px/500 */}
          {contextLine && (
            <p className="mt-1.5 text-[12px] leading-4 font-medium text-muted-foreground text-center">
              {contextLine}
            </p>
          )}

          {/* Edit/Save buttons */}
          <div className="flex gap-2 mt-1.5">
            {isEditing ? (
              <>
                <Button variant="outline" size="sm" onClick={onEditToggle} disabled={isSaving} className="gap-1.5">
                  <X className="h-4 w-4" />
                  <span className="hidden sm:inline">Cancelar</span>
                </Button>
                <Button size="sm" onClick={onSave} disabled={isSaving} className="gap-1.5">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  <span className="hidden sm:inline">{isSaving ? 'Salvando...' : 'Salvar'}</span>
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={onEditToggle} className="gap-1.5">
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
