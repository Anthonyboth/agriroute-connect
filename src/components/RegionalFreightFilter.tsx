import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Filter, AlertTriangle, Navigation, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface RegionalFreightFilterProps {
  onFreightsLoaded?: (freights: any[]) => void;
  userType: 'MOTORISTA' | 'PRESTADOR_SERVICOS';
}

export const RegionalFreightFilter: React.FC<RegionalFreightFilterProps> = ({ 
  onFreightsLoaded, 
  userType 
}) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [matchedItems, setMatchedItems] = useState<any[]>([]);
  const [locationConfigured, setLocationConfigured] = useState(false);
  const [regionInfo, setRegionInfo] = useState<{
    city: string;
    state: string;
    radius: number;
  } | null>(null);

  // Verificar se localização está configurada
  useEffect(() => {
    if (profile) {
      const profileAny = profile as any;
      const hasLocation = !!(profileAny.base_lat && profileAny.base_lng && profileAny.base_city_name);
      setLocationConfigured(hasLocation);
      
      if (hasLocation) {
        setRegionInfo({
          city: profileAny.base_city_name,
          state: profileAny.base_state || '',
          radius: profileAny.service_radius_km || 100
        });
      }
    }
  }, [profile]);

  // Carregar itens filtrados por região automaticamente
  useEffect(() => {
    if (locationConfigured && profile?.id) {
      loadRegionalItems();
    }
  }, [locationConfigured, profile?.id]);

  const loadRegionalItems = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      let result;

      if (userType === 'MOTORISTA') {
        // Usar função do banco para buscar fretes no raio
        const { data, error } = await supabase
          .rpc('get_freights_in_radius', { 
            driver_profile_id: profile.id 
          });
        
        if (error) throw error;
        result = data || [];
      } else {
        // Usar função do banco para buscar service_requests no raio
        const { data, error } = await supabase
          .rpc('get_service_requests_in_radius', { 
            provider_profile_id: profile.id 
          });
        
        if (error) throw error;
        result = data || [];
      }

      setMatchedItems(result);
      onFreightsLoaded?.(result);

      if (result.length > 0) {
        toast.success(`${result.length} ${userType === 'MOTORISTA' ? 'fretes' : 'solicitações'} encontrados na sua região`);
      } else {
        toast.info(`Nenhum ${userType === 'MOTORISTA' ? 'frete' : 'serviço'} disponível na sua região no momento`);
      }
    } catch (error) {
      console.error('Error loading regional items:', error);
      toast.error('Erro ao carregar solicitações regionais');
      setMatchedItems([]);
      onFreightsLoaded?.([]);
    } finally {
      setLoading(false);
    }
  };

  if (!locationConfigured) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <AlertTriangle className="h-5 w-5" />
            Configuração de Região Necessária
          </CardTitle>
          <CardDescription className="text-orange-700">
            Para visualizar {userType === 'MOTORISTA' ? 'fretes' : 'solicitações de serviços'} da sua região, 
            configure sua localização base e raio de atendimento.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="p-3 bg-white rounded border">
              <p className="text-sm text-gray-600 mb-2">
                <strong>Por que configurar?</strong>
              </p>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>• Veja apenas {userType === 'MOTORISTA' ? 'fretes' : 'serviços'} dentro do seu alcance</li>
                <li>• Evite perder tempo com solicitações distantes</li>
                <li>• Receba notificações relevantes para sua região</li>
                <li>• Sistema calcula distâncias precisas automaticamente</li>
              </ul>
            </div>
            
            <Button 
              className="w-full" 
              onClick={() => window.location.reload()} // Trigger region setup
            >
              <Navigation className="h-4 w-4 mr-2" />
              Configurar Região de Atendimento
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Filtro Regional Ativo
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadRegionalItems}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardTitle>
        <CardDescription>
          Mostrando {userType === 'MOTORISTA' ? 'fretes' : 'solicitações'} dentro do seu raio de atendimento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Informações da Região */}
          {regionInfo && (
            <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-full">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {regionInfo.city}, {regionInfo.state}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Raio: {regionInfo.radius} km
                  </p>
                </div>
              </div>
              <Badge variant="secondary">
                {matchedItems.length} {matchedItems.length === 1 ? 'item' : 'itens'}
              </Badge>
            </div>
          )}

          {/* Status do Carregamento */}
          {loading && (
            <div className="flex items-center justify-center py-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Carregando {userType === 'MOTORISTA' ? 'fretes' : 'solicitações'}...
              </div>
            </div>
          )}

          {/* Resumo dos Resultados */}
          {!loading && matchedItems.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
                <p className="text-2xl font-bold text-green-700">{matchedItems.length}</p>
                <p className="text-sm text-green-600">
                  {userType === 'MOTORISTA' ? 'Fretes' : 'Solicitações'} Disponíveis
                </p>
              </div>
              
              <div className="text-center p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-2xl font-bold text-blue-700">
                  {matchedItems.length > 0 
                    ? `${Math.round(matchedItems[0]?.distance_km || 0)}km` 
                    : '---'
                  }
                </p>
                <p className="text-sm text-blue-600">Mais Próximo</p>
              </div>
            </div>
          )}

          {/* Estado Vazio */}
          {!loading && matchedItems.length === 0 && (
            <div className="text-center py-6 space-y-2">
              <Filter className="h-8 w-8 text-muted-foreground mx-auto" />
              <p className="font-medium">Nenhum item na sua região</p>
              <p className="text-sm text-muted-foreground">
                Não há {userType === 'MOTORISTA' ? 'fretes' : 'solicitações de serviços'} disponíveis 
                dentro do seu raio de {regionInfo?.radius}km no momento.
              </p>
              
              <div className="pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={loadRegionalItems}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Verificar Novamente
                </Button>
              </div>
            </div>
          )}

          {/* Dica */}
          <div className="p-3 bg-gray-50 rounded-lg border">
            <p className="text-xs text-gray-600">
              💡 <strong>Dica:</strong> Os resultados são atualizados automaticamente e ordenados por proximidade. 
              {userType === 'MOTORISTA' 
                ? 'Fretes mais próximos aparecem primeiro.'
                : 'Solicitações mais próximas aparecem primeiro.'
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};