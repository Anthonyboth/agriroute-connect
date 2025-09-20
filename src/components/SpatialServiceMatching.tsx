import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Target, MapPin, Clock, Wrench, Navigation, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ServiceMatch {
  provider_id: string;
  provider_area_id: string;
  match_type: string;
  distance_m: number;
  match_score: number;
  service_compatibility_score: number;
  provider_name?: string;
  city_name?: string;
  radius_km?: number;
  service_types?: string[];
  notified_at?: string;
}

interface MatchingRequest {
  service_request_id?: string;
  guest_request_id?: string;
  request_lat: number;
  request_lng: number;
  service_type?: string;
  notify_providers?: boolean;
}

interface SpatialServiceMatchingProps {
  requestId?: string;
  requestType?: 'service_request' | 'guest_request';
  requestLat?: number;
  requestLng?: number;
  requestServiceType?: string;
  onMatchComplete?: (matches: ServiceMatch[]) => void;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  GUINCHO: 'Guincho',
  BORRACHARIA: 'Borracharia',
  MECANICA: 'Mecânica',
  ELETRICA: 'Elétrica',
  REBOQUE: 'Reboque',
  COMBUSTIVEL: 'Combustível',
  CHAVEIRO: 'Chaveiro',
  LIMPEZA: 'Limpeza',
  OUTROS: 'Outros'
};

const SpatialServiceMatching: React.FC<SpatialServiceMatchingProps> = ({
  requestId,
  requestType = 'service_request',
  requestLat,
  requestLng,
  requestServiceType,
  onMatchComplete
}) => {
  const [matches, setMatches] = useState<ServiceMatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [matchingInProgress, setMatchingInProgress] = useState(false);
  
  // Manual matching inputs
  const [manualLocation, setManualLocation] = useState({
    lat: requestLat || 0,
    lng: requestLng || 0,
    service_type: requestServiceType || ''
  });

  const executeMatching = async (notifyProviders = true, useManualLocation = false) => {
    try {
      setMatchingInProgress(true);
      setLoading(true);

      const matchingData: MatchingRequest = useManualLocation 
        ? {
            request_lat: manualLocation.lat,
            request_lng: manualLocation.lng,
            service_type: manualLocation.service_type || undefined
          }
        : {
            [requestType === 'service_request' ? 'service_request_id' : 'guest_request_id']: requestId,
            request_lat: requestLat!,
            request_lng: requestLng!,
            service_type: requestServiceType
          };

      matchingData.notify_providers = notifyProviders;

      const { data, error } = await supabase.functions.invoke('service-provider-spatial-matching', {
        method: 'POST',
        body: matchingData
      });

      if (error) throw error;

      if (data?.success) {
        setMatches(data.matches || []);
        toast.success(
          `Matching concluído! ${data.matches_found} prestadores encontrados${
            notifyProviders ? `, ${data.notifications_sent} notificados` : ''
          }`
        );
        
        if (onMatchComplete) {
          onMatchComplete(data.matches || []);
        }
      } else {
        throw new Error('Resposta inválida do servidor');
      }
    } catch (error) {
      console.error('Error executing spatial service matching:', error);
      toast.error('Erro ao executar matching espacial');
    } finally {
      setLoading(false);
      setMatchingInProgress(false);
    }
  };

  const fetchExistingMatches = async () => {
    if (!requestId) return;

    try {
      setLoading(true);

      const params = requestType === 'service_request' 
        ? { service_request_id: requestId }
        : { guest_request_id: requestId };

      const { data, error } = await supabase.functions.invoke('service-provider-spatial-matching', {
        method: 'GET',
        body: params
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
    if (requestId && requestLat && requestLng) {
      fetchExistingMatches();
    }
  }, [requestId, requestLat, requestLng]);

  const getMatchTypeIcon = (matchType: string) => {
    switch (matchType) {
      case 'LOCATION':
        return <MapPin className="h-4 w-4" />;
      case 'SERVICE_TYPE':
        return <Wrench className="h-4 w-4" />;
      case 'BOTH':
        return <Target className="h-4 w-4" />;
      default:
        return <Target className="h-4 w-4" />;
    }
  };

  const getMatchTypeLabel = (matchType: string) => {
    switch (matchType) {
      case 'LOCATION':
        return 'Por Localização';
      case 'SERVICE_TYPE':
        return 'Por Serviço';
      case 'BOTH':
        return 'Localização + Serviço';
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

  const getServiceCompatibilityColor = (score: number) => {
    if (score >= 1.0) return 'bg-blue-500';
    if (score >= 0.7) return 'bg-purple-500';
    return 'bg-gray-500';
  };

  const canExecuteMatching = requestId && requestLat && requestLng;
  const canExecuteManualMatching = manualLocation.lat && manualLocation.lng;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Matching Espacial de Prestadores
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Sistema de matching por proximidade geográfica e tipo de serviço
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {canExecuteMatching && (
            <div>
              <h4 className="font-medium mb-2">Matching Automático</h4>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button
                  onClick={() => executeMatching(true)}
                  disabled={loading || matchingInProgress}
                  className="flex-1"
                >
                  {matchingInProgress ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
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
            </div>
          )}

          <div>
            <h4 className="font-medium mb-2">Matching Manual</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <Label htmlFor="manual_lat">Latitude</Label>
                <Input
                  id="manual_lat"
                  type="number"
                  step="any"
                  value={manualLocation.lat}
                  onChange={(e) => setManualLocation(prev => ({ 
                    ...prev, 
                    lat: parseFloat(e.target.value) || 0 
                  }))}
                  placeholder="Ex: -15.556"
                />
              </div>
              <div>
                <Label htmlFor="manual_lng">Longitude</Label>
                <Input
                  id="manual_lng"
                  type="number"
                  step="any"
                  value={manualLocation.lng}
                  onChange={(e) => setManualLocation(prev => ({ 
                    ...prev, 
                    lng: parseFloat(e.target.value) || 0 
                  }))}
                  placeholder="Ex: -54.296"
                />
              </div>
              <div>
                <Label htmlFor="manual_service">Tipo de Serviço</Label>
                <Input
                  id="manual_service"
                  value={manualLocation.service_type}
                  onChange={(e) => setManualLocation(prev => ({ 
                    ...prev, 
                    service_type: e.target.value 
                  }))}
                  placeholder="Ex: GUINCHO"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => executeMatching(true, true)}
                disabled={!canExecuteManualMatching || loading || matchingInProgress}
                variant="outline"
              >
                <Target className="h-4 w-4 mr-2" />
                Matching Manual + Notificar
              </Button>
              <Button
                onClick={() => executeMatching(false, true)}
                disabled={!canExecuteManualMatching || loading || matchingInProgress}
                variant="outline"
              >
                Apenas Matching Manual
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Prestadores Compatíveis ({matches.length})
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {matches.map((match, index) => (
                <div
                  key={`${match.provider_id}-${match.provider_area_id}`}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium">
                        {match.provider_name || `Prestador ${index + 1}`}
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
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
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
                    
                    {match.service_types && match.service_types.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {match.service_types.map((type) => (
                          <Badge key={type} variant="outline" className="text-xs">
                            {SERVICE_TYPE_LABELS[type] || type}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        Proximidade: {(match.match_score * 100).toFixed(0)}%
                      </div>
                      <div className="flex items-center gap-2 mt-1 mb-1">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getMatchScoreColor(match.match_score)} transition-all duration-300`}
                            style={{ width: `${match.match_score * 100}%` }}
                          />
                        </div>
                      </div>
                      <div className="text-sm font-medium">
                        Compatibilidade: {(match.service_compatibility_score * 100).toFixed(0)}%
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getServiceCompatibilityColor(match.service_compatibility_score)} transition-all duration-300`}
                            style={{ width: `${match.service_compatibility_score * 100}%` }}
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
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">
              Nenhum prestador compatível encontrado
            </p>
            <p className="text-sm text-muted-foreground">
              Execute o matching para encontrar prestadores na região da solicitação
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SpatialServiceMatching;