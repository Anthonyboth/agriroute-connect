/**
 * DriverAvatar - Avatar robusto para motoristas com suporte a URLs assinadas
 * Usa useSignedImageUrl para renovar URLs de buckets privados automaticamente.
 */
import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';

interface DriverAvatarProps {
  profilePhotoUrl?: string | null;
  selfieUrl?: string | null;
  fullName?: string | null;
  className?: string;
  fallbackClassName?: string;
  showFallbackIcon?: boolean;
}

/**
 * Gera iniciais a partir do nome completo
 */
const getInitials = (name: string | null | undefined): string => {
  if (!name) return '??';
  return name
    .split(' ')
    .filter((n) => n.length > 0)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
};

export const DriverAvatar: React.FC<DriverAvatarProps> = ({
  profilePhotoUrl,
  selfieUrl,
  fullName,
  className,
  fallbackClassName,
  showFallbackIcon = false,
}) => {
  // Prioridade: profile_photo > selfie
  const rawUrl = profilePhotoUrl || selfieUrl || null;
  const { url: resolvedUrl } = useSignedImageUrl(rawUrl);

  const initials = getInitials(fullName);

  return (
    <Avatar className={className}>
      {resolvedUrl && (
        <AvatarImage
          src={resolvedUrl}
          alt={fullName || 'Motorista'}
        />
      )}
      <AvatarFallback className={cn(
        "bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold",
        fallbackClassName
      )}>
        {showFallbackIcon ? (
          <User className="h-1/2 w-1/2" />
        ) : (
          initials
        )}
      </AvatarFallback>
    </Avatar>
  );
};
