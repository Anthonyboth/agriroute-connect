/**
 * src/components/freight/DriverLocationModal.tsx
 * 
 * Modal que exibe a localização exata de um motorista no mapa
 * e o histórico de status individual dele no frete.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { X, MapPin, History, Clock, User, Truck, Navigation, ExternalLink, WifiOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { formatSecondsAgo } from '@/lib/maplibre-utils';

interface DriverLocationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  driverId: string;
  driverName: string;
  freightId: string;
  avatarUrl?: string;
  lat?: number;
  lng?: number;
  isOnline?: boolean;
  secondsAgo?: number;
  currentStatus?: string;
}

interface StatusHistoryItem {
  id: string;
  status: string;
  created_at: string;
  notes?: string;
  location_lat?: number;
  location_lng?: number;
}

export const DriverLocationModal: React.FC<DriverLocationModalProps> = ({
  open,
  onOpenChange,
  driverId,
  driverName,
  freightId,
  avatarUrl,
  lat,
  lng,
  isOnline = false,
  secondsAgo = 0,
  currentStatus
}) => {
  const [statusHistory, setStatusHistory] = useState<StatusHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Buscar histórico de status do motorista neste frete
  useEffect(() => {
    if (!open || !freightId || !driverId) return;

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        // Buscar do driver_trip_progress e freight_status_history
        const [tripProgressRes, statusHistoryRes] = await Promise.all([
          supabase
            .from('driver_trip_progress')
            .select('id, current_status, accepted_at, loading_at, loaded_at, in_transit_at, delivered_at, updated_at, driver_notes, last_lat, last_lng')
            .eq('freight_id', freightId)
            .eq('driver_id', driverId)
            .maybeSingle(),
          supabase
            .from('freight_status_history')
            .select('id, status, created_at, notes, location_lat, location_lng')
            .eq('freight_id', freightId)
            .eq('changed_by', driverId)
            .order('created_at', { ascending: false })
            .limit(20)
        ]);

        const items: StatusHistoryItem[] = [];

        // Converter trip_progress em histórico de eventos
        if (tripProgressRes.data) {
          const progress = tripProgressRes.data;
          
          if (progress.delivered_at) {
            items.push({
              id: `tp-delivered-${progress.id}`,
              status: 'DELIVERED_PENDING_CONFIRMATION',
              created_at: progress.delivered_at,
              notes: progress.driver_notes,
              location_lat: progress.last_lat,
              location_lng: progress.last_lng
            });
          }
          if (progress.in_transit_at) {
            items.push({
              id: `tp-transit-${progress.id}`,
              status: 'IN_TRANSIT',
              created_at: progress.in_transit_at,
              location_lat: progress.last_lat,
              location_lng: progress.last_lng
            });
          }
          if (progress.loaded_at) {
            items.push({
              id: `tp-loaded-${progress.id}`,
              status: 'LOADED',
              created_at: progress.loaded_at,
              location_lat: progress.last_lat,
              location_lng: progress.last_lng
            });
          }
          if (progress.loading_at) {
            items.push({
              id: `tp-loading-${progress.id}`,
              status: 'LOADING',
              created_at: progress.loading_at,
              location_lat: progress.last_lat,
              location_lng: progress.last_lng
            });
          }
          if (progress.accepted_at) {
            items.push({
              id: `tp-accepted-${progress.id}`,
              status: 'ACCEPTED',
              created_at: progress.accepted_at
            });
          }
        }

        // Adicionar histórico da tabela freight_status_history (sem duplicar)
        if (statusHistoryRes.data) {
          for (const h of statusHistoryRes.data) {
            // Evitar duplicatas do trip_progress
            const isDuplicate = items.some(i => 
              i.status === h.status && 
              Math.abs(new Date(i.created_at).getTime() - new Date(h.created_at).getTime()) < 60000
            );
            if (!isDuplicate) {
              items.push(h);
            }
          }
        }

        // Ordenar por data (mais recente primeiro)
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        
        setStatusHistory(items);
      } catch (err) {
        console.error('[DriverLocationModal] Error fetching history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [open, freightId, driverId]);

  // Abrir Google Maps com a localização
  const openInGoogleMaps = () => {
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank');
    }
  };

  const hasLocation = lat != null && lng != null && !isNaN(lat) && !isNaN(lng);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt={driverName}
                  className="h-12 w-12 rounded-full object-cover border-2 border-background"
                  onError={(e) => { e.currentTarget.src = '/placeholder.svg'; }}
                />
              ) : (
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              <div>
                <DialogTitle className="text-lg">{driverName}</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
                    {currentStatus && (
                      <Badge variant={getFreightStatusVariant(currentStatus)} className="text-[10px]">
                        {getFreightStatusLabel(currentStatus)}
                      </Badge>
                    )}
                    <Badge variant={isOnline ? "default" : "secondary"} className="text-[10px]">
                      {isOnline ? '🟢 Online' : <><WifiOff className="h-3 w-3 mr-1" /> Offline</>}
                    </Badge>
                  </div>
                </DialogDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-2">
          <div className="space-y-4 pb-4">
            {/* Localização */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-primary" />
                  Localização Atual
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {hasLocation ? (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Coordenadas:</span>
                      <span className="font-mono text-xs">
                        {lat.toFixed(6)}, {lng.toFixed(6)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Atualização:</span>
                      <span>
                        {isOnline 
                          ? `Há ${formatSecondsAgo(secondsAgo)}`
                          : `Última há ${formatSecondsAgo(secondsAgo)}`
                        }
                      </span>
                    </div>

                    <Button 
                      onClick={openInGoogleMaps}
                      className="w-full"
                      variant="outline"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Abrir no Google Maps
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-4">
                    <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Localização não disponível
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      O motorista ainda não compartilhou sua posição
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Histórico de Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <History className="h-4 w-4 text-primary" />
                  Histórico do Frete
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : statusHistory.length > 0 ? (
                  <div className="relative">
                    {/* Timeline line */}
                    <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
                    
                    <div className="space-y-3">
                      {statusHistory.map((item, index) => (
                        <div key={item.id} className="relative flex items-start gap-3 pl-1">
                          {/* Timeline dot */}
                          <div className={cn(
                            "relative z-10 h-6 w-6 rounded-full flex items-center justify-center",
                            index === 0 
                              ? "bg-primary text-primary-foreground" 
                              : "bg-muted border border-border"
                          )}>
                            <Clock className="h-3 w-3" />
                          </div>
                          
                          <div className="flex-1 min-w-0 pb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge 
                                variant={index === 0 ? getFreightStatusVariant(item.status) : "outline"}
                                className="text-[10px]"
                              >
                                {getFreightStatusLabel(item.status)}
                              </Badge>
                            </div>
                            
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(item.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                            
                            {item.notes && (
                              <p className="text-xs text-muted-foreground mt-1 italic">
                                {item.notes}
                              </p>
                            )}
                            
                            {item.location_lat && item.location_lng && (
                              <Button
                                variant="link"
                                size="sm"
                                className="h-auto p-0 text-xs text-primary"
                                onClick={() => {
                                  window.open(`https://www.google.com/maps?q=${item.location_lat},${item.location_lng}`, '_blank');
                                }}
                              >
                                <MapPin className="h-3 w-3 mr-1" />
                                Ver local no mapa
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <History className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Nenhum histórico encontrado
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
