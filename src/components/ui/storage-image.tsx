import React, { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ImageOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StorageImageProps {
  src: string;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  onClick?: () => void;
  showLoader?: boolean;
}

/**
 * Componente de imagem robusto que tenta carregar de storage
 * Se falhar, tenta gerar signed URL automaticamente
 */
export const StorageImage: React.FC<StorageImageProps> = ({
  src,
  alt = '',
  className,
  fallbackClassName,
  onClick,
  showLoader = true,
}) => {
  const [imageSrc, setImageSrc] = useState(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retried, setRetried] = useState(false);

  const extractStoragePath = useCallback((url: string): { bucket: string; path: string } | null => {
    // Pattern: /storage/v1/object/public/{bucket}/{path}
    const publicMatch = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
    if (publicMatch) {
      return { bucket: publicMatch[1], path: publicMatch[2] };
    }
    
    // Pattern: /storage/v1/object/sign/{bucket}/{path}
    const signedMatch = url.match(/\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)/);
    if (signedMatch) {
      return { bucket: signedMatch[1], path: signedMatch[2] };
    }
    
    return null;
  }, []);

  const handleError = useCallback(async () => {
    if (retried) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    setRetried(true);

    // Tentar extrair bucket/path e gerar signed URL
    const storageInfo = extractStoragePath(src);
    if (storageInfo) {
      try {
        const { data, error } = await supabase.storage
          .from(storageInfo.bucket)
          .createSignedUrl(storageInfo.path, 3600); // 1 hora

        if (!error && data?.signedUrl) {
          setImageSrc(data.signedUrl);
          return;
        }
      } catch (e) {
        console.warn('Failed to create signed URL:', e);
      }
    }

    setHasError(true);
    setIsLoading(false);
  }, [src, retried, extractStoragePath]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  if (hasError) {
    return (
      <div 
        className={cn(
          "flex items-center justify-center bg-muted",
          fallbackClassName || className
        )}
        onClick={onClick}
      >
        <ImageOff className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("relative", className)} onClick={onClick}>
      {isLoading && showLoader && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={imageSrc}
        alt={alt}
        className={cn("w-full h-full object-cover", isLoading && "opacity-0")}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
};
