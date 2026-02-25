import React, { useState, useEffect } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';

interface StorageImageProps {
  src: string;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
  onClick?: () => void;
  showLoader?: boolean;
}

/**
 * Componente de imagem robusto para Supabase Storage.
 * Usa useSignedImageUrl para renovar URLs expiradas e resolver paths privados.
 */
export const StorageImage: React.FC<StorageImageProps> = ({
  src,
  alt = '',
  className,
  fallbackClassName,
  onClick,
  showLoader = true,
}) => {
  const { url, isLoading: signingLoading, refresh } = useSignedImageUrl(src);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    setHasError(false);
    setRetried(false);
  }, [src, url]);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
  };

  const handleError = async () => {
    if (retried) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    setRetried(true);
    await refresh();
  };

  if (!url && !signingLoading) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted',
          fallbackClassName || className,
        )}
        onClick={onClick}
      >
        <ImageOff className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  if (hasError) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted',
          fallbackClassName || className,
        )}
        onClick={onClick}
      >
        <ImageOff className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('relative', className)} onClick={onClick}>
      {(isLoading || signingLoading) && showLoader && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {url && (
        <img
          src={url}
          alt={alt}
          className={cn('w-full h-full object-cover', (isLoading || signingLoading) && 'opacity-0')}
          onLoad={handleLoad}
          onError={() => {
            void handleError();
          }}
        />
      )}
    </div>
  );
};
