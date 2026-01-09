import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ImageOff, ZoomIn, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImagePreviewProps {
  url?: string | null;
  alt: string;
  className?: string;
  fallbackText?: string;
  showZoom?: boolean;
  aspectRatio?: 'square' | 'video' | 'portrait' | 'auto';
}

/**
 * Componente de preview de imagem com fallback e tratamento de erro
 * Usado para exibir fotos de documentos, CNH, perfil, etc.
 */
export const ImagePreview: React.FC<ImagePreviewProps> = ({
  url,
  alt,
  className,
  fallbackText = 'Foto não enviada',
  showZoom = true,
  aspectRatio = 'auto',
}) => {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const aspectClasses = {
    square: 'aspect-square',
    video: 'aspect-video',
    portrait: 'aspect-[3/4]',
    auto: '',
  };

  // Se não há URL ou houve erro, mostrar fallback
  if (!url || hasError) {
    return (
      <div 
        className={cn(
          "flex flex-col items-center justify-center p-6 sm:p-8 border-2 border-dashed rounded-lg bg-muted/50 min-h-[120px]",
          aspectClasses[aspectRatio],
          className
        )}
      >
        <ImageOff className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/50 mb-2" />
        <p className="text-sm text-muted-foreground text-center">
          {hasError ? 'Erro ao carregar imagem' : fallbackText}
        </p>
        {hasError && url && (
          <button 
            onClick={() => { setHasError(false); setIsLoading(true); }}
            className="mt-2 text-xs text-primary hover:underline"
          >
            Tentar novamente
          </button>
        )}
      </div>
    );
  }

  const handleOpenImage = () => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div 
      className={cn(
        "relative group overflow-hidden rounded-lg border bg-muted/20",
        aspectClasses[aspectRatio],
        className
      )}
    >
      {/* Loading skeleton */}
      {isLoading && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      
      {/* Imagem */}
      <img
        src={url}
        alt={alt}
        className={cn(
          "w-full h-full object-contain transition-opacity duration-300",
          isLoading ? 'opacity-0' : 'opacity-100',
          showZoom && 'cursor-pointer hover:scale-105 transition-transform duration-200'
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        onClick={showZoom ? handleOpenImage : undefined}
        loading="lazy"
      />
      
      {/* Overlay com ações */}
      {showZoom && !isLoading && (
        <div 
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2 cursor-pointer"
          onClick={handleOpenImage}
        >
          <div className="bg-white/90 rounded-full p-2 shadow-lg">
            <ZoomIn className="h-5 w-5 text-gray-700" />
          </div>
          <div className="bg-white/90 rounded-full p-2 shadow-lg">
            <ExternalLink className="h-5 w-5 text-gray-700" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ImagePreview;
