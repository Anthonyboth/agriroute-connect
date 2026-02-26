/**
 * DriverVehiclePreview.tsx
 *
 * Exibe um preview leve do veículo (tipo/placa mascarada) e algumas fotos
 * do veículo do motorista. Usado no contexto do produtor dentro do card do frete.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, Truck } from 'lucide-react';
import { useParticipantProfile } from '@/hooks/useParticipantProfile';
import { StorageImage } from '@/components/ui/storage-image';

interface DriverVehiclePreviewProps {
  driverId: string;
}

export const DriverVehiclePreview: React.FC<DriverVehiclePreviewProps> = ({ driverId }) => {
  const { vehicle, vehiclePhotos, isLoading } = useParticipantProfile(driverId, 'driver');

  // Evitar “flicker”/poluição visual: só mostra algo quando tiver dado útil
  if (isLoading) return null;
  if (!vehicle && (!vehiclePhotos || vehiclePhotos.length === 0)) return null;

  const photos = (vehiclePhotos || []).slice(0, 3);

  return (
    <Card className="border-dashed">
      <CardContent className="p-3 space-y-2">
        {vehicle && (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium truncate">
                {vehicle.type}
              </p>
            </div>
            <p className="text-xs text-muted-foreground font-mono whitespace-nowrap">
              {vehicle.plate_masked}
            </p>
          </div>
        )}

        {photos.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Camera className="h-3 w-3" />
              <span>Fotos do veículo</span>
            </div>
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((p) => (
                <div key={p.id} className="h-14 w-14 rounded-md overflow-hidden border flex-shrink-0">
                  <StorageImage
                    src={p.photo_url}
                    alt="Foto do veículo"
                    className="h-full w-full"
                    showLoader
                  />
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Para ver todas as fotos, abra o perfil do motorista.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
