/**
 * DriverAvatar - Avatar robusto para motoristas com suporte a URLs assinadas expiradas
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface DriverAvatarProps {
  profilePhotoUrl?: string | null;
  selfieUrl?: string | null;
  fullName?: string | null;
  className?: string;
  fallbackClassName?: string;
  showFallbackIcon?: boolean;
}

/**
 * Extrai bucket e path de uma URL do Supabase Storage
 */
const extractStoragePath = (url: string): { bucket: string; path: string } | null => {
  if (!url) return null;
  
  // Pattern: /storage/v1/object/sign/{bucket}/{path}?token=...
  const signedMatch = url.match(/\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)/);
  if (signedMatch) {
    return { bucket: signedMatch[1], path: decodeURIComponent(signedMatch[2]) };
  }
  
  // Pattern: /storage/v1/object/public/{bucket}/{path}
  const publicMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
  if (publicMatch) {
    return { bucket: publicMatch[1], path: decodeURIComponent(publicMatch[2]) };
  }
  
  return null;
};

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
  const [imageSrc, setImageSrc] = useState<string | null>(profilePhotoUrl || selfieUrl || null);
  const [hasError, setHasError] = useState(false);
  const [retried, setRetried] = useState(false);

  // Atualizar quando as props mudam
  useEffect(() => {
    const newSrc = profilePhotoUrl || selfieUrl || null;
    setImageSrc(newSrc);
    setHasError(false);
    setRetried(false);
  }, [profilePhotoUrl, selfieUrl]);

  const handleImageError = useCallback(async () => {
    if (retried) {
      setHasError(true);
      return;
    }

    setRetried(true);
    const originalUrl = profilePhotoUrl || selfieUrl;
    
    if (!originalUrl) {
      setHasError(true);
      return;
    }

    // Tentar regenerar URL assinada
    const storageInfo = extractStoragePath(originalUrl);
    if (storageInfo) {
      try {
        const { data, error } = await supabase.storage
          .from(storageInfo.bucket)
          .createSignedUrl(storageInfo.path, 3600);

        if (!error && data?.signedUrl) {
          setImageSrc(data.signedUrl);
          return;
        }
      } catch (e) {
        console.warn('[DriverAvatar] Falha ao regenerar URL:', e);
      }
    }

    setHasError(true);
  }, [profilePhotoUrl, selfieUrl, retried]);

  const initials = getInitials(fullName);

  return (
    <Avatar className={className}>
      {imageSrc && !hasError && (
        <AvatarImage 
          src={imageSrc} 
          alt={fullName || 'Motorista'} 
          onError={handleImageError}
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
