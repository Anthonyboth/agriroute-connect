import React, { useState } from 'react';
import { Camera, X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useVehiclePhotos } from '@/hooks/useVehiclePhotos';
import { StorageImage } from '@/components/ui/storage-image';
import { Dialog, DialogContent, VisuallyHidden, DialogTitle } from '@/components/ui/dialog';

interface VehiclePhotoThumbnailsProps {
  vehicleId: string;
  maxShow?: number;
  onClick?: () => void;
  vehiclePlate?: string;
}

export const VehiclePhotoThumbnails: React.FC<VehiclePhotoThumbnailsProps> = ({
  vehicleId,
  maxShow = 4,
  onClick,
  vehiclePlate,
}) => {
  const { photos, isLoading, totalPhotos } = useVehiclePhotos(vehicleId);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (totalPhotos > 0) {
      setGalleryOpen(true);
      setCurrentIndex(0);
    }
  };

  const navigatePhoto = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? (currentIndex - 1 + photos.length) % photos.length
      : (currentIndex + 1) % photos.length;
    setCurrentIndex(newIndex);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-1 w-20">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="aspect-square bg-muted animate-pulse rounded-sm" />
        ))}
      </div>
    );
  }

  if (totalPhotos === 0) {
    return (
      <div 
        className="w-20 h-20 bg-muted rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
        onClick={handleClick}
      >
        <Camera className="h-5 w-5 text-muted-foreground mb-1" />
        <span className="text-[10px] text-muted-foreground">Sem fotos</span>
      </div>
    );
  }

  const displayPhotos = photos.slice(0, maxShow);
  const extraCount = totalPhotos - maxShow;
  const currentPhoto = photos[currentIndex];

  return (
    <>
      <div 
        className="grid grid-cols-2 gap-1 w-20 cursor-pointer"
        onClick={handleClick}
      >
        {displayPhotos.map((photo, index) => (
          <div
            key={photo.id}
            className="aspect-square rounded-sm overflow-hidden relative"
          >
            <StorageImage
              src={photo.photo_url}
              alt=""
              className="w-full h-full object-cover"
              showLoader={false}
            />
            
            {/* Badge +X no último item */}
            {index === maxShow - 1 && extraCount > 0 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-xs font-medium">+{extraCount}</span>
              </div>
            )}
          </div>
        ))}

        {/* Preencher grid vazio se menos de 4 fotos */}
        {displayPhotos.length < maxShow && displayPhotos.length > 0 && (
          Array.from({ length: maxShow - displayPhotos.length }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square bg-muted/50 rounded-sm" />
          ))
        )}
      </div>

      {/* Modal de Galeria */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-3xl p-0 bg-black/95 border-none" aria-label="Galeria de Fotos">
          <VisuallyHidden>
            <DialogTitle>
              {vehiclePlate ? `Fotos - ${vehiclePlate}` : 'Galeria de Fotos'}
            </DialogTitle>
          </VisuallyHidden>
          <div className="relative">
            {/* Navegação */}
            {photos.length > 1 && (
              <>
                <button
                  onClick={() => navigatePhoto('prev')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center z-10"
                >
                  <ChevronLeft className="h-6 w-6 text-white" />
                </button>
                <button
                  onClick={() => navigatePhoto('next')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center z-10"
                >
                  <ChevronRight className="h-6 w-6 text-white" />
                </button>
              </>
            )}

            {/* Imagem */}
            {currentPhoto && (
              <StorageImage
                src={currentPhoto.photo_url}
                alt={`Foto ${currentIndex + 1}`}
                className="w-full max-h-[80vh] object-contain"
              />
            )}

            {/* Botão abrir em nova aba */}
            {currentPhoto && (
              <button
                onClick={() => window.open(currentPhoto.photo_url, '_blank')}
                className="absolute top-2 left-2 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-4 w-4 text-white" />
              </button>
            )}

            {/* Info da foto */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <div className="flex items-center justify-between text-white">
                <span className="text-sm">{vehiclePlate || 'Foto do veículo'}</span>
                <span className="text-xs text-white/60">{currentIndex + 1} de {photos.length}</span>
              </div>
            </div>

            {/* Botão fechar */}
            <button
              onClick={() => setGalleryOpen(false)}
              className="absolute top-2 right-2 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>

          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="p-4 overflow-x-auto">
              <div className="flex gap-2 justify-center">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    onClick={() => setCurrentIndex(index)}
                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                      currentIndex === index
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                  >
                    <StorageImage
                      src={photo.photo_url}
                      alt=""
                      className="w-full h-full object-cover"
                      showLoader={false}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
