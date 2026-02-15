import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Target, MapPin, Clock, Truck, Navigation } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface FreightMatch {
  driver_id: string;
  driver_area_id: string;
  match_type: string;
  distance_m: number;
  match_score: number;
  driver_name?: string;
  city_name?: string;
  radius_km?: number;
  notified_at?: string;
}

interface SpatialFreightMatchingProps {
  freightId: string;
  onMatchComplete?: (matches: FreightMatch[]) => void;
}

const SpatialFreightMatching: React.FC<SpatialFreightMatchingProps> = ({
  freightId,
  onMatchComplete
}) => {
  const [matches, setMatches] = useState<FreightMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchingInProgress, setMatchingInProgress] = useState(false);

  const executeMatching = async (notifyDrivers = true) => {
    try {
      setMatchingInProgress(true);
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('spatial-freight-matching', {
        method: 'POST',
        body: {
          freight_id: freightId,
          notify_drivers: notifyDrivers
        }
      });

      if (error) throw error;

      if (data?.success) {
        setMatches(data.matches || []);
        toast.success(
          `Matching concluído! ${data.matches_found} motoristas encontrados${
            notifyDrivers ? `, ${data.notifications_sent} notificados` : ''
          }`
        );
        
        if (onMatchComplete) {
          onMatchComplete(data.matches || []);
        }
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error) {
      console.error('Error executing spatial matching:', error);
      toast.error('Erro ao executar matching espacial');
    } finally {
      setLoading(false);
      setMatchingInProgress(false);
    }
  };

  const fetchExistingMatches = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.functions.invoke('spatial-freight-matching', {
        method: 'GET',
        body: { freight_id: freightId }
      });

      if (error) throw error;

      if (data?.success) {
        setMatches(data.matches || []);
      }
    } catch (error) {
      console.error('Error fetching existing matches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (freightId) {
      fetchExistingMatches();
    }
  }, [freightId]);

  const getMatchTypeIcon = (matchType: string) => {
    switch (matchType) {
      case 'ORIGIN':
        return <MapPin className="h-4 w-4" />;
      case 'ROUTE':
        return <Navigation className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case 'ORIGIN':
        return 'Origem';
      case 'ROUTE':
        return 'Rota';
      default:
        return matchType;
    }
  };

  const formatDistance = (distanceM: number) => {
    if (distanceM < 1000) {
      return `${Math.round(distanceM)}m`;
    }
    return `${(distanceM / 1000).toFixed(1)}km`;
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.6) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Matching Espacial Inteligente
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sistema de matching por proximidade geográfica usando PostGIS
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={() => executeMatching(true)}
              disabled={loading || matchingInProgress}
              className="flex-1"
            >
              {matchingInProgress ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Executando Matching...
                </>
              ) : (
                <>
                  <Target className="h-4 w-4 mr-2" />
                  Executar Matching + Notificar
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => executeMatching(false)}
              disabled={loading || matchingInProgress}
            >
              <Target className="h-4 w-4 mr-2" />
              Apenas Matching
            </Button>

            <Button
              variant="secondary"
              onClick={fetchExistingMatches}
              disabled={loading}
            >
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Motoristas Compatíveis ({matches.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {matches.map((match, index) => (
                <div
                  key={`${match.driver_id}-${match.driver_area_id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">
                        {match.driver_name || `Motorista ${index + 1}`}
                      </h3>
                      <Badge variant="outline" className="flex items-center gap-1">
                        {getMatchTypeIcon(match.match_type)}
                        {getMatchTypeLabel(match.match_type)}
                      </Badge>
                      {match.notified_at && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Notificado
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {match.city_name || 'Cidade não informada'}
                      </span>
                      <span>
                        Distância: {formatDistance(match.distance_m)}
                      </span>
                      {match.radius_km && (
                        <span>
                          Raio: {match.radius_km}km
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        Score: {(match.match_score * 100).toFixed(0)}%
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getMatchScoreColor(match.match_score)} transition-all duration-300`}
                            style={{ width: `${match.match_score * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && matches.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum motorista compatível encontrado
            </p>
            <p className="text-sm text-muted-foreground">
              Execute o matching para encontrar motoristas na região do frete
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SpatialFreightMatching;