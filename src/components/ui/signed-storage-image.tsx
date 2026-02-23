/**
 * Componente para exibir imagens de buckets privados do Supabase Storage.
 * Regenera automaticamente URLs assinadas expiradas.
 */
import { useEffect, useState } from 'react';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { Loader2 } from 'lucide-react';

interface SignedStorageImageProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  onClick?: () => void;
  adminMode?: boolean;
}

export const SignedStorageImage = ({ src, alt, className, onClick, adminMode = false }: SignedStorageImageProps) => {
  const { url, isLoading, refresh } = useSignedImageUrl(src, { preferAdminApi: adminMode });
  const [hasRetried, setHasRetried] = useState(false);

  useEffect(() => {
    setHasRetried(false);
  }, [src]);

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!url) return null;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onClick={onClick}
      onError={() => {
        if (hasRetried) return;
        setHasRetried(true);
        void refresh();
      }}
    />
  );
};
