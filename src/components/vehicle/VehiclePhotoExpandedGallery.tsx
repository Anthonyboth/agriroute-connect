import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { useVehiclePhotos, VehiclePhoto, PHOTO_TYPES } from '@/hooks/useVehiclePhotos';
import { cn } from '@/lib/utils';

interface VehiclePhotoExpandedGalleryProps {
  vehicleId: string;
  isOpen: boolean;
  onClose: () => void;
  initialPhotoIndex?: number;
}

export const VehiclePhotoExpandedGallery: React.FC<VehiclePhotoExpandedGalleryProps> = ({
  vehicleId,
  isOpen,
  onClose,
  initialPhotoIndex = 0,
}) => {
  const { photos, isLoading } = useVehiclePhotos(vehicleId);
  const [currentIndex, setCurrentIndex] = useState(initialPhotoIndex);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    setCurrentIndex(initialPhotoIndex);
    setZoom(1);
  }, [initialPhotoIndex, isOpen]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          navigatePhoto('prev');
          break;
        case 'ArrowRight':
          navigatePhoto('next');
          break;
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          setZoom(z => Math.min(z + 0.25, 3));
          break;
        case '-':
          setZoom(z => Math.max(z - 0.25, 0.5));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, photos.length]);

  const navigatePhoto = useCallback((direction: 'prev' | 'next') => {
    if (photos.length === 0) return;
    
    setZoom(1);
    setCurrentIndex(prev => {
      if (direction === 'prev') {
        return prev === 0 ? photos.length - 1 : prev - 1;
      }
      return prev === photos.length - 1 ? 0 : prev + 1;
    });
  }, [photos.length]);

  const getPhotoTypeLabel = (type: string) => {
    return PHOTO_TYPES.find(t => t.value === type)?.label || 'Foto';
  };

  const currentPhoto = photos[currentIndex];

  const handleDownload = async () => {
    if (!currentPhoto) return;
    
    try {
      const response = await fetch(currentPhoto.photo_url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veiculo_foto_${currentIndex + 1}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar foto:', error);
    }
  };

  if (isLoading || !currentPhoto) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0 bg-black/95 border-none">
        <div className="relative w-full h-full flex flex-col">
          {/* Header */}
          <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between">
            <div className="text-white">
              <h3 className="font-semibold">{getPhotoTypeLabel(currentPhoto.photo_type)}</h3>
              <p className="text-sm text-white/60">{currentIndex + 1} de {photos.length}</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-5 w-5" />
              </Button>
              <span className="text-white text-sm min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={() => setZoom(z => Math.min(z + 0.25, 3))}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={handleDownload}
              >
                <Download className="h-5 w-5" />
              </Button>
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

          {/* Main Image Container */}
          <div className="flex-1 flex items-center justify-center overflow-hidden p-8">
            <div 
              className="relative transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
            >
              <img
                src={currentPhoto.photo_url}
                alt={getPhotoTypeLabel(currentPhoto.photo_type)}
                className="max-w-full max-h-[80vh] object-contain"
                draggable={false}
              />
            </div>
          </div>

          {/* Navigation Arrows */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 text-white z-10"
                onClick={() => navigatePhoto('prev')}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/50 hover:bg-black/70 text-white z-10"
                onClick={() => navigatePhoto('next')}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Thumbnail Strip */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
            <div className="flex gap-2 justify-center overflow-x-auto pb-2">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  onClick={() => {
                    setCurrentIndex(index);
                    setZoom(1);
                  }}
                  className={cn(
                    "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all",
                    index === currentIndex 
                      ? "border-white ring-2 ring-white/50" 
                      : "border-transparent opacity-60 hover:opacity-100"
                  )}
                >
                  <img
                    src={photo.photo_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
