/**
 * VehiclePhotoZoomModal.tsx
 * 
 * Modal dedicado para visualização ampliada de fotos de veículo.
 * Usa portal para evitar conflitos com modais aninhados.
 * 
 * CRÍTICO: Essencial para produtores verificarem veículos dos motoristas.
 */

import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download,
  ZoomIn,
  ZoomOut,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';

interface VehiclePhotoZoomModalProps {
  isOpen: boolean;
  photoUrl: string | null;
  photoTitle: string;
  onClose: () => void;
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  currentIndex?: number;
  totalPhotos?: number;
}

export const VehiclePhotoZoomModal: React.FC<VehiclePhotoZoomModalProps> = ({
  isOpen,
  photoUrl,
  photoTitle,
  onClose,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  currentIndex = 0,
  totalPhotos = 1,
}) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [hasRetried, setHasRetried] = React.useState(false);

  const { url: resolvedPhotoUrl, isLoading: isSigningUrl, refresh } = useSignedImageUrl(photoUrl);

  // Reset states when photo changes
  useEffect(() => {
    if (resolvedPhotoUrl) {
      setIsLoading(true);
      setHasError(false);
      setHasRetried(false);
      setZoom(1);
    }
  }, [resolvedPhotoUrl]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        if (hasPrevious && onPrevious) onPrevious();
        break;
      case 'ArrowRight':
        if (hasNext && onNext) onNext();
        break;
      case '+':
      case '=':
        setZoom(prev => Math.min(prev + 0.25, 3));
        break;
      case '-':
        setZoom(prev => Math.max(prev - 0.25, 0.5));
        break;
    }
  }, [isOpen, onClose, hasNext, hasPrevious, onNext, onPrevious]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleDownload = () => {
    if (!resolvedPhotoUrl) return;
    
    const link = document.createElement('a');
    link.href = resolvedPhotoUrl;
    link.download = `veiculo-${currentIndex + 1}.jpg`;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-3">
          <span className="text-white font-medium text-sm md:text-base">
            {photoTitle}
          </span>
          {totalPhotos > 1 && (
            <span className="text-white/60 text-sm">
              {currentIndex + 1} / {totalPhotos}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setZoom(prev => Math.max(prev - 0.25, 0.5))}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-5 w-5" />
          </Button>
          <span className="text-white/60 text-xs min-w-[3rem] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={() => setZoom(prev => Math.min(prev + 0.25, 3))}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
          
          {/* Download */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={handleDownload}
          >
            <Download className="h-5 w-5" />
          </Button>
          
          {/* Close */}
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Image container */}
      <div className="flex-1 flex items-center justify-center relative overflow-auto p-4">
        {/* Previous button */}
        {hasPrevious && onPrevious && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 rounded-full z-10"
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
        )}

        {/* Image */}
        <div 
          className="relative flex items-center justify-center"
          style={{ 
            transform: `scale(${zoom})`,
            transition: 'transform 0.2s ease-out'
          }}
        >
          {(isLoading || isSigningUrl) && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-white animate-spin" />
            </div>
          )}
          
          {hasError ? (
            <div className="bg-muted/20 rounded-lg p-8 text-center">
              <p className="text-white/60 mb-2">Não foi possível carregar a imagem</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  setHasError(false);
                  setIsLoading(true);
                }}
              >
                Tentar novamente
              </Button>
            </div>
          ) : (
            <img
              src={resolvedPhotoUrl || ''}
              alt={photoTitle}
              className={cn(
                "max-w-[90vw] max-h-[80vh] object-contain rounded-lg shadow-2xl",
                (isLoading || isSigningUrl) && "opacity-0"
              )}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                if (!hasRetried && resolvedPhotoUrl) {
                  setHasRetried(true);
                  void refresh();
                  return;
                }
                setIsLoading(false);
                setHasError(true);
              }}
              draggable={false}
            />
          )}
        </div>

        {/* Next button */}
        {hasNext && onNext && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12 rounded-full z-10"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        )}
      </div>

      {/* Thumbnail navigation */}
      {totalPhotos > 1 && (
        <div className="flex justify-center gap-2 p-4 bg-gradient-to-t from-black/80 to-transparent">
          {Array.from({ length: totalPhotos }).map((_, idx) => (
            <button
              key={idx}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                idx === currentIndex 
                  ? "bg-white w-4" 
                  : "bg-white/40 hover:bg-white/60"
              )}
              onClick={() => {
                // Navigate to specific photo via index difference
                const diff = idx - currentIndex;
                if (diff > 0 && onNext) {
                  for (let i = 0; i < diff; i++) onNext();
                } else if (diff < 0 && onPrevious) {
                  for (let i = 0; i < Math.abs(diff); i++) onPrevious();
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Mobile swipe hint */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 text-white/40 text-xs md:hidden">
        Deslize para navegar • Pressione ESC para fechar
      </div>
    </div>
  );

  // Use portal to render outside of any nested modals
  return createPortal(modalContent, document.body);
};

export default VehiclePhotoZoomModal;
