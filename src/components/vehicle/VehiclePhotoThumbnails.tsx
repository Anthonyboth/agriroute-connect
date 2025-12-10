import React from 'react';
import { Camera } from 'lucide-react';
import { useVehiclePhotos } from '@/hooks/useVehiclePhotos';

interface VehiclePhotoThumbnailsProps {
  vehicleId: string;
  maxShow?: number;
  onClick?: () => void;
}

export const VehiclePhotoThumbnails: React.FC<VehiclePhotoThumbnailsProps> = ({
  vehicleId,
  maxShow = 4,
  onClick,
}) => {
  const { photos, isLoading, totalPhotos } = useVehiclePhotos(vehicleId);

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
        onClick={onClick}
      >
        <Camera className="h-5 w-5 text-muted-foreground mb-1" />
        <span className="text-[10px] text-muted-foreground">Sem fotos</span>
      </div>
    );
  }

  const displayPhotos = photos.slice(0, maxShow);
  const extraCount = totalPhotos - maxShow;

  return (
    <div 
      className="grid grid-cols-2 gap-1 w-20 cursor-pointer"
      onClick={onClick}
    >
      {displayPhotos.map((photo, index) => (
        <div
          key={photo.id}
          className="aspect-square rounded-sm overflow-hidden relative"
        >
          <img
            src={photo.photo_url}
            alt=""
            className="w-full h-full object-cover"
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
  );
};
