import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Play, Pause, SkipBack, SkipForward, 
  MapPin, Clock, Navigation, Gauge, 
  Calendar, Route as RouteIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';

interface LocationPoint {
  id: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  captured_at: string;
}

interface RouteReplayPanelProps {
  freightId: string;
  driverProfileId?: string;
}

export const RouteReplayPanel: React.FC<RouteReplayPanelProps> = ({
  freightId,
  driverProfileId
}) => {
  const [locationHistory, setLocationHistory] = useState<LocationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLocationHistory = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('driver_location_history')
        .select('id, lat, lng, speed, heading, accuracy, captured_at')
        .eq('freight_id', freightId)
        .order('captured_at', { ascending: true });

      if (error) throw error;
      setLocationHistory(data || []);
    } catch (error) {
      console.error('[RouteReplayPanel] Erro ao carregar histórico:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocationHistory();
    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [freightId]);

  // Playback control
  useEffect(() => {
    if (isPlaying && locationHistory.length > 0) {
      playIntervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          if (prev >= locationHistory.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, playbackSpeed, locationHistory.length]);

  const currentPoint = locationHistory[currentIndex];

  const stats = useMemo(() => {
    if (locationHistory.length === 0) return null;

    const firstPoint = locationHistory[0];
    const lastPoint = locationHistory[locationHistory.length - 1];
    const startTime = new Date(firstPoint.captured_at);
    const endTime = new Date(lastPoint.captured_at);
    const durationMs = endTime.getTime() - startTime.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    // Calculate total distance using Haversine formula
    let totalDistance = 0;
    for (let i = 1; i < locationHistory.length; i++) {
      const prev = locationHistory[i - 1];
      const curr = locationHistory[i];
      totalDistance += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    }

    const avgSpeed = locationHistory.reduce((sum, p) => sum + (p.speed || 0), 0) / locationHistory.length;
    const maxSpeed = Math.max(...locationHistory.map(p => p.speed || 0));

    return {
      totalPoints: locationHistory.length,
      totalDistance: totalDistance.toFixed(1),
      durationHours: durationHours.toFixed(1),
      avgSpeed: avgSpeed.toFixed(0),
      maxSpeed: maxSpeed.toFixed(0),
      startTime,
      endTime
    };
  }, [locationHistory]);

  const haversineDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleSliderChange = (value: number[]) => {
    setCurrentIndex(value[0]);
  };

  const handlePlayPause = () => {
    if (currentIndex >= locationHistory.length - 1) {
      setCurrentIndex(0);
    }
    setIsPlaying(!isPlaying);
  };

  const handleSkipBack = () => {
    setCurrentIndex(0);
    setIsPlaying(false);
  };

  const handleSkipForward = () => {
    setCurrentIndex(locationHistory.length - 1);
    setIsPlaying(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RouteIcon className="h-5 w-5" />
            Histórico de Rota
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (locationHistory.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RouteIcon className="h-5 w-5" />
            Histórico de Rota
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Navigation className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum ponto GPS registrado ainda</p>
            <p className="text-sm mt-2">
              O histórico será exibido quando o motorista iniciar o rastreamento
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <RouteIcon className="h-5 w-5" />
            Histórico de Rota (Replay)
          </span>
          <Badge variant="secondary">
            {locationHistory.length} pontos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Stats Summary */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-muted-foreground text-xs mb-1">Distância</div>
              <div className="font-semibold">{stats.totalDistance} km</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-muted-foreground text-xs mb-1">Duração</div>
              <div className="font-semibold">{stats.durationHours}h</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-muted-foreground text-xs mb-1">Vel. Média</div>
              <div className="font-semibold">{stats.avgSpeed} km/h</div>
            </div>
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="text-muted-foreground text-xs mb-1">Vel. Máx</div>
              <div className="font-semibold">{stats.maxSpeed} km/h</div>
            </div>
          </div>
        )}

        {/* Current Point Info */}
        {currentPoint && (
          <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                Ponto {currentIndex + 1} de {locationHistory.length}
              </span>
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                {format(new Date(currentPoint.captured_at), "HH:mm:ss", { locale: ptBR })}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{currentPoint.lat.toFixed(6)}, {currentPoint.lng.toFixed(6)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-muted-foreground" />
                <span>{currentPoint.speed?.toFixed(0) || 0} km/h</span>
              </div>
              {currentPoint.accuracy && (
                <div className="flex items-center gap-2 col-span-2">
                  <span className="text-muted-foreground">Precisão:</span>
                  <span>{currentPoint.accuracy.toFixed(0)}m</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Timeline Slider */}
        <div className="space-y-2">
          <Slider
            value={[currentIndex]}
            min={0}
            max={locationHistory.length - 1}
            step={1}
            onValueChange={handleSliderChange}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            {stats && (
              <>
                <span>{format(stats.startTime, "dd/MM HH:mm", { locale: ptBR })}</span>
                <span>{format(stats.endTime, "dd/MM HH:mm", { locale: ptBR })}</span>
              </>
            )}
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleSkipBack}
            disabled={currentIndex === 0}
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="default"
            size="icon"
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleSkipForward}
            disabled={currentIndex >= locationHistory.length - 1}
          >
            <SkipForward className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-muted-foreground">Velocidade:</span>
            {[1, 2, 5].map(speed => (
              <Button
                key={speed}
                variant={playbackSpeed === speed ? "default" : "outline"}
                size="sm"
                onClick={() => setPlaybackSpeed(speed)}
                className="h-7 px-2"
              >
                {speed}x
              </Button>
            ))}
          </div>
        </div>

        {/* Timeline List */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-3">Timeline de Eventos</h4>
          <ScrollArea className="h-48">
            <div className="space-y-2">
              {locationHistory.map((point, index) => (
                <button
                  key={point.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`w-full text-left p-2 rounded-lg transition-colors text-sm ${
                    index === currentIndex 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {format(new Date(point.captured_at), "HH:mm:ss", { locale: ptBR })}
                    </span>
                    <span className={index === currentIndex ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                      {point.speed?.toFixed(0) || 0} km/h
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};
