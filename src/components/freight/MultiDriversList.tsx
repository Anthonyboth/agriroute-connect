/**
 * src/components/freight/MultiDriversList.tsx
 * 
 * Exibe lista de TODOS os motoristas atribuídos a um frete multi-carreta.
 * Cada motorista mostra seu status individual, veículo e localização.
 * Usado no FreightInProgressCard para o produtor ver todos os motoristas.
 */

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { User, Truck, MapPin, WifiOff, Clock, CheckCircle2, Package, Navigation, History, ExternalLink } from 'lucide-react';
import { useMultiDriverLocations, DriverLocationData } from '@/hooks/useMultiDriverLocations';
import { DriverVehiclePreview } from '@/components/freight/DriverVehiclePreview';
import { DriverLocationModal } from '@/components/freight/DriverLocationModal';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { formatSecondsAgo } from '@/lib/maplibre-utils';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

interface MultiDriversListProps {
  freightId: string;
  className?: string;
}

const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  const normalized = status?.toUpperCase().trim() || '';
  
  switch (normalized) {
    case 'ACCEPTED':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'LOADING':
      return <Navigation className="h-4 w-4 text-blue-600" />;
    case 'LOADED':
      return <Package className="h-4 w-4 text-indigo-600" />;
    case 'IN_TRANSIT':
      return <Truck className="h-4 w-4 text-primary animate-pulse" />;
    case 'DELIVERED_PENDING_CONFIRMATION':
      return <MapPin className="h-4 w-4 text-orange-600" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

interface DriverCardProps {
  driver: DriverLocationData;
  index: number;
  freightId: string;
  onOpenLocation: (driver: DriverLocationData) => void;
}

const DriverCard: React.FC<DriverCardProps> = ({ driver, index, freightId, onOpenLocation }) => {
  return (
    <AccordionItem value={driver.driverId} className="border rounded-lg mb-2">
      <AccordionTrigger className="px-3 py-2 hover:no-underline">
        <div className="flex items-center gap-3 w-full">
          {/* Avatar */}
          <div className="relative">
            {driver.avatarUrl ? (
              <img 
                src={driver.avatarUrl} 
                alt={driver.driverName}
                className="h-10 w-10 rounded-full object-cover border-2 border-background"
                onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center border-2 border-background">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
            )}
            {/* Indicador online/offline */}
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-background",
              driver.isOnline ? "bg-green-500" : "bg-gray-400"
            )} />
          </div>

          {/* Info principal */}
          <div className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{driver.driverName}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                #{index + 1}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <StatusIcon status={driver.assignmentStatus} />
              <span className="text-xs text-muted-foreground">
                {getFreightStatusLabel(driver.assignmentStatus)}
              </span>
            </div>
          </div>

          {/* Status badge */}
          <Badge 
            variant={getFreightStatusVariant(driver.assignmentStatus)}
            className="text-[10px] shrink-0"
          >
            {driver.isOnline ? (
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <WifiOff className="h-3 w-3" />
                Offline
              </span>
            )}
          </Badge>
        </div>
      </AccordionTrigger>
      
      <AccordionContent className="px-3 pb-3">
        <div className="space-y-3">
          {/* Veículo */}
          {driver.vehicleType && (
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{driver.vehicleType}</span>
              {driver.vehiclePlate && (
                <span className="text-xs text-muted-foreground font-mono">
                  {driver.vehiclePlate}
                </span>
              )}
            </div>
          )}

          {/* Localização resumida */}
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            {driver.lat && driver.lng ? (
              <span className="text-muted-foreground">
                {driver.isOnline 
                  ? `Atualizado há ${formatSecondsAgo(driver.secondsAgo)}`
                  : `Última posição há ${formatSecondsAgo(driver.secondsAgo)}`
                }
              </span>
            ) : (
              <span className="text-muted-foreground italic">
                Localização não disponível
              </span>
            )}
          </div>

          {/* Botão Localização + Histórico */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={(e) => {
              e.stopPropagation();
              onOpenLocation(driver);
            }}
          >
            <MapPin className="h-4 w-4 mr-2" />
            Localização e Histórico
          </Button>

          {/* Preview do veículo com fotos */}
          <DriverVehiclePreview driverId={driver.driverId} freightId={freightId} />
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export const MultiDriversList: React.FC<MultiDriversListProps> = ({ freightId, className }) => {
  const { drivers, isLoading, error } = useMultiDriverLocations(freightId);
  const [locationModal, setLocationModal] = useState<{
    open: boolean;
    driver: DriverLocationData | null;
  }>({ open: false, driver: null });

  const handleOpenLocation = (driver: DriverLocationData) => {
    setLocationModal({ open: true, driver });
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        <Skeleton className="h-16 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="py-3 text-center text-sm text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  if (drivers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4 text-center">
          <User className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Nenhum motorista atribuído ainda
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className={cn("space-y-1", className)}>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Motoristas ({drivers.length})
          </h4>
          <Badge variant="outline" className="text-[10px]">
            {drivers.filter(d => d.isOnline).length} online
          </Badge>
        </div>
        
        <Accordion type="single" collapsible className="w-full">
          {drivers.map((driver, index) => (
            <DriverCard 
              key={driver.driverId} 
              driver={driver} 
              index={index} 
              freightId={freightId}
              onOpenLocation={handleOpenLocation}
            />
          ))}
        </Accordion>
      </div>

      {/* Modal de Localização + Histórico */}
      {locationModal.driver && (
        <DriverLocationModal
          open={locationModal.open}
          onOpenChange={(open) => setLocationModal({ ...locationModal, open })}
          driverId={locationModal.driver.driverId}
          driverName={locationModal.driver.driverName}
          freightId={freightId}
          avatarUrl={locationModal.driver.avatarUrl}
          lat={locationModal.driver.lat}
          lng={locationModal.driver.lng}
          isOnline={locationModal.driver.isOnline}
          secondsAgo={locationModal.driver.secondsAgo}
          currentStatus={locationModal.driver.assignmentStatus}
        />
      )}
    </>
  );
};
