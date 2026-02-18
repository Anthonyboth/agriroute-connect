import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { MapPin, Navigation, Save, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { UnifiedLocationInput } from './UnifiedLocationInput';

interface DriverRegionManagerProps {
  driverId?: string;
  onSave?: () => void;
  onClose?: () => void;
}

interface RegionData {
  city: string;
  state: string;
  radius: number;
}

export const DriverRegionManager: React.FC<DriverRegionManagerProps> = ({
  driverId,
  onSave,
  onClose
}) => {
  const [currentRegion, setCurrentRegion] = useState<RegionData | null>(null);
  const [radius, setRadius] = useState([50]); // Default 50km
  const [selectedCity, setSelectedCity] = useState<{city: string, state: string} | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentLocation = useCallback(async () => {
    setIsLoading(true);
    try {
      const { getCurrentPositionSafe } = await import('@/utils/location');
      const position = await getCurrentPositionSafe();
      const { latitude, longitude } = position.coords;
      
      toast.success(`Localização capturada: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      toast.info('Por favor, selecione a cidade correspondente à sua localização');
    } catch (error) {
      console.error('Error getting location:', error);
      toast.error('Erro ao obter localização atual');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSaveRegion = async () => {
    if (!selectedCity) {
      toast.error('Selecione uma cidade primeiro');
      return;
    }

    if (!driverId) {
      toast.error('ID do motorista não encontrado');
      return;
    }

    setIsLoading(true);
    try {
      // Buscar coordenadas da cidade usando o CitySelector interno
      // Como o CitySelector já valida as cidades, vamos assumir coordenadas padrão
      // ou pedir para o usuário usar a localização atual
      
      // Por simplicidade, vamos usar coordenadas aproximadas baseadas no estado
      const stateCoordinates: Record<string, {lat: number, lng: number}> = {
        'AC': { lat: -8.77, lng: -70.55 },
        'AL': { lat: -9.71, lng: -35.73 },
        'AP': { lat: 1.41, lng: -51.77 },
        'AM': { lat: -3.07, lng: -61.66 },
        'BA': { lat: -12.96, lng: -38.51 },
        'CE': { lat: -3.71, lng: -38.54 },
        'DF': { lat: -15.83, lng: -47.86 },
        'ES': { lat: -19.19, lng: -40.34 },
        'GO': { lat: -16.64, lng: -49.31 },
        'MA': { lat: -2.55, lng: -44.30 },
        'MT': { lat: -12.64, lng: -55.42 },
        'MS': { lat: -20.51, lng: -54.54 },
        'MG': { lat: -18.10, lng: -44.38 },
        'PA': { lat: -5.53, lng: -52.29 },
        'PB': { lat: -7.06, lng: -35.55 },
        'PR': { lat: -24.89, lng: -51.55 },
        'PE': { lat: -8.28, lng: -35.07 },
        'PI': { lat: -8.28, lng: -43.68 },
        'RJ': { lat: -22.84, lng: -43.15 },
        'RN': { lat: -5.22, lng: -36.52 },
        'RS': { lat: -30.01, lng: -51.22 },
        'RO': { lat: -11.22, lng: -62.80 },
        'RR': { lat: 1.99, lng: -61.33 },
        'SC': { lat: -27.33, lng: -49.44 },
        'SP': { lat: -23.55, lng: -46.64 },
        'SE': { lat: -10.90, lng: -37.07 },
        'TO': { lat: -10.25, lng: -48.25 }
      };

      const coords = stateCoordinates[selectedCity.state] || { lat: -15.83, lng: -47.86 }; // Default to Brasília

      // Save to driver_service_areas via edge function
      const { data: saveData, error } = await supabase.functions.invoke('driver-service-areas', {
        method: 'POST',
        body: {
          city_name: selectedCity.city,
          state: selectedCity.state,
          lat: coords.lat,
          lng: coords.lng,
          radius_km: radius[0],
          is_active: true
        }
      });

      if (error) throw error;

      if (saveData?.success) {
        // Also update the profile's service_cities to sync with the Cidades tab
        const cityString = `${selectedCity.city}, ${selectedCity.state}`;
        
        // Get current service cities
        const { data: profile } = await supabase
          .from('profiles')
          .select('service_cities, current_city_name, current_state')
          .eq('id', driverId)
          .single();

        const currentServiceCities = profile?.service_cities || [];
        
        // Add the new city if it's not already in the list
        if (!currentServiceCities.includes(cityString)) {
          const updatedServiceCities = [...currentServiceCities, cityString];
          
          await supabase
            .from('profiles')
            .update({ 
              service_cities: updatedServiceCities,
              current_city_name: selectedCity.city,
              current_state: selectedCity.state 
            })
            .eq('id', driverId);
        } else {
          // Just update current city
          await supabase
            .from('profiles')
            .update({ 
              current_city_name: selectedCity.city,
              current_state: selectedCity.state 
            })
            .eq('id', driverId);
        }

        toast.success('Região de atendimento configurada com sucesso!');
        setCurrentRegion({
          city: selectedCity.city,
          state: selectedCity.state,
          radius: radius[0]
        });
        onSave?.();
      }
    } catch (error) {
      console.error('Error saving region:', error);
      toast.error('Erro ao salvar região de atendimento');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Configurar Região de Atendimento
          </CardTitle>
          <CardDescription>
            Selecione sua cidade e defina o raio de atendimento para receber fretes da sua região.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Seletor de Cidade */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Cidade de Atendimento</Label>
            <UnifiedLocationInput
              label=""
              value={selectedCity ? `${selectedCity.city}, ${selectedCity.state}` : ''}
              onChange={(value, locationData) => {
                if (locationData) {
                  setSelectedCity({ city: locationData.city, state: locationData.state });
                }
              }}
              placeholder="CEP ou nome da cidade"
            />
            <Button
              type="button"
              variant="outline"
              onClick={getCurrentLocation}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              <Navigation className="h-4 w-4 mr-2" />
              {isLoading ? 'Obtendo...' : 'Usar Localização Atual'}
            </Button>
          </div>

          {/* Slider de Raio */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Raio de Atendimento</Label>
              <Badge variant="secondary" className="text-lg font-semibold px-3 py-1">
                {radius[0]} km
              </Badge>
            </div>
            
            <div className="px-2">
              <Slider
                value={radius}
                onValueChange={setRadius}
                max={200}
                min={10}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>10 km</span>
                <span>50 km</span>
                <span>100 km</span>
                <span>200 km</span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Você receberá fretes num raio de <strong>{radius[0]} km</strong> a partir de <strong>{selectedCity?.city || 'sua cidade'}</strong>.
            </p>
          </div>

          {/* Região Atual */}
          {currentRegion && (
            <div className="p-4 border rounded-lg bg-muted/30">
              <h4 className="font-medium mb-2">Região Configurada</h4>
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{currentRegion.city}, {currentRegion.state}</span>
                <Badge variant="outline">{currentRegion.radius} km</Badge>
              </div>
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-3 pt-4 border-t">
            {onClose && (
              <Button variant="outline" onClick={onClose} className="flex-1">
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
            <Button 
              onClick={handleSaveRegion} 
              disabled={!selectedCity || isLoading}
              className="flex-1"
            >
              {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Região
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Informações Adicionais */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-2">
              <h4 className="font-semibold text-primary">Como Funciona</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Selecione sua cidade principal de operação</li>
                <li>• Ajuste o raio para definir até onde você atende</li>
                <li>• Você receberá apenas fretes dentro desta área</li>
                <li>• Pode alterar a qualquer momento</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};